# Backline grounded-enrichment qualification review

Captured: 2026-08-28T19:07:24.428Z

This is a bounded 20-case provider qualification cohort, not the full Backline corpus. It contains 10 artists and 10 venues selected from the live Trust Loop review set. No canonical writes occurred.

Capture errors: 1. Estimated cost: $1.5707.

| Case | Type | Source | Entity | Identity confidence | Proposed facts | Human identity | Human notes |
|---|---|---|---|---:|---|---|---|
| grounded-01-artist | artist | gigs-news-daily-import | the Reform | 0.200 | No facts returned | match / park | |
| grounded-02-artist | artist | klma-stoke-gig-list | Catalyst | 0.100 | No facts returned | match / park | |
| grounded-03-artist | artist | lemonrock-artist-hydration | Neovenator | 0.980 | No facts returned | match / park | |
| grounded-04-artist | artist | onthecase-band-hydration | Jonny Trax | 0.980 | No facts returned | match / park | |
| grounded-05-artist | artist | lemonrock-artist-hydration | The Humbuckers | 0.980 | No facts returned | match / park | |
| grounded-06-artist | artist | onthecase-band-hydration | Charlotte Forman | 0.980 | No facts returned | match / park | |
| grounded-07-artist | artist | onthecase-band-hydration | Anna Reay | 0.980 | No facts returned | match / park | |
| grounded-08-artist | artist | gigs-news-daily-import | the Select Committee | 0.000 | No facts returned | match / park | |
| grounded-09-artist | artist | gigs-news-daily-import | the Tall Faces | 0.980 | No facts returned | match / park | |
| grounded-10-artist | artist | gigs-news-daily-import | Tom Meighan Raw26 | 0.980 | No facts returned | match / park | |
| grounded-11-venue | venue | gigs-news-daily-import | Whittles Oldham | 0.990 | No facts returned | match / park | |
| grounded-12-venue | venue | klma-stoke-gig-list | Shoulder, Fulford | 0.990 | No facts returned | match / park | |
| grounded-13-venue | venue | onthecase-gig-index | Bebside Inn Blyth | 0.990 | No facts returned | match / park | |
| grounded-14-venue | venue | gigs-news-daily-import | Town House Festival Oswestry | 0.300 | No facts returned | match / park | |
| grounded-15-venue | venue | onthecase-gig-index | Murton Officials Club Seaham | 0.980 | No facts returned | match / park | |
| grounded-16-venue | venue | onthecase-gig-index | Crook Hotel Crook | 0.980 | No facts returned | match / park | |
| grounded-17-venue | venue | gigs-news-daily-import | the Whitehouse Stalybridge | 0.990 | No facts returned | match / park | |
| grounded-18-venue | venue | gigs-news-daily-import | White Hart Woodley | 0.980 | No facts returned | match / park | |
| grounded-19-venue | venue | klma-stoke-gig-list | The Globe, Nantwich | 0.000 | No facts returned | match / park | |
| grounded-20-venue | venue | klma-stoke-gig-list | The Roebuck, Chesterton | 0.980 | No facts returned | match / park | |

## Review instructions

For every case, confirm `match` only if the evidence definitely belongs to the exact artist or venue. Mark `park` for ambiguity, a same-name entity, weak locality or an unproven official link. Any confident false identity, wrong official URL or unsupported classification fails qualification.

### grounded-01-artist: the Reform

- Source: gigs-news-daily-import / artist_the-reform
- Provider identity confidence: 0.200
- Provider reasoning: The input name 'the Reform' is shared by multiple distinct musical acts and events across different eras and regions (e.g., 1970s Irish rock band Reform, Swedish jazz-rock group Reform, a New York group, and local event listings). Without a specific geographic footprint, gig schedule, venue detail, or cross-referenced official URL provided in the source metadata, it is not possible to safely establish which exact entity 'artist_the-reform' refers to.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-02-artist: Catalyst

- Source: klma-stoke-gig-list / klma-artist-ff14ed763cec
- Provider identity confidence: 0.100
- Provider reasoning: Multiple distinct musical acts perform under the name Catalyst, and no specific Stoke-on-Trent gig footprint or official profile could be definitively verified for this source entry.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-03-artist: Neovenator

- Source: lemonrock-artist-hydration / lemonrock:artist:neovenator
- Provider identity confidence: 0.980
- Provider reasoning: Neovenator is positively identified as a UK rock/post-punk band formed in 2021 by Simon Waller, Pete Walter, Phil Humphreys, and Felix Waller, signed to Flicknife Records with the album 'Songs From The End Of The Pier'.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-04-artist: Jonny Trax

- Source: onthecase-band-hydration / onthecase:band:1211
- Provider identity confidence: 0.980
- Provider reasoning: Matches exact On The Case Music candidate profile (onthecase:band:1211) and gig footprint in North East England venues including Pelaw Inn and Crown and Cannon Winlaton.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-05-artist: The Humbuckers

- Source: lemonrock-artist-hydration / lemonrock:artist:thehumbuckers
- Provider identity confidence: 0.980
- Provider reasoning: The entity is positively identified as The Humbuckers, a South Coast/Sussex UK blues-rock live band featured on Lemonrock and local Sussex live venue gig listings (e.g. Duke of Wellington in Shoreham, The Bull Inn in Battle).
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-06-artist: Charlotte Forman

