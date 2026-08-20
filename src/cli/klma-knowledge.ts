import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildKnowledgeGraph, renderGraphHtml } from '../vertical-slice/graph-export.js';
import { persistKnowledgeToAws } from '../vertical-slice/knowledge-persist.js';
import {
  buildKlmaKnowledge,
  fetchKlmaCsv,
  normaliseKlmaRows,
  parseKlmaCsv,
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
    else if (value === '--help' || value === '-h') {
      console.log(`KLMA knowledge vertical slice\n\nUsage:\n  npm run source:klma -- [--limit 5] [--match text] [--persist-aws] [--apply]\n\nDefault behaviour is SAFE: live fetch + Observation/Claims + graph export only.\n--persist-aws  persists immutable evidence + Observation/Claims to the existing AWS stores (requires STATE_TABLE and EVIDENCE_BUCKET).\n--apply        additionally resolves/creates Artist, Venue and Event through canonical BNDY APIs and verifies Event read-back.\n--match        project/visualise only rows where artist or venue contains this text.\n`);
      process.exit(0);
    }
  }

  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50) {
    throw new Error('--limit must be an integer from 1 to 50');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.today)) throw new Error('--today must be YYYY-MM-DD');
  return args;
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

  console.log(`[KLMA] fetching live source...`);
  const fetched = await fetchKlmaCsv();
  const rows = parseKlmaCsv(fetched.body);
  const allFutureEvents = normaliseKlmaRows(rows, args.today);
  const selected = selectEvents(allFutureEvents, args);
  if (selected.length === 0) {
    throw new Error(`No matching future KLMA events found (future events parsed: ${allFutureEvents.length})`);
  }

  console.log(`[KLMA] ${rows.length} source rows, ${allFutureEvents.length} future normalised events, ${selected.length} selected for graph/projection`);

  // Build knowledge for the full future snapshot. The visual graph can remain small
  // while the Observation truthfully represents the complete source capture.
  const knowledge = buildKlmaKnowledge(allFutureEvents, fetched, startedAt);

  await Promise.all([
    writeFile(`${outDir}/raw.csv`, fetched.body, 'utf8'),
    writeFile(`${outDir}/observation.json`, JSON.stringify(knowledge.observation, null, 2), 'utf8'),
    writeFile(`${outDir}/claims.json`, JSON.stringify(knowledge.claims, null, 2), 'utf8'),
    writeFile(`${outDir}/candidates.json`, JSON.stringify(knowledge.candidates, null, 2), 'utf8'),
  ]);

  let persisted: Awaited<ReturnType<typeof persistKnowledgeToAws>> | undefined;
  if (args.persistAws) {
    console.log(`[KLMA] persisting Observation + ${knowledge.claims.length} claims to AWS...`);
    persisted = await persistKnowledgeToAws(knowledge, fetched.body);
  }

  const projections: ProjectionResult[] = [];
  const exceptions: Array<{ sourceEventKey: string; artist: string; venue: string; error: string }> = [];

  if (args.apply) {
    console.log(`[KLMA] APPLY enabled: projecting ${selected.length} items through canonical BNDY APIs...`);
    for (const event of selected) {
      try {
        const projection = await projectKlmaEvent(event);
        projections.push(projection);
        console.log(`[KLMA] ✓ ${event.artistName} @ ${event.venueName} ${event.date} → BNDY event ${projection.event.id} (${projection.event.action})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        exceptions.push({ sourceEventKey: event.sourceEventKey, artist: event.artistName, venue: event.venueName, error: message });
        console.error(`[KLMA] ✗ ${event.artistName} @ ${event.venueName}: ${message}`);
      }
    }
  } else {
    console.log('[KLMA] shadow mode: no BNDY mutations. Re-run with --apply when ready.');
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

  console.log('\n=== KLMA KNOWLEDGE RUN ===');
  console.log(`Observation: ${knowledge.observation.id}`);
  console.log(`Claims:      ${knowledge.claims.length}`);
  console.log(`Graph:       ${graph.nodes.length} nodes / ${graph.edges.length} edges`);
  console.log(`BNDY:        ${projections.length}/${selected.length} projected${args.apply ? '' : ' (shadow)'}`);
  console.log(`Exceptions:  ${exceptions.length}`);
  console.log(`Output:      ${outDir}`);
  console.log(`Open:        ${outDir}/graph.html`);

  if (args.apply && exceptions.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
