# Backline grounded-enrichment qualification review

Captured: 2026-08-28T19:57:02.013Z

This is a bounded 20-case provider qualification cohort, not the full Backline corpus. It contains 10 artists and 10 venues selected from the live Trust Loop review set. No canonical writes occurred.

Captured cases: 20/20. Capture errors: 0. Accepted facts: 0. Quarantined facts: 99. Estimated cost: $1.8712.

A quarantined fact is visible for review but is not accepted evidence and cannot project to canonical BNDY. Human adjudication does not repair missing provider citations; those cases remain parked.

| Case | Type | Source | Entity | Capture | Identity confidence | Accepted | Quarantined | Human identity |
|---|---|---|---|---|---:|---:|---:|---|
| grounded-01-artist | artist | gigs-news-daily-import | the Reform | captured | 0.200 | 0 | 0 | match / park |
| grounded-02-artist | artist | klma-stoke-gig-list | Catalyst | captured | 0.980 | 0 | 3 | match / park |
| grounded-03-artist | artist | lemonrock-artist-hydration | Neovenator | captured | 0.980 | 0 | 7 | match / park |
| grounded-04-artist | artist | onthecase-band-hydration | Jonny Trax | captured | 0.980 | 0 | 5 | match / park |
| grounded-05-artist | artist | lemonrock-artist-hydration | The Humbuckers | captured | 0.980 | 0 | 8 | match / park |
| grounded-06-artist | artist | onthecase-band-hydration | Charlotte Forman | captured | 0.990 | 0 | 10 | match / park |
| grounded-07-artist | artist | onthecase-band-hydration | Anna Reay | captured | 0.980 | 0 | 12 | match / park |
| grounded-08-artist | artist | gigs-news-daily-import | the Select Committee | captured | 0.400 | 0 | 0 | match / park |
| grounded-09-artist | artist | gigs-news-daily-import | the Tall Faces | captured | 0.980 | 0 | 9 | match / park |
| grounded-10-artist | artist | gigs-news-daily-import | Tom Meighan Raw26 | captured | 0.980 | 0 | 9 | match / park |
| grounded-11-venue | venue | gigs-news-daily-import | Whittles Oldham | captured | 0.990 | 0 | 4 | match / park |
| grounded-12-venue | venue | klma-stoke-gig-list | Shoulder, Fulford | captured | 0.980 | 0 | 4 | match / park |
| grounded-13-venue | venue | onthecase-gig-index | Bebside Inn Blyth | captured | 0.980 | 0 | 3 | match / park |
| grounded-14-venue | venue | gigs-news-daily-import | Town House Festival Oswestry | captured | 0.300 | 0 | 0 | match / park |
| grounded-15-venue | venue | onthecase-gig-index | Murton Officials Club Seaham | captured | 0.980 | 0 | 3 | match / park |
| grounded-16-venue | venue | onthecase-gig-index | Crook Hotel Crook | captured | 0.990 | 0 | 3 | match / park |
| grounded-17-venue | venue | gigs-news-daily-import | the Whitehouse Stalybridge | captured | 0.990 | 0 | 6 | match / park |
| grounded-18-venue | venue | gigs-news-daily-import | White Hart Woodley | captured | 0.980 | 0 | 4 | match / park |
| grounded-19-venue | venue | klma-stoke-gig-list | The Globe, Nantwich | captured | 0.980 | 0 | 5 | match / park |
| grounded-20-venue | venue | klma-stoke-gig-list | The Roebuck, Chesterton | captured | 0.980 | 0 | 4 | match / park |

## Review instructions

Confirm `match` only if the captured provider evidence definitely belongs to the exact Artist or Venue. Mark `park` for ambiguity, a same-name entity, weak locality, missing provider citations or an unproven official link. Any confident false identity, wrong official URL or unsupported classification fails qualification.

### grounded-01-artist: the Reform

- Source: gigs-news-daily-import / artist_the-reform
- Capture status: captured
- Provider identity confidence: 0.200
- Provider reasoning or error: The name 'the Reform' is shared by several distinct musical entities across different eras and regions (including a 1970s Irish rock band, a Swedish prog quintet, a UK pop group, and local cover bands). Without location, venue, or gig date footprint details in the input, identity cannot be safely established.
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
- Provider identity confidence: 0.980
- Provider reasoning or error: Matched the exact artist source context 'klma-stoke-gig-list' to posts for the Stoke-on-Trent / Newcastle-under-Lyme local gig circuit covers band Catalyst on the community page 'Keep Live Music Alive in Stoke on Trent (Gigs in Stoke)'.
- Accepted facts: none
- Quarantined facts: hasArtistType=Band (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFu7HImumi6g2P818R5db3RCYaWSQuehlf-3C2RDzXssXhAPrF12G6ZhhY4CdAWlEpUleyEpPZAdNFyoQhbqYcGaYhBwIodyXIi3dmUvVbfJLrz1tHQXriD5cMsuXxhJUM6ybPqzmQiBfRIUQCE7AXShJrtp7i7A98KUHHgNYuUnD8BM7rth7LXaXZTQX3XbNgcaXn7kw1CCHjLC9IxFHgMouMzoWxReGKD0xOsdk0JjgcmHlTjklk8BmnM5hP3mkduj3iCHs8=]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEalcXuooikUkmrzNsceqVSyi1-eSG_2Ku4_-Zj4f03VAt7VQuGkXACSFUW26sfcnsvG6Elj-eb1XQBx1biTtC9bpAr9VRdKZqdQd_r-c7M6Nsk6bNEIaURVuhU5FG_5xhiO6K_inO_G1FTwbby7kLtL5mPJ6I5-AtVJmrgfJHqXD1P]; officialPresenceAttempted=no-official-presence-found (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFu7HImumi6g2P818R5db3RCYaWSQuehlf-3C2RDzXssXhAPrF12G6ZhhY4CdAWlEpUleyEpPZAdNFyoQhbqYcGaYhBwIodyXIi3dmUvVbfJLrz1tHQXriD5cMsuXxhJUM6ybPqzmQiBfRIUQCE7AXShJrtp7i7A98KUHHgNYuUnD8BM7rth7LXaXZTQX3XbNgcaXn7kw1CCHjLC9IxFHgMouMzoWxReGKD0xOsdk0JjgcmHlTjklk8BmnM5hP3mkduj3iCHs8=]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFu7HImumi6g2P818R5db3RCYaWSQuehlf-3C2RDzXssXhAPrF12G6ZhhY4CdAWlEpUleyEpPZAdNFyoQhbqYcGaYhBwIodyXIi3dmUvVbfJLrz1tHQXriD5cMsuXxhJUM6ybPqzmQiBfRIUQCE7AXShJrtp7i7A98KUHHgNYuUnD8BM7rth7LXaXZTQX3XbNgcaXn7kw1CCHjLC9IxFHgMouMzoWxReGKD0xOsdk0JjgcmHlTjklk8BmnM5hP3mkduj3iCHs8=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEalcXuooikUkmrzNsceqVSyi1-eSG_2Ku4_-Zj4f03VAt7VQuGkXACSFUW26sfcnsvG6Elj-eb1XQBx1biTtC9bpAr9VRdKZqdQd_r-c7M6Nsk6bNEIaURVuhU5FG_5xhiO6K_inO_G1FTwbby7kLtL5mPJ6I5-AtVJmrgfJHqXD1P)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-03-artist: Neovenator

