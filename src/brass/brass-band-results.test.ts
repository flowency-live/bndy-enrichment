import { describe, expect, it } from 'vitest';
import { parseBrassBandResultsPage, slugCandidates } from './brass-band-results.js';

describe('slugCandidates', () => {
  it('creates stable candidate slugs', () => {
    expect(slugCandidates("Foden's")).toContain('fodens');
    expect(slugCandidates('Brighouse & Rastrick Band')).toContain('brighouse-and-rastrick-band');
    expect(slugCandidates('Brighouse & Rastrick Band')).toContain('brighouse-and-rastrick');
  });
});

describe('parseBrassBandResultsPage', () => {
  it('extracts current name, aliases and official website', () => {
    const html = `
      <h2>Pemberton Old Wigan DW Band 1892-</h2>
      <p>Also/previously known as: Pemberton Old Band, Pemberton Wigan Band</p>
      <div>Website: <a href="http://www.pembertonoldwiganband.co.uk/">site</a></div>
      <div>Region: <img alt="North West" /></div>
      <div>Section: <span>Championship</span></div>
    `;
    const record = parseBrassBandResultsPage(html, 'https://www.brassbandresults.co.uk/bands/pemberton-old-wigan-band/');
    expect(record?.currentName).toBe('Pemberton Old Wigan DW Band');
    expect(record?.aliases).toEqual(['Pemberton Old Band', 'Pemberton Wigan Band']);
    expect(record?.website).toBe('http://www.pembertonoldwiganband.co.uk/');
    expect(record?.region).toBe('North West');
    expect(record?.section).toBe('Championship');
  });
});
