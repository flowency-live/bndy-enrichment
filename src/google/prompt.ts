import type { EventCandidate, EntityEnrichment, SearchEntity } from '../domain/schema.js';
import type { ClaimPredicate } from '../knowledge/types.js';
import type { CanonicalEntitySnapshot } from '../enrichment/types.js';

export function buildDiscoveryPrompt(entity: SearchEntity, horizonDays: number, now = new Date()): string {
  const start = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + horizonDays * 86400000).toISOString().slice(0, 10);
  const identity = [entity.name, entity.town, entity.region].filter(Boolean).join(', ');
  const subject = entity.type === 'artist'
    ? `UK live music artist/band: ${identity}`
    : `UK live music venue: ${identity}`;

  return `Perform a COST-CONSCIOUS reconnaissance search for upcoming live music performances related to this ${entity.type}:\n${subject}\n\nDate window: ${start} through ${end}, inclusive.\n\nPRIMARY GOAL:\n- Discover dated live performances and determine whether admission is FREE, PAID or UNKNOWN.\n- Do NOT spend search effort enriching biographies, Facebook profiles, genres or websites at this stage. That happens only after a FREE eligibility gate.\n\nEVENT RULES:\n- Return only events with an explicit future performance date inside the window.\n- Do not infer an event date from a publication date.\n- Prefer direct artist, venue, promoter, Facebook-indexed and established event-listing evidence.\n- Search broadly enough to catch small pub/club/community gigs, but stop once sufficient evidence exists.\n- Do not invent a venue, date, time, URL, town, artist, admission status, ticket URL or price.\n- Every event must include at least one grounded source URL.\n- admission.status=FREE_CONFIRMED only when evidence explicitly says free entry/free admission/no cover/no ticket required or equivalent. Absence of a price is NEVER evidence of free entry.\n- admission.status=PAID_CONFIRMED when evidence shows a mandatory price, paid ticket, booking fee/price, or otherwise clearly requires paid admission. Preserve price text when visible.\n- Otherwise admission.status=UNKNOWN.\n- If ticket information is already obvious in discovery evidence, populate ticketing fields, but DO NOT perform extra searches just to complete ticket details.\n- For clearly free gigs use ticketing.expected=false and ticketing.status=not_applicable unless evidence says tickets are still required.\n- Capture eventUrl, promoter and support acts only when they are already explicit.\n- For artist searches, artistName should be the searched artist unless evidence clearly identifies an alias.\n- For venue searches, venueName should be the searched venue unless evidence clearly identifies the venue under another name.\n- confidence is factual confidence in the event claim from 0 to 1.\n\nENTITY PLACEHOLDERS:\n- Return entityEnrichment/discoveredEntities only as minimal placeholders from facts already present in event evidence.\n- Do not actively search Facebook, websites, bios or artist classification fields in this pass.\n- facebook.searched=false and facebook.status=not_searched unless a Facebook URL was incidentally explicit in the evidence.\n- Include both newly encountered artists and venues in discoveredEntities when useful for later FREE-only enrichment.\n\nReturn no prose outside the requested JSON schema.`;
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

