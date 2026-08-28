# Backline grounded-enrichment qualification review

Captured: 2026-08-28T19:07:24.428Z

This is a bounded 20-case provider qualification cohort, not the full Backline corpus. It contains 10 artists and 10 venues selected from the live Trust Loop review set. No canonical writes occurred.

Captured cases: 19/20. Capture errors: 1. Accepted facts: 0. Quarantined facts: 84. Estimated cost: $1.5707.

A quarantined fact is visible for review but is not accepted evidence and cannot project to canonical BNDY. Human adjudication does not repair missing provider citations; those cases remain parked.

| Case | Type | Source | Entity | Capture | Identity confidence | Accepted | Quarantined | Human identity |
|---|---|---|---|---|---:|---:|---:|---|
| grounded-01-artist | artist | gigs-news-daily-import | the Reform | captured | 0.200 | 0 | 0 | match / park |
| grounded-02-artist | artist | klma-stoke-gig-list | Catalyst | captured | 0.100 | 0 | 0 | match / park |
| grounded-03-artist | artist | lemonrock-artist-hydration | Neovenator | captured | 0.980 | 0 | 5 | match / park |
| grounded-04-artist | artist | onthecase-band-hydration | Jonny Trax | captured | 0.980 | 0 | 5 | match / park |
| grounded-05-artist | artist | lemonrock-artist-hydration | The Humbuckers | captured | 0.980 | 0 | 7 | match / park |
| grounded-06-artist | artist | onthecase-band-hydration | Charlotte Forman | captured | 0.980 | 0 | 7 | match / park |
| grounded-07-artist | artist | onthecase-band-hydration | Anna Reay | captured | 0.980 | 0 | 11 | match / park |
| grounded-08-artist | artist | gigs-news-daily-import | the Select Committee | captured | 0.000 | 0 | 0 | match / park |
| grounded-09-artist | artist | gigs-news-daily-import | the Tall Faces | captured | 0.980 | 0 | 10 | match / park |
| grounded-10-artist | artist | gigs-news-daily-import | Tom Meighan Raw26 | captured | 0.980 | 0 | 13 | match / park |
| grounded-11-venue | venue | gigs-news-daily-import | Whittles Oldham | captured | 0.990 | 0 | 4 | match / park |
| grounded-12-venue | venue | klma-stoke-gig-list | Shoulder, Fulford | captured | 0.990 | 0 | 4 | match / park |
| grounded-13-venue | venue | onthecase-gig-index | Bebside Inn Blyth | captured | 0.990 | 0 | 3 | match / park |
| grounded-14-venue | venue | gigs-news-daily-import | Town House Festival Oswestry | captured | 0.300 | 0 | 0 | match / park |
| grounded-15-venue | venue | onthecase-gig-index | Murton Officials Club Seaham | captured | 0.980 | 0 | 3 | match / park |
| grounded-16-venue | venue | onthecase-gig-index | Crook Hotel Crook | captured | 0.980 | 0 | 3 | match / park |
| grounded-17-venue | venue | gigs-news-daily-import | the Whitehouse Stalybridge | captured | 0.990 | 0 | 3 | match / park |
| grounded-18-venue | venue | gigs-news-daily-import | White Hart Woodley | captured | 0.980 | 0 | 3 | match / park |
| grounded-19-venue | venue | klma-stoke-gig-list | The Globe, Nantwich | error | 0.000 | 0 | 0 | match / park |
| grounded-20-venue | venue | klma-stoke-gig-list | The Roebuck, Chesterton | captured | 0.980 | 0 | 3 | match / park |

## Review instructions

Confirm `match` only if the captured provider evidence definitely belongs to the exact Artist or Venue. Mark `park` for ambiguity, a same-name entity, weak locality, missing provider citations or an unproven official link. Any confident false identity, wrong official URL or unsupported classification fails qualification.

### grounded-01-artist: the Reform

- Source: gigs-news-daily-import / artist_the-reform
- Capture status: captured
- Provider identity confidence: 0.200
- Provider reasoning or error: The input name 'the Reform' is shared by multiple distinct musical acts and events across different eras and regions (e.g., 1970s Irish rock band Reform, Swedish jazz-rock group Reform, a New York group, and local event listings). Without a specific geographic footprint, gig schedule, venue detail, or cross-referenced official URL provided in the source metadata, it is not possible to safely establish which exact entity 'artist_the-reform' refers to.
- Accepted facts: none
- Quarantined facts: none
- Captured provider evidence: none
- All cited URLs: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-02-artist: Catalyst

- Source: klma-stoke-gig-list / klma-artist-ff14ed763cec
- Capture status: captured
- Provider identity confidence: 0.100
- Provider reasoning or error: Multiple distinct musical acts perform under the name Catalyst, and no specific Stoke-on-Trent gig footprint or official profile could be definitively verified for this source entry.
- Accepted facts: none
- Quarantined facts: none
- Captured provider evidence: none
- All cited URLs: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-03-artist: Neovenator