- Source: lemonrock-artist-hydration / lemonrock:artist:neovenator
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Strong public evidence establishes Neovenator as a UK live music act featured on Lemonrock gig rosters and venue schedules, releasing music through Flicknife Records.
- Accepted facts: none
- Quarantined facts: hasArtistType=Band (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE38vKTe3frfmkWixDIBdlzTlKBGLae8deM7Iwltojk-1wojZVAZOqom3z45pgD6IsDB74GFxFgrmfwigkigEc74COftZhQ0dimGUgn7mbv2-o1yu9_]; hasActType=Originals (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE38vKTe3frfmkWixDIBdlzTlKBGLae8deM7Iwltojk-1wojZVAZOqom3z45pgD6IsDB74GFxFgrmfwigkigEc74COftZhQ0dimGUgn7mbv2-o1yu9_]; isAcoustic=false (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHPzBjOUjnLG6q4FoaQFFSh0XO0uGGzui67Ma8dvPiMcwEskEVNATfPO92DqHEnqGkDPKmiPIx9qIv-HOsxJIuecjdoTuQw1854zqse0ycbO8Rf1NtaRNMberqqQt4zDfdkhpf_Ac5Lx6wN4S1Fr_cKsHVcEUoKIquT6h9KPYXZDiFiH7djLQ==]; hasGenre=Rock (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEeflkKdeh8HkCk6jrLdsw16ossJQjdWseyXzV16nikWJK19H9LNVqQYzOc9uustU_K8noLpnxy3gQ2biJo8Od2thLG8Q8LOEgouM6hLsLPhKI=]; hasGenre=Punk (0.920) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEHzmTV0GW7gDag1AcifJnX0rlFZ1sxethTMpOJeYPuAiQZkxvxF2ZeDHenY8viQ2NMUzoyqZZE_LBU4MG5r2KWCGq3dWSROMrGKS6xNX8IRQ==]; hasGenre=Alternative (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE38vKTe3frfmkWixDIBdlzTlKBGLae8deM7Iwltojk-1wojZVAZOqom3z45pgD6IsDB74GFxFgrmfwigkigEc74COftZhQ0dimGUgn7mbv2-o1yu9_]; hasBandcampUrl=https://neovenator.bandcamp.com (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGOGvmH6RXBKaqs95VLSjScG8Vv4ef-QVNfaCfzF9J61QCvvzDbuDbX-XXPeDzj6rEEWy0MP5Lz__HnUnvX1oKtaTNGLVspacxJw6lvgGUA5OY_EEHAN6oTHttMrjP1lhDoXcolXt3ARR0qRjCtCXE3rkyZ71dGa121sklNFw-KiREhgQmoZPb0a50-OqTyqP9HqcrNtB8XkMJUhpxFMFiGXxaidZI2oIihRittPN0Mbcjwxx1SREm8_uClydDmiRYX5Rwo3hd3XFfUPg==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE38vKTe3frfmkWixDIBdlzTlKBGLae8deM7Iwltojk-1wojZVAZOqom3z45pgD6IsDB74GFxFgrmfwigkigEc74COftZhQ0dimGUgn7mbv2-o1yu9_), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHPzBjOUjnLG6q4FoaQFFSh0XO0uGGzui67Ma8dvPiMcwEskEVNATfPO92DqHEnqGkDPKmiPIx9qIv-HOsxJIuecjdoTuQw1854zqse0ycbO8Rf1NtaRNMberqqQt4zDfdkhpf_Ac5Lx6wN4S1Fr_cKsHVcEUoKIquT6h9KPYXZDiFiH7djLQ==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEeflkKdeh8HkCk6jrLdsw16ossJQjdWseyXzV16nikWJK19H9LNVqQYzOc9uustU_K8noLpnxy3gQ2biJo8Od2thLG8Q8LOEgouM6hLsLPhKI=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEHzmTV0GW7gDag1AcifJnX0rlFZ1sxethTMpOJeYPuAiQZkxvxF2ZeDHenY8viQ2NMUzoyqZZE_LBU4MG5r2KWCGq3dWSROMrGKS6xNX8IRQ==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGOGvmH6RXBKaqs95VLSjScG8Vv4ef-QVNfaCfzF9J61QCvvzDbuDbX-XXPeDzj6rEEWy0MP5Lz__HnUnvX1oKtaTNGLVspacxJw6lvgGUA5OY_EEHAN6oTHttMrjP1lhDoXcolXt3ARR0qRjCtCXE3rkyZ71dGa121sklNFw-KiREhgQmoZPb0a50-OqTyqP9HqcrNtB8XkMJUhpxFMFiGXxaidZI2oIihRittPN0Mbcjwxx1SREm8_uClydDmiRYX5Rwo3hd3XFfUPg==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-04-artist: Jonny Trax

- Source: onthecase-band-hydration / onthecase:band:1211
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The entity corresponds directly to the Jonny Trax listing on On The Case Music (onthecasemusic.co.uk), matching the source candidate key 'onthecase:band:1211' and source ID 'onthecase-band-hydration'.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.850) [uncaptured citation: https://onthecasemusic.co.uk/]; hasActType=Covers (0.950) [uncaptured citation: https://onthecasemusic.co.uk/]; hasGenre=Rock (0.950) [uncaptured citation: https://onthecasemusic.co.uk/]; hasGenre=Pop (0.950) [uncaptured citation: https://onthecasemusic.co.uk/]; officialPresenceAttempted=no-official-presence-found (0.900) [uncaptured citation: https://onthecasemusic.co.uk/]
- Captured provider evidence: none
- All cited URLs: [link](https://onthecasemusic.co.uk/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-05-artist: The Humbuckers

- Source: lemonrock-artist-hydration / lemonrock:artist:thehumbuckers
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The entity matches the Sussex, UK live music footprint associated with Lemonrock listings for 'The Humbuckers', identified as a south-coast blues-rock cover band playing local venues such as The Duke of Wellington in Shoreham, The Bull Inn in Battle, and The Cow & Oak in Worthing.
- Accepted facts: none
- Quarantined facts: hasArtistType=Band (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkuORkIBCG5Y_gv5vG1NO_VQo9hqMysPJSLoPaXNcbR2s2YQTDFOSpU0CPULu25bua9CR_llXPoC6k-Y1f48L7-fblyAmhUE5tEBK2DaMj41nJl3nI2lnTWquYj6109k4tE5WVqpOMvdmI-WCTZPrFd5VwDiRCl7nSJcMy, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHAFKZEURwOYwaqPZTNQE6NsxI8GS1nVxfD2sUxP2xZtv_zn6qkT7SXe8zHZjgLiW7-IMEL4vNvehNusSPMp4bFjuQAGrcJIFG9g33uFT5d2NAhJ6rvSLGsArZL9ZuD2z-04w0JqsbOpy1oe6CEtA_g31L0-NojhOa2QpMsSWU=]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkuORkIBCG5Y_gv5vG1NO_VQo9hqMysPJSLoPaXNcbR2s2YQTDFOSpU0CPULu25bua9CR_llXPoC6k-Y1f48L7-fblyAmhUE5tEBK2DaMj41nJl3nI2lnTWquYj6109k4tE5WVqpOMvdmI-WCTZPrFd5VwDiRCl7nSJcMy, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHAFKZEURwOYwaqPZTNQE6NsxI8GS1nVxfD2sUxP2xZtv_zn6qkT7SXe8zHZjgLiW7-IMEL4vNvehNusSPMp4bFjuQAGrcJIFG9g33uFT5d2NAhJ6rvSLGsArZL9ZuD2z-04w0JqsbOpy1oe6CEtA_g31L0-NojhOa2QpMsSWU=]; hasGenre=Blues (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkuORkIBCG5Y_gv5vG1NO_VQo9hqMysPJSLoPaXNcbR2s2YQTDFOSpU0CPULu25bua9CR_llXPoC6k-Y1f48L7-fblyAmhUE5tEBK2DaMj41nJl3nI2lnTWquYj6109k4tE5WVqpOMvdmI-WCTZPrFd5VwDiRCl7nSJcMy]; hasGenre=Rock (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkuORkIBCG5Y_gv5vG1NO_VQo9hqMysPJSLoPaXNcbR2s2YQTDFOSpU0CPULu25bua9CR_llXPoC6k-Y1f48L7-fblyAmhUE5tEBK2DaMj41nJl3nI2lnTWquYj6109k4tE5WVqpOMvdmI-WCTZPrFd5VwDiRCl7nSJcMy]; hasGenre=Rock n Roll (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkuORkIBCG5Y_gv5vG1NO_VQo9hqMysPJSLoPaXNcbR2s2YQTDFOSpU0CPULu25bua9CR_llXPoC6k-Y1f48L7-fblyAmhUE5tEBK2DaMj41nJl3nI2lnTWquYj6109k4tE5WVqpOMvdmI-WCTZPrFd5VwDiRCl7nSJcMy]; hasGenre=R&B (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkuORkIBCG5Y_gv5vG1NO_VQo9hqMysPJSLoPaXNcbR2s2YQTDFOSpU0CPULu25bua9CR_llXPoC6k-Y1f48L7-fblyAmhUE5tEBK2DaMj41nJl3nI2lnTWquYj6109k4tE5WVqpOMvdmI-WCTZPrFd5VwDiRCl7nSJcMy]; isAcoustic=false (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkuORkIBCG5Y_gv5vG1NO_VQo9hqMysPJSLoPaXNcbR2s2YQTDFOSpU0CPULu25bua9CR_llXPoC6k-Y1f48L7-fblyAmhUE5tEBK2DaMj41nJl3nI2lnTWquYj6109k4tE5WVqpOMvdmI-WCTZPrFd5VwDiRCl7nSJcMy]; officialPresenceAttempted=no-official-presence-found (1.000) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkuORkIBCG5Y_gv5vG1NO_VQo9hqMysPJSLoPaXNcbR2s2YQTDFOSpU0CPULu25bua9CR_llXPoC6k-Y1f48L7-fblyAmhUE5tEBK2DaMj41nJl3nI2lnTWquYj6109k4tE5WVqpOMvdmI-WCTZPrFd5VwDiRCl7nSJcMy]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkuORkIBCG5Y_gv5vG1NO_VQo9hqMysPJSLoPaXNcbR2s2YQTDFOSpU0CPULu25bua9CR_llXPoC6k-Y1f48L7-fblyAmhUE5tEBK2DaMj41nJl3nI2lnTWquYj6109k4tE5WVqpOMvdmI-WCTZPrFd5VwDiRCl7nSJcMy), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHAFKZEURwOYwaqPZTNQE6NsxI8GS1nVxfD2sUxP2xZtv_zn6qkT7SXe8zHZjgLiW7-IMEL4vNvehNusSPMp4bFjuQAGrcJIFG9g33uFT5d2NAhJ6rvSLGsArZL9ZuD2z-04w0JqsbOpy1oe6CEtA_g31L0-NojhOa2QpMsSWU=)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-06-artist: Charlotte Forman

