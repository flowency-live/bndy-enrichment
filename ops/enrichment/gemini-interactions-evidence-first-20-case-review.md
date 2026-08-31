# Backline Interactions evidence-first qualification review

Captured: 2026-08-29T20:22:36.606Z
Provider: `gemini-interactions-evidence-first-v1` (inactive)

## Fixed capture outcome

- Attempted: 20; captured: 12; errors: 8.
- Fact-bearing captures: 9; safe abstentions with zero admitted facts: 3.
- Admitted facts: 50; provider citations: 86.
- Searches: 52; model calls: 20.
- Estimated cost: $0.758573 against a $1.50 reserve.
- Canonical writes: 0; provider activated: false; schedule created: false.

**Capture verdict: `FAILED_CAPTURE_CONTRACT`. Identity and fact adjudication: `PENDING_HUMAN_ADJUDICATION`.**

The run failed its approved one-to-two-search contract: 6 cases used four searches. 2 further cases failed the FACT-line format. The provider cannot be qualified on this cohort, irrespective of the remaining human decisions. Human review is still required to establish identity quality, factual accuracy and whether a revised contract would be worthwhile. Raising the allowance to four searches would be a new qualification and cost contract, not an automatic repair or approval.

The links below are the immutable provider redirect URLs retained by the capture. Their visible labels are the provider citation titles. This renderer performs no network resolution and makes no provider, AWS or canonical data call.

## Contract breaches

| Case | Entity | Searches | Captured citations | Failure |
|---|---|---:|---:|---|
| interactions-evidence-first-q03-artist | Neovenator | 4 | 6 | Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two |
| interactions-evidence-first-q04-artist | Jonny Trax | 4 | 3 | Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two |
| interactions-evidence-first-q08-artist | the Select Committee | 4 | 3 | Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two |
| interactions-evidence-first-q10-artist | Tom Meighan Raw26 | 2 | 8 | Gemini Interactions evidence-first output failed the plain-text contract: Plain-text response has an invalid FACT line |
| interactions-evidence-first-q11-venue | Whittles Oldham | 4 | 5 | Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two |
| interactions-evidence-first-q12-venue | Shoulder, Fulford | 4 | 3 | Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two |
| interactions-evidence-first-q18-venue | White Hart Woodley | 4 | 5 | Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two |
| interactions-evidence-first-q20-venue | The Roebuck, Chesterton | 2 | 3 | Gemini Interactions evidence-first output failed the plain-text contract: Plain-text response has an invalid FACT line |

## Cohort index

| Case | Type | Source | Entity | Outcome | Searches | Citations | Admitted facts | Human review |
|---|---|---|---|---|---:|---:|---:|---|
| interactions-evidence-first-q01-artist | artist | gigs-news-daily-import | the Reform | safe abstention | 2 | 0 | 0 | pending |
| interactions-evidence-first-q02-artist | artist | klma-stoke-gig-list | Catalyst | safe abstention | 2 | 0 | 0 | pending |
| interactions-evidence-first-q03-artist | artist | lemonrock-artist-hydration | Neovenator | capture error | 4 | 6 | 0 | capture-error / no fact decision |
| interactions-evidence-first-q04-artist | artist | onthecase-band-hydration | Jonny Trax | capture error | 4 | 3 | 0 | capture-error / no fact decision |
| interactions-evidence-first-q05-artist | artist | lemonrock-artist-hydration | The Humbuckers | fact-bearing capture | 2 | 2 | 2 | pending |
| interactions-evidence-first-q06-artist | artist | onthecase-band-hydration | Charlotte Forman | fact-bearing capture | 2 | 9 | 9 | pending |
| interactions-evidence-first-q07-artist | artist | onthecase-band-hydration | Anna Reay | fact-bearing capture | 2 | 16 | 16 | pending |
| interactions-evidence-first-q08-artist | artist | gigs-news-daily-import | the Select Committee | capture error | 4 | 3 | 0 | capture-error / no fact decision |
| interactions-evidence-first-q09-artist | artist | gigs-news-daily-import | the Tall Faces | fact-bearing capture | 2 | 8 | 8 | pending |
| interactions-evidence-first-q10-artist | artist | gigs-news-daily-import | Tom Meighan Raw26 | capture error | 2 | 8 | 0 | capture-error / no fact decision |
| interactions-evidence-first-q11-venue | venue | gigs-news-daily-import | Whittles Oldham | capture error | 4 | 5 | 0 | capture-error / no fact decision |
| interactions-evidence-first-q12-venue | venue | klma-stoke-gig-list | Shoulder, Fulford | capture error | 4 | 3 | 0 | capture-error / no fact decision |
| interactions-evidence-first-q13-venue | venue | onthecase-gig-index | Bebside Inn Blyth | fact-bearing capture | 2 | 2 | 2 | pending |
| interactions-evidence-first-q14-venue | venue | gigs-news-daily-import | Town House Festival Oswestry | safe abstention | 2 | 0 | 0 | pending |
| interactions-evidence-first-q15-venue | venue | onthecase-gig-index | Murton Officials Club Seaham | fact-bearing capture | 2 | 3 | 3 | pending |
| interactions-evidence-first-q16-venue | venue | onthecase-gig-index | Crook Hotel Crook | fact-bearing capture | 2 | 3 | 3 | pending |
| interactions-evidence-first-q17-venue | venue | gigs-news-daily-import | the Whitehouse Stalybridge | fact-bearing capture | 2 | 2 | 2 | pending |
| interactions-evidence-first-q18-venue | venue | gigs-news-daily-import | White Hart Woodley | capture error | 4 | 5 | 0 | capture-error / no fact decision |
| interactions-evidence-first-q19-venue | venue | klma-stoke-gig-list | The Globe, Nantwich | fact-bearing capture | 2 | 5 | 5 | pending |
| interactions-evidence-first-q20-venue | venue | klma-stoke-gig-list | The Roebuck, Chesterton | capture error | 2 | 3 | 0 | capture-error / no fact decision |

