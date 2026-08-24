import fs from 'node:fs';

const path = 'lib/bndy-enrichment-stack.ts';
let source = fs.readFileSync(path, 'utf8');

if (source.includes("sourceId: 'lemonrock-full-reconcile'")) {
  console.log('Lemonrock full reconcile target already present');
  process.exit(0);
}

const needle = `        new targets.SqsQueue(sourceScanQueue, {\n          message: events.RuleTargetInput.fromObject({ sourceId: 'lemonrock-venue-index', reason: 'scheduled' }),\n        }),\n      ],\n    });`;
const replacement = `        new targets.SqsQueue(sourceScanQueue, {\n          message: events.RuleTargetInput.fromObject({ sourceId: 'lemonrock-venue-index', reason: 'scheduled' }),\n        }),\n        new targets.SqsQueue(sourceScanQueue, {\n          message: events.RuleTargetInput.fromObject({\n            sourceId: 'lemonrock-full-reconcile',\n            reason: 'scheduled',\n            task: { kind: 'future-index', url: 'https://www.lemonrock.com/' },\n          }),\n        }),\n      ],\n    });`;

if (!source.includes(needle)) {
  throw new Error('LemonrockWeeklyDirectoryReconcile target block not found');
}

source = source.replace(needle, replacement);
fs.writeFileSync(path, source);
console.log('Added lemonrock-full-reconcile to weekly directory reconciliation');