- Source: onthecase-band-hydration / onthecase:band:26683
- Capture status: captured
- Provider identity confidence: 0.990
- Provider reasoning or error: The target candidate key 'onthecase:band:26683' directly matches the On The Case Music booking profile for Durham/North East UK singer-songwriter Charlotte Forman, confirmed across official website, Facebook, Instagram, and press sources.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHX1RaLZWBDq9OlRvF2DGfFcmD8EqTixoTW7llv7f3cBmg3aQu1aJM8N5TzDjt2I4pWTzP18id_79uVHP1Mgb5KEmlcxvsxKFkiAmVMQZ6EnJPcfviseKQu-LEW_gRhzmDKHMnegpm_X5ub4DXWQ==, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH2Ap5fhmzs-glxgQjXUKueumNAFyHixoSnXAxLKfLWDqa7j-BRvRC3SsoYtVmUcF-DVRM44CB2yKbiBGYevd7xyt_EQ1aCN4uIhfRpBBj0cevsLeSgIWc-u_1v8nK_99x50g==]; hasActType=Originals (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHX1RaLZWBDq9OlRvF2DGfFcmD8EqTixoTW7llv7f3cBmg3aQu1aJM8N5TzDjt2I4pWTzP18id_79uVHP1Mgb5KEmlcxvsxKFkiAmVMQZ6EnJPcfviseKQu-LEW_gRhzmDKHMnegpm_X5ub4DXWQ==, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQES9JtJnlU3DVx0HcZYRJ4LX7wCxZKpowdK1UHgBumLZHwLZnIQ6gyeLc69DO08DczI-XNioPMNIAB-PnKuJU8K7JIhDt9_NpoIyJqmvGY_Rg2GWUIzyJdNyaUPZjAAQ7QnhVGeAA==]; hasActType=Covers (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHX1RaLZWBDq9OlRvF2DGfFcmD8EqTixoTW7llv7f3cBmg3aQu1aJM8N5TzDjt2I4pWTzP18id_79uVHP1Mgb5KEmlcxvsxKFkiAmVMQZ6EnJPcfviseKQu-LEW_gRhzmDKHMnegpm_X5ub4DXWQ==, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQES9JtJnlU3DVx0HcZYRJ4LX7wCxZKpowdK1UHgBumLZHwLZnIQ6gyeLc69DO08DczI-XNioPMNIAB-PnKuJU8K7JIhDt9_NpoIyJqmvGY_Rg2GWUIzyJdNyaUPZjAAQ7QnhVGeAA==]; hasGenre=Pop (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHX1RaLZWBDq9OlRvF2DGfFcmD8EqTixoTW7llv7f3cBmg3aQu1aJM8N5TzDjt2I4pWTzP18id_79uVHP1Mgb5KEmlcxvsxKFkiAmVMQZ6EnJPcfviseKQu-LEW_gRhzmDKHMnegpm_X5ub4DXWQ==]; hasGenre=Soul (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHX1RaLZWBDq9OlRvF2DGfFcmD8EqTixoTW7llv7f3cBmg3aQu1aJM8N5TzDjt2I4pWTzP18id_79uVHP1Mgb5KEmlcxvsxKFkiAmVMQZ6EnJPcfviseKQu-LEW_gRhzmDKHMnegpm_X5ub4DXWQ==]; hasGenre=Jazz (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHX1RaLZWBDq9OlRvF2DGfFcmD8EqTixoTW7llv7f3cBmg3aQu1aJM8N5TzDjt2I4pWTzP18id_79uVHP1Mgb5KEmlcxvsxKFkiAmVMQZ6EnJPcfviseKQu-LEW_gRhzmDKHMnegpm_X5ub4DXWQ==]; hasFacebookUrl=https://www.facebook.com/Charlottef94 (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHH9eoEFoBLYhPH72Rg08vEpLE7mfXwZBeoucf7Kkb5sj5IHx8GfzxtPjdbVY9Riv6IsKWYj6iGL5tgVcZ1Ov6tETRfvez7tC8sLZGANRNMppBCGGtCScyeE7fH]; hasWebsiteUrl=https://charlotteforman.co.uk (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQES9JtJnlU3DVx0HcZYRJ4LX7wCxZKpowdK1UHgBumLZHwLZnIQ6gyeLc69DO08DczI-XNioPMNIAB-PnKuJU8K7JIhDt9_NpoIyJqmvGY_Rg2GWUIzyJdNyaUPZjAAQ7QnhVGeAA==, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHH9eoEFoBLYhPH72Rg08vEpLE7mfXwZBeoucf7Kkb5sj5IHx8GfzxtPjdbVY9Riv6IsKWYj6iGL5tgVcZ1Ov6tETRfvez7tC8sLZGANRNMppBCGGtCScyeE7fH]; hasOfficialUrl=https://charlotteforman.co.uk (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQES9JtJnlU3DVx0HcZYRJ4LX7wCxZKpowdK1UHgBumLZHwLZnIQ6gyeLc69DO08DczI-XNioPMNIAB-PnKuJU8K7JIhDt9_NpoIyJqmvGY_Rg2GWUIzyJdNyaUPZjAAQ7QnhVGeAA==]; hasInstagramUrl=https://www.instagram.com/singercharlotteforman/ (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8IM9vG9ES4IG6rbQzIhckeIaaWTrTKxV9ICLBJVWT_lM8BVPFkVkj9hi_isOU-FqNN0YYApH44GT2U5j5-hzdE5q-z2embFzoeWiyEEYkpbNQrS2T-VWcRz6woATYRQo=]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHX1RaLZWBDq9OlRvF2DGfFcmD8EqTixoTW7llv7f3cBmg3aQu1aJM8N5TzDjt2I4pWTzP18id_79uVHP1Mgb5KEmlcxvsxKFkiAmVMQZ6EnJPcfviseKQu-LEW_gRhzmDKHMnegpm_X5ub4DXWQ==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH2Ap5fhmzs-glxgQjXUKueumNAFyHixoSnXAxLKfLWDqa7j-BRvRC3SsoYtVmUcF-DVRM44CB2yKbiBGYevd7xyt_EQ1aCN4uIhfRpBBj0cevsLeSgIWc-u_1v8nK_99x50g==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQES9JtJnlU3DVx0HcZYRJ4LX7wCxZKpowdK1UHgBumLZHwLZnIQ6gyeLc69DO08DczI-XNioPMNIAB-PnKuJU8K7JIhDt9_NpoIyJqmvGY_Rg2GWUIzyJdNyaUPZjAAQ7QnhVGeAA==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHH9eoEFoBLYhPH72Rg08vEpLE7mfXwZBeoucf7Kkb5sj5IHx8GfzxtPjdbVY9Riv6IsKWYj6iGL5tgVcZ1Ov6tETRfvez7tC8sLZGANRNMppBCGGtCScyeE7fH), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8IM9vG9ES4IG6rbQzIhckeIaaWTrTKxV9ICLBJVWT_lM8BVPFkVkj9hi_isOU-FqNN0YYApH44GT2U5j5-hzdE5q-z2embFzoeWiyEEYkpbNQrS2T-VWcRz6woATYRQo=)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-07-artist: Anna Reay