## Human review instructions

Review all 12 captured cases. For each fact-bearing case, first decide whether the evidence belongs to the exact BNDY entity, then decide every admitted fact independently. Mark uncertainty as `needs external verification`; do not infer support from provider confidence. For each abstention, decide whether parking was safe or incorrectly withheld a knowable match. The eight capture errors contain no admitted facts and therefore receive no fact decision.

## Capture errors

### interactions-evidence-first-q03-artist: Neovenator

- Source: lemonrock-artist-hydration / lemonrock:artist:neovenator
- Type: artist
- Searches: 4; model calls: 1; captured citations: 6
- Exact failure: Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two
- Adjudication: `capture-error / no fact decision`
- Human notes:

### interactions-evidence-first-q04-artist: Jonny Trax

- Source: onthecase-band-hydration / onthecase:band:1211
- Type: artist
- Searches: 4; model calls: 1; captured citations: 3
- Exact failure: Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two
- Adjudication: `capture-error / no fact decision`
- Human notes:

### interactions-evidence-first-q08-artist: the Select Committee

- Source: gigs-news-daily-import / artist_the-select-committee
- Type: artist
- Searches: 4; model calls: 1; captured citations: 3
- Exact failure: Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two
- Adjudication: `capture-error / no fact decision`
- Human notes:

### interactions-evidence-first-q10-artist: Tom Meighan Raw26

- Source: gigs-news-daily-import / artist_tom-meighan-raw26
- Type: artist
- Searches: 2; model calls: 1; captured citations: 8
- Exact failure: Gemini Interactions evidence-first output failed the plain-text contract: Plain-text response has an invalid FACT line
- Adjudication: `capture-error / no fact decision`
- Human notes:

### interactions-evidence-first-q11-venue: Whittles Oldham

- Source: gigs-news-daily-import / venue_whittles-oldham
- Type: venue
- Searches: 4; model calls: 1; captured citations: 5
- Exact failure: Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two
- Adjudication: `capture-error / no fact decision`
- Human notes:

### interactions-evidence-first-q12-venue: Shoulder, Fulford

- Source: klma-stoke-gig-list / klma-venue-fef3609d34f8
- Type: venue
- Searches: 4; model calls: 1; captured citations: 3
- Exact failure: Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two
- Adjudication: `capture-error / no fact decision`
- Human notes:

### interactions-evidence-first-q18-venue: White Hart Woodley

- Source: gigs-news-daily-import / venue_white-hart-woodley
- Type: venue
- Searches: 4; model calls: 1; captured citations: 5
- Exact failure: Gemini Interactions evidence-first failed closed: observed 4 Google Search queries, expected one or two
- Adjudication: `capture-error / no fact decision`
- Human notes:

### interactions-evidence-first-q20-venue: The Roebuck, Chesterton

- Source: klma-stoke-gig-list / klma-venue-f88c79f4c673
- Type: venue
- Searches: 2; model calls: 1; captured citations: 3
- Exact failure: Gemini Interactions evidence-first output failed the plain-text contract: Plain-text response has an invalid FACT line
- Adjudication: `capture-error / no fact decision`
- Human notes:

## Safe abstentions

### interactions-evidence-first-q01-artist: the Reform

- Source: gigs-news-daily-import / artist_the-reform
- Type: artist
- Provider identity confidence: 0.000
- Provider reason: Search results show multiple distinct music acts named The Reform or The Reform Club, making identity resolution unsafe without further disambiguating metadata.
- Requested predicates: hasArtistType, hasActType, isAcoustic, hasGenre, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasBandcampUrl, hasSpotifyUrl, hasOfficialUrl, officialPresenceAttempted
- Human abstention decision: [ ] safe park  [ ] incorrect abstention  [ ] needs external verification
- Human notes:

### interactions-evidence-first-q02-artist: Catalyst

- Source: klma-stoke-gig-list / klma-artist-ff14ed763cec
- Type: artist
- Provider identity confidence: 0.000
- Provider reason: Search evidence cannot safely establish identity for the artist 'Catalyst' on the Stoke gig list due to multiple same-name entities and lack of specific local footprint evidence.
- Requested predicates: hasArtistType, hasActType, isAcoustic, hasGenre, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasBandcampUrl, hasSpotifyUrl, hasOfficialUrl, officialPresenceAttempted
- Human abstention decision: [ ] safe park  [ ] incorrect abstention  [ ] needs external verification
- Human notes:

### interactions-evidence-first-q14-venue: Town House Festival Oswestry

- Source: gigs-news-daily-import / venue_town-house-festival-oswestry
- Type: venue
- Provider identity confidence: 0.000
- Provider reason: The candidate entity name 'Town House Festival Oswestry' cannot be conclusively verified as an official venue separate from the bar/restaurant 'Townhouse Oswestry' or local festival events.
- Requested predicates: hasAddress, hasLocation, hasGooglePlaceId, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasOfficialUrl, officialPresenceAttempted
- Human abstention decision: [ ] safe park  [ ] incorrect abstention  [ ] needs external verification
- Human notes:

## Fact-bearing captures

