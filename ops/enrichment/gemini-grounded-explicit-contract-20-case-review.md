# Backline grounded-enrichment qualification review

Captured: 2026-08-29T16:52:12.792Z

This is a bounded 20-case provider qualification cohort, not the full Backline corpus. It contains 10 artists and 10 venues selected from the live Trust Loop review set. No canonical writes occurred.

Captured cases: 20/20. Capture errors: 0. Accepted facts: 0. Quarantined facts: 67. Measured estimated cost: $0.6623.

A quarantined fact is visible for review but is not accepted evidence and cannot project to canonical BNDY. Human adjudication does not repair missing provider citations; those cases remain parked.

| Case | Type | Source | Entity | Capture | Identity confidence | Accepted | Quarantined | Human identity |
|---|---|---|---|---|---:|---:|---:|---|
| grounded-01-artist | artist | gigs-news-daily-import | the Reform | captured | 0.200 | 0 | 0 | match / park |
| grounded-02-artist | artist | klma-stoke-gig-list | Catalyst | captured | 0.150 | 0 | 0 | match / park |
| grounded-03-artist | artist | lemonrock-artist-hydration | Neovenator | captured | 0.980 | 0 | 6 | match / park |
| grounded-04-artist | artist | onthecase-band-hydration | Jonny Trax | captured | 0.980 | 0 | 5 | match / park |
| grounded-05-artist | artist | lemonrock-artist-hydration | The Humbuckers | captured | 0.150 | 0 | 0 | match / park |
| grounded-06-artist | artist | onthecase-band-hydration | Charlotte Forman | captured | 0.980 | 0 | 8 | match / park |
| grounded-07-artist | artist | onthecase-band-hydration | Anna Reay | captured | 0.980 | 0 | 9 | match / park |
| grounded-08-artist | artist | gigs-news-daily-import | the Select Committee | captured | 0.200 | 0 | 0 | match / park |
| grounded-09-artist | artist | gigs-news-daily-import | the Tall Faces | captured | 0.980 | 0 | 8 | match / park |
| grounded-10-artist | artist | gigs-news-daily-import | Tom Meighan Raw26 | captured | 0.980 | 0 | 7 | match / park |
| grounded-11-venue | venue | gigs-news-daily-import | Whittles Oldham | captured | 0.990 | 0 | 3 | match / park |
| grounded-12-venue | venue | klma-stoke-gig-list | Shoulder, Fulford | captured | 0.980 | 0 | 3 | match / park |
| grounded-13-venue | venue | onthecase-gig-index | Bebside Inn Blyth | captured | 0.980 | 0 | 3 | match / park |
| grounded-14-venue | venue | gigs-news-daily-import | Town House Festival Oswestry | captured | 0.300 | 0 | 0 | match / park |
| grounded-15-venue | venue | onthecase-gig-index | Murton Officials Club Seaham | captured | 0.980 | 0 | 1 | match / park |
| grounded-16-venue | venue | onthecase-gig-index | Crook Hotel Crook | captured | 0.980 | 0 | 2 | match / park |
| grounded-17-venue | venue | gigs-news-daily-import | the Whitehouse Stalybridge | captured | 0.980 | 0 | 1 | match / park |
| grounded-18-venue | venue | gigs-news-daily-import | White Hart Woodley | captured | 0.980 | 0 | 3 | match / park |
| grounded-19-venue | venue | klma-stoke-gig-list | The Globe, Nantwich | captured | 0.980 | 0 | 5 | match / park |
| grounded-20-venue | venue | klma-stoke-gig-list | The Roebuck, Chesterton | captured | 0.980 | 0 | 3 | match / park |

## Review instructions

Confirm `match` only if the captured provider evidence definitely belongs to the exact Artist or Venue. Mark `park` for ambiguity, a same-name entity, weak locality, missing provider citations or an unproven official link. Any confident false identity, wrong official URL or unsupported classification fails qualification.

### grounded-01-artist: the Reform