export function buildTrustLoopEnrichmentPrompt(input: {
  entity: CanonicalEntitySnapshot;
  sourceId: string;
  sourceCandidateKey: string;
  requestedPredicates: ClaimPredicate[];
}): string {
  return `Perform one bounded Google Search grounding pass for this Backline Trust Loop qualification case.

ENTITY:
${JSON.stringify({
    entityType: input.entity.entityType,
    displayName: input.entity.displayName,
    sourceId: input.sourceId,
    sourceCandidateKey: input.sourceCandidateKey,
    currentValues: input.entity.currentValues,
  }, null, 2)}

REQUESTED PREDICATES:
${JSON.stringify(input.requestedPredicates)}

IDENTITY SAFETY:
- Treat identity as the primary question. Name similarity alone is never sufficient.
- identityConfidence may be 0.98 or higher only when the result is tied to this exact entity by strong public evidence, such as an exact gig, venue and date footprint, an official self-identification, or mutually cross-linked official profiles.
- Same-name artists and generic venue names are hard negatives. Abstain when the locality, gig footprint or official ownership cannot be established.
- If identity is not safe, return low identity confidence and no facts. Abstention is a healthy result.

FACT SAFETY:
- Use at most two Google Search queries for this case. Abstain rather than widening the search.
- Return only requested predicates and only facts supported by public HTTPS evidence URLs found in this search.
- Every official URL must be identity-proven for this exact artist or venue. Do not return a search result merely because its name looks similar.
- Artist type values: Band, Solo Act, Duo, Trio, Group, DJ, Collective.
- Act type values: Originals, Covers, Tribute Act. Return one fact per value.
- Genre values: Rock, Rock n Roll, Grunge, Metal, Punk, Alternative, New Wave, Pop, Indie, Britpop, Mod, Blues, R&B, Country, Americana, Folk, Soul, Funk, Motown, Electronic, Dance, Jazz, Classical, Reggae, Latin, Other. Prefer a few strong classifications.
- isAcoustic is a separate boolean and requires positive evidence for true or clear contrary evidence for false.
- Facebook absence is not a defect. Capture verified website, Instagram, Bandcamp, Spotify or other official presence when available.
- If an identity-safe search finds no official presence, return officialPresenceAttempted with value no-official-presence-found and cite the strongest identity or search evidence inspected.
- Confidence describes the fact itself, separately from identityConfidence.
- Do not write to any canonical system. This is evidence capture for human qualification only.

Return one JSON object only in the requested schema. Do not use Markdown code fences or prose outside the JSON object.`;
}

export function buildEntityEnrichmentFollowUpPrompt(entities: EntityEnrichment[]): string {
  const targets = entities.map((a, i) => ({
    index: i,
    entityType: a.entityType,
    name: a.name,
    town: a.town,
    knownEvidence: a.evidenceUrls,
  }));

  return `These entities have passed bndy's FREE grassroots eligibility gate. Perform a focused enrichment search.\n\n${JSON.stringify(targets, null, 2)}\n\nFor every index:\n- Search specifically for the official Facebook page/profile and verify identity.\n- facebook.searched must be true. Return matched, not_found or ambiguous; never invent a Facebook URL.\n- Find the official website where available.\n- Capture a concise public bio/description, preferring the entity's own Facebook About/profile text or official website wording, with evidence URLs.\n- If nothing can be verified, explicitly return not_found/ambiguous with the evidence URLs inspected.\n\nARTIST CLASSIFICATION - only when entityType=artist:\n- Populate artistProfile using ONLY bndy's controlled values.\n- genres may contain only: Rock, Rock n Roll, Grunge, Metal, Punk, Alternative, New Wave, Pop, Indie, Britpop, Mod, Blues, R&B, Country, Americana, Folk, Soul, Funk, Motown, Electronic, Dance, Jazz, Classical, Reggae, Latin, Other.\n- artistType must be one of: Band, Solo Act, Duo, Trio, Group, DJ, Collective.\n- actTypes may contain only: Originals, Covers, Tribute Act.\n- acousticPerformances is true only when there is positive evidence the act performs acoustic sets; false only when reasonably established; otherwise omit it.\n- Weight artist-authored evidence highest. Facebook About/bio or the official artist website should use source=artist_declared when the artist explicitly states the classification.\n- Other official artist-controlled pages may use source=official_source.\n- Venue/promoter descriptions may use source=promoter_or_venue.\n- If explicit evidence is absent, Gemini may infer a controlled value from the artist bio, repertoire, descriptions and context using source=gemini_inferred with appropriately lower confidence.\n- Prefer a small set of strong genres over broad speculative tagging. Do not select a genre merely because an artist has performed one song in that style.\n- For each selected genre return matching genreEvidence with confidence, source, evidenceUrls and rawText when useful.\n- Return evidence/confidence for artistType, each actType and acousticPerformances where supplied.\n- Do not invent evidence URLs.\n\nCOST RULE:\n- Do not make separate searches solely for genres or artist type if the Facebook bio/official website evidence already collected is sufficient. Infer from the material already found wherever possible.\n- Do not search for additional paid gigs or ticket details; this pass is entity enrichment only.\n\nReturn JSON only.`;
}
