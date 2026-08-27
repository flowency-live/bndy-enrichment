import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { readFile, writeFile } from 'node:fs/promises';

const REQUIRED_ENV = ['STATE_TABLE', 'SOURCE_QUEUE_URL', 'STATUS_FILE'];
for (const name of REQUIRED_ENV) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const tableName = process.env.STATE_TABLE;
const queueUrl = process.env.SOURCE_QUEUE_URL;
const statusFile = process.env.STATUS_FILE;
const deploymentStatusFile = process.env.DEPLOYMENT_STATUS_FILE
  ?? 'ops/lemonrock-low-cost-operating-status.json';
const runtimeCutoversFile = process.env.RUNTIME_CUTOVERS_FILE
  ?? 'ops/lemonrock-runtime-cutovers.json';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const sqs = new SQSClient({});

async function updateStatus(patch) {
  const current = JSON.parse(await readFile(statusFile, 'utf8'));
  await writeFile(statusFile, `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`);
}

async function queryTasks() {
  const rows = [];
  let ExclusiveStartKey;
  do {
    const response = await ddb.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': 'BOOTSTRAP#lemonrock',
        ':prefix': 'TASK#',
      },
      ProjectionExpression: 'pk, sk, sourceId, taskKind, taskKey, logicalTaskKey, task, #status, attemptCount, reconciliationId, lastReconciliationId, completedAt, failedAt, updatedAt, venueFanoutRecoveryAt, targetedFailureRecoveryAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExclusiveStartKey,
    }));
    rows.push(...(response.Items ?? []));
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return rows;
}

function recoveryCandidates(rows, reconciliationId, venueFanoutCutoverAt) {
  const currentByIdentity = new Map();
  for (const row of rows) {
    if (row.lastReconciliationId !== reconciliationId || row.task?.auditRun !== true) continue;
    const identity = `${row.sourceId}:${row.task?.nativeId ?? row.logicalTaskKey ?? row.taskKey ?? row.sk}`;
    const previous = currentByIdentity.get(identity);
    if (!previous || String(row.updatedAt ?? '') > String(previous.updatedAt ?? '')) {
      currentByIdentity.set(identity, row);
    }
  }

  return [...currentByIdentity.values()].flatMap((row) => {
    if (!row.pk || !row.sk || !row.sourceId || !row.taskKey || !row.task) return [];

    if (
      row.sourceId === 'lemonrock-gig-hydration'
      && row.taskKind === 'gig'
      && row.status === 'completed'
      && !row.venueFanoutRecoveryAt
      && typeof row.completedAt === 'string'
      && row.completedAt < venueFanoutCutoverAt
    ) {
      return [{ row, mode: 'venue-fanout-gap' }];
    }

    if (
      row.status === 'failed'
      && Number(row.attemptCount ?? 1) < 3
      && (
        !row.targetedFailureRecoveryAt
        || (typeof row.failedAt === 'string' && row.targetedFailureRecoveryAt < row.failedAt)
      )
    ) {
      return [{ row, mode: 'failed-logical-task' }];
    }
    return [];
  });
}

async function queueCandidate(candidate, reconciliationId, requestedAt) {
  const { row, mode } = candidate;
  const marker = mode === 'venue-fanout-gap' ? 'venueFanoutRecoveryAt' : 'targetedFailureRecoveryAt';
  const expectedStatus = mode === 'venue-fanout-gap' ? 'completed' : 'failed';
  const values = {
    ':queued': 'queued',
    ':expected': expectedStatus,
    ':at': requestedAt,
    ':reconciliationId': reconciliationId,
    ':one': 1,
  };
  const condition = mode === 'venue-fanout-gap'
    ? '#status = :expected AND attribute_not_exists(venueFanoutRecoveryAt) AND lastReconciliationId = :reconciliationId'
    : '#status = :expected AND (attribute_not_exists(targetedFailureRecoveryAt) OR (attribute_exists(failedAt) AND targetedFailureRecoveryAt < failedAt)) AND lastReconciliationId = :reconciliationId AND (attribute_not_exists(attemptCount) OR attemptCount < :maxAttempts)';
  if (mode === 'failed-logical-task') values[':maxAttempts'] = 3;

  try {
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: { pk: row.pk, sk: row.sk },
      UpdateExpression: `SET #status = :queued, queuedAt = :at, updatedAt = :at, lastDiscoveredAt = :at, ${marker} = :at, reconciliationId = :reconciliationId, lastReconciliationId = :reconciliationId REMOVE completedAt, failedAt, lastError, startedAt ADD attemptCount :one`,
      ConditionExpression: condition,
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: values,
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') return 'skipped';
    throw error;
  }

  try {
    await sqs.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        sourceId: row.sourceId,
        reason: 'manual',
        requestedAt,
        reconciliationId,
        taskKey: row.taskKey,
        task: row.task,
      }),
    }));
    return 'queued';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SQS send failure';
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: { pk: row.pk, sk: row.sk },
      UpdateExpression: `SET #status = :failed, failedAt = :at, updatedAt = :at, lastError = :error REMOVE ${marker}`,
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':failed': 'failed', ':at': requestedAt, ':error': `Targeted recovery send failed: ${message}` },
    }));
    return 'send-failed';
  }
}

