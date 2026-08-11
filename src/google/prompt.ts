import type { SearchEntity } from '../domain/schema.js';

export function buildDiscoveryPrompt(entity: SearchEntity, horizonDays: number, now = new Date()): string {
  const start = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + horizonDays * 86400000).toISOString().slice(0, 10);
  const identity = [entity.name, entity.town, entity.region].filter(Boolean).join(', ');
  const subject = entity.type === 'artist'
    ? `UK live music artist/band: ${identity}`
    : `UK live music venue: ${identity}`;

  return `Search the public web thoroughly for upcoming live music performances related to this ${entity.type}:\n${subject}\n\nDate window: ${start} through ${end}, inclusive.\n\nRules:\n- Return only events with an explicit future performance date inside the window.\n- Do not infer an event date from a page publication date.\n- Prefer direct artist, venue, ticketing, promoter, Facebook-indexed, Instagram-indexed and established event-listing evidence.\n- Search broadly enough to catch small local-band and pub/club gigs.\n- If the entity name is ambiguous, use location/context to disambiguate and lower identityConfidence if unresolved.\n- Do not invent a venue, date, time, URL, town or artist.\n- Each event must include at least one sourceUrls URL actually found by Google Search grounding. Do not invent URLs.\n- For artist searches, artistName should be the searched artist unless evidence clearly identifies an alias.\n- For venue searches, venueName should be the searched venue unless evidence clearly identifies the venue under another name.\n- confidence is factual confidence in the event claim from 0 to 1.\n- Return no prose outside the requested JSON schema.`;
}
