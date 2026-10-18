# Deadlock feature scope

The binding product design is [the design](superpowers/specs/2026-10-18-deadlock-design.md).

## Included in this build

Graph-discovered three/four-party exchanges; bounded policy-agent negotiation; explicit per-agency human approval; atomic cycle commitment; capacity holds and release; agency create/edit and availability; participant withdrawal and graph-based rerouting; persistent negotiation history; graph/query evidence; JSON agreement export; responsive exchange desk; seeded synthetic company network; local and Docker setup; domain, integration and browser checks.

## Acceptance journey

Start with six agencies. Discover cycles. Inspect why no direct swap works. Negotiate the first cycle. Read independent decisions and terms. Withdraw a participant. Confirm invalidation and released capacity. Discover a replacement, negotiate it and approve each agency. Confirm the entire agreement commits once. Reload and inspect history. Restart and confirm the same state remains.

## Explicit boundary

The agreement reserves fictional service capacity. It does not transfer money, contact agencies, deliver services, or form a verified real-world contract. Policy agents are the default and clearly labeled. Model assistance is optional; feasibility is always enforced by code.
