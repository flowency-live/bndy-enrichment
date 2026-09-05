import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';
import { assertDailySourceCoverage, auditDailySourceCoverage, sourceCatalog } from '../sources/catalog.js';
import { reconcileSourceDefinition } from '../sources/registry-reconcile.js';

const tableName = process.env.STATE_TABLE;
if (!tableName) throw new Error('STATE_TABLE is required');

const sources = sourceCatalog();
assertDailySourceCoverage(sources);
const registry = new SourceRegistryStore(tableName);
const preservedLive: string[] = [];
for (const source of sources) {
  const reconciled = reconcileSourceDefinition(await registry.get(source.id), source);
  if (reconciled.shadow === false) preservedLive.push(source.id);
  await registry.put(reconciled);
}
const legacyIds = ['onthecase-daily-import', 'sceniceye-weekly-listing'];
const retiredAt = new Date().toISOString();
const retiredLegacyIds: string[] = [];
for (const sourceId of legacyIds) {
  if (await registry.retireSchedule(sourceId, retiredAt)) retiredLegacyIds.push(sourceId);
}

console.log(JSON.stringify({
  seeded: sources.length,
  preservedLive,
  retiredLegacyIds,
  ...auditDailySourceCoverage(sources),
  canonicalWritesEnabled: false,
}));
