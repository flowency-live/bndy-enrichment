import type {
  EventCandidate,
  GigSource,
  KnowledgeClaim,
  ProjectionWorkItem,
  SourceObservation,
} from '../../knowledge/types.js';

export type FetchedSourceKind = 'csv' | 'json' | 'html' | 'text';

export type FetchedSource = {
  kind: FetchedSourceKind;
  body: string;
  sourceUrl?: string;
  fetchMethod: string;
  fetchedAt: string;
  complete: boolean;
  paginationComplete?: boolean;
  captureStable?: boolean;
  httpStatus?: number;
  contentType?: string;
  structuralFingerprint?: string;
};

export type NormalisedSourceEvent = {
  sourceEventKey: string;
  sourceNativeId?: string;
  artistName?: string;
  venueName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  eventUrl?: string;
  status?: string;
  contentHash?: string;
  data?: Record<string, unknown>;
};

export type ParsedSource = {
  events: NormalisedSourceEvent[];
  parked: Array<{ reason: string; raw?: unknown }>;
  warnings: string[];
};

export type SourceRunContext = {
  runId: string;
  sourceId: string;
  startedAt: string;
  runDate: string;
  reason: 'scheduled' | 'manual';
  requestedAt: string;
};

export type SourceEventDiff = {
  added: NormalisedSourceEvent[];
  updated: NormalisedSourceEvent[];
  unchanged: NormalisedSourceEvent[];
  withdrawn: NormalisedSourceEvent[];
  pastDropped: NormalisedSourceEvent[];
  ignoredAbsences: NormalisedSourceEvent[];
};

export type KnowledgeOutput = {
  observation: SourceObservation;
  claims: KnowledgeClaim[];
  candidates: EventCandidate[];
  claimsByCandidate: Map<string, KnowledgeClaim[]>;
};

export type SourceRunReport = {
  runId: string;
  sourceId: string;
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'failed';
  reason: 'scheduled' | 'manual';
  observationId?: string;
  complete?: boolean;
  rawItems: number;
  validEvents: number;
  parked: number;
  claims: number;
  added: number;
  updated: number;
  withdrawn: number;
  unchanged: number;
  projectionWorkItems: number;
  shadow: boolean;
  writerAuthority: 'cowork' | 'aws';
  warnings: string[];
  errors: Array<{ step: string; message: string }>;
  artifacts: Record<string, string>;
};

export type SourceRunnerResult = {
  config: GigSource;
  report: SourceRunReport;
  observation?: SourceObservation;
  claims: KnowledgeClaim[];
  candidates: EventCandidate[];
  diff?: SourceEventDiff;
  projectionWorkItems: ProjectionWorkItem[];
};