- Source: gigs-news-daily-import / artist_the-reform
- Capture status: captured
- Provider identity confidence: 0.200
- Provider reasoning or error: Multiple distinct musical entities exist with the name 'The Reform' or 'Reform' (including a 1970s Irish rock band, a Swedish jazz fusion group, and a UK pop band), and public evidence cannot safely establish which entity corresponds to this import record.
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
- Provider identity confidence: 0.150
- Provider reasoning or error: There are multiple distinct musical acts and venues using the name Catalyst, and public search results do not safely establish a specific gig footprint or official presence for the Stoke gig list entity.
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
- Provider reasoning or error: The identity is safe because Neovenator is confirmed as a UK rock band listed on Lemonrock gig schedules and performing at UK venues such as The Dublin Castle and Hope and Anchor, matching official releases and band profiles.
- Accepted facts: none
- Quarantined facts: hasArtistType=Band (0.980) [uncaptured citation: https://neovenator.bandcamp.com/merch]; hasActType=Originals (0.980) [uncaptured citation: https://www.flickniferecords.co.uk/store/vinyl-2/504-neovenator-7-limited-edition-double-a-side]; isAcoustic=false (0.950) [uncaptured citation: https://www.flickniferecords.co.uk/store/vinyl-2/504-neovenator-7-limited-edition-double-a-side]; hasGenre=Rock (0.980) [uncaptured citation: https://neovenator.bandcamp.com/merch]; hasGenre=Alternative (0.920) [uncaptured citation: https://neovenator.bandcamp.com/merch]; hasBandcampUrl=https://neovenator.bandcamp.com (0.980) [uncaptured citation: https://neovenator.bandcamp.com/merch]
- Captured provider evidence: none
- All cited URLs: [link](https://neovenator.bandcamp.com/merch), [link](https://www.flickniferecords.co.uk/store/vinyl-2/504-neovenator-7-limited-edition-double-a-side)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-04-artist: Jonny Trax

- Source: onthecase-band-hydration / onthecase:band:1211
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The target entity directly matches the On The Case Music listing for Jonny Trax, corresponding to sourceId onthecase-band-hydration and sourceCandidateKey onthecase:band:1211.
- Accepted facts: none
- Quarantined facts: hasArtistType=Band (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvAsXNdLvslam2XUZcf0-CtDS_paGIjmJ0QU9f0YwEhvteo-rPO9y8IMvpN003JWncinf_WDFhQ-n5SBfhDG4cmnvclIvcnbhjaDD_SMNLiq6K5gVV0ZN1UBYHO0rPAAG4v8VC-xcnIg==]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvAsXNdLvslam2XUZcf0-CtDS_paGIjmJ0QU9f0YwEhvteo-rPO9y8IMvpN003JWncinf_WDFhQ-n5SBfhDG4cmnvclIvcnbhjaDD_SMNLiq6K5gVV0ZN1UBYHO0rPAAG4v8VC-xcnIg==]; hasGenre=Rock (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvAsXNdLvslam2XUZcf0-CtDS_paGIjmJ0QU9f0YwEhvteo-rPO9y8IMvpN003JWncinf_WDFhQ-n5SBfhDG4cmnvclIvcnbhjaDD_SMNLiq6K5gVV0ZN1UBYHO0rPAAG4v8VC-xcnIg==]; hasGenre=Pop (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvAsXNdLvslam2XUZcf0-CtDS_paGIjmJ0QU9f0YwEhvteo-rPO9y8IMvpN003JWncinf_WDFhQ-n5SBfhDG4cmnvclIvcnbhjaDD_SMNLiq6K5gVV0ZN1UBYHO0rPAAG4v8VC-xcnIg==]; officialPresenceAttempted=no-official-presence-found (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvAsXNdLvslam2XUZcf0-CtDS_paGIjmJ0QU9f0YwEhvteo-rPO9y8IMvpN003JWncinf_WDFhQ-n5SBfhDG4cmnvclIvcnbhjaDD_SMNLiq6K5gVV0ZN1UBYHO0rPAAG4v8VC-xcnIg==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvAsXNdLvslam2XUZcf0-CtDS_paGIjmJ0QU9f0YwEhvteo-rPO9y8IMvpN003JWncinf_WDFhQ-n5SBfhDG4cmnvclIvcnbhjaDD_SMNLiq6K5gVV0ZN1UBYHO0rPAAG4v8VC-xcnIg==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-05-artist: The Humbuckers

- Source: lemonrock-artist-hydration / lemonrock:artist:thehumbuckers
- Capture status: captured
- Provider identity confidence: 0.150
- Provider reasoning or error: Multiple distinct musical acts named 'The Humbuckers' exist across different regions (including Michigan, Canada, and the UK), and no specific Lemonrock profile or distinct gig footprint could be established to safely identify this artist entity.
- Accepted facts: none
- Quarantined facts: none
- Captured provider evidence: none
- All cited URLs: none
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-06-artist: Charlotte Forman

- Source: onthecase-band-hydration / onthecase:band:26683
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The entity source candidate key matches the official profile for North East UK singer-songwriter Charlotte Forman on On The Case Music (onthecasemusic.co.uk), cross-verified with her verified Facebook and press profiles.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4FdaigHCw-SoZuWD8FCdjrtSVPGlF3ZI8sIUb8Ddjq2_MYF4-kIKcdZBuwc2irW7NrMos3Z6Jxz-e-eHl6ZlH5YWq6Tuwbcan3jFRGlwGlkfE7-ZHGJNlnRCJMJItyp3EZ9b9thb7GXrmOQFUhug=]; hasActType=Originals (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4FdaigHCw-SoZuWD8FCdjrtSVPGlF3ZI8sIUb8Ddjq2_MYF4-kIKcdZBuwc2irW7NrMos3Z6Jxz-e-eHl6ZlH5YWq6Tuwbcan3jFRGlwGlkfE7-ZHGJNlnRCJMJItyp3EZ9b9thb7GXrmOQFUhug=]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4FdaigHCw-SoZuWD8FCdjrtSVPGlF3ZI8sIUb8Ddjq2_MYF4-kIKcdZBuwc2irW7NrMos3Z6Jxz-e-eHl6ZlH5YWq6Tuwbcan3jFRGlwGlkfE7-ZHGJNlnRCJMJItyp3EZ9b9thb7GXrmOQFUhug=]; hasGenre=Pop (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4FdaigHCw-SoZuWD8FCdjrtSVPGlF3ZI8sIUb8Ddjq2_MYF4-kIKcdZBuwc2irW7NrMos3Z6Jxz-e-eHl6ZlH5YWq6Tuwbcan3jFRGlwGlkfE7-ZHGJNlnRCJMJItyp3EZ9b9thb7GXrmOQFUhug=]; hasGenre=Soul (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4FdaigHCw-SoZuWD8FCdjrtSVPGlF3ZI8sIUb8Ddjq2_MYF4-kIKcdZBuwc2irW7NrMos3Z6Jxz-e-eHl6ZlH5YWq6Tuwbcan3jFRGlwGlkfE7-ZHGJNlnRCJMJItyp3EZ9b9thb7GXrmOQFUhug=]; hasGenre=Jazz (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4FdaigHCw-SoZuWD8FCdjrtSVPGlF3ZI8sIUb8Ddjq2_MYF4-kIKcdZBuwc2irW7NrMos3Z6Jxz-e-eHl6ZlH5YWq6Tuwbcan3jFRGlwGlkfE7-ZHGJNlnRCJMJItyp3EZ9b9thb7GXrmOQFUhug=]; hasFacebookUrl=https://www.facebook.com/Charlottef94 (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8io_Ny1AnKEXW3elWzxNAa0VwuDcdDRGbPQ_1Bqv6XpzZ-amKS0TcDYP7JL7GMd_D8JW9seS1UG6vDhJH1zeWKWGm2M9A5ayDhDPDOPlHssXv74yo00t13CTJUw==]; hasOfficialUrl=https://www.facebook.com/Charlottef94 (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8io_Ny1AnKEXW3elWzxNAa0VwuDcdDRGbPQ_1Bqv6XpzZ-amKS0TcDYP7JL7GMd_D8JW9seS1UG6vDhJH1zeWKWGm2M9A5ayDhDPDOPlHssXv74yo00t13CTJUw==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF4FdaigHCw-SoZuWD8FCdjrtSVPGlF3ZI8sIUb8Ddjq2_MYF4-kIKcdZBuwc2irW7NrMos3Z6Jxz-e-eHl6ZlH5YWq6Tuwbcan3jFRGlwGlkfE7-ZHGJNlnRCJMJItyp3EZ9b9thb7GXrmOQFUhug=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8io_Ny1AnKEXW3elWzxNAa0VwuDcdDRGbPQ_1Bqv6XpzZ-amKS0TcDYP7JL7GMd_D8JW9seS1UG6vDhJH1zeWKWGm2M9A5ayDhDPDOPlHssXv74yo00t13CTJUw==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-07-artist: Anna Reay

