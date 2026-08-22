import { describe, expect, it } from 'vitest';
import { parseBrassBandResultsIndex, parseBrassBandResultsPage, slugCandidates } from './brass-band-results.js';

describe('slugCandidates', () => {
  it('creates stable candidate slugs', () => {
    expect(slugCandidates("Foden's")).toContain('fodens');
    expect(slugCandidates("Foden's")).toContain('fodens-band');
    expect(slugCandidates('Aldbourne')).toContain('aldbourne-band');
    expect(slugCandidates('Abergavenny Borough')).toContain('abergavenny-borough-band');
    expect(slugCandidates('Brighouse & Rastrick Band')).toContain('brighouse-and-rastrick-band');
    expect(slugCandidates('Brighouse & Rastrick Band')).toContain('brighouse-and-rastrick');
  });
});

describe('parseBrassBandResultsIndex', () => {
  it('extracts exact band page URLs and regions from directory rows', () => {
    const html = `
      <table>
        <tr><th>Name</th><th>Region</th><th>Contest Results</th></tr>
        <tr>
          <td><a href="/bands/aberdeen-city-band">Aberdeen City Band</a></td>
          <td><img alt="Scotland" /> <a href="/regions/scotland">Scotland</a></td>
          <td>43</td>
        </tr>
        <tr>
          <td><a href="/bands/acceler8">Acceler8</a></td>
          <td><img alt="North West" /> <a href="/regions/north-west">North West</a></td>
          <td>195</td>
        </tr>
      </table>`;
    expect(parseBrassBandResultsIndex(html)).toEqual([
      { name: 'Aberdeen City Band', pageUrl: 'https://www.brassbandresults.co.uk/bands/aberdeen-city-band', region: 'Scotland' },
      { name: 'Acceler8', pageUrl: 'https://www.brassbandresults.co.uk/bands/acceler8', region: 'North West' },
    ]);
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
