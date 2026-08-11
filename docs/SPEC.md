# bndy Enrichment Engine Specification

## Objective

Replace token-heavy general-purpose browser-agent enrichment with a measurable pipeline that uses Google/Gemini as the primary discovery layer and Facebook only as a targeted evidence fallback.

## Core hypothesis

Gemini with Google Search grounding can discover enough current local gig evidence that exhaustive Facebook browsing is unnecessary for most artists and venues.

## Primary architecture

```text
EventBridge -> Scan Planner -> SQS -> Gemini + Google Search -> Normalise -> Evidence/State -> Candidate Resolver
                                                        \
                                                         -> Facebook fallback experiment
```

The first deployed slice deliberately stops at evidence/candidate discovery. It does not write canonical gigs into bndy until precision and recall are measured.

## Prototype gates

Use roughly 25 active artists and 25 active venues with a manually verified 90-day truth set.

Measure:

- artist-search recall;
- venue-search recall;
- union recall;
- high-confidence precision;
- Google search queries consumed;
- model input/output tokens;
- cost per verified event;
- events found only via Facebook.

Initial hypothesis gates:

- Google union recall >= 80%;
- high-confidence precision >= 95%;
- automatic bndy writes remain disabled until the auto-write confidence band demonstrates >= 99% precision.

## Google discovery

Use Gemini's Interactions API with `gemini-3.6-flash`, the `google_search` tool and JSON structured output. Search both sides of the graph:

- artist -> upcoming venues/dates;
- venue -> upcoming artists/dates.

Persist grounding evidence and query counts wherever the response exposes them. Never infer event dates from publication dates. Every event candidate must carry at least one source URL.

## Facebook fallback

Facebook is not a primary production dependency in the first slice. The Playwright probe exists to test the long `/events` scrolling problem deterministically without an LLM watching each scroll.

The probe accumulates event URLs while recording XHR/fetch activity and stops after consecutive no-growth cycles or a hard scroll cap. Future iterations should test response-body capture for structured GraphQL/event payloads, but must not add CAPTCHA bypass or anti-detection evasion.

Authenticated Facebook sessions, if tested, must be isolated from bndy mutation credentials and should not use a primary personal account as a production dependency.

## AWS resources

- EventBridge rule for scheduled planning;
- Lambda scan planner;
- SQS discovery queue and DLQ;
- Lambda Gemini worker;
- DynamoDB state/evidence metadata;
- S3 evidence archive scaffold;
- Secrets Manager Gemini key;
- CloudWatch via native Lambda/SQS/CDK telemetry.

## Data contracts

`SearchEntity` contains type, bndy ID, name and optional location/site/social context.

`EventCandidate` contains artist, venue, date, optional time, confidence and evidence source URLs.

`DiscoveryResult` adds run ID, retrieved timestamp, normalised evidence and usage metrics.

## Safety and write model

Collectors should not possess canonical bndy mutation permissions. A later writer should receive idempotent approved commands only after entity resolution and calibrated confidence evaluation.

## Next implementation increments

1. Run CI and CDK synthesis.
2. Deploy the Google-first slice.
3. Build a real bndy truth-set fixture.
4. Run artist and venue searches and calculate precision/recall.
5. Add bndy read-only entity source to the planner.
6. Expand the Facebook probe only if it contributes material incremental recall.
7. Add candidate resolution against the existing bndy venue/artist matching APIs.
8. Add a restricted writer only once the measured precision gate is satisfied.
