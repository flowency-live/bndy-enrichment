import { describe, expect, it } from 'vitest';
import { parseScenicEye } from '../src/sources/adapters/sceniceye/parse.js';
import { editionIsFresh } from '../src/sources/adapters/sceniceye/index.js';
import type { SourceRunContext } from '../src/sources/runner/types.js';

const edition = `<html><head><title>Scenic Eye</title></head><body>
<h2 class="notion-heading">Thursday 27 August 2026</h2><table>
<tr><td>Act</td><td>Venue</td><td>Time</td></tr>
<tr><td>The Example Band</td><td>The Crown, High Street, Winchester, SO23 9AP, England</td><td>7:30 PM - 9:30 PM</td></tr>
</table></body></html>`;

function run(date: string): SourceRunContext { return { runId: 'run-test', sourceId: 'sceniceye-daily-import', startedAt: `${date}T00:00:00.000Z`, runDate: date, reason: 'manual', requestedAt: `${date}T00:00:00.000Z` }; }

describe('Scenic Eye adapter', () => {
  it('derives stable event identity and venue evidence from a weekly edition', () => {
    const parsed = parseScenicEye(edition, 'https://scenicmind.co.uk/sceniceye', run('2026-08-26'));
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]).toMatchObject({
      sourceEventKey: 'sceniceye:gig:2026-08-27:the-example-band:the-crown',
      artistName: 'The Example Band', venueName: 'The Crown', date: '2026-08-27', startTime: '19:30', endTime: '21:30',
    });
    expect(parsed.editionFresh).toBe(true);
  });

  it('marks an old edition stale so complete-snapshot withdrawal can be suppressed', () => {
    expect(editionIsFresh(edition, '2026-08-26')).toBe(true);
    expect(editionIsFresh(edition, '2026-09-01')).toBe(false);
    expect(parseScenicEye(edition, 'https://scenicmind.co.uk/sceniceye', run('2026-09-01')).editionFresh).toBe(false);
  });

  it('fails closed when the expected page structure disappears', () => {
    expect(() => parseScenicEye('<html><head><title>Other page</title></head></html>', 'https://scenicmind.co.uk/sceniceye', run('2026-08-26'))).toThrow(/unexpected title/);
  });
});
