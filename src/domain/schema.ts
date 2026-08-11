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

export const EvidenceSchema = z.object({
  id: z.string(),
  sourceUrl: z.string().url(),
  sourceDomain: z.string(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  searchQuery: z.string().optional(),
  supports: z.array(z.enum(['artist_name','venue_name','town','event_date','start_time'])).default([]),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

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
  notes: z.string().nullable().optional(),
});
export type EventCandidate = z.infer<typeof EventCandidateSchema>;

export const DiscoveryResponseSchema = z.object({
  identityConfidence: z.number().min(0).max(1),
  events: z.array(EventCandidateSchema),
});
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;

export const DiscoveryResultSchema = z.object({
  runId: z.string(),
  entity: SearchEntitySchema,
  retrievedAt: z.string(),
  events: z.array(EventCandidateSchema),
  evidence: z.array(EvidenceSchema),
  metrics: z.object({
    latencyMs: z.number(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    searchQueries: z.number(),
  }),
});
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;