- Source: onthecase-band-hydration / onthecase:band:27822
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Public evidence establishes Anna Reay as a Newcastle upon Tyne, UK vocalist and bandleader with mutually cross-linked official web and Facebook presence for Anna Reay / Anna Reay Band.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEEEHA52Fmth8c3Tb3h5KzI04_FmzYMolgByMBX4fTbG8sJAtkaE5HpgLiEDyMl3dDQvN93-sMe22rtDsRNIFz54Qo348v9rW7JDZU3sgkOoGCL-5nYuRKqow4H]; hasArtistType=Band (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERFOKttLc8IaL8nOuV30hufq9LXqRPFyeG5An5M4o3sAPrD9b7Tas6xaMrXw8-js9_M3-Bl7CfcPzjR3eMd0J4D_IpwXaizxiTVkkL]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG__nzKHnHMN5T73IQXm-ZnhzY5RF-20kn7fZJ8x7jslKG1P3KDKgq8YTFGZrq7jVWXoLbFbvd_05XVASFA_QdxUQseh37ZPLc027p1BiW4C3uAyF8S-cHaNDaO2EAArDvGOhS2ghZtj765pqoGDHwx4_gF8gu175kI1rn7B3OdHqhNE-esM_tY_Lsg3cGL255YCGr9-X1hnHOCXYmihhUC55qfY9j0ExPQtVRBkplBy8Q39lkimMvtZZInsO3XQhl6X7w1]; hasActType=Originals (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG__nzKHnHMN5T73IQXm-ZnhzY5RF-20kn7fZJ8x7jslKG1P3KDKgq8YTFGZrq7jVWXoLbFbvd_05XVASFA_QdxUQseh37ZPLc027p1BiW4C3uAyF8S-cHaNDaO2EAArDvGOhS2ghZtj765pqoGDHwx4_gF8gu175kI1rn7B3OdHqhNE-esM_tY_Lsg3cGL255YCGr9-X1hnHOCXYmihhUC55qfY9j0ExPQtVRBkplBy8Q39lkimMvtZZInsO3XQhl6X7w1]; isAcoustic=true (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG__nzKHnHMN5T73IQXm-ZnhzY5RF-20kn7fZJ8x7jslKG1P3KDKgq8YTFGZrq7jVWXoLbFbvd_05XVASFA_QdxUQseh37ZPLc027p1BiW4C3uAyF8S-cHaNDaO2EAArDvGOhS2ghZtj765pqoGDHwx4_gF8gu175kI1rn7B3OdHqhNE-esM_tY_Lsg3cGL255YCGr9-X1hnHOCXYmihhUC55qfY9j0ExPQtVRBkplBy8Q39lkimMvtZZInsO3XQhl6X7w1]; hasGenre=Pop (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbTgYIYSOmRP-Ru7Ri2olAtwXLaLk7Le9jsynW1LVdZMVXODq45Yc1NXHEcnDBOvL45kZVw6mZiu7creWKqcf28w_pOSWfV1XHVPMfuONK0k3dEXHi-xsZk1g=]; hasGenre=Jazz (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbTgYIYSOmRP-Ru7Ri2olAtwXLaLk7Le9jsynW1LVdZMVXODq45Yc1NXHEcnDBOvL45kZVw6mZiu7creWKqcf28w_pOSWfV1XHVPMfuONK0k3dEXHi-xsZk1g=]; hasFacebookUrl=https://www.facebook.com/annareayband/ (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHFLO5ApVUpvzmCaZ5G8PaZ20gS9WbO1Lw_CqcRB6ZTy4bAKYUBmL2QFl-qpl4kps5gNpF5wSyju-pC_LFrEq3sKCzwnGK0y892CcOHKv7BZsASFDCLkayYLWRh0K-e8SzgaZMrHvfQ_PPvgnp40rRXSs2jgw_45R_j3E5n_sqg3kepw-wVWrbXVEubacRxQQ==]; hasWebsiteUrl=http://annareay.co.uk/ (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERFOKttLc8IaL8nOuV30hufq9LXqRPFyeG5An5M4o3sAPrD9b7Tas6xaMrXw8-js9_M3-Bl7CfcPzjR3eMd0J4D_IpwXaizxiTVkkL]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEEEHA52Fmth8c3Tb3h5KzI04_FmzYMolgByMBX4fTbG8sJAtkaE5HpgLiEDyMl3dDQvN93-sMe22rtDsRNIFz54Qo348v9rW7JDZU3sgkOoGCL-5nYuRKqow4H), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERFOKttLc8IaL8nOuV30hufq9LXqRPFyeG5An5M4o3sAPrD9b7Tas6xaMrXw8-js9_M3-Bl7CfcPzjR3eMd0J4D_IpwXaizxiTVkkL), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG__nzKHnHMN5T73IQXm-ZnhzY5RF-20kn7fZJ8x7jslKG1P3KDKgq8YTFGZrq7jVWXoLbFbvd_05XVASFA_QdxUQseh37ZPLc027p1BiW4C3uAyF8S-cHaNDaO2EAArDvGOhS2ghZtj765pqoGDHwx4_gF8gu175kI1rn7B3OdHqhNE-esM_tY_Lsg3cGL255YCGr9-X1hnHOCXYmihhUC55qfY9j0ExPQtVRBkplBy8Q39lkimMvtZZInsO3XQhl6X7w1), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbTgYIYSOmRP-Ru7Ri2olAtwXLaLk7Le9jsynW1LVdZMVXODq45Yc1NXHEcnDBOvL45kZVw6mZiu7creWKqcf28w_pOSWfV1XHVPMfuONK0k3dEXHi-xsZk1g=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHFLO5ApVUpvzmCaZ5G8PaZ20gS9WbO1Lw_CqcRB6ZTy4bAKYUBmL2QFl-qpl4kps5gNpF5wSyju-pC_LFrEq3sKCzwnGK0y892CcOHKv7BZsASFDCLkayYLWRh0K-e8SzgaZMrHvfQ_PPvgnp40rRXSs2jgw_45R_j3E5n_sqg3kepw-wVWrbXVEubacRxQQ==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-08-artist: the Select Committee

