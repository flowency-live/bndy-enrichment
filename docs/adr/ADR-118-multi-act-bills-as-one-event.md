# ADR-118: A multi-act bill is one Event with an ordered line-up

- Status: accepted
- Date: 05/09/2026
- Owner ruling: multi-act line-up gigs are built in bndy; one event, headliner marked

## Context

Sources list bills as one string: `Riskee And The Ridicule, Deadwax, Boss Cass`,
`Troyen + Stonepit Drive`, `Indie Vs Britpop Night With All4indie & Brit Pop United`.
Backline modelled one performer per event, so the KLMA adapter parked every Rigger row
as `multi_act` and other adapters sent the whole string to canonical, which refuses a
line-up as an artist name. The vault runbook §4 prescribed one discrete event per act
because the parent container did not exist. It exists now: the community events API
accepts `artistIds`, stores the first as the primary act and the rest as collaborators,
and caps a gig at four acts.

## Decision

In the context of projecting a gig whose source lists several acts, facing a canonical
model that now carries a line-up, we decided for one Event per bill with an ordered
`artistIds`, headliner first, and against one event per act or a lumped artist, to
achieve one record per gig that matches what bndy.live displays, accepting that a bill
of more than four acts is refused as a handled exception until it is modelled as a
festival.

Shape, end to end:

1. A normalised source event may carry `performers[]`; `artistName` names the headliner.
2. Knowledge writes one `hasPerformer` Claim per act with its `ordinal` and a
   `headliner` flag, and one `hasPerformerName` Claim for the headliner. A one-act event
   keeps the legacy Claim shape unchanged.
3. The projection candidate materialises the bill from the newest Claim per act,
   ordered by position. Every act is an artist candidate in its own right.
4. The engine resolves the venue, then every act in order, creates the event with the
   full `artistIds`, and verifies on read-back that every act is on the bill.
5. Every created act posts its own enrichment job.

## Consequences

- Line-up splitting moves to a source-independent billing stage (next ADR); adapters
  stop parking multi-act rows.
- A remembered projection mapping names only the headliner and is reused only for a
  one-act bill; a multi-act bill re-resolves every act.
- Sentinel keys in canonical are one per act, so adding a support act to an existing
  event is an identity change and is left to the additive-only guards.