### interactions-evidence-first-q05-artist: The Humbuckers

- Source: lemonrock-artist-hydration / lemonrock:artist:thehumbuckers
- Type: artist
- Provider identity confidence: 0.920
- Provider reason: Live music listings in Sussex associated with Lemonrock establish identity for the UK act The Humbuckers.
- Requested predicates: hasArtistType, hasActType, isAcoustic, hasGenre, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasBandcampUrl, hasSpotifyUrl, hasOfficialUrl, officialPresenceAttempted
- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification
- Human identity notes:

| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |
|---:|---|---|---:|---|---|---|---|
| 1 | hasArtistType | Band | 0.900 | The Humbuckers are a live act listed under bands and musicians in West Sussex. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFMfS9a_lvpDfDskV4JsxCKVbtSQpkzdF2uhtrQImbk-OnWeK4ylCMIp_EJt2z2c9cjjyf7R89XPeopbpehcH4VlYuc4BTobz39LZkiQzuGhd5ITW1-SJu5jt3IpoFqyrSgXgs8INIC0o2cWwBOfBYnf3qFaSN7NGyBU03ly44IBb7R4RJxDlVE5I2aBVBkpzOiRTK5js-858rK2x56DVEQ2KXDLghUT8aYaWAEeQDsxXbVRL0ekEWFQWzIe8MalusLnvG8IuA=) | supported / unsupported / wrong identity / needs external verification | |
| 2 | hasGenre | Blues | 0.920 | Live gig listings describe The Humbuckers as performing with a Blues vibe. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEZ0lieLAOm-_Qa540JwqrNbxmFH-gPyOXOty0c9Ug9re405P2v4t0JY7vtGIOR8db0gZRvTBwjo51ItRPoFGsqa4aRLIhlBIzTHLoB5KylffsRbogqhK6KH3X-G4HLhg2nhdVPDiF08ZmAupz0rygjEw12S61wiyyknQ6T71mqWR3F-LrHlahpSU7NbYu7gS8HUteUz7In9bqttjYmQjT6tsxAp_A4fm0WW4agXekbCQD-dOqNHfyJZQ2RuIJ7Pv-0q5c=) | supported / unsupported / wrong identity / needs external verification | |

### interactions-evidence-first-q06-artist: Charlotte Forman

- Source: onthecase-band-hydration / onthecase:band:26683
- Type: artist
- Provider identity confidence: 0.950
- Provider reason: On The Case Music listing and regional performance listings establish Charlotte Forman, a North East UK singer-songwriter.
- Requested predicates: hasArtistType, hasActType, isAcoustic, hasGenre, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasBandcampUrl, hasSpotifyUrl, hasOfficialUrl, officialPresenceAttempted
- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification
- Human identity notes:

| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |
|---:|---|---|---:|---|---|---|---|
| 1 | hasArtistType | Solo Act | 0.950 | On The Case Music describes Charlotte Forman as an individual artist who writes original songs and performs her cover set. | [onthecasemusic.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERi5Ya2aXWw8qj3E2vDPuGsgyn6WBOcKqkTmBEoOuN7DzB8vP_dpjQcnLu2uGaGB2qrgJtj3XQ-QLViO5LaEUBfoERWLLHeKfIYU6GMaC0nX9rbfvquGzhk7VfaGrNpc2BzYFFEbZ0WDE6uImUCQ==) | supported / unsupported / wrong identity / needs external verification | |
| 2 | hasActType | Originals | 0.950 | On The Case Music states that she writes original songs. | [onthecasemusic.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERi5Ya2aXWw8qj3E2vDPuGsgyn6WBOcKqkTmBEoOuN7DzB8vP_dpjQcnLu2uGaGB2qrgJtj3XQ-QLViO5LaEUBfoERWLLHeKfIYU6GMaC0nX9rbfvquGzhk7VfaGrNpc2BzYFFEbZ0WDE6uImUCQ==) | supported / unsupported / wrong identity / needs external verification | |
| 3 | hasActType | Covers | 0.950 | On The Case Music states that she performs her cover set around the North East. | [onthecasemusic.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERi5Ya2aXWw8qj3E2vDPuGsgyn6WBOcKqkTmBEoOuN7DzB8vP_dpjQcnLu2uGaGB2qrgJtj3XQ-QLViO5LaEUBfoERWLLHeKfIYU6GMaC0nX9rbfvquGzhk7VfaGrNpc2BzYFFEbZ0WDE6uImUCQ==) | supported / unsupported / wrong identity / needs external verification | |
| 4 | hasGenre | Pop | 0.950 | On The Case Music categorizes her music under Pop. | [onthecasemusic.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERi5Ya2aXWw8qj3E2vDPuGsgyn6WBOcKqkTmBEoOuN7DzB8vP_dpjQcnLu2uGaGB2qrgJtj3XQ-QLViO5LaEUBfoERWLLHeKfIYU6GMaC0nX9rbfvquGzhk7VfaGrNpc2BzYFFEbZ0WDE6uImUCQ==) | supported / unsupported / wrong identity / needs external verification | |
| 5 | hasGenre | Soul | 0.950 | On The Case Music categorizes her music under Soul. | [onthecasemusic.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERi5Ya2aXWw8qj3E2vDPuGsgyn6WBOcKqkTmBEoOuN7DzB8vP_dpjQcnLu2uGaGB2qrgJtj3XQ-QLViO5LaEUBfoERWLLHeKfIYU6GMaC0nX9rbfvquGzhk7VfaGrNpc2BzYFFEbZ0WDE6uImUCQ==) | supported / unsupported / wrong identity / needs external verification | |
| 6 | hasGenre | Jazz | 0.950 | On The Case Music categorizes her music under Jazz. | [onthecasemusic.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERi5Ya2aXWw8qj3E2vDPuGsgyn6WBOcKqkTmBEoOuN7DzB8vP_dpjQcnLu2uGaGB2qrgJtj3XQ-QLViO5LaEUBfoERWLLHeKfIYU6GMaC0nX9rbfvquGzhk7VfaGrNpc2BzYFFEbZ0WDE6uImUCQ==) | supported / unsupported / wrong identity / needs external verification | |
| 7 | hasFacebookUrl | https://www.facebook.com/Charlottef94 | 0.950 | Her official Facebook page is facebook.com/Charlottef94. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHceoBkXE16lBWvvA_RtXmKQK_57dHJfhB-Um7fsrobQiqWLNW3z4kz8ixhOpbRiS8dFsL6K4I8NMOwsQ5Nuz97ke-Ke_MaHGZPGvY09xfhk51TuXf2IfuUmk1x) | supported / unsupported / wrong identity / needs external verification | |
| 8 | hasWebsiteUrl | https://charlotteforman.co.uk | 0.900 | Her official Facebook page details list charlotteforman.co.uk. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHceoBkXE16lBWvvA_RtXmKQK_57dHJfhB-Um7fsrobQiqWLNW3z4kz8ixhOpbRiS8dFsL6K4I8NMOwsQ5Nuz97ke-Ke_MaHGZPGvY09xfhk51TuXf2IfuUmk1x) | supported / unsupported / wrong identity / needs external verification | |
| 9 | officialPresenceAttempted | true | 0.950 | Official website and social media presence exist for Charlotte Forman. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHceoBkXE16lBWvvA_RtXmKQK_57dHJfhB-Um7fsrobQiqWLNW3z4kz8ixhOpbRiS8dFsL6K4I8NMOwsQ5Nuz97ke-Ke_MaHGZPGvY09xfhk51TuXf2IfuUmk1x) | supported / unsupported / wrong identity / needs external verification | |

