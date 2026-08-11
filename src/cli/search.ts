import fs from 'node:fs/promises';
import { SearchEntitySchema } from '../domain/schema.js';
import { discoverWithGemini } from '../google/gemini.js';

const pairs = process.argv.slice(2)
  .map((v, i, a) => v.startsWith('--') ? [v.slice(2), a[i + 1]] : null)
  .filter(Boolean) as [string, string][];
const args = Object.fromEntries(pairs);
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('Set GEMINI_API_KEY');

const entity = SearchEntitySchema.parse({
  type: args.type ?? 'artist',
  bndyId: args.id ?? 'prototype',
  name: args.name,
  town: args.town,
  region: args.region,
});

const result = await discoverWithGemini(entity, {
  apiKey,
  model: process.env.GEMINI_MODEL,
  horizonDays: Number(args.days ?? process.env.SEARCH_HORIZON_DAYS ?? 90),
});

const output = JSON.stringify(result, null, 2);
console.log(output);
if (args.out) await fs.writeFile(args.out, output);