- Source: onthecase-band-hydration / onthecase:band:27822
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The entity corresponds to Newcastle-based professional vocalist and bandleader Anna Reay (who performs solo, as the Anna Reay Duo, and with the Anna Reay Band), verified via her official domain annareay.co.uk and official Facebook page.
- Accepted facts: none
- Quarantined facts: hasWebsiteUrl=http://annareay.co.uk (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQECw4LzX8hDWIkqQq9R4knyKlWFUtDsVJWa3KdkMN-VcEOx0vV_adftO_ccOuUYpQiMI0m-B4L9MEibLb9WSuYjhXLRkNV3QH62onk82A==]; hasOfficialUrl=http://annareay.co.uk (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQECw4LzX8hDWIkqQq9R4knyKlWFUtDsVJWa3KdkMN-VcEOx0vV_adftO_ccOuUYpQiMI0m-B4L9MEibLb9WSuYjhXLRkNV3QH62onk82A==]; hasFacebookUrl=https://www.facebook.com/annareayband/ (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG-yD-5j4B_QDyRuphEYS5BRxMguDQrmS16TTe4RrnC_01Sl0su843GQSpURAaRIJczMegAaWji5OIvNTLvBECN3eS6gycLVuW1wtosPHjAaxhthN8LdTUmsi-K2RD0f2TJCFFXuX5TRw_11KHK6ReuaTAJZeRaq1oLhw8zQ277Y0KyA69x35BObL56BZKXsZY=]; hasArtistType=Solo Act (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHhP2V7Eclq-HakI_8m--pzELVzr4KlCXrbgh_7s3Qm9emTNPe0ZOMwzJYj5aJoiZcGij1W5RXCLHcyVqMji3mmRYq6vTTUB0C7KF60cy-cbuMSTzz10QeHdcw=]; hasArtistType=Band (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHhP2V7Eclq-HakI_8m--pzELVzr4KlCXrbgh_7s3Qm9emTNPe0ZOMwzJYj5aJoiZcGij1W5RXCLHcyVqMji3mmRYq6vTTUB0C7KF60cy-cbuMSTzz10QeHdcw=]; hasArtistType=Duo (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHWrNdX9oeU_Sv81DKVo9i0PsAAtK0Gd6HJFUlk0Q0g9uaUN3Y6q9cn8IS-OUaxS-4iLpJTKCz-Fku2IHYu2HbD-Py8OGNoqN7D3LXsdQni]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHhP2V7Eclq-HakI_8m--pzELVzr4KlCXrbgh_7s3Qm9emTNPe0ZOMwzJYj5aJoiZcGij1W5RXCLHcyVqMji3mmRYq6vTTUB0C7KF60cy-cbuMSTzz10QeHdcw=]; hasActType=Originals (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHWrNdX9oeU_Sv81DKVo9i0PsAAtK0Gd6HJFUlk0Q0g9uaUN3Y6q9cn8IS-OUaxS-4iLpJTKCz-Fku2IHYu2HbD-Py8OGNoqN7D3LXsdQni]; hasGenre=Pop (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHhP2V7Eclq-HakI_8m--pzELVzr4KlCXrbgh_7s3Qm9emTNPe0ZOMwzJYj5aJoiZcGij1W5RXCLHcyVqMji3mmRYq6vTTUB0C7KF60cy-cbuMSTzz10QeHdcw=]; hasGenre=Jazz (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHhP2V7Eclq-HakI_8m--pzELVzr4KlCXrbgh_7s3Qm9emTNPe0ZOMwzJYj5aJoiZcGij1W5RXCLHcyVqMji3mmRYq6vTTUB0C7KF60cy-cbuMSTzz10QeHdcw=]; hasGenre=Rock (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYGg4UiB3QRbFWb9Ug6d_MiMW7SwfKlcJUkrONrh0g9Tkh28PxxuG-ATJ9yBMAgdD3En0bKie8J62ixDxZIfpObRJpxtCmhuoo6_DexOJI_A3lv7Fj1rpTDaQOJUk4dBDrDCGdpK]; hasGenre=Classical (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYGg4UiB3QRbFWb9Ug6d_MiMW7SwfKlcJUkrONrh0g9Tkh28PxxuG-ATJ9yBMAgdD3En0bKie8J62ixDxZIfpObRJpxtCmhuoo6_DexOJI_A3lv7Fj1rpTDaQOJUk4dBDrDCGdpK]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQECw4LzX8hDWIkqQq9R4knyKlWFUtDsVJWa3KdkMN-VcEOx0vV_adftO_ccOuUYpQiMI0m-B4L9MEibLb9WSuYjhXLRkNV3QH62onk82A==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG-yD-5j4B_QDyRuphEYS5BRxMguDQrmS16TTe4RrnC_01Sl0su843GQSpURAaRIJczMegAaWji5OIvNTLvBECN3eS6gycLVuW1wtosPHjAaxhthN8LdTUmsi-K2RD0f2TJCFFXuX5TRw_11KHK6ReuaTAJZeRaq1oLhw8zQ277Y0KyA69x35BObL56BZKXsZY=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHhP2V7Eclq-HakI_8m--pzELVzr4KlCXrbgh_7s3Qm9emTNPe0ZOMwzJYj5aJoiZcGij1W5RXCLHcyVqMji3mmRYq6vTTUB0C7KF60cy-cbuMSTzz10QeHdcw=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHWrNdX9oeU_Sv81DKVo9i0PsAAtK0Gd6HJFUlk0Q0g9uaUN3Y6q9cn8IS-OUaxS-4iLpJTKCz-Fku2IHYu2HbD-Py8OGNoqN7D3LXsdQni), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYGg4UiB3QRbFWb9Ug6d_MiMW7SwfKlcJUkrONrh0g9Tkh28PxxuG-ATJ9yBMAgdD3En0bKie8J62ixDxZIfpObRJpxtCmhuoo6_DexOJI_A3lv7Fj1rpTDaQOJUk4dBDrDCGdpK)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-08-artist: the Select Committee