### interactions-evidence-first-q07-artist: Anna Reay

- Source: onthecase-band-hydration / onthecase:band:27822
- Type: artist
- Provider identity confidence: 0.950
- Provider reason: The official website annareay.co.uk and UK performance profiles confirm the identity of Newcastle singer and bandleader Anna Reay.
- Requested predicates: hasArtistType, hasActType, isAcoustic, hasGenre, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasBandcampUrl, hasSpotifyUrl, hasOfficialUrl, officialPresenceAttempted
- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification
- Human identity notes:

| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |
|---:|---|---|---:|---|---|---|---|
| 1 | hasArtistType | Solo Act | 0.950 | Anna Reay is a solo vocalist based in Newcastle upon Tyne. | [entertainersworldwide.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHKzzwEcBD8dEjHdEsu6SOCE8eJImZ06j2D7V0QyMOW7NWgt6FO6H9TqHL6Y0gHFWcs1Oau4PNERNlQDdT0YNhryStkMAycZhdrbSuz-Y6KLy-KEg0V5uSgyaBfU1HZV6G6lyNxYeMB6b2867CbGfVO0vd2) | supported / unsupported / wrong identity / needs external verification | |
| 2 | hasArtistType | Band | 0.950 | Anna Reay founded and fronts the Anna Reay Band. | [youtube.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFDc_g-5HW_syJShM1Q7YLosaOBzGLktNJiSIvBelBpvg55nSxSs1YCOo3fyHJqoCzUlk_wuCS6cTlXME8hR4-Md2kgK91PJxuiKRoJy-F8jc1bWcfHCeftZS1nwVzSvhbQ) | supported / unsupported / wrong identity / needs external verification | |
| 3 | hasArtistType | Duo | 0.950 | Anna Reay performs as part of the Anna Reay Duo with Deon Krishnan. | [annareay.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3vvNdFbmEblgBc5crWj0GUzK5bQI_wCoZAIfK1Yu--BunwKELl_g1nIyfkdoRCynGx63EY6IVFWGw4xB22W78tJc5YNEdThRCNuLnpCHp3g==) | supported / unsupported / wrong identity / needs external verification | |
| 4 | hasActType | Covers | 0.950 | Anna Reay and her band perform cover repertoire across a wide range of popular styles. | [youtube.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFDc_g-5HW_syJShM1Q7YLosaOBzGLktNJiSIvBelBpvg55nSxSs1YCOo3fyHJqoCzUlk_wuCS6cTlXME8hR4-Md2kgK91PJxuiKRoJy-F8jc1bWcfHCeftZS1nwVzSvhbQ) | supported / unsupported / wrong identity / needs external verification | |
| 5 | hasActType | Originals | 0.950 | Anna Reay is a singer-songwriter who writes and releases original music. | [narcmagazine.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGEOXY0khsnbaR7uAsz7gVLAhTEmdOHu6GmUmvLw_NMV-SHcjeU98AgfPnvFpyUlWs-6dxmOAghji4OopOkwTVbj2DcHfHvpZeN2t19SH1jpUXHQi2ndFrSTUb8f0at7ilINgDioxNbkmvemC0=) | supported / unsupported / wrong identity / needs external verification | |
| 6 | hasGenre | Pop | 0.950 | Anna Reay's repertoire includes popular and pop music. | [annareay.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3vvNdFbmEblgBc5crWj0GUzK5bQI_wCoZAIfK1Yu--BunwKELl_g1nIyfkdoRCynGx63EY6IVFWGw4xB22W78tJc5YNEdThRCNuLnpCHp3g==) | supported / unsupported / wrong identity / needs external verification | |
| 7 | hasGenre | Jazz | 0.950 | Anna Reay performs jazz music. | [annareay.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3vvNdFbmEblgBc5crWj0GUzK5bQI_wCoZAIfK1Yu--BunwKELl_g1nIyfkdoRCynGx63EY6IVFWGw4xB22W78tJc5YNEdThRCNuLnpCHp3g==) | supported / unsupported / wrong identity / needs external verification | |
| 8 | hasGenre | Rock | 0.950 | Anna Reay's repertoire includes rock music. | [annareay.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3vvNdFbmEblgBc5crWj0GUzK5bQI_wCoZAIfK1Yu--BunwKELl_g1nIyfkdoRCynGx63EY6IVFWGw4xB22W78tJc5YNEdThRCNuLnpCHp3g==) | supported / unsupported / wrong identity / needs external verification | |
| 9 | hasGenre | Blues | 0.950 | Anna Reay performs blues music. | [entertainersworldwide.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHKzzwEcBD8dEjHdEsu6SOCE8eJImZ06j2D7V0QyMOW7NWgt6FO6H9TqHL6Y0gHFWcs1Oau4PNERNlQDdT0YNhryStkMAycZhdrbSuz-Y6KLy-KEg0V5uSgyaBfU1HZV6G6lyNxYeMB6b2867CbGfVO0vd2) | supported / unsupported / wrong identity / needs external verification | |
| 10 | hasGenre | Soul | 0.950 | Anna Reay performs soul music. | [entertainersworldwide.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHKzzwEcBD8dEjHdEsu6SOCE8eJImZ06j2D7V0QyMOW7NWgt6FO6H9TqHL6Y0gHFWcs1Oau4PNERNlQDdT0YNhryStkMAycZhdrbSuz-Y6KLy-KEg0V5uSgyaBfU1HZV6G6lyNxYeMB6b2867CbGfVO0vd2) | supported / unsupported / wrong identity / needs external verification | |
| 11 | hasGenre | Country | 0.950 | Anna Reay performs country music. | [youtube.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFDc_g-5HW_syJShM1Q7YLosaOBzGLktNJiSIvBelBpvg55nSxSs1YCOo3fyHJqoCzUlk_wuCS6cTlXME8hR4-Md2kgK91PJxuiKRoJy-F8jc1bWcfHCeftZS1nwVzSvhbQ) | supported / unsupported / wrong identity / needs external verification | |
| 12 | hasGenre | Classical | 0.950 | Anna Reay performs classical music and opera. | [entertainersworldwide.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHKzzwEcBD8dEjHdEsu6SOCE8eJImZ06j2D7V0QyMOW7NWgt6FO6H9TqHL6Y0gHFWcs1Oau4PNERNlQDdT0YNhryStkMAycZhdrbSuz-Y6KLy-KEg0V5uSgyaBfU1HZV6G6lyNxYeMB6b2867CbGfVO0vd2) | supported / unsupported / wrong identity / needs external verification | |
| 13 | hasWebsiteUrl | http://www.annareay.co.uk | 0.950 | The official website for Anna Reay is listed as www.annareay.co.uk. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH-Qa2RsSwWxjzAXcTJFGIzIbf9Xc_MJPItoaVFV7oRvcp8hAQgpsoUWB9A4AlDxcPK98anYS3g_PzVzp26qLp4ogg4nS_rQt4rdpFLQGvHLjSRc4LeMRl3Qiz_hBvQBy5TgHg=) | supported / unsupported / wrong identity / needs external verification | |
| 14 | hasOfficialUrl | http://www.annareay.co.uk | 0.950 | The official web domain for Anna Reay is www.annareay.co.uk. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH-Qa2RsSwWxjzAXcTJFGIzIbf9Xc_MJPItoaVFV7oRvcp8hAQgpsoUWB9A4AlDxcPK98anYS3g_PzVzp26qLp4ogg4nS_rQt4rdpFLQGvHLjSRc4LeMRl3Qiz_hBvQBy5TgHg=) | supported / unsupported / wrong identity / needs external verification | |
| 15 | hasFacebookUrl | https://www.facebook.com/annareayband | 0.950 | The official Facebook page URL for the artist is facebook.com/annareayband. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFnqDCuxiDC8kavnTzko9OAMo9OKV2IydEBH8RRcHzdoWTUKkmjTg2Hdc8wXujo6WEUnr7e8KVAoYYmm_Yx1maY5aPJQGnbk83gVwrzWXsijZV43QnLci3712JgGLlfmZJN-BK1h-WzSXSuR-9FVtkZwBR5WcSa_llol7fAoDYbapeCelP25oQOIRCU4qf9DTQ=) | supported / unsupported / wrong identity / needs external verification | |
| 16 | officialPresenceAttempted | true | 0.950 | Official website and social presence attempts were verified. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH-Qa2RsSwWxjzAXcTJFGIzIbf9Xc_MJPItoaVFV7oRvcp8hAQgpsoUWB9A4AlDxcPK98anYS3g_PzVzp26qLp4ogg4nS_rQt4rdpFLQGvHLjSRc4LeMRl3Qiz_hBvQBy5TgHg=) | supported / unsupported / wrong identity / needs external verification | |

