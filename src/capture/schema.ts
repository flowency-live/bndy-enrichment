import { z } from 'zod';
import { ActTypeSchema, ArtistTypeSchema, GenreSchema } from '../domain/schema.js';

export const CaptureMediaSchema = z.object({
  type: z.literal('image'),
  bucket: z.string().min(1),
  key: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  size: z.number().nonnegative().optional(),
  originalName: z.string().optional(),
});
export type CaptureMedia = z.infer<typeof CaptureMediaSchema>;

export const CaptureRecordSchema = z.object({
  id: z.string().min(1),
  capturedAt: z.string().optional(),
  receivedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  sharedText: z.string().optional(),
  reviewContext: z.string().optional(),
  sharedUrl: z.string().optional(),
  mimeType: z.string().default('text/plain'),
  sourceApp: z.string().optional(),
  note: z.string().optional(),
  suggestedEntityType: z.enum(['unknown', 'venue', 'artist', 'event']).default('unknown'),
  status: z.enum(['unprocessed', 'processing', 'processed', 'rejected', 'failed', 'ignored']),
  rawPayload: z.record(z.unknown()).optional(),
  media: CaptureMediaSchema.optional(),
  processingWorkerId: z.string().optional(),
  processingStartedAt: z.string().optional(),
  leaseUntil: z.string().optional(),
  processingAttempt: z.number().optional(),
});
export type CaptureRecord = z.infer<typeof CaptureRecordSchema>;

export const CaptureArtistSchema = z.object({
  name: z.string().min(1),
  facebookUrl: z.string().url().optional(),
  location: z.string().min(1).optional(),
  locationType: z.enum(['city', 'regional']).optional(),
  artistType: ArtistTypeSchema.optional(),
  actTypes: z.array(ActTypeSchema).default([]),
  genres: z.array(GenreSchema).default([]),
  bio: z.string().optional(),
  officialWebsite: z.string().url().optional(),
  confidence: z.number().min(0).max(1),
  evidenceUrls: z.array(z.string().url()).default([]),
});
export type CaptureArtist = z.infer<typeof CaptureArtistSchema>;

export const CaptureEventSchema = z.object({
  artistName: z.string().min(1),
  eventName: z.string().min(1).optional(),
  venueName: z.string().min(1),
  town: z.string().min(1).optional(),
  address: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  eventUrl: z.string().url().optional(),
  ticketed: z.boolean().optional(),
  ticketUrl: z.string().url().optional(),
  price: z.string().optional(),
  admission: z.enum(['FREE_CONFIRMED', 'PAID_CONFIRMED', 'UNKNOWN']),
  cancelled: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
  sourceUrls: z.array(z.string().url()).default([]),
});
export type CaptureEvent = z.infer<typeof CaptureEventSchema>;

export const CaptureDiscoverySchema = z.object({
  classification: z.enum(['artist', 'venue', 'event', 'non_music', 'unsupported']),
  reason: z.string(),
  canonicalUrl: z.string().url().optional(),
  artist: CaptureArtistSchema.optional(),
  events: z.array(CaptureEventSchema).default([]),
  evidenceUrls: z.array(z.string().url()).default([]),
});
export type CaptureDiscovery = z.infer<typeof CaptureDiscoverySchema>;
