# Deadlock: product scope and design

Team: ContextSense. Product: Deadlock. Written before implementation on 18 October 2026.

## Intent

Help a small, trusted community of creative agencies exchange spare capacity when no two members can make a direct swap. Each agency has an autonomous representative with explicit limits. FalkorDB discovers a connected exchange, representatives negotiate, and humans approve the entire agreement before any capacity is committed.

This is a complete hackathon MVP, not a payment service or a claim that exchanged work has been delivered. All seeded agencies, valuations, conversations, and commitments are synthetic. Local operation and complete setup instructions satisfy the deployment deliverable. Publishing or messaging third parties is outside this build.

## Success criteria

1. A fresh checkout starts a real FalkorDB graph and the full application without API keys. Docker/remote FalkorDB is also supported.
2. Six fictional agencies contain no direct reciprocal match, but contain at least two alternative three-party cycles.
3. The graph finds candidate cycles of three or four distinct agencies. The interface highlights a selected cycle and explains each participant's give/receive relationship.
4. Independent policy representatives negotiate over capacity, delivery deadlines, minimum requested hours, and credit-value balance. Every accept, counteroffer, and rejection is recorded. Policies are deterministic and explicitly labeled; optional model assistance cannot bypass the policies.
5. A negotiated agreement reserves capacity only after every participant's constraints pass. It remains a proposal until each agency receives an explicit human approval in the sandbox.
6. Final approval commits the entire cycle together. Repeated approval is idempotent. Conflicting or stale proposals cannot overbook capacity.
7. Changing an agency's availability invalidates affected pending proposals and releases all their holds. A replacement search excludes unavailable agencies and preserves the previous negotiation history.
8. Reload and process restart preserve agencies, runs, messages, proposals, approvals, and reservations in FalkorDB.
9. Invalid forms, failed graph connection, no possible cycle, infeasible terms, and stale actions have actionable interface states.
10. Automated tests exercise negotiation constraints, graph-discovered cycles, capacity contention, approval transitions, recovery, and persistence. Browser QA covers the principal desktop and mobile flows.

## Features

- Exchange desk: live network graph, cycle search, ranked opportunities, selected exchange details.
- Negotiation room: round-by-round representative decisions, proposed service hours and delivery days, transparent constraints, graph evidence.
- Agreement panel: explicit approval per member, reservation/commit status, cancel, downloadable JSON agreement with evidence and audit history.
- Agency directory: offers, needs, credit valuations, capacity, deadlines, availability, edit/create validated agency profiles.
- Activity archive: persistent runs and decisions, including invalidation and rerouting.
- Guided demo: discover, negotiate, simulate withdrawal, discover alternative, approve.
- Settings/status: actual database and agent mode, optional server-side model configuration, clear synthetic-data label, guarded demo reset.

## Data and graph model

`Agency` has id, name, specialty, initials, color, description, active, capacityHours, reservedHours, committedHours, requestHours, minReceiveHours, hourlyCredits, maxImbalancePct, deliveryDays, deadlineDays, offer, need, revision.

`Service` is an exact taxonomy: design, video, copy, development. `Agency-[:OFFERS]->Service` and `Agency-[:NEEDS]->Service` derive `Agency-[:CAN_SERVE]->Agency` compatibility edges inside FalkorDB. No hardcoded cycle arrays are allowed in runtime matching. Service categories are exact matches, not inferred professional suitability.

`Run` records creation time, candidate paths, counts and query evidence. `Deal` records a snapshot of participants and negotiated legs, status (negotiating, rejected, awaiting_approval, committed, cancelled, invalidated), timestamps, and failure reason. `Deal-[:INVOLVES]->Agency`, `Deal-[:HAS_EVENT]->Event`, and `Deal-[:FROM_RUN]->Run` connect memory and provenance. Each event records actor, round, action, reason, and time. Approval flags and reserved/committed quantities are represented in the deal snapshot and agency counters, updated together in a graph transaction.

All durable state lives in FalkorDB. JSON properties hold immutable structured snapshots while graph relationships support matching, ownership, evidence and invalidation. No in-memory or browser-local fallback replaces the graph. A graph outage stops mutation and search.

## Negotiation and consistency

An exchange leg is provider -> recipient for the provider's offered service. The recipient starts by requesting requestHours. On each bounded round (maximum 6), each agency checks the hours it receives, the hours it gives, delivery deadline, available capacity, and credit balance. A permitted counteroffer lowers outgoing hours while respecting the recipient's minimum. Failed deadlines are non-negotiable. Value balance requires outgoing credits <= incoming credits * (1 + maxImbalancePct/100). A stable feasible set of legs is accepted; impossible constraints produce a persisted rejection rather than a fabricated deal.

The policy engine owns feasibility. Optional model assistance may provide a rationale or choose a stricter accept/reject decision, but cannot relax constraints, invent participants or execute a commitment. The default is transparently labeled policy agents, not an LLM simulation.

One Node process serializes mutations; inside each operation it reloads current graph state. A single Cypher write persists the full mutation atomically. This prevents competing proposals and repeated clicks from overbooking. Remote multiple-server deployment requires a distributed lock or graph-side compare-and-swap before scaling; it is explicitly unsupported in this MVP. Embedded FalkorDB uses append-only persistence. External instances must enable persistence themselves.

Capacity is held only for awaiting_approval proposals. Every participant approval is an explicit sandbox action. The final approval atomically converts every hold into a commitment. Availability/profile changes invalidate related pending agreements first; committed agreements are immutable historical records. Cancellation releases all holds. Deals have no automatic expiry in this MVP; the interface exposes cancellation and clearly displays outstanding reservations.

## Technical choices (builder defaults)

- Node.js >=22.12, TypeScript, React, Vite, Express, Zod, Lucide icons.
- Official FalkorDB TypeScript client. Default embedded official falkordblite, with persistent data under `.data/`; `FALKORDB_URL` enables remote/Docker mode.
- One local API/application server; Vite proxies `/api` in development. Production Node serves the compiled frontend.
- API binds to localhost by default. Docker mode may bind to 0.0.0.0 explicitly. No authentication is implemented; do not expose the write API publicly without access controls.
- Responsive, keyboard-accessible UI. Named form labels, live announcements, visible focus, reduced motion and no remote image dependencies.

## Visual direction

An exchange desk with a blueprint-like network canvas, a pale lavender workspace and deep indigo controls. Palette: paper #f7f8fc, ink #20253d, indigo #5652d6, lavender #eeedfb, teal #237f73, amber #b76c28. System sans for operational text, Georgia for the product's short editorial headline. Main layout: restrained left navigation; central network and opportunities; right contextual negotiation/agreement panel. Network connections and agency identities are the bold visual element; avoid a generic grid of metrics. Mobile stacks network, opportunities, then room. All core controls remain accessible without manipulating the graph.

## Out of scope

Payments, escrow, contracts with legal effect, external messaging, real agency data, third-party integrations, service quality verification, currency issuance, open public marketplace, arbitrary natural-language pricing, unlimited negotiation, distributed workers, and claiming real work was fulfilled.

## Submission and product path

Primary tracks: Agents That Act on Connected Data; Agent Memory and Coordination. README must explain FalkorDB dependency, schema, exact queries, agent policies, operation and tests, data provenance, limitations, and AI assistance. Include a demo script and submission checklist; the user records the final video and publishes the repository. Post-event validate with one existing professional community before adding payments or integrations. Pilot hypotheses: sufficient compatible supply, understandable valuation, acceptable coordination costs, and willingness to complete repeat exchanges.