### interactions-evidence-first-q09-artist: the Tall Faces

- Source: gigs-news-daily-import / artist_the-tall-faces
- Type: artist
- Provider identity confidence: 0.950
- Provider reason: Discogs profile and UK gig listings establish the entity as the UK 60s mod cover band the Tall Faces.
- Requested predicates: hasArtistType, hasActType, isAcoustic, hasGenre, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasBandcampUrl, hasSpotifyUrl, hasOfficialUrl, officialPresenceAttempted
- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification
- Human identity notes:

| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |
|---:|---|---|---:|---|---|---|---|
| 1 | hasArtistType | Band | 0.950 | Discogs describes The Tall Faces as a four-piece band. | [discogs.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFg5M1VcWOqi-oVlr4LJAyEsvwf-DOnEgs_Zm5_yfu6y9a7Avl0HKEcRrh0NDUiCBi2vs_0vJOBdD2kHtTc4d-05e4O7USBQjzOStd0HeXykJDivI9MDT1LhAymaNO-agMSyrqYJmRiVA_A7A==) | supported / unsupported / wrong identity / needs external verification | |
| 2 | hasActType | Covers | 0.950 | The band performs covers of classic 60s Mod, Pop, Soul, and R&B music. | [discogs.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFg5M1VcWOqi-oVlr4LJAyEsvwf-DOnEgs_Zm5_yfu6y9a7Avl0HKEcRrh0NDUiCBi2vs_0vJOBdD2kHtTc4d-05e4O7USBQjzOStd0HeXykJDivI9MDT1LhAymaNO-agMSyrqYJmRiVA_A7A==) | supported / unsupported / wrong identity / needs external verification | |
| 3 | hasGenre | Mod | 0.950 | Discogs lists Mod among the band's primary genres. | [discogs.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFg5M1VcWOqi-oVlr4LJAyEsvwf-DOnEgs_Zm5_yfu6y9a7Avl0HKEcRrh0NDUiCBi2vs_0vJOBdD2kHtTc4d-05e4O7USBQjzOStd0HeXykJDivI9MDT1LhAymaNO-agMSyrqYJmRiVA_A7A==) | supported / unsupported / wrong identity / needs external verification | |
| 4 | hasGenre | Pop | 0.950 | Discogs lists Pop among the band's primary genres. | [discogs.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFg5M1VcWOqi-oVlr4LJAyEsvwf-DOnEgs_Zm5_yfu6y9a7Avl0HKEcRrh0NDUiCBi2vs_0vJOBdD2kHtTc4d-05e4O7USBQjzOStd0HeXykJDivI9MDT1LhAymaNO-agMSyrqYJmRiVA_A7A==) | supported / unsupported / wrong identity / needs external verification | |
| 5 | hasGenre | Soul | 0.950 | Discogs lists Soul among the band's primary genres. | [discogs.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFg5M1VcWOqi-oVlr4LJAyEsvwf-DOnEgs_Zm5_yfu6y9a7Avl0HKEcRrh0NDUiCBi2vs_0vJOBdD2kHtTc4d-05e4O7USBQjzOStd0HeXykJDivI9MDT1LhAymaNO-agMSyrqYJmRiVA_A7A==) | supported / unsupported / wrong identity / needs external verification | |
| 6 | hasGenre | R&B | 0.950 | Discogs lists R&B among the band's primary genres. | [discogs.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFg5M1VcWOqi-oVlr4LJAyEsvwf-DOnEgs_Zm5_yfu6y9a7Avl0HKEcRrh0NDUiCBi2vs_0vJOBdD2kHtTc4d-05e4O7USBQjzOStd0HeXykJDivI9MDT1LhAymaNO-agMSyrqYJmRiVA_A7A==) | supported / unsupported / wrong identity / needs external verification | |
| 7 | hasFacebookUrl | https://www.facebook.com/TheTallFaces/ | 0.900 | The band's official Facebook page handle is linked in video posts. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEHJPxF21FHPTfcxlWH1hEvB-mixN6-gXedn87W8-fwryj6R--j6pqUr8gwwgdtNVr5tT1vWawrzJWpCmoOgkkMTgbDQ-GWbFos4QciM_Q0w6fqJDzXky-5xTRlmcET1VAorI5e9fJ7SsJj7EbG5CeEH6_m) | supported / unsupported / wrong identity / needs external verification | |
| 8 | officialPresenceAttempted | true | 0.950 | Official social and web presence lookup was performed. | [discogs.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFg5M1VcWOqi-oVlr4LJAyEsvwf-DOnEgs_Zm5_yfu6y9a7Avl0HKEcRrh0NDUiCBi2vs_0vJOBdD2kHtTc4d-05e4O7USBQjzOStd0HeXykJDivI9MDT1LhAymaNO-agMSyrqYJmRiVA_A7A==) | supported / unsupported / wrong identity / needs external verification | |

### interactions-evidence-first-q13-venue: Bebside Inn Blyth

- Source: onthecase-gig-index / onthecase:venue:90
- Type: venue
- Provider identity confidence: 0.990
- Provider reason: The venue is established as a pub located on Front Street in Bebside, Blyth, matching On The Case Music venue 90.
- Requested predicates: hasAddress, hasLocation, hasGooglePlaceId, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasOfficialUrl, officialPresenceAttempted
- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification
- Human identity notes:

| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |
|---:|---|---|---:|---|---|---|---|
| 1 | hasAddress | Front Street, Bebside, Blyth, NE24 4HT, United Kingdom | 0.950 | Wikidata confirms the venue address on Front Street, Bebside, Blyth, NE24 4HT. | [wikidata.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEVwO2M6IAWjHS5TD4yvWZGcssOav5zXNxMQELmvZgTcMq7U0kGKx3R19nq-RFgNyPEC1Kb9rAtvToWfrzd8Mib5GrB0X2jIigZ4cWYm042lkqA-QXjPsSn6lNkUuw=) | supported / unsupported / wrong identity / needs external verification | |
| 2 | officialPresenceAttempted | true | 0.990 | Search was conducted to identify official websites and social channels for the venue. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH7CzXrvPUvhF0Te26YnO-T9khqkdWWkTSu0leBaJqGwdBlPAqT2quZanfBnGS4NYVcuwu33qT_hg2k_JVBmVZcMZya_VUMd4xGyLAXF-WT6Nlau91-cV6tWZQiVGd6wmdBeTD06OIkMQJC8d1a5uYkG20D1XVEEQ==) | supported / unsupported / wrong identity / needs external verification | |

