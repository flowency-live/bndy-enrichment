import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';
import { ONTHECASE_SOURCES } from '../sources/adapters/onthecase/sources.js';

// Explicit bootstrap/audit can include directories; steady state never does.
const mode = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] ?? 'gig-led';
if (!['gig-led', 'inventory-audit'].includes(mode)) throw new Error(`Unsupported --mode=${mode}`);
const table = process.env.STATE_TABLE;
const queue = process.env.SOURCE_SCAN_QUEUE_URL;
if (!table || !queue) throw new Error('STATE_TABLE and SOURCE_SCAN_QUEUE_URL are required');

const registry = new SourceRegistryStore(table);
for (const source of ONTHECASE_SOURCES) {
  // Production shadow activation enables only the scheduled gig root. Directory
  // and profile sources remain disabled as scheduler roots; child tasks can still
  // address them explicitly through the durable source queue.
  await registry.put(source.id === 'onthecase-gig-index' ? { ...source, enabled: true } : source);
}

const roots: Array<[string, string, string]> = mode === 'inventory-audit'
  ? [
      ['onthecase-gig-index', 'gig-index', 'https://onthecasemusic.co.uk/gigs'],
      ['onthecase-band-index', 'band-index', 'https://onthecasemusic.co.uk/bands'],
      ['onthecase-venue-index', 'venue-index', 'https://onthecasemusic.co.uk/venues'],
    ]
  : [['onthecase-gig-index', 'gig-index', 'https://onthecasemusic.co.uk/gigs']];

const sqs = new SQSClient({});
const now = new Date().toISOString();
const token = now.replace(/[:.]/g, '-');
const reconciliationId = `onthecase-${mode}-${token}`;
for (const [sourceId, kind, url] of roots) {
  await sqs.send(new SendMessageCommand({
    QueueUrl: queue,
    MessageBody: JSON.stringify({
      sourceId,
      reason: 'manual',
      requestedAt: now,
      reconciliationId,
      taskKey: `root:${mode}:${sourceId}:${token}`,
      task: { kind, url, bootstrapMode: mode, bootstrapToken: token },
    }),
  }));
}
console.log(JSON.stringify({ mode, reconciliationId, sourcesSeeded: ONTHECASE_SOURCES.length, scheduledRootsEnabled: ['onthecase-gig-index'], rootsQueued: roots.length, requestedAt: now, shadow: true }));
