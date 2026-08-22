import { describe, expect, it } from 'vitest';
import {
  BRASS_DISCOVERY_POLICY,
  LIVE_DISCOVERY_POLICY,
  getDiscoveryPolicy,
} from './policies.js';

describe('edition discovery policies', () => {
  it('preserves the current live free-first expansion behaviour', () => {
    expect(getDiscoveryPolicy()).toBe(LIVE_DISCOVERY_POLICY);
    expect(LIVE_DISCOVERY_POLICY.publishPaidEvents).toBe(true);
    expect(LIVE_DISCOVERY_POLICY.paidEventsCanExpandGraph).toBe(false);
  });

  it('allows ticketed brass events to remain valid discovery branches', () => {
    expect(getDiscoveryPolicy('brass')).toBe(BRASS_DISCOVERY_POLICY);
    expect(BRASS_DISCOVERY_POLICY.publishPaidEvents).toBe(true);
    expect(BRASS_DISCOVERY_POLICY.paidEventsCanExpandGraph).toBe(true);
    expect(BRASS_DISCOVERY_POLICY.officialWebsitePriority).toBe('primary');
  });
});