- Source: gigs-news-daily-import / artist_the-select-committee
- Capture status: captured
- Provider identity confidence: 0.200
- Provider reasoning or error: Public search results do not establish a unique or verifiable entity identity for the artist 'the Select Committee' due to ambiguous usage and a lack of distinctive gig footprint or mutually cross-linked official profiles.
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
- Provider reasoning or error: Public gig listings, event schedules (Skiddle), and database entries (Discogs) establish identity for The Tall Faces as a four-piece 1960s Mod, Soul, Pop, and R&B cover band based in the UK.
- Accepted facts: none
- Quarantined facts: hasArtistType=Band (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4mBdzMJO0fadpsSJiVOZvD0lmeVmIuYGk8TkRhhLuyyGA4qezeWIuXWGd_9P1VhNP3qTFS3TA3XAjQqCxHGpoQ3YxnBjlOBVx7M1h3xwlQC-RVG2AJtQIiawQ5Tg9WS9Cvep54lMuUpSOgw==, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEotVAk_NDVjUubwqSlYqnZfTPy8SlJh9pFJethXqedWBtoFAqPxurILTcfmPokQWpvmcSI8aLECg0ElDn0WS9-QjoVrXjePjVP61Wd_KxsW00Jldcd-isPIfA5KPHk-de9J60a4tuygkWG_fyXzzc42VbwGOTPeNfcIVrafxnxrJm43fhQ5BlD8RM=]; hasActType=Covers (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEotVAk_NDVjUubwqSlYqnZfTPy8SlJh9pFJethXqedWBtoFAqPxurILTcfmPokQWpvmcSI8aLECg0ElDn0WS9-QjoVrXjePjVP61Wd_KxsW00Jldcd-isPIfA5KPHk-de9J60a4tuygkWG_fyXzzc42VbwGOTPeNfcIVrafxnxrJm43fhQ5BlD8RM=, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4mBdzMJO0fadpsSJiVOZvD0lmeVmIuYGk8TkRhhLuyyGA4qezeWIuXWGd_9P1VhNP3qTFS3TA3XAjQqCxHGpoQ3YxnBjlOBVx7M1h3xwlQC-RVG2AJtQIiawQ5Tg9WS9Cvep54lMuUpSOgw==]; hasGenre=Mod (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEotVAk_NDVjUubwqSlYqnZfTPy8SlJh9pFJethXqedWBtoFAqPxurILTcfmPokQWpvmcSI8aLECg0ElDn0WS9-QjoVrXjePjVP61Wd_KxsW00Jldcd-isPIfA5KPHk-de9J60a4tuygkWG_fyXzzc42VbwGOTPeNfcIVrafxnxrJm43fhQ5BlD8RM=]; hasGenre=Soul (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4mBdzMJO0fadpsSJiVOZvD0lmeVmIuYGk8TkRhhLuyyGA4qezeWIuXWGd_9P1VhNP3qTFS3TA3XAjQqCxHGpoQ3YxnBjlOBVx7M1h3xwlQC-RVG2AJtQIiawQ5Tg9WS9Cvep54lMuUpSOgw==]; hasGenre=Pop (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4mBdzMJO0fadpsSJiVOZvD0lmeVmIuYGk8TkRhhLuyyGA4qezeWIuXWGd_9P1VhNP3qTFS3TA3XAjQqCxHGpoQ3YxnBjlOBVx7M1h3xwlQC-RVG2AJtQIiawQ5Tg9WS9Cvep54lMuUpSOgw==]; hasGenre=R&B (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4mBdzMJO0fadpsSJiVOZvD0lmeVmIuYGk8TkRhhLuyyGA4qezeWIuXWGd_9P1VhNP3qTFS3TA3XAjQqCxHGpoQ3YxnBjlOBVx7M1h3xwlQC-RVG2AJtQIiawQ5Tg9WS9Cvep54lMuUpSOgw==]; hasFacebookUrl=https://www.facebook.com/TheTallFaces/ (0.950) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]; hasOfficialUrl=https://www.facebook.com/TheTallFaces/ (0.950) [uncaptured citation: https://www.facebook.com/TheTallFaces/videos/1320133576663202/]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4mBdzMJO0fadpsSJiVOZvD0lmeVmIuYGk8TkRhhLuyyGA4qezeWIuXWGd_9P1VhNP3qTFS3TA3XAjQqCxHGpoQ3YxnBjlOBVx7M1h3xwlQC-RVG2AJtQIiawQ5Tg9WS9Cvep54lMuUpSOgw==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEotVAk_NDVjUubwqSlYqnZfTPy8SlJh9pFJethXqedWBtoFAqPxurILTcfmPokQWpvmcSI8aLECg0ElDn0WS9-QjoVrXjePjVP61Wd_KxsW00Jldcd-isPIfA5KPHk-de9J60a4tuygkWG_fyXzzc42VbwGOTPeNfcIVrafxnxrJm43fhQ5BlD8RM=), [link](https://www.facebook.com/TheTallFaces/videos/1320133576663202/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-10-artist: Tom Meighan Raw26

