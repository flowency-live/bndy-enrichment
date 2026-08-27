# Enrichment Provider Qualification

No external entity-enrichment provider may be wired to a Lambda or schedule until a reviewed fixture passes the default qualification gate.

## Cohort

The minimum cohort is 20 real Backline entities and must include:

- at least five Artists and five Venues;
- at least two deliberately ambiguous Artist cases and two deliberately ambiguous Venue cases;
- exact quality-gap predicates requested by the daily planner;
- the complete raw provider bundle, HTTPS citations and measured usage for every case;
- human adjudication metadata and an explanation for every expected abstention.

The provider must return identity confidence below 0.98 for every expected-park case. A confident false match or an unnecessary park fails the provider. Expected-park cases do not count towards predicate coverage, so no provider is rewarded for inventing facts about an ambiguous entity.

## Run the gate

```bash
npm run enrichment:qualify -- fixtures/enrichment/<provider>-reviewed.json
```

The command emits a machine-readable report and exits non-zero if the cohort is mixed across providers, contains duplicate cases, omits usage, exceeds the item budget, returns unsafe facts, mishandles identity or covers less than 80 percent of requested predicates on expected matches.

Do not commit secrets, provider credentials or unredacted private data in a fixture. Search results and citations must be public evidence suitable for an immutable Backline Observation.

## After fixture qualification

1. Run a small live shadow sample with the same hard budgets.
2. Review every parked item, conflict, owner-managed fact and a sample of otherwise clean results.
3. Compare measured usage and cost with the fixture report.
4. Only then add disabled Lambda wiring. Scheduling remains a separate production decision.

Qualification never authorises canonical projection. The worker remains evidence-and-Claims only.
