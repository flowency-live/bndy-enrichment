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
});
