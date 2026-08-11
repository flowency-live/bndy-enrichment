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
  status: z.enum(['matched', 'not_found', 'ambiguous']),
  url: z.string().url().optional(),
  confidence: z.number().min(0).max(1),
  evidenceUrls: z.array(z.string().url()).default([]),
  notes: z.string().nullable().optional(),
});
export type FacebookSearch = z.infer<typeof FacebookSearchSchema>;

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
  notes: z.string().nullable().optional(),
});
export type EventCandidate = z.infer<typeof EventCandidateSchema>;

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
  evidence: z.array(EvidenceSchema),
  metrics: z.object({
    latencyMs: z.number(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    searchQueries: z.number(),
    followUpSearches: z.number().default(0),
  }),
});
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;
