import { canonicalEvidenceSource } from '../bndy-baseline/sources.js';
import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';

const tableName = process.env.STATE_TABLE;
if (!tableName) throw new Error('STATE_TABLE is required');
const registry = new SourceRegistryStore(tableName);
const activated: string[] = [];
for (const entityType of ['artist', 'venue', 'event', 'festival'] as const) {
  const source = canonicalEvidenceSource(entityType, true);
  await registry.put(source);
  activated.push(source.id);
}
console.log(JSON.stringify({ activated, shadow: true, canonicalWritesEnabled: false }));
