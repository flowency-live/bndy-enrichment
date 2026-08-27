import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Lemonrock low-cost schedules', () => {
  it('keeps fast feeds hourly and avoids recurring directory crawls', () => {
    const stack = readFileSync(new URL('../lib/bndy-enrichment-stack.ts', import.meta.url), 'utf8');
    const scheduledBlock = stack.slice(
      stack.indexOf("new events.Rule(this, 'LemonrockFastGigTick'"),
      stack.indexOf('// Import existing bndy tables'),
    );

    expect(scheduledBlock).toContain('cdk.Duration.hours(1)');
    expect(scheduledBlock).toContain("new events.Rule(this, 'LemonrockDailyHealthCheck'");
    expect(scheduledBlock).toContain("task: { kind: 'future-health'");
    expect(scheduledBlock).toContain("new events.Rule(this, 'LemonrockMonthlyFutureReconcile'");
    expect(scheduledBlock).toContain("schedule: events.Schedule.cron({ minute: '20', hour: '2', day: '1' })");
    expect(scheduledBlock).toContain("task: { kind: 'future-index'");
    expect(scheduledBlock).not.toContain('lemonrock-artist-index');
    expect(scheduledBlock).not.toContain('lemonrock-venue-index');
    expect(scheduledBlock).not.toContain('full-reconcile');
  });

  it('keeps national verification bounded and never auto-redrives failures', () => {
    const workflow = readFileSync(
      new URL('../.github/workflows/lemonrock-completion-deploy.yml', import.meta.url),
      'utf8',
    );

    expect(workflow).toContain('directoryMode:"inventory-controls-only"');
    expect(workflow).toContain('automaticDeadLetterRedrive:false');
    expect(workflow).toContain('Require an empty source queue and DLQ');
    expect(workflow).toContain('auditRun:true');
    expect(workflow).toContain('directoryAuditOnly:true');
    expect(workflow).not.toContain('start-message-move-task');
    expect(workflow).not.toContain('update-role');
    expect(workflow).not.toContain('role-duration-seconds: 14400');
  });

  it('quarantines superseded delivery copies without deleting or replaying them', () => {
    const stack = readFileSync(new URL('../lib/bndy-enrichment-stack.ts', import.meta.url), 'utf8');
    const workflow = readFileSync(
      new URL('../.github/workflows/lemonrock-quarantine-historical-failures.yml', import.meta.url),
      'utf8',
    );

    expect(stack).toContain("new sqs.Queue(this, 'HistoricalSourceFailureQuarantine'");
    expect(stack).toContain("new cdk.CfnOutput(this, 'HistoricalSourceFailureQuarantineArn'");
    expect(workflow).toContain('destination-arn "$QUARANTINE_ARN"');
    expect(workflow).toContain('max-number-of-messages-per-second 10');
    expect(workflow).toContain('visibility-timeout 0');
    expect(workflow).toContain('automaticReplay:false');
    expect(workflow).toContain('canonicalWritesEnabled:false');
    expect(workflow).not.toContain('purge-queue');
  });

  it('keeps end-of-run recovery scoped to owned tasks and out of the DLQ', () => {
    const workflow = readFileSync(
      new URL('../.github/workflows/lemonrock-targeted-recovery.yml', import.meta.url),
      'utf8',
    );
    const script = readFileSync(
      new URL('../scripts/lemonrock-targeted-recovery.mjs', import.meta.url),
      'utf8',
    );

    expect(workflow).toContain('boundedToExistingReconciliation:true');
    expect(workflow).toContain('launchesNationalReconciliation:false');
    expect(workflow).toContain('automaticDeadLetterRedrive:false');
    expect(workflow).toContain('canonicalWritesEnabled:false');
    expect(workflow).not.toContain('start-message-move-task');
    expect(script).toContain("row.sourceId === 'lemonrock-gig-hydration'");
    expect(script).toContain("row.status === 'failed'");
    expect(script).toContain("Number(row.attemptCount ?? 1) < 3");
    expect(script).toContain("row.lastReconciliationId !== reconciliationId");
    expect(script).toContain('venueFanoutCutoverAt');
    expect(script).toContain("ops/lemonrock-runtime-cutovers.json");
    expect(script).not.toContain('recoveryCandidates(rows, reconciliationId, deployment.verifiedAt)');
    expect(script).not.toContain("sourceId: 'lemonrock-full-reconcile'");
  });

  it('finishes the owned run through existing bounded workflows', () => {
    const workflow = readFileSync(
      new URL('../.github/workflows/lemonrock-eod-completion.yml', import.meta.url),
      'utf8',
    );

    expect(workflow).toContain('run-907eba4a-b7eb-4d41-95f5-06bbc91beef4');
    expect(workflow).toContain('lemonrock-targeted-recovery.yml');
    expect(workflow).toContain('lemonrock-quarantine-historical-failures.yml');
    expect(workflow).toContain('lemonrock-manifest-readonly.yml');
    expect(workflow).toContain('credential_handoff_at');
    expect(workflow).toContain('gh workflow run lemonrock-eod-completion.yml --ref main');
    expect(workflow).toContain('echo "handoff=true" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain("if: steps.control.outputs.handoff != 'true'");
    expect(workflow).toContain("test \"$(jq -r '.status' /tmp/lemonrock-final-manifest.json)\" = \"complete\"");
    expect(workflow).not.toContain('lemonrock-completion-deploy.yml');
    expect(workflow).not.toContain('lemonrock-full-reconcile');
    expect(workflow).not.toContain('start-message-move-task');
    expect(workflow).not.toContain('canonicalWritesEnabled:true');
  });
});