- Source: lemonrock-artist-hydration / lemonrock:artist:neovenator
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Neovenator is positively identified as a UK rock/post-punk band formed in 2021 by Simon Waller, Pete Walter, Phil Humphreys, and Felix Waller, signed to Flicknife Records with the album 'Songs From The End Of The Pier'.
- Accepted facts: none
- Quarantined facts: hasArtistType=Band (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGG6AtLtQ3WJW6HCgm_Mhs4ujj2fGN6Bt7-d6LFEaeEQzeUo9PJicMICkHbIqrkpTHZh0q1Ta-aeV_HDmr0XOLGw89stM-Sdnhi854NI6DF1QrFkfL2]; hasActType=Originals (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGG6AtLtQ3WJW6HCgm_Mhs4ujj2fGN6Bt7-d6LFEaeEQzeUo9PJicMICkHbIqrkpTHZh0q1Ta-aeV_HDmr0XOLGw89stM-Sdnhi854NI6DF1QrFkfL2]; hasGenre=Rock (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGG6AtLtQ3WJW6HCgm_Mhs4ujj2fGN6Bt7-d6LFEaeEQzeUo9PJicMICkHbIqrkpTHZh0q1Ta-aeV_HDmr0XOLGw89stM-Sdnhi854NI6DF1QrFkfL2]; hasGenre=Punk (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGG6AtLtQ3WJW6HCgm_Mhs4ujj2fGN6Bt7-d6LFEaeEQzeUo9PJicMICkHbIqrkpTHZh0q1Ta-aeV_HDmr0XOLGw89stM-Sdnhi854NI6DF1QrFkfL2]; hasBandcampUrl=https://neovenator.bandcamp.com/ (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHGtm8FgwY__tRs91pP_btkZbxtWYqMU_aPpNtKXTwlgGnBg1y3CvaA_43SS8sSKdWKJ9SPfXKsPZLAZSVO5hXiDB0s6gZPT8tjyczJCWLaAOpjzqV8VH2Vbt0FhX08X9lr1ulJAm7hWYGbOiQ3GA9F1jXW60lXXz2z9t8Odib2lHgWS7jge-RZ6GKrMHvn9ybil0n2PT03ZYuSMY-gPvLLTHH8oJyfq8MsvUCC17Az5t61VmHSL2FKcrjaF6rsqq8C5phVzXP4-WUMkg==]
- Captured provider evidence: [link](https://neovenatorband.com/about)
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGG6AtLtQ3WJW6HCgm_Mhs4ujj2fGN6Bt7-d6LFEaeEQzeUo9PJicMICkHbIqrkpTHZh0q1Ta-aeV_HDmr0XOLGw89stM-Sdnhi854NI6DF1QrFkfL2), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHGtm8FgwY__tRs91pP_btkZbxtWYqMU_aPpNtKXTwlgGnBg1y3CvaA_43SS8sSKdWKJ9SPfXKsPZLAZSVO5hXiDB0s6gZPT8tjyczJCWLaAOpjzqV8VH2Vbt0FhX08X9lr1ulJAm7hWYGbOiQ3GA9F1jXW60lXXz2z9t8Odib2lHgWS7jge-RZ6GKrMHvn9ybil0n2PT03ZYuSMY-gPvLLTHH8oJyfq8MsvUCC17Az5t61VmHSL2FKcrjaF6rsqq8C5phVzXP4-WUMkg==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-04-artist: Jonny Trax

- Source: onthecase-band-hydration / onthecase:band:1211
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Matches exact On The Case Music candidate profile (onthecase:band:1211) and gig footprint in North East England venues including Pelaw Inn and Crown and Cannon Winlaton.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHICl1JhXBxSU1HkezsTzmlPQWykHeaRYVzO9ngfTdD0nU4tr3Uz_ZlSqpbFNXqT3oJ_6oH04KD3lMpi0i5T-qY70IjraEU_--rAKdJXfD5QO43g4tRzntr90I9gqqblTajp5cgOHWokw==]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHICl1JhXBxSU1HkezsTzmlPQWykHeaRYVzO9ngfTdD0nU4tr3Uz_ZlSqpbFNXqT3oJ_6oH04KD3lMpi0i5T-qY70IjraEU_--rAKdJXfD5QO43g4tRzntr90I9gqqblTajp5cgOHWokw==]; hasGenre=Rock (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHICl1JhXBxSU1HkezsTzmlPQWykHeaRYVzO9ngfTdD0nU4tr3Uz_ZlSqpbFNXqT3oJ_6oH04KD3lMpi0i5T-qY70IjraEU_--rAKdJXfD5QO43g4tRzntr90I9gqqblTajp5cgOHWokw==]; hasGenre=Pop (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHICl1JhXBxSU1HkezsTzmlPQWykHeaRYVzO9ngfTdD0nU4tr3Uz_ZlSqpbFNXqT3oJ_6oH04KD3lMpi0i5T-qY70IjraEU_--rAKdJXfD5QO43g4tRzntr90I9gqqblTajp5cgOHWokw==]; hasFacebookUrl=https://www.facebook.com/JonnySax15/ (0.920) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH6xKEJnRXyt3sk-DtSmmEkN6IZJFWyGs4-EajNiX6u5MJ8o0ecZUG--5Cn1sF8_NXDXJnulPmW44n4nLUJVljojPwXH5dSdCpISxAB8kDbiDyI6837uC7WsNSEWBmeY82KnWo1bFDdvfbsyRg6cA5EtakNIu-HE5qMEO9ZiMnr-QfzhV3mAoUTbOn_GMVlrxF9869Ot0lPxYl97u3kTjzZ]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHICl1JhXBxSU1HkezsTzmlPQWykHeaRYVzO9ngfTdD0nU4tr3Uz_ZlSqpbFNXqT3oJ_6oH04KD3lMpi0i5T-qY70IjraEU_--rAKdJXfD5QO43g4tRzntr90I9gqqblTajp5cgOHWokw==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH6xKEJnRXyt3sk-DtSmmEkN6IZJFWyGs4-EajNiX6u5MJ8o0ecZUG--5Cn1sF8_NXDXJnulPmW44n4nLUJVljojPwXH5dSdCpISxAB8kDbiDyI6837uC7WsNSEWBmeY82KnWo1bFDdvfbsyRg6cA5EtakNIu-HE5qMEO9ZiMnr-QfzhV3mAoUTbOn_GMVlrxF9869Ot0lPxYl97u3kTjzZ)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-05-artist: The Humbuckers

