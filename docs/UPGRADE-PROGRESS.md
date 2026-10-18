# Deadlock upgrade ledger

Plan: docs/superpowers/plans/2026-10-18-agent-upgrade.md.

- User authorized implementing all recommended upgrades sequentially.
- Design builder check: no blocking contradictions. Ruling: lessons may cite any persisted negotiation involving the agency, including cancelled/rejected proposals; these represent explicitly entered participant feedback, not claimed completed work.
- Task 1: bounded model choices implemented. Actual inspect_exchange -> accept/counter/reject protocol. Counter changes terms and clears representative acceptances. Unknown proposals, loops, vetoes, malformed responses and timeouts fail without capacity holds.
- Task 1 verification: 29 tests green, including local HTTP provider protocol plus real FalkorDB model-selected eight-hour reservations. TypeScript passes. Live API credentials are pending user configuration in ignored .env; no live-provider verification claimed yet.
- Ruling: .env is read dynamically for model settings, so a user can configure a provider without leaking credentials or restarting the app.
- Ruling: use a stable Node dev process plus Vite frontend HMR. Backend changes require restart; this avoids watcher restarts interrupting embedded database shutdown during active edits.

- Task 2: typed source-backed Lesson nodes, supersession, active graph retrieval, participant feedback API, constrained remembered proposals and memory on/off implemented. Tests prove unchanged profiles produce 10h/8h/10h across real database reopen; invalid source and impossible feedback remain safe.
- Task 3: ten-agency launch fixture yields fourteen discovered cycles: eleven feasible, three deadline-blocked, including six feasible four-party paths. UI adds scenario confirmation, mode/memory controls, tool/citation trace, learning form and controlled Memory comparison.
- Verification: npm run check passes typecheck, all 33 tests and production build. Browser learning journey produced actual 10h vs 8h linked agreements under identical snapshots. Live provider remains unconfigured at this checkpoint.

- Independent review: fixed model identity mismatch in memory comparison and preserved provider-reported response models separately from requested model IDs. Missing actual identity excludes model comparisons. Added failing regression tests first. Source feedback from rejected negotiations remains allowed by explicit spec ruling; UI now accurately calls these source negotiations.
- User selected Claude Haiku 5.5. Official Anthropic docs verified model ID claude-haiku-5-5 and compatibility endpoint https://api.anthropic.com/v1. Ignored local configuration updated without exposing/changing any key. Requests now bound output to 2,048 tokens, omitting sampling overrides.
- Live Anthropic Haiku 5.5 baseline succeeded: each representative actually inspected context and accepted; provider-reported model matched; 10h per participant held awaiting human approval. Live memory test exposed a repeated-inspection response. No holds were made on failure. Root cause: inspection remained in the offered tool menu after context had been returned. Added failing protocol-menu regression then restricted first step to inspection and following step to decision tools.
- User additionally requested moving from demo to a working product. Bounded scope: live agents selected when configured; editable user-owned service profiles and a durable empty workspace option; sample networks remain explicitly identified; commitments remain human-approved capacity records. No external outreach, billing, identity verification or service delivery is implied.

- Live rerun succeeded after clarifying that requestHours is aspirational, minReceiveHours is binding, and only the agency's own lesson records define its preferred received-scope ceiling. Baseline model deal e82c7abd held 10h each; model deal fe67b1c5 countered twice and reached 8h each with all representative acceptances renewed. Provider reported claude-haiku-5-5. Rejected attempts remain in the audit trail; they made no holds.
- Empty-workspace persistence regression plus full suite: 35 tests, typecheck and production build pass. Workspace metadata distinguishes samples/custom profiles; user profile entry does not imply verified identities or completed services. Review confirmed persistence/menu logic; sample-specific labels and export metadata corrected.

- Final tool-menu regression green: counter choices exclude current and previously visited proposals; no counter tool is exposed when none remain. All35 tests/typecheck/build pass; independent follow-up reviewer found no consequential issues.
- Finished narrated live walkthrough (180.13s, H.264/AAC, synthetic voice). Actual model failures remain visible and are described accurately.
- Custom live browser verification completed for three newly entered profiles: graph-discovered cycle, actual Haiku decisions, 10h holds, correct non-sample workspace/export metadata.

- Public source published at https://github.com/MaanavKrishna/deadlock-graphhacks on branch main. Key scan checked all 62 publishable files with zero key matches; .env remains ignored. Final npm run check passes35 tests/typecheck/build; Prettier passes.
- Narrated MP4 and source archive are release deliverables for v0.2.0. Participant source understanding, video review, and submission form remain human responsibilities.

## v0.3 — 18 October 2026 (evening)

- Graph-sourced network edges; compare-and-swap writes on the Workspace revision (cross-instance race test); `ACCESS_KEY` for workspace replacement, model negotiation and Ask; Vercel entrypoint with remote FalkorDB; unused advisor removed.
- Withdrawal what-if traversal, keystone agencies, recruitment what-if (prediction verified against a real addition).
- Self-learning memory: `TRADED_WITH` partner edges and `Insight` nodes that expire with the blocking profile revision.
- Ask the network: eight fixed Cypher tools, citations limited to retrieved node ids, verified live with Claude Haiku 5.5. MCP server (`npm run mcp`) verified end to end with an MCP client.
- Claude Design canvas for every screen; landing (`/`), docs (`/docs`) and workspace v2 (`/app`) built with motion.dev; product language and guided first-run setup in place of demo wording.
- 45 tests, typecheck and production build pass; desktop (1440) and mobile (390) browser checks with no console errors and no horizontal scroll.
- Network edges: all 8 `CAN_SERVE` edges were present in the graph and the DOM, but arrowheads ended under the taller cards, muted edges were too faint on the dark stage and the center label covered one edge. Endpoints now use rectangle intersection, edges are brighter, and the label sits beneath the wires.
- Every workspace view has its own URL with Back/Forward support and per-page titles; agreements are linkable with `?deal=`. "Why this loop?" evidence panel with a copyable Cypher query, tested to reproduce every discovered loop. 46 tests pass.
- Removed the `codex/deadlock` branch from GitHub; `main` is the default branch.
- All workspace views moved to the v2 design with motion: Agencies (filterable card grid, capacity meters, loop counts), Activity (status counters, timeline), Memory (memory counters, source cards), Ask (dark panel, tool list), Settings (workspace choice cards). Checked at 1440 and 390 with no console errors or horizontal scroll.