### interactions-evidence-first-q15-venue: Murton Officials Club Seaham

- Source: onthecase-gig-index / onthecase:venue:915
- Type: venue
- Provider identity confidence: 0.990
- Provider reason: The official Facebook page and directory listings confirm the identity of Murton Officials Club in Seaham.
- Requested predicates: hasAddress, hasLocation, hasGooglePlaceId, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasOfficialUrl, officialPresenceAttempted
- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification
- Human identity notes:

| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |
|---:|---|---|---:|---|---|---|---|
| 1 | hasAddress | 22a Woods Terrace East, Murton, Seaham, SR7 9AA, UK | 0.950 | Yell directory lists the full address for Murton Officials Club. | [yell.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFs0saOH4EBHCNtMWM5SLbzmUebyUcYn27AafpewJOO-j6ogRBudtZv4H_dHGHahkTlHRxNajI_NoeFNQUignvN5yubePnIPCN2xv4JMVjjwRTmHIy2FOKoHjajIb8Pvvkv6eBgpElDsaiA3m6nW6uDl6Ao_3kD) | supported / unsupported / wrong identity / needs external verification | |
| 2 | hasFacebookUrl | https://www.facebook.com/murtonofficials/ | 0.980 | Facebook page for Murton Officials Club is active. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFFJ_djA27UgN9lhWU_775MFqFW4ArCHXQlpCCWo4enHisGOst1Bzq6EYQ66uKT11x7E3acn0n7HP08kIRtMfXODGZC6z1cQP_QoumFO3UTrvUVYUVF70VzLjy1IqgW) | supported / unsupported / wrong identity / needs external verification | |
| 3 | officialPresenceAttempted | true | 0.980 | An official social media page on Facebook was located and verified. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFFJ_djA27UgN9lhWU_775MFqFW4ArCHXQlpCCWo4enHisGOst1Bzq6EYQ66uKT11x7E3acn0n7HP08kIRtMfXODGZC6z1cQP_QoumFO3UTrvUVYUVF70VzLjy1IqgW) | supported / unsupported / wrong identity / needs external verification | |

### interactions-evidence-first-q16-venue: Crook Hotel Crook

- Source: onthecase-gig-index / onthecase:venue:940
- Type: venue
- Provider identity confidence: 0.980
- Provider reason: The source ID 'onthecase:venue:940' matches Crook Hotel located on Hope Street in Crook, County Durham.
- Requested predicates: hasAddress, hasLocation, hasGooglePlaceId, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasOfficialUrl, officialPresenceAttempted
- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification
- Human identity notes:

| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |
|---:|---|---|---:|---|---|---|---|
| 1 | hasAddress | 56 Hope St, Crook DL15 9HU, UK | 0.950 | CAMRA and directory listings confirm the venue address as 56 Hope St, Crook DL15 9HU. | [camra.org.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHVgV7bpCv_svLdi0aHt5naBJWyFotgTbEXAOgBgotVfNjESgMIxDgFixvQAnJao-5OajpUVLmDmTHMTZwcVlEAZICFeteaptBbc39mQJFB8S9PwnRSRKShaz6FW6zK_r5r9fVDOR6) | supported / unsupported / wrong identity / needs external verification | |
| 2 | hasLocation | Crook, County Durham, UK | 0.950 | Listings and local news report the Crook Hotel as being located in Crook, County Durham. | [thenorthernecho.co.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFnhcVUt7WYT2aRzDH4ZnWS-Ff21auQEYDjbv2yWfmIF7O3pMMp9rwEg_PubeMPzBSOnD1EZE_SA6RAWaC9hmQUxac_kGbHQ-Pa7yWnkn_nVhH8ztUtWvfGoRmA1qu1iBn33685bTO_takOW3PZducYSfj36mhTi6w67r6D_Pad0h72yXJfwYTsbK8i4yV5AWIaCCGQKeoRhw==) | supported / unsupported / wrong identity / needs external verification | |
| 3 | officialPresenceAttempted | true | 0.950 | Search was attempted for official website and online accounts of Crook Hotel. | [camra.org.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHVgV7bpCv_svLdi0aHt5naBJWyFotgTbEXAOgBgotVfNjESgMIxDgFixvQAnJao-5OajpUVLmDmTHMTZwcVlEAZICFeteaptBbc39mQJFB8S9PwnRSRKShaz6FW6zK_r5r9fVDOR6) | supported / unsupported / wrong identity / needs external verification | |

### interactions-evidence-first-q17-venue: the Whitehouse Stalybridge