- Source: lemonrock-artist-hydration / lemonrock:artist:thehumbuckers
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The entity is positively identified as The Humbuckers, a South Coast/Sussex UK blues-rock live band featured on Lemonrock and local Sussex live venue gig listings (e.g. Duke of Wellington in Shoreham, The Bull Inn in Battle).
- Accepted facts: none
- Quarantined facts: hasArtistType=Band (0.990) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGweuN1veSC3zt8KSMGORK_C4WZxGojn77O8klwkixSoaBHU_W9R9wjK-kLMvpY2WP01oiMQrE4OjAqCwplxMqK1QPuSC8tkvb5tTIIPjOF27zQOdmsjGNRdkL0VQ2GtivfqP2BO7t_w1XvJaHyosq7xrOzZhFpxHFDYYy, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEVDeJWUUudu2tlKkPdHyAy1e1zajFjcgQcNoiJIqaCFepj2KiLc2u1lbMV4kzt8xDLg2LX1flFKPeBfuZsLrZvkw0wkYRb1jQ3KJ3xcCoULaf4MBakL8QjuQXGHrLsOOrUKwOLX6NwOj_yWwFIXvGcnrwweLhBZBcLW16MztE=]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGweuN1veSC3zt8KSMGORK_C4WZxGojn77O8klwkixSoaBHU_W9R9wjK-kLMvpY2WP01oiMQrE4OjAqCwplxMqK1QPuSC8tkvb5tTIIPjOF27zQOdmsjGNRdkL0VQ2GtivfqP2BO7t_w1XvJaHyosq7xrOzZhFpxHFDYYy, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEVDeJWUUudu2tlKkPdHyAy1e1zajFjcgQcNoiJIqaCFepj2KiLc2u1lbMV4kzt8xDLg2LX1flFKPeBfuZsLrZvkw0wkYRb1jQ3KJ3xcCoULaf4MBakL8QjuQXGHrLsOOrUKwOLX6NwOj_yWwFIXvGcnrwweLhBZBcLW16MztE=]; hasGenre=Blues (0.990) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGweuN1veSC3zt8KSMGORK_C4WZxGojn77O8klwkixSoaBHU_W9R9wjK-kLMvpY2WP01oiMQrE4OjAqCwplxMqK1QPuSC8tkvb5tTIIPjOF27zQOdmsjGNRdkL0VQ2GtivfqP2BO7t_w1XvJaHyosq7xrOzZhFpxHFDYYy]; hasGenre=Rock (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGweuN1veSC3zt8KSMGORK_C4WZxGojn77O8klwkixSoaBHU_W9R9wjK-kLMvpY2WP01oiMQrE4OjAqCwplxMqK1QPuSC8tkvb5tTIIPjOF27zQOdmsjGNRdkL0VQ2GtivfqP2BO7t_w1XvJaHyosq7xrOzZhFpxHFDYYy]; hasGenre=Rock n Roll (0.920) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEVDeJWUUudu2tlKkPdHyAy1e1zajFjcgQcNoiJIqaCFepj2KiLc2u1lbMV4kzt8xDLg2LX1flFKPeBfuZsLrZvkw0wkYRb1jQ3KJ3xcCoULaf4MBakL8QjuQXGHrLsOOrUKwOLX6NwOj_yWwFIXvGcnrwweLhBZBcLW16MztE=]; isAcoustic=false (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGweuN1veSC3zt8KSMGORK_C4WZxGojn77O8klwkixSoaBHU_W9R9wjK-kLMvpY2WP01oiMQrE4OjAqCwplxMqK1QPuSC8tkvb5tTIIPjOF27zQOdmsjGNRdkL0VQ2GtivfqP2BO7t_w1XvJaHyosq7xrOzZhFpxHFDYYy]; officialPresenceAttempted=no-official-presence-found (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGweuN1veSC3zt8KSMGORK_C4WZxGojn77O8klwkixSoaBHU_W9R9wjK-kLMvpY2WP01oiMQrE4OjAqCwplxMqK1QPuSC8tkvb5tTIIPjOF27zQOdmsjGNRdkL0VQ2GtivfqP2BO7t_w1XvJaHyosq7xrOzZhFpxHFDYYy]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGweuN1veSC3zt8KSMGORK_C4WZxGojn77O8klwkixSoaBHU_W9R9wjK-kLMvpY2WP01oiMQrE4OjAqCwplxMqK1QPuSC8tkvb5tTIIPjOF27zQOdmsjGNRdkL0VQ2GtivfqP2BO7t_w1XvJaHyosq7xrOzZhFpxHFDYYy), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEVDeJWUUudu2tlKkPdHyAy1e1zajFjcgQcNoiJIqaCFepj2KiLc2u1lbMV4kzt8xDLg2LX1flFKPeBfuZsLrZvkw0wkYRb1jQ3KJ3xcCoULaf4MBakL8QjuQXGHrLsOOrUKwOLX6NwOj_yWwFIXvGcnrwweLhBZBcLW16MztE=)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-06-artist: Charlotte Forman

