import type { EventCandidate, EntityEnrichment, SearchEntity } from '../domain/schema.js';

export function buildDiscoveryPrompt(entity: SearchEntity, horizonDays: number, now = new Date()): string {
  const start = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + horizonDays * 86400000).toISOString().slice(0, 10);
  const identity = [entity.name, entity.town, entity.region].filter(Boolean).join(', ');
  const subject = entity.type === 'artist'
    ? `UK live music artist/band: ${identity}`
    : `UK live music venue: ${identity}`;

  return `Perform a COST-CONSCIOUS reconnaissance search for upcoming live music performances related to this ${entity.type}:\n${subject}\n\nDate window: ${start} through ${end}, inclusive.\n\nPRIMARY GOAL:\n- Discover dated live performances and determine whether admission is FREE, PAID or UNKNOWN.\n- Do NOT spend search effort enriching biographies, Facebook profiles or websites at this stage. That happens only after a FREE eligibility gate.\n\nEVENT RULES:\n- Return only events with an explicit future performance date inside the window.\n- Do not infer an event date from a publication date.\n- Prefer direct artist, venue, promoter, Facebook-indexed and established event-listing evidence.\n- Search broadly enough to catch small pub/club/community gigs, but stop once sufficient evidence exists.\n- Do not invent a venue, date, time, URL, town, artist, admission status, ticket URL or price.\n- Every event must include at least one grounded source URL.\n- admission.status=FREE_CONFIRMED only when evidence explicitly says free entry/free admission/no cover/no ticket required or equivalent. Absence of a price is NEVER evidence of free entry.\n- admission.status=PAID_CONFIRMED when evidence shows a mandatory price, paid ticket, booking fee/price, or otherwise clearly requires paid admission. Preserve price text when visible.\n- Otherwise admission.status=UNKNOWN.\n- If ticket information is already obvious in discovery evidence, populate ticketing fields, but DO NOT perform extra searches just to complete ticket details.\n- For clearly free gigs use ticketing.expected=false and ticketing.status=not_applicable unless evidence says tickets are still required.\n- Capture eventUrl, promoter and support acts only when they are already explicit.\n- For artist searches, artistName should be the searched artist unless evidence clearly identifies an alias.\n- For venue searches, venueName should be the searched venue unless evidence clearly identifies the venue under another name.\n- confidence is factual confidence in the event claim from 0 to 1.\n\nENTITY PLACEHOLDERS:\n- Return entityEnrichment/discoveredEntities only as minimal placeholders from facts already present in event evidence.\n- Do not actively search Facebook, websites or bios in this pass.\n- facebook.searched=false and facebook.status=not_searched unless a Facebook URL was incidentally explicit in the evidence.\n- Include both newly encountered artists and venues in discoveredEntities when useful for later FREE-only enrichment.\n\nReturn no prose outside the requested JSON schema.`;
}

export function buildAdmissionFollowUpPrompt(events: EventCandidate[]): string {
  const targets = events.map((e, i) => ({
    index: i,
    artistName: e.artistName,
    venueName: e.venueName,
    town: e.town,
    eventDate: e.eventDate,
    knownSources: e.sourceUrls,
  }));

  return `Perform ONE focused, low-cost Google Search pass to classify admission for these already-discovered events.\n\n${JSON.stringify(targets, null, 2)}\n\nFor every index return only admission classification:\n- FREE_CONFIRMED only with explicit evidence such as free entry, free admission, no cover or equivalent.\n- PAID_CONFIRMED when an explicit mandatory price/ticket/paid booking is evidenced. Return priceText when visible.\n- UNKNOWN if neither can be established quickly. Do not keep searching exhaustively.\n- Absence of a price is not evidence of FREE.\n- Preserve evidence URLs and a short reason.\n- Never invent a price or admission claim.\nReturn JSON only.`;
}

export function buildEntityEnrichmentFollowUpPrompt(entities: EntityEnrichment[]): string {
  const targets = entities.map((a, i) => ({
    index: i,
    entityType: a.entityType,
    name: a.name,
    town: a.town,
    knownEvidence: a.evidenceUrls,
  }));

  return `These entities have passed bndy's FREE grassroots eligibility gate. Perform a focused enrichment search.\n\n${JSON.stringify(targets, null, 2)}\n\nFor every index:\n- Search specifically for the official Facebook page/profile and verify identity.\n- facebook.searched must be true. Return matched, not_found or ambiguous; never invent a Facebook URL.\n- Find the official website where available.\n- Capture a concise public bio/description, preferring the entity's own Facebook About/profile text or official website wording, with evidence URLs.\n- If nothing can be verified, explicitly return not_found/ambiguous with the evidence URLs inspected.\n- Do not search for additional paid gigs or ticket details; this pass is entity enrichment only.\nReturn JSON only.`;
}