- Source: gigs-news-daily-import / artist_the-select-committee
- Capture status: captured
- Provider identity confidence: 0.400
- Provider reasoning or error: Multiple distinct musical entities exist under the name 'The Select Committee' (including a 1980s UK reggae group associated with Maxi Priest and a contemporary UK pub cover band). Without specific gig, venue, or geographic footprint in the source record, identity cannot be safely established.
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
- Provider reasoning or error: The Tall Faces is positively identified as a 1960s Mod, Soul, and Beat cover/tribute band operating out of Stockport and North West England, evidenced by documented gig listings and an official Facebook presence.
- Accepted facts: none
- Quarantined facts: hasFacebookUrl=https://www.facebook.com/TheTallFaces/ (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE1KiC7T3PJC-n6WVSX3ynzxA3vWMLm_QPxEUj2j6am3nP9yWOZOtN8wU1oMZfNVOVZdFw_Lvi-tCXF5GVXoJCaNKnTle_g8zO7HVI0sDqzdMHfNH6G9IZq3GuIibBNLVjPCYYGwevu_0yoaMaHvmnRO4hi0Q==]; hasOfficialUrl=https://www.facebook.com/TheTallFaces/ (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE1KiC7T3PJC-n6WVSX3ynzxA3vWMLm_QPxEUj2j6am3nP9yWOZOtN8wU1oMZfNVOVZdFw_Lvi-tCXF5GVXoJCaNKnTle_g8zO7HVI0sDqzdMHfNH6G9IZq3GuIibBNLVjPCYYGwevu_0yoaMaHvmnRO4hi0Q==]; hasArtistType=Band (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDW6_JLfnoTIoTJ8VRi83hC-D-8fETD85BTNafI4qZIXvLRn5-_Or5qqiDDDBtbfSeWVByqYHnCOcngOXcamHXEs_zX1xmSPkZ5HXp1mlQ78C87D7iiIs8bqI4Jdg1O77g1-CUH_k4tcnJzK0=]; hasActType=Covers (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_P3RM0QF3klVFtj2xubtf_nHC1GjlDg72BAqvmFUcrhLGuln94CjPld6QEtkfbs9HFgR-9gLuHdP0aLXQckHHKjwEpaYCVw2pIFzlvcNtf6bpwBGprWQh674j8PDugFWh]; hasActType=Tribute Act (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFyYU_m3DXVZFJp9d08KBs8EiKk3w2PZWRils3h-PYO1kZagVfMzqioYMBrjaPDT4mOJq2vYuAQIO2P6PrcneY3aF8bN1MMc_24yez8VmerabmP7xa62vqe6opkRyqz2ZdiZkOfkmlAnQ==]; hasGenre=Mod (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDW6_JLfnoTIoTJ8VRi83hC-D-8fETD85BTNafI4qZIXvLRn5-_Or5qqiDDDBtbfSeWVByqYHnCOcngOXcamHXEs_zX1xmSPkZ5HXp1mlQ78C87D7iiIs8bqI4Jdg1O77g1-CUH_k4tcnJzK0=]; hasGenre=Soul (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDW6_JLfnoTIoTJ8VRi83hC-D-8fETD85BTNafI4qZIXvLRn5-_Or5qqiDDDBtbfSeWVByqYHnCOcngOXcamHXEs_zX1xmSPkZ5HXp1mlQ78C87D7iiIs8bqI4Jdg1O77g1-CUH_k4tcnJzK0=]; hasGenre=Pop (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDW6_JLfnoTIoTJ8VRi83hC-D-8fETD85BTNafI4qZIXvLRn5-_Or5qqiDDDBtbfSeWVByqYHnCOcngOXcamHXEs_zX1xmSPkZ5HXp1mlQ78C87D7iiIs8bqI4Jdg1O77g1-CUH_k4tcnJzK0=]; hasGenre=R&B (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDW6_JLfnoTIoTJ8VRi83hC-D-8fETD85BTNafI4qZIXvLRn5-_Or5qqiDDDBtbfSeWVByqYHnCOcngOXcamHXEs_zX1xmSPkZ5HXp1mlQ78C87D7iiIs8bqI4Jdg1O77g1-CUH_k4tcnJzK0=]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE1KiC7T3PJC-n6WVSX3ynzxA3vWMLm_QPxEUj2j6am3nP9yWOZOtN8wU1oMZfNVOVZdFw_Lvi-tCXF5GVXoJCaNKnTle_g8zO7HVI0sDqzdMHfNH6G9IZq3GuIibBNLVjPCYYGwevu_0yoaMaHvmnRO4hi0Q==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDW6_JLfnoTIoTJ8VRi83hC-D-8fETD85BTNafI4qZIXvLRn5-_Or5qqiDDDBtbfSeWVByqYHnCOcngOXcamHXEs_zX1xmSPkZ5HXp1mlQ78C87D7iiIs8bqI4Jdg1O77g1-CUH_k4tcnJzK0=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_P3RM0QF3klVFtj2xubtf_nHC1GjlDg72BAqvmFUcrhLGuln94CjPld6QEtkfbs9HFgR-9gLuHdP0aLXQckHHKjwEpaYCVw2pIFzlvcNtf6bpwBGprWQh674j8PDugFWh), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFyYU_m3DXVZFJp9d08KBs8EiKk3w2PZWRils3h-PYO1kZagVfMzqioYMBrjaPDT4mOJq2vYuAQIO2P6PrcneY3aF8bN1MMc_24yez8VmerabmP7xa62vqe6opkRyqz2ZdiZkOfkmlAnQ==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-10-artist: Tom Meighan Raw26

- Source: gigs-news-daily-import / artist_tom-meighan-raw26
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Public evidence from official tour listings and press coverage confirms 'Tom Meighan Raw26' corresponds to former Kasabian lead vocalist Tom Meighan performing his official 2026 UK acoustic 'RAW 26' tour.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFEJ6cjfPokY4oerzPcrpgzhU0t67Qo8n3rNUBbVwhcz0XSN2sRisB3HAbJC7mFWBSdsrp3uy_qV63QIoAvQPaekBUDko2gnMfpAHwgP_3TVa33GRw06y0l10zeYcVFSzfdjoiKrDqIng_1cTKxJQzS4es8JF4llBY-EClDu9Ewp_iuZRaEsVaLtw4dNyiv_rzOZjhkbqZ1s2bbsedr8ZOE9YpUjt9CC7r5_DJXYJH7gvTbbCb5-ZvBWQbiZn2L_BJxA3eKQlOT]; hasActType=Originals (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFEJ6cjfPokY4oerzPcrpgzhU0t67Qo8n3rNUBbVwhcz0XSN2sRisB3HAbJC7mFWBSdsrp3uy_qV63QIoAvQPaekBUDko2gnMfpAHwgP_3TVa33GRw06y0l10zeYcVFSzfdjoiKrDqIng_1cTKxJQzS4es8JF4llBY-EClDu9Ewp_iuZRaEsVaLtw4dNyiv_rzOZjhkbqZ1s2bbsedr8ZOE9YpUjt9CC7r5_DJXYJH7gvTbbCb5-ZvBWQbiZn2L_BJxA3eKQlOT]; isAcoustic=true (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEbUg3yPI36tMwZrfUiyP3lhqoxT8vean0_oxpUBFxmh8b2VQKOguJ0R2jnX7L6Oy2izrgQKpIHKaXmKgLQh0XE0UkOlmYxg0ybMnZ5zwp8FVIRtJsczUxGq-74jtTZX0d5L6_-pHhoGP82C5Gfrq1TAXh-mJGv5t7P8rT-1E3gI-jCBPGV7U80F5gdl3Llxc5Ztk8ZQhLGGQeIfYtQ9BW6AHDIIfhc8wpVC5BiAMz5NhhT]; hasGenre=Rock (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEMPK8Uy_u9wcAK4Cp1X6mvzDcCL_SK57cUbCslbD9KOAs-KtHjukYTYkczYyX9lxIWmRzr4nGd80ekn94cWUBtFVYOETTm040MAkgtH0HjUTxPTJeBR8NnlG5iqZn5Hq8oycag2jHBIhATTbs_bQ==]; hasGenre=Indie (0.920) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFpQewtZYrWsp_IH_XV-2vQtHViV2r-1uVHRM0nIUFA6zGCc8iTvhqsfyDKXrDw_J-gNyUdJq6hCmI4VZcmpBWHegxw3DpdgwkAx0Qy6sjpVbBH1APmfd5GQN-UdE70amXErco0wPL0t-jvXX9V]; hasWebsiteUrl=https://www.tommeighanofficial.com (0.990) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGX21HDe7LxeD6ve_qdBwP6-wFuIGQMpIciu6DmQ2-fb9KRdPf9Jozori7h-e_txEYu3Ac7QErNoMm3CsnKf2BdiAKLOrV1A3kiWIakdqpClo2P]; hasOfficialUrl=https://www.tommeighanofficial.com (0.990) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGX21HDe7LxeD6ve_qdBwP6-wFuIGQMpIciu6DmQ2-fb9KRdPf9Jozori7h-e_txEYu3Ac7QErNoMm3CsnKf2BdiAKLOrV1A3kiWIakdqpClo2P]; hasFacebookUrl=https://www.facebook.com/TomMeighanOfficial (0.990) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKt-KWtjsiHsuJcjEMKCQ44n-WKwGojh7gPKPACz-y8rqaNsbEGX7qyZOpaVfDdcWPL2X194e8cc-lz6uVCx8aZ21d9aqSJYHBKD3W7EyC9zLmkbFVxMHgvPT1J4u-9CN5uA==]; hasInstagramUrl=https://www.instagram.com/tommeighanofficial/ (0.990) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEuWXmB1yOJV4s8THhIxclvR7tMAnvn0tHfOMrQTHhq-SH8colk5PcjmH2KUNkx8_HldiLo2MWOOZrfzTZUrI2gb5HnvPx9KyxfERiHVQMmAoWac7KV4nb0V04WcaKy1c9n9dX1vPrfsBOeQb8=]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFEJ6cjfPokY4oerzPcrpgzhU0t67Qo8n3rNUBbVwhcz0XSN2sRisB3HAbJC7mFWBSdsrp3uy_qV63QIoAvQPaekBUDko2gnMfpAHwgP_3TVa33GRw06y0l10zeYcVFSzfdjoiKrDqIng_1cTKxJQzS4es8JF4llBY-EClDu9Ewp_iuZRaEsVaLtw4dNyiv_rzOZjhkbqZ1s2bbsedr8ZOE9YpUjt9CC7r5_DJXYJH7gvTbbCb5-ZvBWQbiZn2L_BJxA3eKQlOT), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEbUg3yPI36tMwZrfUiyP3lhqoxT8vean0_oxpUBFxmh8b2VQKOguJ0R2jnX7L6Oy2izrgQKpIHKaXmKgLQh0XE0UkOlmYxg0ybMnZ5zwp8FVIRtJsczUxGq-74jtTZX0d5L6_-pHhoGP82C5Gfrq1TAXh-mJGv5t7P8rT-1E3gI-jCBPGV7U80F5gdl3Llxc5Ztk8ZQhLGGQeIfYtQ9BW6AHDIIfhc8wpVC5BiAMz5NhhT), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEMPK8Uy_u9wcAK4Cp1X6mvzDcCL_SK57cUbCslbD9KOAs-KtHjukYTYkczYyX9lxIWmRzr4nGd80ekn94cWUBtFVYOETTm040MAkgtH0HjUTxPTJeBR8NnlG5iqZn5Hq8oycag2jHBIhATTbs_bQ==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFpQewtZYrWsp_IH_XV-2vQtHViV2r-1uVHRM0nIUFA6zGCc8iTvhqsfyDKXrDw_J-gNyUdJq6hCmI4VZcmpBWHegxw3DpdgwkAx0Qy6sjpVbBH1APmfd5GQN-UdE70amXErco0wPL0t-jvXX9V), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGX21HDe7LxeD6ve_qdBwP6-wFuIGQMpIciu6DmQ2-fb9KRdPf9Jozori7h-e_txEYu3Ac7QErNoMm3CsnKf2BdiAKLOrV1A3kiWIakdqpClo2P), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKt-KWtjsiHsuJcjEMKCQ44n-WKwGojh7gPKPACz-y8rqaNsbEGX7qyZOpaVfDdcWPL2X194e8cc-lz6uVCx8aZ21d9aqSJYHBKD3W7EyC9zLmkbFVxMHgvPT1J4u-9CN5uA==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEuWXmB1yOJV4s8THhIxclvR7tMAnvn0tHfOMrQTHhq-SH8colk5PcjmH2KUNkx8_HldiLo2MWOOZrfzTZUrI2gb5HnvPx9KyxfERiHVQMmAoWac7KV4nb0V04WcaKy1c9n9dX1vPrfsBOeQb8=)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-11-venue: Whittles Oldham

