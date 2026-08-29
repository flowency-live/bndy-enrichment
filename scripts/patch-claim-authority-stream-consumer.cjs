const fs = require('fs');

function patch(path, from, to, label) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(from)) throw new Error(`Missing ${label} in ${path}`);
  s = s.replace(from, to);
  fs.writeFileSync(path, s);
}

patch(
  'src/authority/claim-authority.ts',
  '    id: `authority:${input.claim_id}:r${revision}`,',
  '    id: `authority:${input.claim_id}:r${revision}:${input.status}`,',
  'status-versioned authority ID',
);

patch(
  'src/handlers/claim-authority-stream-worker.ts',
  "const STATE_TABLE = process.env.STATE_TABLE;\nif (!STATE_TABLE) throw new Error('STATE_TABLE is required');\n\nconst store = new AuthorityAssertionStore(STATE_TABLE);",
  "function getStore(): AuthorityAssertionStore {\n  const tableName = process.env.STATE_TABLE;\n  if (!tableName) throw new Error('STATE_TABLE is required');\n  return new AuthorityAssertionStore(tableName);\n}",
  'lazy authority store',
);
patch(
  'src/handlers/claim-authority-stream-worker.ts',
  '    await store.put(assertion);',
  '    await getStore().put(assertion);',
  'authority store call',
);

patch(
  'lib/bndy-enrichment-stack.ts',
  "import * as events from 'aws-cdk-lib/aws-events';\nimport * as targets from 'aws-cdk-lib/aws-events-targets';",
  "import * as events from 'aws-cdk-lib/aws-events';\nimport * as targets from 'aws-cdk-lib/aws-events-targets';\nimport * as ssm from 'aws-cdk-lib/aws-ssm';",
  'SSM import',
);

const stackPath = 'lib/bndy-enrichment-stack.ts';
let stack = fs.readFileSync(stackPath, 'utf8');
const anchor = "    const sourceDispatcher = new lambdaNode.NodejsFunction(this, 'SourceDispatcher', {";
if (!stack.includes(anchor)) throw new Error('Missing SourceDispatcher anchor');
const block = `    // Claim V2 authority is consumed asynchronously from the canonical BNDY\n    // claims table. Raw claimant evidence is transient only; the worker stores\n    // the privacy-minimised AuthorityAssertion defined by ADR-111.\n    const claimStreamArn = ssm.StringParameter.valueForStringParameter(this, '/bndy/claims/stream-arn');\n    const entityClaimsTable = dynamodb.Table.fromTableAttributes(this, 'EntityClaimsTable', {\n      tableName: 'bndy-entity-claims',\n      tableStreamArn: claimStreamArn,\n    });\n    const claimAuthorityStreamWorker = new lambdaNode.NodejsFunction(this, 'ClaimAuthorityStreamWorker', {\n      runtime: lambda.Runtime.NODEJS_22_X,\n      entry: 'src/handlers/claim-authority-stream-worker.ts',\n      handler: 'handler',\n      timeout: cdk.Duration.seconds(30),\n      memorySize: 256,\n      environment: { STATE_TABLE: table.tableName },\n      bundling: { minify: true, sourceMap: true },\n    });\n    claimAuthorityStreamWorker.addEventSource(new sources.DynamoEventSource(entityClaimsTable, {\n      startingPosition: lambda.StartingPosition.LATEST,\n      batchSize: 10,\n      retryAttempts: 3,\n      bisectBatchOnError: true,\n    }));\n    entityClaimsTable.grantStreamRead(claimAuthorityStreamWorker);\n    table.grantReadWriteData(claimAuthorityStreamWorker);\n\n`;
stack = stack.replace(anchor, block + anchor);
fs.writeFileSync(stackPath, stack);

patch(
  'test/claim-authority.test.ts',
  "    expect(result.id).toBe('authority:claim-conflict:r1');",
  "    expect(result.id).toBe('authority:claim-conflict:r1:conflict');",
  'authority ID expectation',
);

console.log('Claim authority stream consumer wiring applied');