- Source: gigs-news-daily-import / venue_the-whitehouse-stalybridge
- Type: venue
- Provider identity confidence: 0.990
- Provider reason: The Whitehouse Stalybridge is a pub venue confirmed at 1 Water Street in Stalybridge.
- Requested predicates: hasAddress, hasLocation, hasGooglePlaceId, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasOfficialUrl, officialPresenceAttempted
- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification
- Human identity notes:

| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |
|---:|---|---|---:|---|---|---|---|
| 1 | hasAddress | 1 Water Street, Stalybridge SK15 2AG, United Kingdom | 0.990 | CAMRA directory lists the address of The Whitehouse as 1 Water Street, Stalybridge SK15 2AG. | [camra.org.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHJnJ01aq2SMAtHkum8YFybda1Gr-JguVSLqYNflVYUR9rshBrd3bUt-9JekZ1nXE6zGsuOzK-UaBy8XJW0-hkymericXEDquKw9gZZhgsV0c-bMFJv4RT3Eh0FT4jj1D_yIP4mcrgq5nJKwtSe2A==) | supported / unsupported / wrong identity / needs external verification | |
| 2 | officialPresenceAttempted | true | 0.990 | Official web presence was searched for The Whitehouse Stalybridge. | [camra.org.uk](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHJnJ01aq2SMAtHkum8YFybda1Gr-JguVSLqYNflVYUR9rshBrd3bUt-9JekZ1nXE6zGsuOzK-UaBy8XJW0-hkymericXEDquKw9gZZhgsV0c-bMFJv4RT3Eh0FT4jj1D_yIP4mcrgq5nJKwtSe2A==) | supported / unsupported / wrong identity / needs external verification | |

### interactions-evidence-first-q19-venue: The Globe, Nantwich

- Source: klma-stoke-gig-list / klma-venue-f84e844c02e3
- Type: venue
- Provider identity confidence: 0.990
- Provider reason: The Globe is a pub and live music venue located on Audlem Road in Nantwich, Cheshire.
- Requested predicates: hasAddress, hasLocation, hasGooglePlaceId, hasFacebookUrl, hasWebsiteUrl, hasInstagramUrl, hasOfficialUrl, officialPresenceAttempted
- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification
- Human identity notes:

| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |
|---:|---|---|---:|---|---|---|---|
| 1 | officialPresenceAttempted | true | 0.990 | Official presence search was performed for The Globe in Nantwich. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9vilvIwKCx5-txkJoN3U094KFR_jlu4yZAjYSSI-MN2LqOKsd0regv-j1jbUIdU0WZ-381qkhpFqsHwsoJuzGFRFx-o10gr_H_oAnX0IaCQ6bLofmFqcf6it4SRYv-0tzmse0zrSv1PXEnth9) | supported / unsupported / wrong identity / needs external verification | |
| 2 | hasAddress | 100 Audlem Road, Nantwich, CW5 7EA, United Kingdom | 0.990 | The Globe is located at 100 Audlem Road, Nantwich, CW5 7EA. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9vilvIwKCx5-txkJoN3U094KFR_jlu4yZAjYSSI-MN2LqOKsd0regv-j1jbUIdU0WZ-381qkhpFqsHwsoJuzGFRFx-o10gr_H_oAnX0IaCQ6bLofmFqcf6it4SRYv-0tzmse0zrSv1PXEnth9) | supported / unsupported / wrong identity / needs external verification | |
| 3 | hasWebsiteUrl | http://www.theglobenantwich.co.uk/ | 0.990 | The Globe's official website is www.theglobenantwich.co.uk. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9vilvIwKCx5-txkJoN3U094KFR_jlu4yZAjYSSI-MN2LqOKsd0regv-j1jbUIdU0WZ-381qkhpFqsHwsoJuzGFRFx-o10gr_H_oAnX0IaCQ6bLofmFqcf6it4SRYv-0tzmse0zrSv1PXEnth9) | supported / unsupported / wrong identity / needs external verification | |
| 4 | hasOfficialUrl | http://www.theglobenantwich.co.uk/ | 0.990 | The Globe's official website is www.theglobenantwich.co.uk. | [facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9vilvIwKCx5-txkJoN3U094KFR_jlu4yZAjYSSI-MN2LqOKsd0regv-j1jbUIdU0WZ-381qkhpFqsHwsoJuzGFRFx-o10gr_H_oAnX0IaCQ6bLofmFqcf6it4SRYv-0tzmse0zrSv1PXEnth9) | supported / unsupported / wrong identity / needs external verification | |
| 5 | hasFacebookUrl | https://www.facebook.com/profile.php?id=100057584374219 | 0.950 | The official Facebook page for The Globe Inn in Nantwich. | [stevedrice.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHyffwo2eBhY341KUvtoTyZAZVP8rOc3IhVdKgdniCqt8icKaaSSEGhcgpjjdfYM2iMu0t-uCITFcvvr2K7oShZqDPwtvNzQesx4u8Dlf9zoysP21hwSsXff7bFEeRN3ekX1jrDc0e2EPNHnHeIYXLlrohHCw==) | supported / unsupported / wrong identity / needs external verification | |

## Final human record

- Capture verdict: `FAILED_CAPTURE_CONTRACT`
- Identity and fact adjudication: `PENDING_HUMAN_ADJUDICATION`
- Confident false identities found:
- Wrong official URLs found:
- Expected-park outcomes reviewed:
- Requested-predicate coverage where knowable:
- Reviewer:
- Reviewed at:
- Recommendation: [ ] do not re-run  [ ] propose a fresh bounded contract  [ ] abandon provider
- Recommendation notes:

