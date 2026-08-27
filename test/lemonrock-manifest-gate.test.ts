import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Lemonrock national manifest directory gate', () => {
  it('distinguishes the 27 inventory segments from the separate root page task', () => {
    const workflow = readFileSync(
      new URL('../.github/workflows/lemonrock-manifest-readonly.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain('directory_inventory_segments_expected = 27');
    expect(workflow).toContain('directory_page_tasks_expected = 28');
    expect(workflow).toContain('len(artist_controls) >= directory_inventory_segments_expected');
    expect(workflow).toContain('len(venue_controls) >= directory_inventory_segments_expected');
    expect(workflow).not.toContain('len(artist_controls) >= 28');
    expect(workflow).not.toContain('len(venue_controls) >= 28');
  });

  it('allows only one expensive manifest aggregation at a time', () => {
    const workflow = readFileSync(
      new URL('../.github/workflows/lemonrock-manifest-readonly.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain('group: lemonrock-manifest-readonly');
    expect(workflow).toContain('cancel-in-progress: true');
  });

  it('accounts explicitly for source pages that became permanently gone', () => {
    const workflow = readFileSync(
      new URL('../.github/workflows/lemonrock-manifest-readonly.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain('terminalDisposition');
    expect(workflow).toContain('future_gig_identity_gap');
    expect(workflow).toContain('future_graph_terminal');
    expect(workflow).toContain('gone_gig_index_pages > 0');
    expect(workflow).toContain('future_gig_identity_gap <= (gone_gig_index_pages + gone_gig_details)');
    expect(workflow).toContain('terminal-gone-evidence');
  });
});