- Source: gigs-news-daily-import / artist_tom-meighan-raw26
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Tom Meighan Raw26 corresponds directly to English singer Tom Meighan's RAW26 solo acoustic tour and releases, confirmed via gig listings and official artist links.
- Accepted facts: none
- Quarantined facts: hasArtistType=Solo Act (0.980) [uncaptured citation: https://www.tommeighanofficial.com/]; hasActType=Originals (0.950) [uncaptured citation: https://www.tommeighanofficial.com/]; isAcoustic=true (0.980) [uncaptured citation: https://tommeighan-raw.bandcamp.com/album/the-past-the-present-the-raw]; hasGenre=Rock (0.950) [uncaptured citation: https://en.wikipedia.org/wiki/Tom_Meighan]; hasWebsiteUrl=https://www.tommeighanofficial.com/ (0.980) [uncaptured citation: https://www.tommeighanofficial.com/]; hasOfficialUrl=https://www.tommeighanofficial.com/ (0.980) [uncaptured citation: https://www.tommeighanofficial.com/]; hasBandcampUrl=https://tommeighan-raw.bandcamp.com/album/the-past-the-present-the-raw (0.950) [uncaptured citation: https://tommeighan-raw.bandcamp.com/album/the-past-the-present-the-raw]
- Captured provider evidence: none
- All cited URLs: [link](https://www.tommeighanofficial.com/), [link](https://tommeighan-raw.bandcamp.com/album/the-past-the-present-the-raw), [link](https://en.wikipedia.org/wiki/Tom_Meighan)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-11-venue: Whittles Oldham

- Source: gigs-news-daily-import / venue_whittles-oldham
- Capture status: captured
- Provider identity confidence: 0.990
- Provider reasoning or error: Whittles Oldham is safely identified as the live music venue located at 57 Roscoe St, Oldham OL1 1EA, UK, with official website whittlesoldham.com and cross-referenced venue listings.
- Accepted facts: none
- Quarantined facts: hasAddress=57 Roscoe St, Oldham OL1 1EA (0.980) [uncaptured citation: https://whittlesoldham.com/]; hasWebsiteUrl=https://whittlesoldham.com/ (0.990) [uncaptured citation: https://whittlesoldham.com/]; hasOfficialUrl=https://whittlesoldham.com/ (0.990) [uncaptured citation: https://whittlesoldham.com/]
- Captured provider evidence: none
- All cited URLs: [link](https://whittlesoldham.com/)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-12-venue: Shoulder, Fulford

- Source: klma-stoke-gig-list / klma-venue-fef3609d34f8
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The venue candidate 'Shoulder, Fulford' from the Stoke gig list precisely matches 'The Shoulder of Mutton' pub located in Meadow Lane, Fulford, Stoke-on-Trent (ST11 9QS), Staffordshire.
- Accepted facts: none
- Quarantined facts: hasAddress=Meadow Ln, Fulford, Stoke-on-Trent ST11 9QS, UK (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHP2MregtaHbG5v8Wtu4AbSE9EkQsA_Sr-nGWWfWVQ2lsHn_RpdzENvz7v00WxZGFl2ZyzwiiLJP7vmq0gI0mrtlE1W2YI8p07lcb8ksMt8A57ZOPHtnr-P2aOHYr__Yrzg]; hasWebsiteUrl=https://www.theshoulderofmuttonfulford.com (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHP2MregtaHbG5v8Wtu4AbSE9EkQsA_Sr-nGWWfWVQ2lsHn_RpdzENvz7v00WxZGFl2ZyzwiiLJP7vmq0gI0mrtlE1W2YI8p07lcb8ksMt8A57ZOPHtnr-P2aOHYr__Yrzg]; hasOfficialUrl=https://www.theshoulderofmuttonfulford.com (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHP2MregtaHbG5v8Wtu4AbSE9EkQsA_Sr-nGWWfWVQ2lsHn_RpdzENvz7v00WxZGFl2ZyzwiiLJP7vmq0gI0mrtlE1W2YI8p07lcb8ksMt8A57ZOPHtnr-P2aOHYr__Yrzg]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHP2MregtaHbG5v8Wtu4AbSE9EkQsA_Sr-nGWWfWVQ2lsHn_RpdzENvz7v00WxZGFl2ZyzwiiLJP7vmq0gI0mrtlE1W2YI8p07lcb8ksMt8A57ZOPHtnr-P2aOHYr__Yrzg)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-13-venue: Bebside Inn Blyth

- Source: onthecase-gig-index / onthecase:venue:90
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The entity Bebside Inn Blyth (onthecase:venue:90) is strongly verified by exact matching gig listings on On The Case Music (such as We 3 Colonels and Six Nowt) and local press coverage for the venue located on Front Street, Bebside, Blyth, Northumberland.
- Accepted facts: none
- Quarantined facts: hasAddress=Front Street, Bebside, Bedlington, NE24 4HT (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGZpt5EV-N6TrSKkvqYGTH8d3MfbEkpW4YO0_PUhLhhkBTL4uBJAEwCsrUDTmlVhdAdGvrFtYKQQ8RD6bHTtx221sGWx6V99FUPmbN60OdOHamzRxLm7kyIbCpHkxE9cOkIsvDH1DRS880QwheX9g==]; hasLocation=Blyth, Northumberland, United Kingdom (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGZpt5EV-N6TrSKkvqYGTH8d3MfbEkpW4YO0_PUhLhhkBTL4uBJAEwCsrUDTmlVhdAdGvrFtYKQQ8RD6bHTtx221sGWx6V99FUPmbN60OdOHamzRxLm7kyIbCpHkxE9cOkIsvDH1DRS880QwheX9g==]; officialPresenceAttempted=no-official-presence-found (0.900) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGZpt5EV-N6TrSKkvqYGTH8d3MfbEkpW4YO0_PUhLhhkBTL4uBJAEwCsrUDTmlVhdAdGvrFtYKQQ8RD6bHTtx221sGWx6V99FUPmbN60OdOHamzRxLm7kyIbCpHkxE9cOkIsvDH1DRS880QwheX9g==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGZpt5EV-N6TrSKkvqYGTH8d3MfbEkpW4YO0_PUhLhhkBTL4uBJAEwCsrUDTmlVhdAdGvrFtYKQQ8RD6bHTtx221sGWx6V99FUPmbN60OdOHamzRxLm7kyIbCpHkxE9cOkIsvDH1DRS880QwheX9g==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-14-venue: Town House Festival Oswestry

- Source: gigs-news-daily-import / venue_town-house-festival-oswestry
- Capture status: captured
- Provider identity confidence: 0.300
- Provider reasoning or error: Public search evidence identifies a bar and venue named Townhouse Oswestry that hosts live music and garden events, but fails to establish a distinct, identity-safe venue officially named 'Town House Festival Oswestry'.
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
- Provider reasoning or error: The entity 'Murton Officials Club Seaham' (source key onthecase:venue:915) is uniquely identified as the social club located at 22a Woods Terrace East, Murton, Seaham, SR7 9AA, as confirmed by matching local business records and gig index listings.
- Accepted facts: none
- Quarantined facts: hasAddress=22a Woods Terrace East, Murton, Seaham SR7 9AA, United Kingdom (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFRrXdROiwJO0PSd5C6m41GHnOmbPtTctlPavtJLyDPgfUNmQfJ-R5N962K7_VEJRSkbQXLds12c2rJs6f3ET5VvR4RIQh189z6X3alXd5kV1H4rIkH_lQbX3xbvvpjOS7QDnZ4O-uZp8FLVk7Tb0xW7VQPERxRMj1eilUcV9fKwbcKVL4TUhb9qmb_o0AI56euEI3aEeYDmqynhTmVWQEF-lI=, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFK0K5k0EcQ9saFiZ1Hk9sIatGA9sEXNoY6s5_CUl1TgueI-dMuo3XlpUepnXuQlinh6Iyz0JQGcmo8hlT_357yVBt1eywbOOKl2GLrJQAl_FrMIolXcrZEjj43KtXtVVw1AB38LBKHilrr83u8yk3DxshBC_l0lSHVAetC9rB87w==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFRrXdROiwJO0PSd5C6m41GHnOmbPtTctlPavtJLyDPgfUNmQfJ-R5N962K7_VEJRSkbQXLds12c2rJs6f3ET5VvR4RIQh189z6X3alXd5kV1H4rIkH_lQbX3xbvvpjOS7QDnZ4O-uZp8FLVk7Tb0xW7VQPERxRMj1eilUcV9fKwbcKVL4TUhb9qmb_o0AI56euEI3aEeYDmqynhTmVWQEF-lI=), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFK0K5k0EcQ9saFiZ1Hk9sIatGA9sEXNoY6s5_CUl1TgueI-dMuo3XlpUepnXuQlinh6Iyz0JQGcmo8hlT_357yVBt1eywbOOKl2GLrJQAl_FrMIolXcrZEjj43KtXtVVw1AB38LBKHilrr83u8yk3DxshBC_l0lSHVAetC9rB87w==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-16-venue: Crook Hotel Crook

- Source: onthecase-gig-index / onthecase:venue:940
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The Crook Hotel in Crook, County Durham, UK is uniquely identified as a live music venue and pub located at 56 Hope Street, Crook, DL15 9HU.
- Accepted facts: none
- Quarantined facts: hasAddress=56 Hope Street, Crook, DL15 9HU, United Kingdom (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFw1XI3rJ1kePnvAUz1MPnPpRTBvCqEEpb3ihuh33TpkgDpbLuZfwSjSWgYgfVd-TTTdYICKv6r6vQDWYX8jFHdIuVHAxcHr7hPpguKbTNxwWcR6OhUTvxCR71-UXLFm9KLBzPCMN7t1CS-]; officialPresenceAttempted=no-official-presence-found (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHnRdcgxNzO6omikG_mNCOCOO83hGeYrbSHAh80qeV3vYquB-0nuOfckxjR_KpclNSvthA8yOtHh0f9iSs3CHrendymozv7gKcPH8mPfzOxnSgHt04X8zeOLAfUDtBmuClFYKZsOfZQSQ==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFw1XI3rJ1kePnvAUz1MPnPpRTBvCqEEpb3ihuh33TpkgDpbLuZfwSjSWgYgfVd-TTTdYICKv6r6vQDWYX8jFHdIuVHAxcHr7hPpguKbTNxwWcR6OhUTvxCR71-UXLFm9KLBzPCMN7t1CS-), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHnRdcgxNzO6omikG_mNCOCOO83hGeYrbSHAh80qeV3vYquB-0nuOfckxjR_KpclNSvthA8yOtHh0f9iSs3CHrendymozv7gKcPH8mPfzOxnSgHt04X8zeOLAfUDtBmuClFYKZsOfZQSQ==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-17-venue: the Whitehouse Stalybridge

- Source: gigs-news-daily-import / venue_the-whitehouse-stalybridge
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: Strong public evidence identifies the Whitehouse Stalybridge as a town centre pub located at 1 Water Street, Stalybridge SK15 2AG, operated under Hydes Brewery with dedicated social and local event listings.
- Accepted facts: none
- Quarantined facts: hasAddress=1 Water Street, Stalybridge SK15 2AG (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7oXPW15rugKrfr8fNmizZ0J8pBGRpRgEX4HR58rmK7kBze4ZSkDQ3HEmA4jM63uJ7kSXrJfaAjV2sAd_mYW6I6pOzTQO0i0oTE6NVPDV1bL-as90VUIzntF9YYLCldwaV7Uc=]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7oXPW15rugKrfr8fNmizZ0J8pBGRpRgEX4HR58rmK7kBze4ZSkDQ3HEmA4jM63uJ7kSXrJfaAjV2sAd_mYW6I6pOzTQO0i0oTE6NVPDV1bL-as90VUIzntF9YYLCldwaV7Uc=)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-18-venue: White Hart Woodley

- Source: gigs-news-daily-import / venue_white-hart-woodley
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The White Hart in Woodley, Stockport (located at 170 Hyde Road, Woodley) uniquely matches the entity name and location footprint.
- Accepted facts: none
- Quarantined facts: hasAddress=170 Hyde Road, Woodley, Stockport SK6 1NL (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTl3UY80z4yozRQSG-VqAKIYw9aZXDlrbDuRxLyeZXp8SsHxgqF1kYyavGBPx4Bd6t5dXn7fHuECPLTqc3OmwGs3gm79IzMAfoipOQjTEE4memXvlshb7ae-gEcqbxxhZyp23y_A2UTA==]; hasFacebookUrl=https://www.facebook.com/thewhitehartwoodley (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqZlGMcNwcN8UVYHMbfZsPYI2QivS_S-0X4TGJeX9LiN713YpGFMjIq-6dXEDrvVEyCyULnqX34JEYHRmTyQXov9MW_f4CXhK1r5Ut0Cq05TNot38kBvZeRKv2bPgKlGGd-Q==]; hasOfficialUrl=https://www.facebook.com/thewhitehartwoodley (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqZlGMcNwcN8UVYHMbfZsPYI2QivS_S-0X4TGJeX9LiN713YpGFMjIq-6dXEDrvVEyCyULnqX34JEYHRmTyQXov9MW_f4CXhK1r5Ut0Cq05TNot38kBvZeRKv2bPgKlGGd-Q==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTl3UY80z4yozRQSG-VqAKIYw9aZXDlrbDuRxLyeZXp8SsHxgqF1kYyavGBPx4Bd6t5dXn7fHuECPLTqc3OmwGs3gm79IzMAfoipOQjTEE4memXvlshb7ae-gEcqbxxhZyp23y_A2UTA==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqZlGMcNwcN8UVYHMbfZsPYI2QivS_S-0X4TGJeX9LiN713YpGFMjIq-6dXEDrvVEyCyULnqX34JEYHRmTyQXov9MW_f4CXhK1r5Ut0Cq05TNot38kBvZeRKv2bPgKlGGd-Q==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-19-venue: The Globe, Nantwich

- Source: klma-stoke-gig-list / klma-venue-f84e844c02e3
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The venue 'The Globe, Nantwich' is uniquely confirmed as a live music pub located at 100 Audlem Road, Nantwich, CW5 7EA, with matching website and social media presence.
- Accepted facts: none
- Quarantined facts: hasAddress=100 Audlem Rd, Nantwich CW5 7EA, UK (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_bX3q7qC6_8Ul4v24m7FLpWMDkzN6gCkQ79dCz7ubyxkZRDG61Veb_-Z5sbKTUfFtYikBi-lyTV3XBJP-8dh-CPh4zKSO5TGHFVVLYlxHRFmIp92kXXnDB8Fvd9HLrFS7]; hasLocation=Nantwich, Cheshire, UK (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzeeph96ApjcslM4adBkuJwCeXm-7lm_pllyVbO5qcsRPdYMID1f3-bhynZVAZgr6WxQYtIovkTBQsw8LBsuBYBk9N7iDxjdyJl8uxZZfx94TVxcN_usNHTSGCmO5HvQCXB5AvHQ==]; hasWebsiteUrl=http://www.theglobenantwich.co.uk/ (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbUXXi7_P_x2l1EH7xa9L7CILhik_Sn2aHY8IRckeIeY8qlTuk0PyYbUyB-3Bs8QfuRAy55uzmvjbfstOxispUMWy5LDC24u0oDINeaiy4yczHQ51sR-6tPHxRy5tHH5JqlB3LmeDpgDjDZkLypA==]; hasOfficialUrl=http://www.theglobenantwich.co.uk/ (0.980) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbUXXi7_P_x2l1EH7xa9L7CILhik_Sn2aHY8IRckeIeY8qlTuk0PyYbUyB-3Bs8QfuRAy55uzmvjbfstOxispUMWy5LDC24u0oDINeaiy4yczHQ51sR-6tPHxRy5tHH5JqlB3LmeDpgDjDZkLypA==]; hasFacebookUrl=https://www.facebook.com/TheGlobeNantwich (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbUXXi7_P_x2l1EH7xa9L7CILhik_Sn2aHY8IRckeIeY8qlTuk0PyYbUyB-3Bs8QfuRAy55uzmvjbfstOxispUMWy5LDC24u0oDINeaiy4yczHQ51sR-6tPHxRy5tHH5JqlB3LmeDpgDjDZkLypA==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_bX3q7qC6_8Ul4v24m7FLpWMDkzN6gCkQ79dCz7ubyxkZRDG61Veb_-Z5sbKTUfFtYikBi-lyTV3XBJP-8dh-CPh4zKSO5TGHFVVLYlxHRFmIp92kXXnDB8Fvd9HLrFS7), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzeeph96ApjcslM4adBkuJwCeXm-7lm_pllyVbO5qcsRPdYMID1f3-bhynZVAZgr6WxQYtIovkTBQsw8LBsuBYBk9N7iDxjdyJl8uxZZfx94TVxcN_usNHTSGCmO5HvQCXB5AvHQ==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbUXXi7_P_x2l1EH7xa9L7CILhik_Sn2aHY8IRckeIeY8qlTuk0PyYbUyB-3Bs8QfuRAy55uzmvjbfstOxispUMWy5LDC24u0oDINeaiy4yczHQ51sR-6tPHxRy5tHH5JqlB3LmeDpgDjDZkLypA==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

### grounded-20-venue: The Roebuck, Chesterton

- Source: klma-stoke-gig-list / klma-venue-f88c79f4c673
- Capture status: captured
- Provider identity confidence: 0.980
- Provider reasoning or error: The entity 'The Roebuck, Chesterton' from the Stoke-on-Trent regional gig list matches the pub located at Dragon Square in Chesterton, Newcastle-under-Lyme, Staffordshire, confirmed by venue operator Caldmore Taverns and local pub listings.
- Accepted facts: none
- Quarantined facts: hasAddress=Dragon Square, Chesterton, Newcastle-under-Lyme, ST5 7HL, United Kingdom (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHovCU8T8VUAiR34TVjCKU2t9a5CfcuHw343Yke22NtkiEVogUt5m4Y0IpZmLgXdmm4sVYo1uvsfs18lEHVsER7250BE2Uc5UnVVeTBRLgkSYHs_-_rbI-F4H0JsHlpLG5dBpx0p7pFMw==]; hasWebsiteUrl=https://caldmoretaverns.co.uk/our-pubs/the-roebuck-chesterton/ (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEhJntXkOSMoGJMnLIOSTaPgQ1yAueE1d5h37vS7XQBsrTBFuhl-5qbkmHKQU9q_3iqRCHhreh7tco7Xrbrdi6EEDX7pu-lTolyt1Kc2xFvGnVEf7hFkrjTcS9n6qKGirBrfDfs90wGdKUO8g==]; hasOfficialUrl=https://caldmoretaverns.co.uk/our-pubs/the-roebuck-chesterton/ (0.950) [uncaptured citation: https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEhJntXkOSMoGJMnLIOSTaPgQ1yAueE1d5h37vS7XQBsrTBFuhl-5qbkmHKQU9q_3iqRCHhreh7tco7Xrbrdi6EEDX7pu-lTolyt1Kc2xFvGnVEf7hFkrjTcS9n6qKGirBrfDfs90wGdKUO8g==]
- Captured provider evidence: none
- All cited URLs: [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHovCU8T8VUAiR34TVjCKU2t9a5CfcuHw343Yke22NtkiEVogUt5m4Y0IpZmLgXdmm4sVYo1uvsfs18lEHVsER7250BE2Uc5UnVVeTBRLgkSYHs_-_rbI-F4H0JsHlpLG5dBpx0p7pFMw==), [link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEhJntXkOSMoGJMnLIOSTaPgQ1yAueE1d5h37vS7XQBsrTBFuhl-5qbkmHKQU9q_3iqRCHhreh7tco7Xrbrdi6EEDX7pu-lTolyt1Kc2xFvGnVEf7hFkrjTcS9n6qKGirBrfDfs90wGdKUO8g==)
- Human identity decision: [ ] match  [ ] park
- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing
- Human notes:

