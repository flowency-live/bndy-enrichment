# Backline deployment workflow boundary

Status: enforced repository control

## Production deployment entry points

Only these workflows may deploy the complete `BndyEnrichmentStack`:

- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-capture-pipeline.yml`

Both are manual-only, require exact confirmation text, require an explicit
repository enable variable and use `AWS_DEPLOY_ROLE_ARN`. Ordinary pushes and
merges must never deploy the stack.

The combined Capture/Enrichment workflow remains disabled unless its separate
enable variable is explicitly set. It is retained temporarily while Capture
and Enrichment resource ownership is reconciled. Its existence is not approval
to execute it.

## Retired workflows

The completed KLMA, Lemonrock, On The Case and Trust Loop activation,
bootstrap, recovery, verification and quarantine workflows were removed after
the infrastructure recovery. They were one-shot operational tools that could
deploy the whole stack or mutate production recovery queues. Their code and run
history remain available in Git history.

Read-only audit workflows may remain. Other non-deployment workflows that
replay Captures, queue bounded work or call a provider are outside this first
containment change and require their own review and authorisation boundary.
They must not be mistaken for stack deployment paths or gain an embedded CDK
or SAM deployment.

## Regression control

`test/deployment-workflow-safety.test.ts` fails if:

- any other workflow contains `cdk deploy`;
- either permitted workflow gains a push trigger;
- exact confirmation and repository enable gates are removed;
- a deployment workflow uses the audit role instead of the deploy role; or
- routine CDK bootstrap is reintroduced.

Any new deployment path requires a deliberate change to this contract and its
test. That change does not itself authorise a production deployment.
