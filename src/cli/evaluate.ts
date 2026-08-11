import fs from 'node:fs/promises';
import { evaluate } from '../eval/evaluator.js';

const [, , truthPath, foundPath] = process.argv;
if (!truthPath || !foundPath) throw new Error('Usage: npm run evaluate -- truth.json discovery.json');
const truth = JSON.parse(await fs.readFile(truthPath, 'utf8'));
const found = JSON.parse(await fs.readFile(foundPath, 'utf8'));
console.log(JSON.stringify(evaluate(truth.events ?? truth, found.events ?? found), null, 2));
