import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { renderQualificationReview } from '../enrichment/qualification-review.js';

const artifactPath = process.argv[2] ?? 'ops/enrichment/gemini-grounded-unreviewed.json';
const reviewPath = process.argv[3] ?? 'ops/enrichment/gemini-grounded-review.md';
const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));

await mkdir(dirname(reviewPath), { recursive: true });
await writeFile(reviewPath, renderQualificationReview(artifact), 'utf8');

console.log(JSON.stringify({ status: 'rendered', artifactPath, reviewPath }));
