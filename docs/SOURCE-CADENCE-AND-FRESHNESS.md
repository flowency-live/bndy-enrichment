# Backline source cadence and freshness contract

Status: code-ready, not deployed. Canonical writes remain disabled.

## Owner rule

Every active source family must have at least one coverage root that completes successfully every 24 hours or faster. Backline allows a two-hour operational grace period and alarms when a coverage root has no successful run within 26 hours.

A child hydration task is not an independent schedule. It runs when a coverage root discovers an artist, venue or gig. A maintenance reconciliation is also not the source's freshness schedule; it repairs history or completeness at a slower cadence while the coverage root continues daily.

| Source family | Coverage root | Schedule owner | Effective cadence | Maximum staleness | State |
|---|---|---|---:|---:|---|
| GigsNews | `gigs-news-daily-import` | registry dispatcher | daily | 26h | enabled, shadow |
| KLMA | `klma-stoke-gig-list` | registry dispatcher | daily | 26h | enabled, shadow |
| Lemonrock | `lemonrock-new-gigs` | EventBridge | hourly | 26h | enabled, shadow |
| Lemonrock | `lemonrock-cancellations` | EventBridge | hourly | 26h | enabled, shadow |
| Lemonrock | `lemonrock-future-reconcile` health surface | EventBridge | daily | 26h | enabled, shadow |
| On The Case | `onthecase-gig-index` | EventBridge | hourly | 26h | enabled, shadow |
| ScenicEye | `sceniceye-daily-import` | registry dispatcher | daily | 26h | enabled, shadow |
| Insangel | `insangel-daily-import` | none | none | none | planned, blocked |

## Known gap

Insangel has no registered runtime adapter. It must not be marked enabled merely to make the table look green. Implement and qualify its acquisition/parser, add fixtures and structural failure tests, then change it to an enabled daily coverage root with a 26-hour staleness limit.

## Deployment and verification gate

The production deployment must:

1. pass build, tests and CDK synth;
2. deploy the source-health worker and alarm;
3. seed the unified catalogue with `npm run sources:seed-catalog` using the deployed state-table output;
4. verify the registry has no legacy `onthecase-daily-import` or `sceniceye-weekly-listing` schedule keys;
5. confirm all EventBridge roots are enabled and target the expected logical queue;
6. observe one successful run for every coverage root;
7. confirm the source freshness alarm returns to `OK`;
8. compare the resulting AWS schedule inventory with the final Claude Cowork scheduled-task export before retiring any Cowork task.

Steps 2 to 8 mutate or inspect production and therefore remain behind the production HITL gate. No source cadence change enables canonical writes.