- Source: onthecase-band-hydration / onthecase:band:26683
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Charlotte Forman is positively identified as a North East UK-based solo singer-songwriter and live performer listed on On The Case Music (onthecasemusic.co.uk) with performance listings at North East venues including Clousden Hill Forest Hall.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEaMNxCSuwDWhWApnC25Vjzts41RVxb6vhIo4dUrpPEQGnJqr4kelDgeLf6QVvhs0aYiN0FgV0hHeNaw1NyT5QrdFCX7X4-t6Y73gh0VbgBhaWuzeY89oojP3mfCBYQj3ENn7gdG9bpWvgF4MCMgbb7lg==]; hasActType=Originals (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHj_I4W3ewFQY4njTHPd3bFfRDbQpR-J1gRXs8o456Tv3QSI5r-iMeMYqrF6xJ9n4dwRzgJ514dhfbEw8UGLlrckOI3c9z6clqZpkfhspTRWi_vxZexlrT9Ywc3pzZECoQXZEWm5o7w5lgb==]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEcdD8uZlYYZ3sLDWMHUImF2lef8gBpAF-1h6GXZmgMsxX4swLBg7bViyk3P8FXS6ECKQ6eGEGVj62deJr8iSR2RfMieKyMcV8gq6d-ZKclblDw04KBAzsVFhekomzWwaso]; hasGenre=Pop (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEaMNxCSuwDWhWApnC25Vjzts41RVxb6vhIo4dUrpPEQGnJqr4kelDgeLf6QVvhs0aYiN0FgV0hHeNaw1NyT5QrdFCX7X4-t6Y73gh0VbgBhaWuzeY89oojP3mfCBYQj3ENn7gdG9bpWvgF4MCMgbb7lg==]; hasGenre=Soul (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHj_I4W3ewFQY4njTHPd3bFfRDbQpR-J1gRXs8o456Tv3QSI5r-iMeMYqrF6xJ9n4dwRzgJ514dhfbEw8UGLlrckOI3c9z6clqZpkfhspTRWi_vxZexlrT9Ywc3pzZECoQXZEWm5o7w5lgb==]; hasGenre=Indie (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGj4dPnx1FCI5BwDEYogeIdyJB0oiA3IigejcF5pdZt_-XDEBs-USmuNY3Oq99D_3qadolX78bDXkgRthjAB17fViy79UpO9mTmdC7v5Bl-WqW5I0j_LJMLgA3vY84GgqZYRLGZAzDj]; hasFacebookUrl=https://www.facebook.com/Charlottef94 (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGUbUzA8t6hP_VNGi-Q7wIxGMKK8FpJafL-CGkiImBzTq48VUezMm7iMjE3t47ufdmZsuvGOjv7WCL-gSMGZrfMGIMcEeCZw0A1NAziAEuYFrg5_SiVRKFActKWcg==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEaMNxCSuwDWhWApnC25Vjzts41RVxb6vhIo4dUrpPEQGnJqr4kelDgeLf6QVvhs0aYiN0FgV0hHeNaw1NyT5QrdFCX7X4-t6Y73gh0VbgBhaWuzeY89oojP3mfCBYQj3ENn7gdG9bpWvgF4MCMgbb7lg==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHj_I4W3ewFQY4njTHPd3bFfRDbQpR-J1gRXs8o456Tv3QSI5r-iMeMYqrF6xJ9n4dwRzgJ514dhfbEw8UGLlrckOI3c9z6clqZpkfhspTRWi_vxZexlrT9Ywc3pzZECoQXZEWm5o7w5lgb==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEcdD8uZlYYZ3sLDWMHUImF2lef8gBpAF-1h6GXZmgMsxX4swLBg7bViyk3P8FXS6ECKQ6eGEGVj62deJr8iSR2RfMieKyMcV8gq6d-ZKclblDw04KBAzsVFhekomzWwaso), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGj4dPnx1FCI5BwDEYogeIdyJB0oiA3IigejcF5pdZt_-XDEBs-USmuNY3Oq99D_3qadolX78bDXkgRthjAB17fViy79UpO9mTmdC7v5Bl-WqW5I0j_LJMLgA3vY84GgqZYRLGZAzDj), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGUbUzA8t6hP_VNGi-Q7wIxGMKK8FpJafL-CGkiImBzTq48VUezMm7iMjE3t47ufdmZsuvGOjv7WCL-gSMGZrfMGIMcEeCZw0A1NAziAEuYFrg5_SiVRKFActKWcg==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-07-artist: Anna Reay

