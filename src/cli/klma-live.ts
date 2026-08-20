import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildKnowledgeGraph, renderGraphHtml } from '../vertical-slice/graph-export.js';
import { persistKnowledgeToAws } from '../vertical-slice/knowledge-persist.js';
import {
  buildKlmaKnowledge,
  KLMA_EXPORT_URL,
  KLMA_GVIZ_URL,
  normaliseKlmaRows,
  parseKlmaCsv,
  realignGvizCsv,
  type KlmaFetchResult,
  type KlmaNormalisedEvent,
} from '../vertical-slice/klma-source.js';
import { projectKlmaEvent, type ProjectionResult } from '../vertical-slice/bndy-projector.js';

type Args = {
  apply: boolean;
  persistAws: boolean;
  limit: number;
  match?: string;
  outDir?: string;
  today: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    persistAws: false,
    limit: 5,
    today: new Date().toISOString().slice(0, 10),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--apply') args.apply = true;
    else if (value === '--persist-aws') args.persistAws = true;
    else if (value === '--limit') args.limit = Number(argv[++i] ?? '5');
    else if (value === '--match') args.match = argv[++i];
    else if (value === '--out') args.outDir = argv[++i];
    else if (value === '--today') args.today = argv[++i] ?? args.today;
  }
  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50) throw new Error('--limit must be 1..50');
  return args;
}

function needsPreferredRealignment(csv: string): boolean {
  const firstLine = csv.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.startsWith(',') || firstLine.startsWith('"",');
}

async function fetchLiveKlma(): Promise<KlmaFetchResult> {
  const preferred = await fetch(KLMA_EXPORT_URL);
  if (preferred.ok) {
    const original = await preferred.text();
    const body = needsPreferredRealignment(original) ? realignGvizCsv(original) : original;
    return {
      body,
      sourceUrl: KLMA_EXPORT_URL,
      fetchMethod: 'export_csv',
      httpStatus: preferred.status,
    };
  }

  const fallback = await fetch(KLMA_GVIZ_URL);
  if (!fallback.ok) throw new Error(`KLMA fetch failed: export=${preferred.status}, gviz=${fallback.status}`);
  return {
    body: realignGvizCsv(await fallback.text()),
    sourceUrl: KLMA_GVIZ_URL,
    fetchMethod: 'gviz_csv',
    httpStatus: fallback.status,
  };
}

function selectEvents(events: KlmaNormalisedEvent[], args: Args): KlmaNormalisedEvent[] {
  const needle = args.match?.trim().toLowerCase();
  const filtered = needle
    ? events.filter((event) => `${event.artistName} ${event.venueName}`.toLowerCase().includes(needle))
    : events;
  return filtered.slice(0, args.limit);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const runId = `klma-${startedAt.replace(/[:.]/g, '-')}`;
  const outDir = resolve(args.outDir ?? `artifacts/knowledge/${runId}`);
  await mkdir(outDir, { recursive: true });

  console.log('[KLMA] fetching live source...');
  const fetched = await fetchLiveKlma();
  const rows = parseKlmaCsv(fetched.body);
  const allFutureEvents = normaliseKlmaRows(rows, args.today);
  const selected = selectEvents(allFutureEvents, args);

  console.log(`[KLMA] fetch=${fetched.fetchMethod}, rows=${rows.length}, future=${allFutureEvents.length}, selected=${selected.length}`);
  if (selected.length === 0) {
    await writeFile(`${outDir}/raw.csv`, fetched.body, 'utf8');
    throw new Error(`No matching future KLMA events found (source rows: ${rows.length}, future events parsed: 0)`);
  }

  const knowledge = buildKlmaKnowledge(allFutureEvents, fetched, startedAt);
  await Promise.all([
    writeFile(`${outDir}/raw.csv`, fetched.body, 'utf8'),
    writeFile(`${outDir}/observation.json`, JSON.stringify(knowledge.observation, null, 2), 'utf8'),
    writeFile(`${outDir}/claims.json`, JSON.stringify(knowledge.claims, null, 2), 'utf8'),
    writeFile(`${outDir}/candidates.json`, JSON.stringify(knowledge.candidates, null, 2), 'utf8'),
  ]);

  let persisted: Awaited<ReturnType<typeof persistKnowledgeToAws>> | undefined;
  if (args.persistAws) persisted = await persistKnowledgeToAws(knowledge, fetched.body);

  const projections: ProjectionResult[] = [];
  const exceptions: Array<{ sourceEventKey: string; artist: string; venue: string; error: string }> = [];
  if (args.apply) {
    for (const event of selected) {
      try {
        const projected = await projectKlmaEvent(event);
        projections.push(projected);
        console.log(`[KLMA] ✓ ${event.artistName} @ ${event.venueName} → ${projected.event.id} (${projected.event.action})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        exceptions.push({ sourceEventKey: event.sourceEventKey, artist: event.artistName, venue: event.venueName, error: message });
        console.error(`[KLMA] ✗ ${event.artistName} @ ${event.venueName}: ${message}`);
      }
    }
  } else {
    console.log('[KLMA] shadow mode: zero BNDY mutations');
  }

  const graph = buildKnowledgeGraph(knowledge, selected, projections);
  const report = {
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    source: {
      sourceUrl: fetched.sourceUrl,
      fetchMethod: fetched.fetchMethod,
      rawRows: rows.length,
      futureNormalisedEvents: allFutureEvents.length,
    },
    knowledge: {
      observationId: knowledge.observation.id,
      claims: knowledge.claims.length,
      candidates: knowledge.candidates.length,
      graphNodes: graph.nodes.length,
      graphEdges: graph.edges.length,
      persistedToAws: Boolean(persisted),
      persistence: persisted,
    },
    projection: {
      apply: args.apply,
      selected: selected.length,
      successful: projections.length,
      failed: exceptions.length,
      createdEvents: projections.filter((item) => item.event.action === 'created').length,
      existingEvents: projections.filter((item) => item.event.action === 'existing').length,
      results: projections,
      exceptions,
    },
    selectedEvents: selected,
  };

  await Promise.all([
    writeFile(`${outDir}/graph.json`, JSON.stringify(graph, null, 2), 'utf8'),
    writeFile(`${outDir}/graph.html`, renderGraphHtml(graph), 'utf8'),
    writeFile(`${outDir}/run-report.json`, JSON.stringify(report, null, 2), 'utf8'),
  ]);

  console.log(`Observation: ${knowledge.observation.id}`);
  console.log(`Claims: ${knowledge.claims.length}`);
  console.log(`Graph: ${graph.nodes.length} nodes / ${graph.edges.length} edges`);
  console.log(`BNDY: ${projections.length}/${selected.length}${args.apply ? ' projected' : ' shadow'}`);
  console.log(`Output: ${outDir}`);
  if (args.apply && exceptions.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
