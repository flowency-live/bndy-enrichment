import type { BrassSource } from './types';

/**
 * Wave 0/1 sources for the 2026 UK contesting-band identity graph.
 * These are evidence sources only: ingesting them must never publish Contest
 * pages or project section/conductor as permanent Band facts.
 */
export const BRASS_2026_IDENTITY_SOURCES: BrassSource[] = [
  {
    id: '4br-2026-national-finals',
    url: 'https://www.4barsrest.com/news/63531/national-finals-line-ups-and-schedules-confirmed-by-kapitol',
    kind: 'contest_listing',
    year: 2026,
    title: '2026 National Finals confirmed line-ups',
    priority: 100,
  },
  {
    id: '4br-2026-north-west',
    url: 'https://www.4barsrest.com/news/63395/results-2026-north-west-regional-championship',
    kind: 'contest_result',
    year: 2026,
    region: 'North West',
    priority: 95,
  },
  {
    id: '4br-2026-yorkshire',
    url: 'https://www.4barsrest.com/news/63267/yorkshire-area-line-ups-confirmed',
    kind: 'contest_listing',
    year: 2026,
    region: 'Yorkshire',
    priority: 95,
  },
  {
    id: '4br-2026-midlands',
    url: 'https://www.4barsrest.com/news/63422/results-2026-midlands-regional-championships',
    kind: 'contest_result',
    year: 2026,
    region: 'Midlands',
    priority: 95,
  },
  {
    id: '4br-2026-west-england',
    url: 'https://www.4barsrest.com/news/63316/west-of-england-area-line-ups-confirmed',
    kind: 'contest_listing',
    year: 2026,
    region: 'West of England',
    priority: 95,
  },
  {
    id: '4br-2026-london-sc',
    url: 'https://www.4barsrest.com/news/63358/london-sc-area-line-ups-confirmed',
    kind: 'contest_listing',
    year: 2026,
    region: 'London & Southern Counties',
    priority: 95,
  },
  {
    id: '4br-2026-north-england',
    url: 'https://www.4barsrest.com/news/63373/line-ups-for-north-of-england-area-confirmed',
    kind: 'contest_listing',
    year: 2026,
    region: 'North of England',
    priority: 95,
  },
  {
    id: '4br-2026-wales',
    url: 'https://www.4barsrest.com/news/63455/results-2026-welsh-regional-championships',
    kind: 'contest_result',
    year: 2026,
    region: 'Wales',
    priority: 95,
  },
  {
    id: '4br-2026-scotland',
    url: 'https://www.4barsrest.com/news/63421/results-2026-scottish-championships',
    kind: 'contest_result',
    year: 2026,
    region: 'Scotland',
    priority: 95,
  },
];
