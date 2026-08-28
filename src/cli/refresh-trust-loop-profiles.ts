import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CandidateStore } from '../knowledge/stores/candidate-store.js';

type SourceTask = {
  sourceId?: string;
  status?: string;
  logicalTaskKey?: string;
  taskKey?: string;
  sourceUrl?: string;
  completedAt?: string;
  task?: Record<string, unknown>;
};

const tableName = process.env.STATE_TABLE;
const queueUrl = process.env.SOURCE_SCAN_QUEUE_URL;
if (!tableName || !queueUrl) throw new Error('STATE_TABLE and SOURCE_SCAN_QUEUE_URL are required');
const region = process.env.AWS_REGION ?? 'eu-west-2';
const sampleSize = Math.min(Math.max(Number(process.env.TRUST_LOOP_PROFILE_SAMPLE_PER_SOURCE ?? 10), 5), 20);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const sqs = new SQSClient({ region });

async function familyTasks(family: string): Promise<SourceTask[]> {
  const rows: SourceTask[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await ddb.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': `BOOTSTRAP#${family}`, ':prefix': 'TASK#' },
      ProjectionExpression: 'sourceId, #status, logicalTaskKey, taskKey, sourceUrl, completedAt, task',
      ExpressionAttributeNames: { '#status': 'status' },
      ExclusiveStartKey,
    }));
    rows.push(...(page.Items ?? []) as SourceTask[]);
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return rows;
}

export function selectProfileTasks(rows: SourceTask[], sourceId: string, limit: number): SourceTask[] {
  const newest = [...rows]
    .filter((row) => row.sourceId === sourceId && row.status === 'completed' && row.task)
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''));
  const selected = new Map<string, SourceTask>();
  for (const row of newest) {
    const key = row.logicalTaskKey ?? row.sourceUrl ?? row.taskKey;
    if (!key || selected.has(key)) continue;
    selected.set(key, row);
    if (selected.size === limit) break;
  }
  return [...selected.values()];
}

async function send(sourceId: string, tasks: SourceTask[], requestedAt: string): Promise<void> {
  for (let offset = 0; offset < tasks.length; offset += 10) {
    const group = tasks.slice(offset, offset + 10);
    const result = await sqs.send(new SendMessageBatchCommand({
      QueueUrl: queueUrl,
      Entries: group.map((row, index) => ({
        Id: `${offset + index}`,
        MessageBody: JSON.stringify({ sourceId, reason: 'manual', requestedAt, task: row.task }),
      })),
    }));
    if (result.Failed?.length) throw new Error(`${sourceId} profile refresh left ${result.Failed.length} failed sends`);
  }
}

const requestedAt = new Date().toISOString();
const definitions = [
  { family: 'lemonrock', sourceId: 'lemonrock-artist-hydration' },
  { family: 'onthecase', sourceId: 'onthecase-band-hydration' },
] as const;
const selected = new Map<string, SourceTask[]>();
for (const definition of definitions) {
  const tasks = selectProfileTasks(await familyTasks(definition.family), definition.sourceId, sampleSize);
  if (tasks.length < 5) throw new Error(`${definition.sourceId} has only ${tasks.length} reusable completed profile tasks`);
  selected.set(definition.sourceId, tasks);
  await send(definition.sourceId, tasks, requestedAt);
}

const candidates = new CandidateStore(tableName);
const deadline = Date.now() + 15 * 60_000;
while (Date.now() < deadline) {
  const counts = Object.fromEntries(await Promise.all(definitions.map(async ({ sourceId }) => [
    sourceId,
    (await candidates.listBySourceType(sourceId, 'artist', 100))
      .filter((candidate) => candidate.observedAt >= requestedAt).length,
  ])));
  if (definitions.every(({ sourceId }) => counts[sourceId] >= (selected.get(sourceId)?.length ?? 0))) {
    console.log(JSON.stringify({ status: 'complete', requestedAt, selected: Object.fromEntries(
      definitions.map(({ sourceId }) => [sourceId, selected.get(sourceId)?.length ?? 0]),
    ), indexed: counts, canonicalWrites: 0 }));
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
throw new Error('Profile evidence refresh did not reach the candidate index inside 15 minutes');
