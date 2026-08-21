import { readFileSync } from 'node:fs';
import { compareParityArtifacts, type SourceParityArtifact } from '../parity/source-parity.js';

function value(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(flag: string): string {
  const found = value(flag);
  if (!found) throw new Error(`${flag} is required`);
  return found;
}

function load(path: string): SourceParityArtifact {
  return JSON.parse(readFileSync(path, 'utf8')) as SourceParityArtifact;
}

function main(): void {
  const expectedPath = required('--expected');
  const actualPath = required('--actual');
  const expectedRuleChanges = (value('--expected-rule-changes') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const expected = load(expectedPath);
  const actual = load(actualPath);
  const result = compareParityArtifacts(expected, actual, { expectedRuleChanges });

  console.log(JSON.stringify({
    passed: result.passed,
    sourceId: actual.sourceId,
    expectedEvidence: expected.evidenceSha256,
    actualEvidence: actual.evidenceSha256,
    differences: result.differences,
  }, null, 2));

  if (!result.passed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
}
