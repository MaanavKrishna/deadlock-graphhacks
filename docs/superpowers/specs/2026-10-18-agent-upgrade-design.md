# Deadlock agent and memory upgrade

User authorization: implement the three proposed improvements one by one, followed by verification, narrated demo and public-source preparation. Existing hard constraints and human approvals remain binding.

## 1. Consequential model-backed representatives

Each agency receives graph-derived exchange terms, its own constraints, feasible alternative proposal vectors and relevant graph lessons. The model must call exactly one bounded tool: `accept_offer`, `counter_offer(proposalId)`, or `reject_offer`. A counter selects a different full proposal vector whose capacities, services, deadlines, minimums and credit balance have already passed the policy engine. The server rechecks the chosen terms. Changing the proposal clears representative acceptances; all representatives must accept the same terms before capacity is held. Rejection, invalid output, timeout, or six-round limit records a rejected negotiation and holds nothing. A model response never approves for a human or commits work.

OpenAI-compatible Chat Completions tool calls are the transport. Configuration lives in ignored `.env` / server environment; model settings reload per request. No key or endpoint credentials are exposed to clients. Policy simulation remains available and is explicitly labeled. Configured model failures do not silently become successful policy negotiations. Record actual model ID, chosen tool, proposal ID and public decision explanation as evidence, not private chain-of-thought.

## 2. Memory changes terms

Add graph `Lesson` nodes linked `ABOUT -> Agency` and `LEARNED_FROM -> Deal`. A human sandbox participant can record a preferred received scope (quarter-hour precision, 0.25–1000 hours), backed by a prior agreement involving that agency. This is a soft learned preference, not a rewrite of hard profile constraints. Newer feedback supersedes earlier lessons of the same kind.

Fresh negotiations retrieve lessons through graph relationships and generate a `remembered` proposal targeting learned scope ceilings when feasible. A policy simulation and model representatives can counter from the requested proposal to the remembered proposal. Infeasible preferences cannot override any hard constraint. `useMemory: false` provides an explicit ablation with identical profiles/capacity so the interface can show whether memory changed actual terms. Store enabled/disabled mode and cited lesson IDs on each deal. Reload and process restart preserve lessons and source evidence.

## 3. Showcase scenario

Keep the original six-agency starter. Add a separate ten-agency launch scenario, loaded only by explicit confirmation because it replaces the current demo graph. It includes heterogeneous values, limited hours, a misleading high-value cycle with a deadline failure, multiple feasible alternatives, and a four-party path. No fabricated benchmark metrics or claimed real-world savings. UI distinguishes raw graph connectivity from feasibility.

## Interface

- Negotiation mode selector: live model agents (only when configured) or policy simulation.
- Include/replay without memory toggle, visibly recorded in the result.
- Model decision trace: actual tool, proposal and source lesson references.
- Lesson capture form on prior agreements, with numeric preference and source agreement link.
- Memory view with persisted lessons; agreement comparison with/without memory and actual received hours.
- Confirmed scenario picker for starter/showcase; preserve existing reset warning behavior.
- Clear provider-configured status with Refresh configuration action.

## Delivery

Test first: real tool choices alter terms; rejection/unsafe output/timeout holds nothing; counters reset prior acceptances; persisted lessons alter the next agreement after restart; ablation preserves profiles; source validation prevents invented lessons; showcase has real graph-discovered four-party paths and infeasible attractive paths. Run existing tests and desktop/mobile QA. Independent read-only review after implementation. Produce a narrated recording with OS speech synthesis (clearly synthetic voice), then prepare/publish the public repository only after verifying no credentials or runtime data enter Git. Never submit the hackathon form or contact third parties without a separate request.

Remaining external dependency: the user configures their API provider in `.env`. Until a real provider responds, label model integration as implemented/tested via a local protocol server, not live-verified.
