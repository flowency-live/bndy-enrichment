# Enrichment Provider Qualification

No external entity-enrichment provider may be wired to a Lambda or schedule until a reviewed fixture passes the default qualification gate.

Human adjudication is a commissioning and exception-control mechanism. It is not a daily dependency and it is not model fine-tuning. The reviewed cohort calibrates identity thresholds, citation rules, abstention behaviour, coverage and cost against known answers.

## Cohort

The minimum cohort is 20 real Backline entities and must include:

- at least five Artists and five Venues;
- at least two deliberately ambiguous Artist cases and two deliberately ambiguous Venue cases;
- exact quality-gap predicates requested by the daily planner;
- the complete raw provider bundle, HTTPS citations and measured usage for every case;
- human adjudication metadata and an explanation for every expected abstention.

The provider must return identity confidence below 0.98 for every expected-park case. A confident false match or an unnecessary park fails the provider. Expected-park cases do not count towards predicate coverage, so no provider is rewarded for inventing facts about an ambiguous entity.

## Split search and reasoning contract

The next qualification adapter separates evidence capture from interpretation:

1. issue at most two explicit Google Programmable Search JSON API requests;
2. preserve the exact public result title, HTTPS URL, snippet, query, duration and conservative per-query cost;
3. pass only that fixed evidence allow-list to one stateless Gemini reasoning call;
4. require Gemini structured output against Backline's JSON schema, with no search tool available to the reasoning call;
5. reject every predicate outside the request and every citation that is not an exact captured allow-list URL;
6. preserve response text, public evidence and measured token/cost usage when schema parsing fails;
7. make zero canonical writes and expose no schedule until the reviewed cohort passes.

The default item ceiling remains two searches, one model call, 12,000 input tokens, 2,000 output tokens, $0.03 estimated cost and 60 seconds. The adapter checks the worst-case reserved Gemini token cost before calling the model and fails closed if search usage, token usage or cost measurement is absent.

The inactive capture command is:

```bash
GOOGLE_SEARCH_API_KEY=... \
GOOGLE_SEARCH_ENGINE_ID=... \
GEMINI_API_KEY=... \
npm run trust-loop:capture-split-enrichment
```

Running it is a new external-provider action and requires a fresh bounded approval. Committing the adapter, tests and command does not make a provider call.

## Run the gate

```bash
npm run enrichment:qualify -- fixtures/enrichment/<provider>-reviewed.json
```

The command emits a machine-readable report and exits non-zero if the cohort is mixed across providers, contains duplicate cases, omits usage, exceeds the item budget, returns unsafe facts, mishandles identity or covers less than 80 percent of requested predicates on expected matches.

Do not commit secrets, provider credentials or unredacted private data in a fixture. Search results and citations must be public evidence suitable for an immutable Backline Observation.

## Human review operating model

### 1. Qualification and calibration

Before activation, reviewers inspect every case in the bounded known-answer cohort. This proves that the provider, model, prompt, adapter, thresholds and evidence rules fail closed. It may also create labelled operational examples, but it does not train or fine-tune the external model.

Any confident false identity, wrong official URL, unsupported classification or invented fact fails qualification. Missing evidence is parked and never repaired by human assertion alone.

### 2. Shadow activation

After qualification, run a small live shadow sample with the same hard budgets. Review every parked item, conflict and owner-managed fact, plus a sample of otherwise clean results. Compare measured usage and cost with the fixture report.

Only then add disabled Lambda wiring. Scheduling is a separate production decision. Qualification never authorises canonical projection.

### 3. Business as usual

Once the provider and policy are qualified, routine processing is automatic:

- accept evidence into Backline only when identity, predicate, confidence and exact citation rules pass;
- abstain or park automatically when any required proof is missing;
- preserve owner-managed BNDY facts as the highest authority;
- keep provider scheduling, budgets and stop thresholds machine-enforced;
- make no canonical write unless a separately approved projection policy permits that exact action.

The product owner approves provider activation and canonical projection policy. They are not the routine daily reviewer.

### 4. Exception queue

Human review is required only for cases that cannot safely resolve automatically, including:

- conflicting or same-name identities;
- a suspected wrong official profile or URL;
- disagreement with owner-managed data;
- mutually contradictory high-quality evidence;
- a proposed destructive or policy-sensitive canonical change;
- evidence of provider drift, citation loss or budget breach.

Exceptions remain parked while awaiting review. A queue may accumulate without blocking safe automatic work elsewhere.

### 5. Quality sampling

BAU includes a small periodic sample of automatically accepted and automatically parked cases. The sample is for drift detection and quality assurance, not daily approval. Operators or designated reviewers can handle it; the product owner is needed only for policy or activation decisions.

### 6. Requalification

Return to the bounded qualification gate when any of the following changes materially:

- provider or model;
- prompt, tool configuration or grounding mode;
- adapter, citation mapping or evidence schema;
- identity, confidence or acceptance policy;
- source family or predicate mix;
- a wrong-link incident or measured quality drift.

A material safety failure pauses automatic acceptance for the affected provider, source or predicate until requalification passes. Unaffected fail-closed ingestion may continue.

## Canonical projection

The enrichment worker remains evidence-and-Claims only until canonical projection is separately approved. Projection requires a complete shadow would-write report, owner protection, additive-only or otherwise explicit action rules, hard stop thresholds and an auditable rollback path.
