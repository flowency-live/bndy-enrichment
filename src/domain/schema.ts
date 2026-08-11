import { z } from 'zod';

export const SearchEntitySchema = z.object({
  type: z.enum(['artist', 'venue']),
  bndyId: z.string().min(1),
  name: z.string().min(1),
  town: z.string().optional(),
  region: z.string().optional(),
  officialWebsite: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
});
export type SearchEntity = z.infer<typeof SearchEntitySchema>;

export const EvidenceSupportSchema = z.enum([
  'artist_name', 'venue_name', 'town', 'event_date', 'start_time',
  'ticket_url', 'ticket_price', 'facebook_url', 'bio', 'website',
  'admission_status', 'genres', 'artist_type', 'act_type', 'acoustic_performances',
]);

export const EvidenceSchema = z.object({
  id: z.string(),
  sourceUrl: z.string().url(),
  sourceDomain: z.string(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  searchQuery: z.string().optional(),
  supports: z.array(EvidenceSupportSchema).default([]),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const FacebookSearchSchema = z.object({
  searched: z.boolean(),
  status: z.enum(['matched', 'not_found', 'ambiguous', 'not_searched']),
  url: z.string().url().optional(),
  confidence: z.number().min(0).max(1),
  evidenceUrls: z.array(z.string().url()).default([]),
  notes: z.string().nullable().optional(),
});
export type FacebookSearch = z.infer<typeof FacebookSearchSchema>;

export const GenreSchema = z.enum([
  'Rock',
  'Rock n Roll',
  'Grunge',
  'Metal',
  'Punk',
  'Alternative',
  'New Wave',
  'Pop',
  'Indie',
  'Britpop',
  'Mod',
  'Blues',
  'R&B',
  'Country',
  'Americana',
  'Folk',
  'Soul',
  'Funk',
  'Motown',
  'Electronic',
  'Dance',
  'Jazz',
  'Classical',
  'Reggae',
  'Latin',
  'Other',
]);
export type Genre = z.infer<typeof GenreSchema>;

export const ArtistTypeSchema = z.enum([
  'Band',
  'Solo Act',
  'Duo',
  'Trio',
  'Group',
  'DJ',
  'Collective',
]);
export type ArtistType = z.infer<typeof ArtistTypeSchema>;

export const ActTypeSchema = z.enum(['Originals', 'Covers', 'Tribute Act']);
export type ActType = z.infer<typeof ActTypeSchema>;

export const ClassificationSourceSchema = z.enum([
  'artist_declared',
  'official_source',
  'promoter_or_venue',
  'gemini_inferred',
]);
export type ClassificationSource = z.infer<typeof ClassificationSourceSchema>;

const ClassificationEvidenceBaseSchema = z.object({
  confidence: z.number().min(0).max(1),
  source: ClassificationSourceSchema,
  evidenceUrls: z.array(z.string().url()).default([]),
  rawText: z.string().optional(),
});

export const ArtistProfileSchema = z.object({
  genres: z.array(GenreSchema).default([]),
  genreEvidence: z.array(ClassificationEvidenceBaseSchema.extend({ genre: GenreSchema })).default([]),
  artistType: ArtistTypeSchema.optional(),
  artistTypeEvidence: ClassificationEvidenceBaseSchema.optional(),
  actTypes: z.array(ActTypeSchema).default([]),
  actTypeEvidence: z.array(ClassificationEvidenceBaseSchema.extend({ actType: ActTypeSchema })).default([]),
  acousticPerformances: z.boolean().optional(),
  acousticEvidence: ClassificationEvidenceBaseSchema.optional(),
});
export type ArtistProfile = z.infer<typeof ArtistProfileSchema>;

export const EntityEnrichmentSchema = z.object({
  entityType: z.enum(['artist', 'venue']),
  name: z.string().min(1),
  town: z.string().optional(),
  officialWebsite: z.string().url().optional(),
  facebook: FacebookSearchSchema,
  bio: z.object({
    text: z.string().min(1).optional(),
    evidenceUrls: z.array(z.string().url()).default([]),
  }),
  artistProfile: ArtistProfileSchema.optional(),
  evidenceUrls: z.array(z.string().url()).default([]),
});
export type EntityEnrichment = z.infer<typeof EntityEnrichmentSchema>;

export const TicketingSchema = z.object({
  expected: z.boolean(),
  status: z.enum(['found', 'not_found', 'not_applicable', 'unknown']),
  ticketUrl: z.string().url().optional(),
  provider: z.string().optional(),
  priceText: z.string().optional(),
  onSale: z.boolean().optional(),
  evidenceUrls: z.array(z.string().url()).default([]),
});
export type Ticketing = z.infer<typeof TicketingSchema>;

export const AdmissionSchema = z.object({
  status: z.enum(['FREE_CONFIRMED', 'PAID_CONFIRMED', 'UNKNOWN']),
  confidence: z.number().min(0).max(1),
  priceText: z.string().optional(),
  evidenceUrls: z.array(z.string().url()).default([]),
  reason: z.string().optional(),
});
export type Admission = z.infer<typeof AdmissionSchema>;

export const EventProcessingSchema = z.object({
  publish: z.boolean(),
  enrichEntities: z.boolean(),
  expandGraph: z.boolean(),
  reason: z.string(),
});
export type EventProcessing = z.infer<typeof EventProcessingSchema>;

export const EventCandidateSchema = z.object({
  artistName: z.string().min(1),
  venueName: z.string().min(1),
  town: z.string().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().default('Europe/London'),
  cancelled: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
  sourceUrls: z.array(z.string().url()).min(1),
  eventUrl: z.string().url().optional(),
  promoter: z.string().optional(),
  supportActs: z.array(z.string()).default([]),
  ticketing: TicketingSchema,
  admission: AdmissionSchema,
  processing: EventProcessingSchema.optional(),
  notes: z.string().nullable().optional(),
});
export type EventCandidate = z.infer<typeof EventCandidateSchema>;

export const EligibilityClassSchema = z.enum([
  'GRASSROOTS_FREE',
  'LIKELY_GRASSROOTS',
  'MIXED',
  'COMMERCIAL_TICKETING',
  'UNKNOWN',
]);
export type EligibilityClass = z.infer<typeof EligibilityClassSchema>;

export const EligibilityDecisionSchema = z.object({
  classification: EligibilityClassSchema,
  autoEnrich: z.boolean(),
  suppressed: z.boolean(),
  suppressionDays: z.number().int().nonnegative(),
  freeEventsSeen: z.number().int().nonnegative(),
  paidEventsSeen: z.number().int().nonnegative(),
  unknownEventsSeen: z.number().int().nonnegative(),
  ticketedVenue: z.boolean().default(false),
  reason: z.string(),
});
export type EligibilityDecision = z.infer<typeof EligibilityDecisionSchema>;

export const CommercialEntitySignalSchema = z.object({
  entityType: z.enum(['artist', 'venue']),
  name: z.string().min(1),
  town: z.string().optional(),
  ticketed: z.boolean(),
  autoEnrich: z.literal(false),
  scanEligible: z.literal(false),
  evidenceUrls: z.array(z.string().url()).default([]),
  reason: z.string(),
});
export type CommercialEntitySignal = z.infer<typeof CommercialEntitySignalSchema>;

export const DiscoveryResponseSchema = z.object({
  identityConfidence: z.number().min(0).max(1),
  entityEnrichment: EntityEnrichmentSchema,
  discoveredEntities: z.array(EntityEnrichmentSchema).default([]),
  events: z.array(EventCandidateSchema),
});
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;

export const DiscoveryResultSchema = z.object({
  runId: z.string(),
  entity: SearchEntitySchema,
  retrievedAt: z.string(),
  identityConfidence: z.number().min(0).max(1),
  entityEnrichment: EntityEnrichmentSchema,
  discoveredEntities: z.array(EntityEnrichmentSchema),
  events: z.array(EventCandidateSchema),
  heldEvents: z.array(EventCandidateSchema).default([]),
  expansionEligibleEvents: z.array(EventCandidateSchema).default([]),
  commercialEntities: z.array(CommercialEntitySignalSchema).default([]),
  eligibility: EligibilityDecisionSchema,
  evidence: z.array(EvidenceSchema),
  metrics: z.object({
    latencyMs: z.number(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    searchQueries: z.number(),
    followUpSearches: z.number().default(0),
    admissionFollowUps: z.number().default(0),
    richEnrichmentFollowUps: z.number().default(0),
  }),
});
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;
