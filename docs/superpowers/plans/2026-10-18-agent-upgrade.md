# Deadlock Agent Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans. Execute sequentially as requested.

**Goal:** Give model agents a consequential tool loop, demonstrate behavior-changing graph memory, and deliver a harder showcase and narrated demo.

**Architecture:** Preserve the policy engine and atomic Store transitions. A separate agent runner negotiates over fully validated proposal vectors. Graph lessons influence generated vectors and are referenced in audit events. React exposes modes, memory, and scenario comparison.

**Tech stack:** existing TypeScript, React, FalkorDB, Vitest; OpenAI-compatible tool calls; local OS voice/ffmpeg for demo production.

**Spec:** docs/superpowers/specs/2026-10-18-agent-upgrade-design.md

## Global constraints

- No model output bypasses hard feasibility or human approval.
- Model failure records rejection and reserves zero hours.
- Graph is the only durable store; lessons have source agreement provenance.
- Provider secrets remain in ignored server configuration.
- Scenario replacement requires explicit confirmation.

## Review focus

- Counteroffer changes terms after an earlier agent accepted: previous acceptances must reset.
- Malformed, out-of-menu or repeated model output: bounded rejection, no reservation.
- Memory is infeasible/stale: hard minimums and capacity still win.
- Source agreement does not involve the lesson's agency: reject the lesson.
- Reload/config changes and older persisted state: backward-compatible defaults and accurate labels.

### Task 1: Real model decisions

Files: `src/server/model.ts`, `src/server/agents.ts`, `src/server/negotiation.ts`, shared types, Store, API, new agent/model tests.

Interfaces: `ModelConfig`, `AgentDecision`, `Proposal`, `runAgents(agencies, proposals, decide): Promise<NegotiationResult>`, `decideWithModel(context): Promise<AgentDecision>`; `Store.negotiate(runId, ids, options)` records requested/executed modes.

- [x] Write and run failing tests for model counter changing hours, veto, invalid tools, counters clearing approvals, timeout and malformed transport responses.
- [x] Implement safe feasible proposal generation, bounded representative tool decisions, validator and model configuration hot reload.
- [x] Integrate mode validation into API/Store, retaining explicit policy simulation.
- [x] Run targeted and existing tests.
- [x] Verify a configured real provider when the participant supplies the key.

### Task 2: Behavior-changing memory

Files: shared Lesson schema, Store graph writes/retrieval, memory API, agent proposal selection, tests.

Interfaces: `Store.recordLesson(dealId, agencyId, preferredHours)`, Snapshot.lessons, `negotiate(...,{useMemory})`.

- [x] Write failing real-FalkorDB tests for source validation, close/reopen and identical-state memory ablation producing different terms.
- [x] Persist typed Lesson relationships, retrieve newest per-agency preferences, generate remembered proposals, cite evidence in agent context and audit.
- [x] Verify no hard constraint changes and no extra reservation on rejection.

### Task 3: Showcase and UI

Files: showcase fixtures, reset/scenario API, React exchange controls, room evidence and lesson form, memory comparison view.

- [x] Write graph tests proving ten participants, a rejected attractive path and a real feasible four-party path.
- [x] Add explicit scenario loading, mode and memory controls, provenance view, learning form and before/after agreement comparison.
- [x] Verify UI journeys and mobile layout against actual graph state.

### Task 4: Delivery

- [x] Run typecheck, full tests, build, browser QA and independent read-only review; fix consequential findings with regression tests.
- [x] Update README, architecture, demo and submission docs to match actual verified behavior.
- [x] Record narrated two/three-minute walkthrough; label synthetic voice and actual model mode accurately.
- [ ] Check Git tracked contents for secrets; create public repository and push only project source/docs. Return repository and video artifacts, noting any required external activation/upload.
