import { SourceStateStore } from '../knowledge/stores/source-state-store.js';
import { assertDailySourceCoverage, sourceCatalog } from '../sources/catalog.js';
import { assessSourceFreshness, type SourceFreshness } from '../sources/freshness.js';

export type SourceHealthDependencies = {
  state: Pick<SourceStateStore, 'get'>;
  now?: () => Date;
};

export async function checkDailySourceHealth(deps: SourceHealthDependencies): Promise<SourceFreshness[]> {
  const now = (deps.now ?? (() => new Date()))();
  const definitions = sourceCatalog(now);
  assertDailySourceCoverage(definitions);
  const roots = definitions.filter((source) => source.sourceRole === 'coverage-root');
  return await Promise.all(roots.map(async (source) => assessSourceFreshness(source, await deps.state.get(source.id), now)));
}

export async function handler(): Promise<{ sources: number; healthy: number }> {
  const tableName = process.env.STATE_TABLE;
  if (!tableName) throw new Error('STATE_TABLE is required');
  const findings = await checkDailySourceHealth({ state: new SourceStateStore(tableName) });
  console.log(JSON.stringify({ event: 'backline-source-freshness', findings }));
  const unhealthy = findings.filter((finding) => finding.status !== 'healthy');
  if (unhealthy.length) {
    throw new Error(`Daily source freshness gate failed: ${unhealthy.map((finding) => `${finding.sourceId}=${finding.status}`).join(', ')}`);
  }
  return { sources: findings.length, healthy: findings.length };
}