- Source: onthecase-band-hydration / onthecase:band:26683
- Provider identity confidence: 0.980
- Provider reasoning: Charlotte Forman is positively identified as a North East UK-based solo singer-songwriter and live performer listed on On The Case Music (onthecasemusic.co.uk) with performance listings at North East venues including Clousden Hill Forest Hall.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-07-artist: Anna Reay

- Source: onthecase-band-hydration / onthecase:band:27822
- Provider identity confidence: 0.980
- Provider reasoning: Anna Reay is a professional vocalist and bandleader based in Newcastle upon Tyne, North East England, whose official website (annareay.co.uk) and social presence match the Newcastle venue footprint and booking records.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-08-artist: the Select Committee

- Source: gigs-news-daily-import / artist_the-select-committee
- Provider identity confidence: 0.000
- Provider reasoning: Unable to safely establish the exact locality, gig footprint, or official presence for 'the Select Committee' without risk of conflating with parliamentary select committees or distinct same-named musical acts.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-09-artist: the Tall Faces

- Source: gigs-news-daily-import / artist_the-tall-faces
- Provider identity confidence: 0.980
- Provider reasoning: Established entity identity as the UK (Stockport/Manchester) 4-piece Mod/60s beat band 'The Tall Faces', verified through gig listings, release records, and official Facebook page.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-10-artist: Tom Meighan Raw26

- Source: gigs-news-daily-import / artist_tom-meighan-raw26
- Provider identity confidence: 0.980
- Provider reasoning: The entity 'Tom Meighan Raw26' corresponds directly to English rock singer Tom Meighan (former Kasabian lead vocalist) performing under his official 2026 solo tour title 'RAW26' / 'RAW 26', verified through official self-identification, tour listings, and linked official profiles.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-11-venue: Whittles Oldham

- Source: gigs-news-daily-import / venue_whittles-oldham
- Provider identity confidence: 0.990
- Provider reasoning: Confirmed as Whittles (also known as Whittles Oldham / Whittles@tokyo), an active live music venue located at 57 Roscoe St, Oldham OL1 1EA, UK, with official website whittlesoldham.com.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-12-venue: Shoulder, Fulford

- Source: klma-stoke-gig-list / klma-venue-fef3609d34f8
- Provider identity confidence: 0.990
- Provider reasoning: The venue 'Shoulder, Fulford' from the Stoke-on-Trent gig footprint matches 'The Shoulder of Mutton' in Fulford, Stoke-on-Trent (Meadow Lane, ST11 9QS) with confirmed address, official website, and local pub directory listings.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-13-venue: Bebside Inn Blyth

- Source: onthecase-gig-index / onthecase:venue:90
- Provider identity confidence: 0.990
- Provider reasoning: The venue entity source candidate key 'onthecase:venue:90' matches the Bebside Inn Blyth listed on On The Case Music and corroborated by news coverage for the pub in Blyth, Northumberland.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-14-venue: Town House Festival Oswestry

- Source: gigs-news-daily-import / venue_town-house-festival-oswestry
- Provider identity confidence: 0.300
- Provider reasoning: No venue or official entity named 'Town House Festival Oswestry' could be verified in public records. Search results show a restaurant/venue named 'Townhouse' in Oswestry (35 Willow Street) and distinct town festivals such as the Oswestry Balloon Carnival and Oswestry Youth Music Festival, but 'Town House Festival Oswestry' cannot be safely identified with 0.98+ confidence.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-15-venue: Murton Officials Club Seaham

- Source: onthecase-gig-index / onthecase:venue:915
- Provider identity confidence: 0.980
- Provider reasoning: Verified match for Murton Officials Club Seaham located at Woods Terrace East, Murton, Seaham (SR7 9AA), cross-referenced with On The Case Music event listings and local directory sources.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-16-venue: Crook Hotel Crook

- Source: onthecase-gig-index / onthecase:venue:940
- Provider identity confidence: 0.980
- Provider reasoning: The Crook Hotel in Crook, County Durham (56 Hope Street, DL15 9HU, UK) matches the entity name, location, and gig footprint associated with source key onthecase:venue:940.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-17-venue: the Whitehouse Stalybridge

- Source: gigs-news-daily-import / venue_the-whitehouse-stalybridge
- Provider identity confidence: 0.990
- Provider reasoning: Confirmed exact identity as The Whitehouse (also known as The White House), a traditional pub and live music venue in Stalybridge located at 1 Water Street, Stalybridge, Greater Manchester.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-18-venue: White Hart Woodley

- Source: gigs-news-daily-import / venue_white-hart-woodley
- Provider identity confidence: 0.980
- Provider reasoning: Public local records, business directories, and social media listings consistently identify The White Hart as a pub located at 170 Hyde Road, Woodley, Stockport.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-19-venue: The Globe, Nantwich

- Source: klma-stoke-gig-list / klma-venue-f84e844c02e3
- Provider identity confidence: 0.000
- Provider reasoning: Gemini 503: {"error":{"message":"The service is currently unavailable.","code":"service_unavailable"}}
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

### grounded-20-venue: The Roebuck, Chesterton

- Source: klma-stoke-gig-list / klma-venue-f88c79f4c673
- Provider identity confidence: 0.980
- Provider reasoning: Strong identity match confirmed for The Roebuck in Chesterton (Newcastle-under-Lyme / Stoke-on-Trent area), located at Dragon Square, Chesterton, ST5 7HL.
- Proposed facts: No facts returned
- Evidence: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required
- Human notes:

