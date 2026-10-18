# Deadlock demo script

Target: a focused 2–3 minute recording. Prepare with Guide & settings -> Reset demo workspace. Start the server before recording. The browser must visibly show real interactions, not a slide deck.

A **32-second captioned draft** of the actual working flow is saved locally at `artifacts/deadlock-demo.webm`. It has no audio. Review it and optionally record the longer narrated walkthrough below before uploading a submission video.

## 0:00–0:20 — The problem

“A designer needs a writer. A writer needs a video editor. A video editor needs design. No two can swap directly. Deadlock uses a graph to find the connected agreement.”

Show the six-agency network and explain that every profile is synthetic. Select an agency if useful to show offers, needs and limits, then close the profile.

## 0:20–0:45 — The graph does the matching

Click Discover exchanges. Select the Motionhaus / Wordcraft / Studio North opportunity. The directed cycle is highlighted. Open Graph evidence.

“These are database-discovered paths. FalkorDB follows compatible offers and needs back to the starting agency. The graph decides which participants can negotiate.”

## 0:45–1:10 — Representatives negotiate

Click Start negotiation. Open Agent log. Show capacity, deadline and value checks.

“Each representative has its own limits. This key-free mode uses policy agents. Optional model assistance explains outcomes, while code enforces the agreement constraints.”

Switch to Agreement. Show each member's separate approval button.

## 1:10–1:45 — Break the plan

Click Simulate withdrawal before approving. Motionhaus becomes unavailable. Show the invalidated agreement and released holds.

Click Find another path. Select Frame Lab / Wordcraft / Studio North and start negotiation. Open Agent log to show its counters and retrieved previous-agreement context.

“Frame Lab has only eight hours. The representatives adjust the exchange instead of copying the old deal. The previous outcome remains in shared memory.”

## 1:45–2:15 — A complete agreement

Approve each member separately. Pause before the final approval and point out that the agreement has not committed. Give the final approval; show Committed and agency capacity counters.

“All members approve. The entire cycle commits in one graph transaction. A repeated click cannot commit it twice.”

## 2:15–2:40 — Explainability and memory

Download the agreement/evidence JSON. Reload. Open Activity and revisit both agreements. Optionally stop and restart the server while recording to show durable graph memory (allow extra time).

“The graph preserves what was proposed, why it changed, who approved and which previous agreement each representative consulted.”

Close with: “Deadlock finds the whole connected deal that makes each individual trade possible.”

## Accuracy notes

- Do not describe the default agents as LLM agents.
- Do not describe committed capacity as completed work or transferred money.
- Do not claim optimal economic matching, verified agencies or production readiness.
- Include AI-assistance disclosure in the README and submission.