async function main() {
  const deployment = JSON.parse(await readFile(deploymentStatusFile, 'utf8'));
  if (deployment.status !== 'deployed' || deployment.shadow !== true || deployment.canonicalWritesEnabled !== false) {
    throw new Error('Verified shadow-only low-cost deployment is required');
  }
  if (typeof deployment.verifiedAt !== 'string' || !deployment.verifiedAt) {
    throw new Error('Low-cost deployment verification time is required');
  }
  const runtimeCutovers = JSON.parse(await readFile(runtimeCutoversFile, 'utf8'));
  const venueFanoutCutoverAt = runtimeCutovers.venueFanout?.verifiedAt;
  if (typeof venueFanoutCutoverAt !== 'string' || !Number.isFinite(Date.parse(venueFanoutCutoverAt))) {
    throw new Error('Stable Venue fanout cutover time is required');
  }

  const root = await ddb.send(new GetCommand({
    TableName: tableName,
    Key: { pk: 'SOURCE#lemonrock-full-reconcile', sk: 'STATE' },
    ProjectionExpression: 'metadata',
  }));
  const reconciliationId = root.Item?.metadata?.lastReconciliationId;
  if (typeof reconciliationId !== 'string' || !reconciliationId.startsWith('run-')) {
    throw new Error('Owned Lemonrock reconciliation ID is unavailable');
  }

  const rows = await queryTasks();
  const candidates = recoveryCandidates(rows, reconciliationId, venueFanoutCutoverAt);
  const byMode = Object.fromEntries(
    ['venue-fanout-gap', 'failed-logical-task'].map((mode) => [mode, candidates.filter((x) => x.mode === mode).length]),
  );
  await updateStatus({
    phase: 'queueing',
    reconciliationId,
    deploymentVerifiedAt: deployment.verifiedAt,
    venueFanoutCutoverAt,
    candidateCounts: byMode,
    boundedToExistingReconciliation: true,
    launchesNationalReconciliation: false,
    automaticDeadLetterRedrive: false,
  });

  const requestedAt = new Date().toISOString();
  const results = { queued: 0, skipped: 0, sendFailed: 0 };
  const failuresBySourceAndKind = {};
  for (const candidate of candidates) {
    const result = await queueCandidate(candidate, reconciliationId, requestedAt);
    if (result === 'send-failed') results.sendFailed += 1;
    else results[result] += 1;
    if (candidate.mode === 'failed-logical-task' && result === 'queued') {
      const key = `${candidate.row.sourceId}:${candidate.row.taskKind ?? candidate.row.task?.kind ?? 'unknown'}`;
      failuresBySourceAndKind[key] = (failuresBySourceAndKind[key] ?? 0) + 1;
    }
  }

  await updateStatus({
    phase: 'queued',
    status: results.sendFailed > 0 ? 'partial' : 'recovery-started',
    queuedAt: requestedAt,
    recovered: results,
    recoveredFailuresBySourceAndKind: failuresBySourceAndKind,
  });
  if (results.sendFailed > 0) throw new Error(`${results.sendFailed} targeted recovery messages could not be sent`);
}

await main();
