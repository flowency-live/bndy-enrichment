import type { EventCandidate, EntityEnrichment, SearchEntity } from '../domain/schema.js';

export function buildDiscoveryPrompt(entity: SearchEntity, horizonDays: number, now = new Date()): string {
  const start = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + horizonDays * 86400000).toISOString().slice(0, 10);
  const identity = [entity.name, entity.town, entity.region].filter(Boolean).join(', ');
  const subject = entity.type === 'artist'
    ? `UK live music artist/band: ${identity}`
    : `UK live music venue: ${identity}`;

  return `Search the public web thoroughly for upcoming live music performances and enrichment evidence related to this ${entity.type}:\n${subject}\n\nDate window: ${start} through ${end}, inclusive.\n\nENTITY ENRICHMENT RULES:\n- Always search for the entity's official Facebook page/profile, even if one was supplied in the input. Validate that it actually matches the entity.\n- facebook.searched MUST be true. If no confident match exists, return status=not_found or ambiguous and preserve the evidence URLs searched; never invent a Facebook URL.\n- Capture the best concise artist/venue bio or description when publicly visible, especially Facebook About/profile text or the official website. Preserve the source URL. Do not paraphrase unless necessary; prefer the source's own concise description.\n- Find the official website when available.\n- Every artist discovered through an event must also appear in discoveredEntities with an attempted Facebook match, website and bio/description where available. If the first search does not establish these, still include the artist with facebook status not_found/ambiguous so the processor can trigger a focused follow-up.\n\nEVENT RULES:\n- Return only events with an explicit future performance date inside the window.\n- Do not infer an event date from a page publication date.\n- Prefer direct artist, venue, ticketing, promoter, Facebook-indexed, Instagram-indexed and established event-listing evidence.\n- Search broadly enough to catch small local-band and pub/club gigs.\n- If the entity name is ambiguous, use location/context to disambiguate and lower identityConfidence if unresolved.\n- Do not invent a venue, date, time, URL, town, artist, ticket URL or price.\n- Each event must include at least one sourceUrls URL actually found by Google Search grounding.\n- Capture a canonical eventUrl when an event/ticket page exists.\n- Capture promoter and support acts when explicit.\n- For ticketing: actively look for ticket information for every event. Set ticketing.expected=true for theatres, academies, touring/tribute shows and other events that would normally be ticketed, or where evidence mentions tickets. Set it false for clearly free/local pub gigs unless evidence says otherwise.\n- If a ticket URL is found, ticketing.status=found and return the direct ticket/event purchase URL, provider and price text where explicit.\n- If ticketing is expected but no ticket link can be established, return status=not_found or unknown; the processor will perform a focused follow-up search.\n- Never substitute a generic venue homepage for a ticket URL.\n- For artist searches, artistName should be the searched artist unless evidence clearly identifies an alias.\n- For venue searches, venueName should be the searched venue unless evidence clearly identifies the venue under another name.\n- confidence is factual confidence in the event claim from 0 to 1.\n- Return no prose outside the requested JSON schema.`;
}

export function buildTicketFollowUpPrompt(events: EventCandidate[]): string {
  const targets = events.map((e, i) => ({
    index: i,
    artistName: e.artistName,
    venueName: e.venueName,
    town: e.town,
    eventDate: e.eventDate,
    knownSources: e.sourceUrls,
  }));
  return `Perform a focused Google Search for ticketing details for these already-discovered live events.\n\n${JSON.stringify(targets, null, 2)}\n\nFor each index:\n- Confirm the exact artist, venue and date before returning ticket data.\n- Find the most direct legitimate ticket/event purchase URL available.\n- Return provider, explicit price text and on-sale state when visible.\n- If the event is clearly free/non-ticketed, status=not_applicable.\n- If tickets are expected but no legitimate ticket URL can be found, status=not_found.\n- Never invent a URL or price.\n- Never use a generic venue homepage as ticketUrl unless that exact page is the event booking page.\n- Preserve evidence URLs.\nReturn JSON only.`;
}

export function buildArtistEnrichmentFollowUpPrompt(artists: EntityEnrichment[]): string {
  const targets = artists.map((a, i) => ({ index: i, name: a.name, town: a.town, knownEvidence: a.evidenceUrls }));
  return `Perform a focused Google Search to enrich these live music artists.\n\n${JSON.stringify(targets, null, 2)}\n\nFor every index:\n- Search specifically for the official Facebook page/profile and verify the identity.\n- facebook.searched must be true. Return matched, not_found or ambiguous; never invent a Facebook URL.\n- Find the official website where available.\n- Capture a concise public bio/description, preferring the artist's own Facebook About/profile text or official website wording, with evidence URLs.\n- If nothing can be verified, explicitly return not_found/ambiguous with the evidence URLs inspected.\nReturn JSON only.`;
}
