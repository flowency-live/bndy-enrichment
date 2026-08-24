import type {
  ClaimPredicate,
  EntityCandidate,
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

export type NormalisedSourceClaim = {
  predicate: ClaimPredicate;
  value: unknown;
  confidence?: number;
  evidenceText?: string;
};

export type NormalisedSourceEvent = {
  sourceEventKey: string;
  sourceNativeId?: string;
  artistName?: string;
  artistExternalId?: string;
  artistLocation?: string;
  venueName?: string;
  venueExternalId?: string;
  venueLocation?: string;
  venueAddress?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  eventUrl?: string;
  ticketUrl?: string;
  status?: string;
  admissionStatus?: string;
  price?: string;
  contentHash?: string;
  claims?: NormalisedSourceClaim[];
  data?: Record<string, unknown>;
};

export type NormalisedSourceEntity = {
  entityType: 'artist' | 'venue';
  sourceEntityKey: string;
  sourceNativeId?: string;
  displayName?: string;
  sourceUrl?: string;
  confidence?: number;
  claims: NormalisedSourceClaim[];
};

export type SourceFanoutRequest = {
  sourceId: string;
  taskKey: string;
  task: Record<string, unknown>;
};

export type ParsedSource = {
  events: NormalisedSourceEvent[];
  entities?: NormalisedSourceEntity[];
  nextRequests?: SourceFanoutRequest[];
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
  reconciliationId?: string;
  taskKey?: string;
  task?: Record<string, unknown>;
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
  candidates: Array<EventCandidate | EntityCandidate>;
  claimsByCandidate: Map<string, KnowledgeClaim[]>;
};

export type SourceRunReport = {
  runId: string;
  sourceId: string;
  reconciliationId?: string;
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'failed';
  reason: 'scheduled' | 'manual';
  observationId?: string;
  complete?: boolean;
  rawItems: number;
  validEvents: number;
  entityProfiles: number;
  parked: number;
  claims: number;
  added: number;
  updated: number;
  withdrawn: number;
  unchanged: number;
  projectionWorkItems: number;
  fanoutQueued: number;
  fanoutDuplicates: number;
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
  candidates: Array<EventCandidate | EntityCandidate>;
  diff?: SourceEventDiff;
  projectionWorkItems: ProjectionWorkItem[];
};
