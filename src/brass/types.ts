export type BrassSourceKind = 'contest_listing' | 'contest_result' | 'article' | 'official_band_website';

export interface BrassSource {
  id: string;
  url: string;
  kind: BrassSourceKind;
  year: number;
  region?: string;
  title?: string;
  priority: number;
}

export interface BrassBandObservation {
  observedName: string;
  normalisedName: string;
  conductorName?: string;
  section?: string;
  region?: string;
  year: number;
  sourceId: string;
  sourceUrl: string;
  sourceKind: BrassSourceKind;
  observedAt: string;
  evidenceText: string;
}

export interface BrassBandIdentityCandidate {
  canonicalName: string;
  observations: BrassBandObservation[];
  aliases: string[];
  regions: string[];
  confidence: number;
}