- Source: onthecase-band-hydration / onthecase:band:27822
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Anna Reay is a professional vocalist and bandleader based in Newcastle upon Tyne, North East England, whose official website (annareay.co.uk) and social presence match the Newcastle venue footprint and booking records.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.950) [uncaptured citation: https://www.entertainersworldwide.com/graphics/products/cache/s_1200_800_00d89d94e63f70b297b475442ae079db.jpg]; hasActType=Covers (0.950) [uncaptured citation: https://amvlivemusic.com/images/artists/anna-reay-duo.jpg]; hasActType=Originals (0.900) [uncaptured citation: https://amvlivemusic.com/images/artists/anna-reay-duo.jpg]; hasGenre=Pop (0.950) [uncaptured citation: https://www.entertainersworldwide.com/graphics/products/cache/s_1200_800_00d89d94e63f70b297b475442ae079db.jpg]; hasGenre=Jazz (0.950) [uncaptured citation: https://www.entertainersworldwide.com/graphics/products/cache/s_1200_800_00d89d94e63f70b297b475442ae079db.jpg]; hasGenre=Soul (0.950) [uncaptured citation: https://www.entertainersworldwide.com/graphics/products/cache/s_1200_800_00d89d94e63f70b297b475442ae079db.jpg]; hasGenre=Blues (0.950) [uncaptured citation: https://www.entertainersworldwide.com/graphics/products/cache/s_1200_800_00d89d94e63f70b297b475442ae079db.jpg]; hasGenre=Classical (0.950) [uncaptured citation: https://www.entertainersworldwide.com/graphics/products/cache/s_1200_800_00d89d94e63f70b297b475442ae079db.jpg]; hasWebsiteUrl=http://www.annareay.co.uk (0.980) [uncaptured citation: https://yt3.googleusercontent.com/ytc/AIdro_lB8rUMYFOHytXg1YwNaFylMM7uETZObLovof4jugsdZnc=s900-c-k-c0x00ffffff-no-rj]; hasOfficialUrl=http://www.annareay.co.uk (0.980) [uncaptured citation: https://yt3.googleusercontent.com/ytc/AIdro_lB8rUMYFOHytXg1YwNaFylMM7uETZObLovof4jugsdZnc=s900-c-k-c0x00ffffff-no-rj]; hasFacebookUrl=https://www.facebook.com/annareayband (0.950) [uncaptured citation: https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=576044713875562]
- Captured provider evidence: none
- All cited URLs: [link](https://www.entertainersworldwide.com/graphics/products/cache/s_1200_800_00d89d94e63f70b297b475442ae079db.jpg), [link](https://amvlivemusic.com/images/artists/anna-reay-duo.jpg), [link](https://yt3.googleusercontent.com/ytc/AIdro_lB8rUMYFOHytXg1YwNaFylMM7uETZObLovof4jugsdZnc=s900-c-k-c0x00ffffff-no-rj), [link](https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=576044713875562)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-08-artist: the Select Committee

- Source: gigs-news-daily-import / artist_the-select-committee
- Capture status: captured
- Provider identity confidence: 0.000
- Provider reasoning or error: Unable to safely establish the exact locality, gig footprint, or official presence for 'the Select Committee' without risk of conflating with parliamentary select committees or distinct same-named musical acts.
- Accepted facts: none
- Quarantined facts: none
- Captured provider evidence: none
- All cited URLs: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-09-artist: the Tall Faces

- Source: gigs-news-daily-import / artist_the-tall-faces
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Established entity identity as the UK (Stockport/Manchester) 4-piece Mod/60s beat band 'The Tall Faces', verified through gig listings, release records, and official Facebook page.
- Accepted facts: none
- Quarantined facts: hasArtistType=Band (0.980) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; hasActType=Covers (0.950) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; hasActType=Originals (0.950) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; hasGenre=Mod (0.980) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; hasGenre=Pop (0.950) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; hasGenre=Soul (0.950) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; hasGenre=R&B (0.950) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; isAcoustic=false (0.950) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; hasFacebookUrl=https://www.facebook.com/TheTallFaces/ (0.980) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; hasOfficialUrl=https://www.facebook.com/TheTallFaces/ (0.980) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]
- Captured provider evidence: none
- All cited URLs: [link](https://www.facebook.com/TheTallFaces/videos/1320133576663202/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-10-artist: Tom Meighan Raw26

- Source: gigs-news-daily-import / artist_tom-meighan-raw26
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The entity 'Tom Meighan Raw26' corresponds directly to English rock singer Tom Meighan (former Kasabian lead vocalist) performing under his official 2026 solo tour title 'RAW26' / 'RAW 26', verified through official self-identification, tour listings, and linked official profiles.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.980) [uncaptured citation: https://www.tommeighanofficial.com/]; hasActType=Originals (0.980) [uncaptured citation: https://www.tommeighanofficial.com/]; hasGenre=Rock (0.980) [uncaptured citation: https://www.tommeighanofficial.com/]; hasGenre=Indie (0.950) [uncaptured citation: https://www.tommeighanofficial.com/]; hasGenre=Britpop (0.920) [uncaptured citation: https://www.tommeighanofficial.com/]; hasGenre=Alternative (0.900) [uncaptured citation: https://www.tommeighanofficial.com/]; isAcoustic=false (0.920) [uncaptured citation: https://www.facebook.com/TomMeighanOfficial/]; hasOfficialUrl=https://www.tommeighanofficial.com/ (0.990) [uncaptured citation: https://www.tommeighanofficial.com/]; hasWebsiteUrl=https://www.tommeighanofficial.com/ (0.990) [uncaptured citation: https://www.tommeighanofficial.com/]; hasFacebookUrl=https://www.facebook.com/TomMeighanOfficial (0.990) [uncaptured citation: https://www.facebook.com/TomMeighanOfficial/]; hasInstagramUrl=https://www.instagram.com/tommeighanofficial (0.980) [uncaptured citation: https://www.facebook.com/TomMeighanOfficial/]; hasSpotifyUrl=https://open.spotify.com/artist/56mQD0Le056ynVaCInwJc2 (0.980) [uncaptured citation: https://www.facebook.com/TomMeighanOfficial/]; hasBandcampUrl=https://tommeighan-raw.bandcamp.com (0.950) [uncaptured citation: https://tommeighan-raw.bandcamp.com/album/the-past-the-present-the-raw]
- Captured provider evidence: none
- All cited URLs: [link](https://www.tommeighanofficial.com/), [link](https://www.facebook.com/TomMeighanOfficial/), [link](https://tommeighan-raw.bandcamp.com/album/the-past-the-present-the-raw)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-11-venue: Whittles Oldham

- Source: gigs-news-daily-import / venue_whittles-oldham
- Capture status: captured
- Provider identity confidence: 0.990
- Provider reasoning or error: Confirmed as Whittles (also known as Whittles Oldham / Whittles@tokyo), an active live music venue located at 57 Roscoe St, Oldham OL1 1EA, UK, with official website whittlesoldham.com.
- Accepted facts: none
- Quarantined facts: hasAddress=57 Roscoe St, Oldham OL1 1EA (0.980) [uncaptured citation: https://whittlesoldham.com/]; hasLocation=Oldham, England, United Kingdom (0.950) [uncaptured citation: https://whittlesoldham.com/]; hasWebsiteUrl=https://whittlesoldham.com/ (0.990) [uncaptured citation: https://whittlesoldham.com/]; hasOfficialUrl=https://whittlesoldham.com/ (0.990) [uncaptured citation: https://whittlesoldham.com/]
- Captured provider evidence: none
- All cited URLs: [link](https://whittlesoldham.com/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-12-venue: Shoulder, Fulford

- Source: klma-stoke-gig-list / klma-venue-fef3609d34f8
- Capture status: captured
- Provider identity confidence: 0.990
- Provider reasoning or error: The venue 'Shoulder, Fulford' from the Stoke-on-Trent gig footprint matches 'The Shoulder of Mutton' in Fulford, Stoke-on-Trent (Meadow Lane, ST11 9QS) with confirmed address, official website, and local pub directory listings.
- Accepted facts: none
- Quarantined facts: hasAddress=Meadow Ln, Fulford, Stoke-on-Trent ST11 9QS (0.990) [uncaptured citation: https://www.theshoulderofmuttonfulford.com/]; hasLocation=Fulford, Stoke-on-Trent, Staffordshire (0.990) [uncaptured citation: https://www.theshoulderofmuttonfulford.com/]; hasWebsiteUrl=https://www.theshoulderofmuttonfulford.com/ (0.990) [uncaptured citation: https://www.theshoulderofmuttonfulford.com/]; hasOfficialUrl=https://www.theshoulderofmuttonfulford.com/ (0.990) [uncaptured citation: https://www.theshoulderofmuttonfulford.com/]
- Captured provider evidence: none
- All cited URLs: [link](https://www.theshoulderofmuttonfulford.com/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-13-venue: Bebside Inn Blyth

- Source: onthecase-gig-index / onthecase:venue:90
- Capture status: captured
- Provider identity confidence: 0.990
- Provider reasoning or error: The venue entity source candidate key 'onthecase:venue:90' matches the Bebside Inn Blyth listed on On The Case Music and corroborated by news coverage for the pub in Blyth, Northumberland.
- Accepted facts: none
- Quarantined facts: hasAddress=Front Street, Bebside, Blyth, NE24 4HT, United Kingdom (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIZgTXX4MAv_v9xKoR1_CeZZbPE26qjQR_xvdQ-hkjd0jNHG0CVrOjDUyQ6nAo0VOBqAfBjubPnZtxwI6uH4sK2ryE4ZlSoRShwydBwmBUVrhz5rsWFvDUrEZTH_YMmpt4RHTj6WVwFy8pJcHzJg==]; hasLocation=Blyth, Northumberland, England (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqMrTr0SKyjs1KtYlJeA52SZsPFFCIzwRGD04Tjs0iM-b4SajOtE_sY_K7jiDFceu4lpW2sR-wLiDg7gVdTLoCo69fsof7Pu8N7HG-n35DpY80S9tUXyrdNSQZFxb_94abJ6A_FwaOkGn3vW5nPA8by2e1IIpxXqwrzRfnsw4tjOxv418QvyqlVatSLXENf9s1bBh6qpWQng==]; officialPresenceAttempted=no-official-presence-found (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIZgTXX4MAv_v9xKoR1_CeZZbPE26qjQR_xvdQ-hkjd0jNHG0CVrOjDUyQ6nAo0VOBqAfBjubPnZtxwI6uH4sK2ryE4ZlSoRShwydBwmBUVrhz5rsWFvDUrEZTH_YMmpt4RHTj6WVwFy8pJcHzJg==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIZgTXX4MAv_v9xKoR1_CeZZbPE26qjQR_xvdQ-hkjd0jNHG0CVrOjDUyQ6nAo0VOBqAfBjubPnZtxwI6uH4sK2ryE4ZlSoRShwydBwmBUVrhz5rsWFvDUrEZTH_YMmpt4RHTj6WVwFy8pJcHzJg==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqMrTr0SKyjs1KtYlJeA52SZsPFFCIzwRGD04Tjs0iM-b4SajOtE_sY_K7jiDFceu4lpW2sR-wLiDg7gVdTLoCo69fsof7Pu8N7HG-n35DpY80S9tUXyrdNSQZFxb_94abJ6A_FwaOkGn3vW5nPA8by2e1IIpxXqwrzRfnsw4tjOxv418QvyqlVatSLXENf9s1bBh6qpWQng==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-14-venue: Town House Festival Oswestry

- Source: gigs-news-daily-import / venue_town-house-festival-oswestry
- Capture status: captured
- Provider identity confidence: 0.300
- Provider reasoning or error: No venue or official entity named 'Town House Festival Oswestry' could be verified in public records. Search results show a restaurant/venue named 'Townhouse' in Oswestry (35 Willow Street) and distinct town festivals such as the Oswestry Balloon Carnival and Oswestry Youth Music Festival, but 'Town House Festival Oswestry' cannot be safely identified with 0.98+ confidence.
- Accepted facts: none
- Quarantined facts: none
- Captured provider evidence: none
- All cited URLs: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-15-venue: Murton Officials Club Seaham

- Source: onthecase-gig-index / onthecase:venue:915
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Verified match for Murton Officials Club Seaham located at Woods Terrace East, Murton, Seaham (SR7 9AA), cross-referenced with On The Case Music event listings and local directory sources.
- Accepted facts: none
- Quarantined facts: hasAddress=22a Woods Terrace East, Murton, Seaham, Durham, SR7 9AA, United Kingdom (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEk3lI57E_HlX7lMkU6dnW-tdDq1rKHfQ74ta8EmivjjR0IGfcj5pJ8KwuCsMMdAt4oO9d82EHopkeLcaUCZ490YtGoGT6in472cW8ZXzSXh4-d6tUce8Zum8K407Ver8peQeLaCHhuOZ2Q4XdTpPSPPuNSsPt9XB_7OYHgeqEP]; hasLocation=Murton, Seaham, County Durham, England, United Kingdom (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEu4krqpj7-g_9YQtj7cO1HGr5isQf74mXQ3D3Z19sRA8gPiCBwnO-1umemh706815jQB2oj1zljq_N2LC0D3xL4AQiU6016lpySL9SA6yKlCezgYbjvcMOuS_53ZAZ6CfbXCSKNpssg_odETm1nGW4WB-aEA==]; officialPresenceAttempted=no-official-presence-found (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF5VtTi3l6K_JNcdEZlBZOx7HokBIh0uu1bCmEof_iboGXmfXdChVmi8yRPnYM9daJ1STCnrBaWoluwx5CiFcnvGdMC-bhYVxtYz2Bln9JDy41X4Znwoz4nAxmJEY52tH6i93iwKn59NTZEmjCGo56C8n-WL4ZdGUTIAA==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEk3lI57E_HlX7lMkU6dnW-tdDq1rKHfQ74ta8EmivjjR0IGfcj5pJ8KwuCsMMdAt4oO9d82EHopkeLcaUCZ490YtGoGT6in472cW8ZXzSXh4-d6tUce8Zum8K407Ver8peQeLaCHhuOZ2Q4XdTpPSPPuNSsPt9XB_7OYHgeqEP), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEu4krqpj7-g_9YQtj7cO1HGr5isQf74mXQ3D3Z19sRA8gPiCBwnO-1umemh706815jQB2oj1zljq_N2LC0D3xL4AQiU6016lpySL9SA6yKlCezgYbjvcMOuS_53ZAZ6CfbXCSKNpssg_odETm1nGW4WB-aEA==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF5VtTi3l6K_JNcdEZlBZOx7HokBIh0uu1bCmEof_iboGXmfXdChVmi8yRPnYM9daJ1STCnrBaWoluwx5CiFcnvGdMC-bhYVxtYz2Bln9JDy41X4Znwoz4nAxmJEY52tH6i93iwKn59NTZEmjCGo56C8n-WL4ZdGUTIAA==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-16-venue: Crook Hotel Crook

- Source: onthecase-gig-index / onthecase:venue:940
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The Crook Hotel in Crook, County Durham (56 Hope Street, DL15 9HU, UK) matches the entity name, location, and gig footprint associated with source key onthecase:venue:940.
- Accepted facts: none
- Quarantined facts: hasAddress=56 Hope Street, Crook, County Durham, DL15 9HU, United Kingdom (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEDP8tuifYPQy7LewCeNEslkcUMn4kvo8rerz_VqxbvwrXE2KbCvmUNp9p83rybIQwG2_EeShr2hTZPmVbbIhJKm0AcQCRu1Ya9Q85Y2FfM91GqzN188UjeVDhC35V55i5gMmD9i7G8NE8u]; hasLocation=Crook, County Durham, United Kingdom (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE5FP6DMjCUymFEib-DPzrvejoiZls0QH_B2chtgnKL__XNseQfWyG33ZCA2PdnrAJPTATCLr6Ds9YSykw1pWAvnWihs3qS52mTgG0GyPibOmkafzsJ3tp9AbM7pMB3VwYdRSG2bwxJ9w9X2ro1Vki3huF0JI-9xm7B6xFCaeWPf7SzCRU8_pazElPJVW06gQVz6NtulhZdZFlwkDwlf_shEPWIHg==]; officialPresenceAttempted=no-official-presence-found (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGk8yeHpNDCJxzMo7rUJw6UGM0St-xmBBAKEyy1JJosiTPAEMMinZ3haMdjF5muB5bApib-E8dxK-EmRSgAwBlW3_f09WB5-IxUUrAGB3d-GHSxbEAIl22KLMP2OJNbtbroXryOrjm8VA==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEDP8tuifYPQy7LewCeNEslkcUMn4kvo8rerz_VqxbvwrXE2KbCvmUNp9p83rybIQwG2_EeShr2hTZPmVbbIhJKm0AcQCRu1Ya9Q85Y2FfM91GqzN188UjeVDhC35V55i5gMmD9i7G8NE8u), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE5FP6DMjCUymFEib-DPzrvejoiZls0QH_B2chtgnKL__XNseQfWyG33ZCA2PdnrAJPTATCLr6Ds9YSykw1pWAvnWihs3qS52mTgG0GyPibOmkafzsJ3tp9AbM7pMB3VwYdRSG2bwxJ9w9X2ro1Vki3huF0JI-9xm7B6xFCaeWPf7SzCRU8_pazElPJVW06gQVz6NtulhZdZFlwkDwlf_shEPWIHg==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGk8yeHpNDCJxzMo7rUJw6UGM0St-xmBBAKEyy1JJosiTPAEMMinZ3haMdjF5muB5bApib-E8dxK-EmRSgAwBlW3_f09WB5-IxUUrAGB3d-GHSxbEAIl22KLMP2OJNbtbroXryOrjm8VA==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-17-venue: the Whitehouse Stalybridge

- Source: gigs-news-daily-import / venue_the-whitehouse-stalybridge
- Capture status: captured
- Provider identity confidence: 0.990
- Provider reasoning or error: Confirmed exact identity as The Whitehouse (also known as The White House), a traditional pub and live music venue in Stalybridge located at 1 Water Street, Stalybridge, Greater Manchester.
- Accepted facts: none
- Quarantined facts: hasAddress=1 Water Street, Stalybridge, SK15 2AG, UK (0.980) [uncaptured citation: https://www.hydesbrewery.com/]; hasLocation=Stalybridge, Greater Manchester, UK (0.980) [uncaptured citation: https://www.hydesbrewery.com/]; hasFacebookUrl=https://www.facebook.com/TheWhitehouseStalybridge (0.950) [uncaptured citation: https://www.facebook.com/TheWhitehouseStalybridge]
- Captured provider evidence: none
- All cited URLs: [link](https://www.hydesbrewery.com/), [link](https://www.facebook.com/TheWhitehouseStalybridge)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-18-venue: White Hart Woodley

- Source: gigs-news-daily-import / venue_white-hart-woodley
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Public local records, business directories, and social media listings consistently identify The White Hart as a pub located at 170 Hyde Road, Woodley, Stockport.
- Accepted facts: none
- Quarantined facts: hasAddress=170 Hyde Road, Woodley, Stockport SK6 1NP, UK (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZcjkbII_Cji-WnqBkpeby1LcO5Up4um1VL6pjxEAsT4stdxJrfUTbiwJEpn8N2IfRBLBQ-DV-8ckq3kUGoY4I7v_KFK5M1cY02wk2q023TB_mM2OqUaPaiNuK0PyS9mMtrFPRhe9y6VxHZG6r4wOQo3Do6sJ71mWLOmvrwaeShvAB4X8=, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1EqGGJT9bwbbwOmy9WbdbQybsCjQYHxw3hGqCF67d2GcOA61vH24KYUZTzGy3wLcd3y-XxgK3Jf5wuSXkeZC9_atLCODP9qvySdI_mT3SKaiQ8VEkpZofIBn8JtgvEAjaS1xJguIoogg=]; hasLocation=Woodley, Stockport, Greater Manchester, England, UK (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1EqGGJT9bwbbwOmy9WbdbQybsCjQYHxw3hGqCF67d2GcOA61vH24KYUZTzGy3wLcd3y-XxgK3Jf5wuSXkeZC9_atLCODP9qvySdI_mT3SKaiQ8VEkpZofIBn8JtgvEAjaS1xJguIoogg=, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZcjkbII_Cji-WnqBkpeby1LcO5Up4um1VL6pjxEAsT4stdxJrfUTbiwJEpn8N2IfRBLBQ-DV-8ckq3kUGoY4I7v_KFK5M1cY02wk2q023TB_mM2OqUaPaiNuK0PyS9mMtrFPRhe9y6VxHZG6r4wOQo3Do6sJ71mWLOmvrwaeShvAB4X8=]; hasFacebookUrl=https://www.facebook.com/thewhitehartwoodley (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_wX1NLhDr0HTFirE5kOb2cNtc6GityDjc9fSCDlGI9JKax2P1sIzOHWHKwc2EU_FTUXrOCyR-AOac20atuNrHZprzl7-Df2LYsooY-cCeG3zykgLsfbDU8mM3e3qePfoLd19NBaDjBv-6E81Piu6n-B-aGLbtKaz-OKUq0INAPLwafp2eDixmzAY=]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZcjkbII_Cji-WnqBkpeby1LcO5Up4um1VL6pjxEAsT4stdxJrfUTbiwJEpn8N2IfRBLBQ-DV-8ckq3kUGoY4I7v_KFK5M1cY02wk2q023TB_mM2OqUaPaiNuK0PyS9mMtrFPRhe9y6VxHZG6r4wOQo3Do6sJ71mWLOmvrwaeShvAB4X8=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1EqGGJT9bwbbwOmy9WbdbQybsCjQYHxw3hGqCF67d2GcOA61vH24KYUZTzGy3wLcd3y-XxgK3Jf5wuSXkeZC9_atLCODP9qvySdI_mT3SKaiQ8VEkpZofIBn8JtgvEAjaS1xJguIoogg=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_wX1NLhDr0HTFirE5kOb2cNtc6GityDjc9fSCDlGI9JKax2P1sIzOHWHKwc2EU_FTUXrOCyR-AOac20atuNrHZprzl7-Df2LYsooY-cCeG3zykgLsfbDU8mM3e3qePfoLd19NBaDjBv-6E81Piu6n-B-aGLbtKaz-OKUq0INAPLwafp2eDixmzAY=)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-19-venue: The Globe, Nantwich

- Source: klma-stoke-gig-list / klma-venue-f84e844c02e3
- Capture status: error
- Provider identity confidence: 0.000
- Provider reasoning or error: Gemini 503: {"error":{"message":"The service is currently unavailable.","code":"service_unavailable"}}
- Accepted facts: none
- Quarantined facts: none
- Captured provider evidence: none
- All cited URLs: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-20-venue: The Roebuck, Chesterton

- Source: klma-stoke-gig-list / klma-venue-f88c79f4c673
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Strong identity match confirmed for The Roebuck in Chesterton (Newcastle-under-Lyme / Stoke-on-Trent area), located at Dragon Square, Chesterton, ST5 7HL.
- Accepted facts: none
- Quarantined facts: hasAddress=Dragon Square, Chesterton, Newcastle-under-Lyme ST5 7HL, United Kingdom (0.950) [uncaptured citation: https://caldmoretaverns.co.uk/, https://whatpub.com/pubs/POT/3321/roebuck-chesterton]; hasLocation=Chesterton, Newcastle-under-Lyme, Staffordshire, England (0.950) [uncaptured citation: https://caldmoretaverns.co.uk/, https://www.stokesentinel.co.uk/]; officialPresenceAttempted=no-official-presence-found (0.900) [uncaptured citation: https://whatpub.com/pubs/POT/3321/roebuck-chesterton]
- Captured provider evidence: none
- All cited URLs: [link](https://caldmoretaverns.co.uk/), [link](https://whatpub.com/pubs/POT/3321/roebuck-chesterton), [link](https://www.stokesentinel.co.uk/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

