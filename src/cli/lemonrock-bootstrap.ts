import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';
import { LEMONROCK_SOURCES } from '../sources/adapters/lemonrock/sources.js';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] ?? 'discovery';
if (!['discovery', 'hydrate', 'recheck'].includes(modeArg)) {
  throw new Error(`Unsupported --mode=${modeArg}; use discovery, hydrate or recheck`);
}

const tableName = process.env.STATE_TABLE;
const queueUrl = process.env.SOURCE_SCAN_QUEUE_URL;
if (!tableName) throw new Error('STATE_TABLE is required');
if (!queueUrl) throw new Error('SOURCE_SCAN_QUEUE_URL is required');

const registry = new SourceRegistryStore(tableName);
const sqs = new SQSClient({});
const now = new Date().toISOString();
const token = now.replace(/[:.]/g, '-');

for (const source of LEMONROCK_SOURCES) await registry.put(source);

const roots = modeArg === 'recheck'
  ? [
      ['lemonrock-new-gigs', 'new-gigs'],
      ['lemonrock-cancellations', 'cancellations'],
      ['lemonrock-future-reconcile', 'future-index'],
    ] as const
  : [
      ['lemonrock-artist-index', 'artist-index'],
      ['lemonrock-venue-index', 'venue-index'],
      ['lemonrock-future-reconcile', 'future-index'],
      ['lemonrock-new-gigs', 'new-gigs'],
      ['lemonrock-cancellations', 'cancellations'],
    ] as const;

for (const [sourceId, kind] of roots) {
  const source = LEMONROCK_SOURCES.find((item) => item.id === sourceId);
  if (!source?.url) throw new Error(`No bootstrap URL for ${sourceId}`);
  const taskKey = `root:${modeArg}:${sourceId}:${token}`;
  await sqs.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify({
      sourceId,
      reason: 'manual',
      requestedAt: now,
      taskKey,
      task: { kind, url: source.url, bootstrapMode: modeArg, bootstrapToken: token },
    }),
  }));
  console.log(`queued ${sourceId} (${kind})`);
}

console.log(JSON.stringify({
  mode: modeArg,
  sourcesSeeded: LEMONROCK_SOURCES.length,
  rootsQueued: roots.length,
  requestedAt: now,
  shadow: true,
}));