- Source: gigs-news-daily-import / venue_whittles-oldham
- Capture status: captured
- Provider identity confidence: 0.990
- Provider reasoning or error: Whittles Oldham is positively identified as a live music venue at 57 Roscoe St in Oldham, UK, verified via its official website (whittlesoldham.com) and consistent gig footprint.
- Accepted facts: none
- Quarantined facts: hasAddress=57 Roscoe St, Oldham OL1 1EA, UK (0.990) [uncaptured citation: https://whittlesoldham.com/]; hasLocation=Oldham, United Kingdom (0.980) [uncaptured citation: https://whittlesoldham.com/]; hasWebsiteUrl=https://whittlesoldham.com/ (0.990) [uncaptured citation: https://whittlesoldham.com/]; hasOfficialUrl=https://whittlesoldham.com/ (0.990) [uncaptured citation: https://whittlesoldham.com/]
- Captured provider evidence: none
- All cited URLs: [link](https://whittlesoldham.com/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-12-venue: Shoulder, Fulford

- Source: klma-stoke-gig-list / klma-venue-fef3609d34f8
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The entry 'Shoulder, Fulford' from the Stoke gig list corresponds uniquely to The Shoulder of Mutton, a historic country pub located on Meadow Lane in Fulford, Stoke-on-Trent, Staffordshire.
- Accepted facts: none
- Quarantined facts: hasAddress=Meadow Ln, Fulford, Stoke-on-Trent ST11 9QS, UK (0.980) [uncaptured citation: https://www.theshoulderofmuttonfulford.com/]; hasLocation=Fulford, Stoke-on-Trent, Staffordshire, England, UK (0.980) [uncaptured citation: https://www.theshoulderofmuttonfulford.com/]; hasWebsiteUrl=https://www.theshoulderofmuttonfulford.com/ (0.980) [uncaptured citation: https://www.theshoulderofmuttonfulford.com/]; hasOfficialUrl=https://www.theshoulderofmuttonfulford.com/ (0.980) [uncaptured citation: https://www.theshoulderofmuttonfulford.com/]
- Captured provider evidence: none
- All cited URLs: [link](https://www.theshoulderofmuttonfulford.com/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-13-venue: Bebside Inn Blyth

- Source: onthecase-gig-index / onthecase:venue:90
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The venue Bebside Inn in Blyth (located on Front Street, Bebside, NE24 4HT) directly matches source key onthecase:venue:90 and gig listings on On The Case Music.
- Accepted facts: none
- Quarantined facts: hasAddress=Front Street, Bebside, Blyth, Northumberland, NE24 4HT, UK (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIzstWDxh8RJsVtU4LSATYGsNUqaiuL3zk9ozBwjUVrvq4dGrqzDsskr7G1yRGb1GZiEQ7M71umoG4V8hwhR8gmZsd0eRVRTLvsCmpMyq8mqBIvZDfoszg9KQ2vIc6BmGFuy7UDxgi7EH7eR5B1Q==]; hasLocation=Blyth, Northumberland, England, UK (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIzstWDxh8RJsVtU4LSATYGsNUqaiuL3zk9ozBwjUVrvq4dGrqzDsskr7G1yRGb1GZiEQ7M71umoG4V8hwhR8gmZsd0eRVRTLvsCmpMyq8mqBIvZDfoszg9KQ2vIc6BmGFuy7UDxgi7EH7eR5B1Q==]; officialPresenceAttempted=no-official-presence-found (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIzstWDxh8RJsVtU4LSATYGsNUqaiuL3zk9ozBwjUVrvq4dGrqzDsskr7G1yRGb1GZiEQ7M71umoG4V8hwhR8gmZsd0eRVRTLvsCmpMyq8mqBIvZDfoszg9KQ2vIc6BmGFuy7UDxgi7EH7eR5B1Q==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIzstWDxh8RJsVtU4LSATYGsNUqaiuL3zk9ozBwjUVrvq4dGrqzDsskr7G1yRGb1GZiEQ7M71umoG4V8hwhR8gmZsd0eRVRTLvsCmpMyq8mqBIvZDfoszg9KQ2vIc6BmGFuy7UDxgi7EH7eR5B1Q==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-14-venue: Town House Festival Oswestry

- Source: gigs-news-daily-import / venue_town-house-festival-oswestry
- Capture status: captured
- Provider identity confidence: 0.300
- Provider reasoning or error: No official venue or entity named 'Town House Festival Oswestry' could be established with confidence. Search results indicate a local bar/restaurant named 'Townhouse Oswestry' as well as separate local town festivals (such as Oswestry Youth Music Festival and Oswestry Food & Drink Festival), making the exact identity of this candidate unsafe.
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
- Provider reasoning or error: Tied to candidate venue on On The Case Music (onthecase:venue:915) and regional event listings at 22a Woods Terrace East, Murton, Seaham SR7 9AA.
- Accepted facts: none
- Quarantined facts: hasAddress=22a Woods Terrace East, Murton, Seaham, SR7 9AA, United Kingdom (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzIZIDvk-83HsutGu101asOgI6Povkyj3AHwb1duR2v3bTkHvsEepEHZ5wR7MhMoQXSnFHKkZjMgNeJ5zOhXcv8aiU_PzuiXlfaRa20HZkE8u2riKAoeetAOlc8cE91qBMp_47giKKCQ4uo-KMk_0vX2z8]; hasLocation=Murton, Seaham, England, United Kingdom (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIv8ErjZO7YNWfck2jJ6byMLUcPJyk-9y2HBjXN1FRL8DOesifis4bfLHMgx7RNUzcXXjJkWaSHJE33sP-rNPX-wpCcaAWJTjuvi1Kfm-MJXe8f4Muvjz_lSYNKmYYffh_4NBB2zxAVUbXNivjlKTkm6inSOnF1ZIr]; officialPresenceAttempted=no-official-presence-found (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIv8ErjZO7YNWfck2jJ6byMLUcPJyk-9y2HBjXN1FRL8DOesifis4bfLHMgx7RNUzcXXjJkWaSHJE33sP-rNPX-wpCcaAWJTjuvi1Kfm-MJXe8f4Muvjz_lSYNKmYYffh_4NBB2zxAVUbXNivjlKTkm6inSOnF1ZIr]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzIZIDvk-83HsutGu101asOgI6Povkyj3AHwb1duR2v3bTkHvsEepEHZ5wR7MhMoQXSnFHKkZjMgNeJ5zOhXcv8aiU_PzuiXlfaRa20HZkE8u2riKAoeetAOlc8cE91qBMp_47giKKCQ4uo-KMk_0vX2z8), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIv8ErjZO7YNWfck2jJ6byMLUcPJyk-9y2HBjXN1FRL8DOesifis4bfLHMgx7RNUzcXXjJkWaSHJE33sP-rNPX-wpCcaAWJTjuvi1Kfm-MJXe8f4Muvjz_lSYNKmYYffh_4NBB2zxAVUbXNivjlKTkm6inSOnF1ZIr)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-16-venue: Crook Hotel Crook

- Source: onthecase-gig-index / onthecase:venue:940
- Capture status: captured
- Provider identity confidence: 0.990
- Provider reasoning or error: The target source key onthecase:venue:940 directly maps to The Crook Hotel in Crook, County Durham via On The Case gig listings (uk/venues/940/crook-hotel-crook/), confirming the entity identity.
- Accepted facts: none
- Quarantined facts: hasAddress=56 Hope Street, Crook, DL15 9HU, United Kingdom (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3Kd9VmExY3kedh5o1zBG78GGztskF5TXhtgn_M6WPUFJU9HjZoNvcWov9MQBJgKFdY3lSeBl4XmvhlVI_E7Lb9Idyjdt7YwYD10DtuE-vDYrO29qgvPZ_R5i5jElJbNs4iWewDNlUYIOZrpVqjZjBbrU=, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE1oyTtK8anFU1E4JR9S37FLPBKLxG4EM11wQar06RhCv2Gryn_7yqD6B8_evyCsJG5aFMQkI6q-B5A9aKYjl1eSJfzhgrMxzmUFx6xV3hvugvTr42_Nu5eCiBi2TYd7MMVM1fmk4EwpTXX]; hasLocation=Crook, County Durham, England, United Kingdom (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4Jh5o9BxhzJ9IUQ4mNFbcZ8il_Bp107mNxxOM1DkH03JzlYeqeW_v9F_9n7SizIHcGCZ5ejSWy7Zt5aujbpotBbVztopmuYGXoIEyjfOenunLkCVFfcnKm1t9lzXkGuq4EZvrvFeRMDr46Sb-V0kNZd1fH7vjn3aofy34h4VwXlA91_wcHcG-ugnh_CfuNcphrqyleaSJV4J7ScBQQ6HkKWe9iQ==]; hasWebsiteUrl=http://www.crookhotel.co.uk (0.850) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZplZF3NEWVMMwHuaaNtV9zKakb0iDrHl9HQsv0dqb2zyGLgwA5T-c01zbHOzietoMgxcfZzuCqyAUbTl_RE3uVd9waH1DN16IwvN4ywLaHOf296ufoc11uptktcjRqO6a, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzYM1ozgggGSL7HJ7tKnV7qG8VLKgWJ4Sj4YsTY-pry9wuEe-GSI4cYq0xg2r6ndKh6d1ANPTOQH-8sXwrpCVYnJpXBuyzdL-TtgBYRcBM4V2e7PFgMnEjdEEzKg==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3Kd9VmExY3kedh5o1zBG78GGztskF5TXhtgn_M6WPUFJU9HjZoNvcWov9MQBJgKFdY3lSeBl4XmvhlVI_E7Lb9Idyjdt7YwYD10DtuE-vDYrO29qgvPZ_R5i5jElJbNs4iWewDNlUYIOZrpVqjZjBbrU=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE1oyTtK8anFU1E4JR9S37FLPBKLxG4EM11wQar06RhCv2Gryn_7yqD6B8_evyCsJG5aFMQkI6q-B5A9aKYjl1eSJfzhgrMxzmUFx6xV3hvugvTr42_Nu5eCiBi2TYd7MMVM1fmk4EwpTXX), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4Jh5o9BxhzJ9IUQ4mNFbcZ8il_Bp107mNxxOM1DkH03JzlYeqeW_v9F_9n7SizIHcGCZ5ejSWy7Zt5aujbpotBbVztopmuYGXoIEyjfOenunLkCVFfcnKm1t9lzXkGuq4EZvrvFeRMDr46Sb-V0kNZd1fH7vjn3aofy34h4VwXlA91_wcHcG-ugnh_CfuNcphrqyleaSJV4J7ScBQQ6HkKWe9iQ==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZplZF3NEWVMMwHuaaNtV9zKakb0iDrHl9HQsv0dqb2zyGLgwA5T-c01zbHOzietoMgxcfZzuCqyAUbTl_RE3uVd9waH1DN16IwvN4ywLaHOf296ufoc11uptktcjRqO6a), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzYM1ozgggGSL7HJ7tKnV7qG8VLKgWJ4Sj4YsTY-pry9wuEe-GSI4cYq0xg2r6ndKh6d1ANPTOQH-8sXwrpCVYnJpXBuyzdL-TtgBYRcBM4V2e7PFgMnEjdEEzKg==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-17-venue: the Whitehouse Stalybridge

- Source: gigs-news-daily-import / venue_the-whitehouse-stalybridge
- Capture status: captured
- Provider identity confidence: 0.990
- Provider reasoning or error: The venue 'the Whitehouse Stalybridge' is uniquely identified as a pub and live entertainment venue located at 1 Water Street, Stalybridge SK15 2AG, operated by Hydes Brewery.
- Accepted facts: none
- Quarantined facts: hasAddress=1 Water Street, Stalybridge SK15 2AG (0.990) [uncaptured citation: https://www.hydesbrewery.com/]; hasLocation=Stalybridge (0.990) [uncaptured citation: https://www.hydesbrewery.com/]; hasWebsiteUrl=https://www.hydesbrewery.com (0.950) [uncaptured citation: https://www.hydesbrewery.com/]; hasFacebookUrl=https://www.facebook.com/people/The-Whitehouse-Stalybridge/100047774869976/ (0.980) [uncaptured citation: https://www.facebook.com/people/The-Whitehouse-Stalybridge/100047774869976/]; hasOfficialUrl=https://www.hydesbrewery.com (0.950) [uncaptured citation: https://www.hydesbrewery.com/]; hasOfficialUrl=https://www.facebook.com/people/The-Whitehouse-Stalybridge/100047774869976/ (0.980) [uncaptured citation: https://www.facebook.com/people/The-Whitehouse-Stalybridge/100047774869976/]
- Captured provider evidence: none
- All cited URLs: [link](https://www.hydesbrewery.com/), [link](https://www.facebook.com/people/The-Whitehouse-Stalybridge/100047774869976/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-18-venue: White Hart Woodley

- Source: gigs-news-daily-import / venue_white-hart-woodley
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Strong public evidence confirms The White Hart is a pub located on Hyde Road in Woodley, Stockport (SK6 1NL), with an active official Facebook page (@thewhitehartwoodley).
- Accepted facts: none
- Quarantined facts: hasAddress=170 Hyde Road, Woodley, Stockport SK6 1NL, UK (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHKsEAb0o1cuQzrnety7vOs7ihlwEaSjVacKVT7wp6jXOv_zpSTnoTaAC__heKsqmfB0X7ovxMviwS2li1WFPujyj4XnXsS1dwlsCHrXkGE1xSJlCoL6pjNotm5JNZgEm5LjXHPNWpQd-c=]; hasLocation=Woodley, Stockport, UK (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHKsEAb0o1cuQzrnety7vOs7ihlwEaSjVacKVT7wp6jXOv_zpSTnoTaAC__heKsqmfB0X7ovxMviwS2li1WFPujyj4XnXsS1dwlsCHrXkGE1xSJlCoL6pjNotm5JNZgEm5LjXHPNWpQd-c=]; hasFacebookUrl=https://www.facebook.com/thewhitehartwoodley (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEExqPxuMZ59kensLN21ESfOxwchqePLPVSeMN_molqSpC9Sh4ptGRXyPQY8L7RBMm3b3A5vbKIPXg-g-d4aZfvDFjaHVJRBqPzNQtJFU_pX8AwXM8Ud60CvR6rGgBDUjf9FeyfI04jke1IYQSedbkimPnmMMbpBZ5tyXkVSJEDBZQpH-3czIHH7gk=]; hasOfficialUrl=https://www.facebook.com/thewhitehartwoodley (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEExqPxuMZ59kensLN21ESfOxwchqePLPVSeMN_molqSpC9Sh4ptGRXyPQY8L7RBMm3b3A5vbKIPXg-g-d4aZfvDFjaHVJRBqPzNQtJFU_pX8AwXM8Ud60CvR6rGgBDUjf9FeyfI04jke1IYQSedbkimPnmMMbpBZ5tyXkVSJEDBZQpH-3czIHH7gk=]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHKsEAb0o1cuQzrnety7vOs7ihlwEaSjVacKVT7wp6jXOv_zpSTnoTaAC__heKsqmfB0X7ovxMviwS2li1WFPujyj4XnXsS1dwlsCHrXkGE1xSJlCoL6pjNotm5JNZgEm5LjXHPNWpQd-c=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEExqPxuMZ59kensLN21ESfOxwchqePLPVSeMN_molqSpC9Sh4ptGRXyPQY8L7RBMm3b3A5vbKIPXg-g-d4aZfvDFjaHVJRBqPzNQtJFU_pX8AwXM8Ud60CvR6rGgBDUjf9FeyfI04jke1IYQSedbkimPnmMMbpBZ5tyXkVSJEDBZQpH-3czIHH7gk=)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-19-venue: The Globe, Nantwich

- Source: klma-stoke-gig-list / klma-venue-f84e844c02e3
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The Globe (also known as The Globe Inn) is a verified pub and live music venue located at 100 Audlem Road, Nantwich, CW5 7EA, Cheshire, UK, matching the source gig list geographic footprint.
- Accepted facts: none
- Quarantined facts: hasAddress=100 Audlem Road, Nantwich CW5 7EA, United Kingdom (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEx-wYMtfGsaPPxkc4HS5XC9fiY6N0_DHPOeu87R_wWi-Hdwh9KTZxuXlX435S9OQcZXsF0r2iD4sqNriQ2rpPLHT4EE-gBZ1EHf6tztFLlCSsnH7p_BqEnFQxZmEqln1PA]; hasLocation=Nantwich, Cheshire, England, United Kingdom (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGQYM_8Wwz-JXInq6VTKht9kddHRt_LbUq3keqRuCMj1zeSwQnhn8C4bNmFmCPigLvAvZnJR0czS6RB2qIG33MWBo3fq2c_o6oKJoyl9N7UC0IRLbFG1yo=]; hasWebsiteUrl=http://www.theglobenantwich.co.uk/ (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1tLQL-2Me0wUME3HE8R_u86wgs0aKXPfpcBaYtmxXkiD3foi47x_5CqJ0P0S9HOZel_CKEHcsM9W54IvLq3wqlzu4OvADIduuuHBfSelXArta-iChlXzvJuKxNM0ySr2NJJJo1rHNG8rSgB1RtQ==]; hasOfficialUrl=http://www.theglobenantwich.co.uk/ (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1tLQL-2Me0wUME3HE8R_u86wgs0aKXPfpcBaYtmxXkiD3foi47x_5CqJ0P0S9HOZel_CKEHcsM9W54IvLq3wqlzu4OvADIduuuHBfSelXArta-iChlXzvJuKxNM0ySr2NJJJo1rHNG8rSgB1RtQ==]; hasFacebookUrl=https://www.facebook.com/profile.php?id=100057584374219 (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbIt58b6sfamzTO4lOxkxEuUDJ3teZK8ie2kSDLDGcyQWzRyNnnow_X4diNdPah1b-_9nz6cx2CJrGV6kf5xIa8Go8bOWLVDg0ELYTYXPSKnfXZ6YyrQdCFOXzD0CUOxgtzCY9Z2TvVhGZxhvKLK0kvn9UwRk=]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEx-wYMtfGsaPPxkc4HS5XC9fiY6N0_DHPOeu87R_wWi-Hdwh9KTZxuXlX435S9OQcZXsF0r2iD4sqNriQ2rpPLHT4EE-gBZ1EHf6tztFLlCSsnH7p_BqEnFQxZmEqln1PA), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGQYM_8Wwz-JXInq6VTKht9kddHRt_LbUq3keqRuCMj1zeSwQnhn8C4bNmFmCPigLvAvZnJR0czS6RB2qIG33MWBo3fq2c_o6oKJoyl9N7UC0IRLbFG1yo=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1tLQL-2Me0wUME3HE8R_u86wgs0aKXPfpcBaYtmxXkiD3foi47x_5CqJ0P0S9HOZel_CKEHcsM9W54IvLq3wqlzu4OvADIduuuHBfSelXArta-iChlXzvJuKxNM0ySr2NJJJo1rHNG8rSgB1RtQ==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbIt58b6sfamzTO4lOxkxEuUDJ3teZK8ie2kSDLDGcyQWzRyNnnow_X4diNdPah1b-_9nz6cx2CJrGV6kf5xIa8Go8bOWLVDg0ELYTYXPSKnfXZ6YyrQdCFOXzD0CUOxgtzCY9Z2TvVhGZxhvKLK0kvn9UwRk=)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-20-venue: The Roebuck, Chesterton

- Source: klma-stoke-gig-list / klma-venue-f88c79f4c673
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The venue is conclusively identified as The Roebuck pub located on Dragon Square in Chesterton, Newcastle-under-Lyme (Stoke-on-Trent area), managed as part of Caldmore Taverns.
- Accepted facts: none
- Quarantined facts: hasAddress=Dragon Square, Chesterton, Newcastle-under-Lyme ST5 7HL, United Kingdom (0.980) [uncaptured citation: https://caldmoretaverns.co.uk/our-pubs/the-roebuck/]; hasLocation=Chesterton, Newcastle-under-Lyme, Staffordshire, England (0.980) [uncaptured citation: https://caldmoretaverns.co.uk/our-pubs/the-roebuck/]; hasWebsiteUrl=https://caldmoretaverns.co.uk/our-pubs/the-roebuck/ (0.950) [uncaptured citation: https://caldmoretaverns.co.uk/our-pubs/the-roebuck/]; hasOfficialUrl=https://caldmoretaverns.co.uk/our-pubs/the-roebuck/ (0.950) [uncaptured citation: https://caldmoretaverns.co.uk/our-pubs/the-roebuck/]
- Captured provider evidence: none
- All cited URLs: [link](https://caldmoretaverns.co.uk/our-pubs/the-roebuck/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

