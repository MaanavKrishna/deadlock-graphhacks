# Deadlock implementation ledger

Plan: docs/superpowers/plans/2026-10-18-deadlock.md

- Scope written before implementation.
- Ruling: work in the provided empty workspace; no repository or existing branch exists to isolate.
- Ruling: local full-stack application with real embedded FalkorDB by default; stopped Docker should not prevent the demo. Remote/Docker connection remains supported.
- Ruling: implement the supplied request continuously after documentation, without another design approval pause, as explicitly requested by the user.
- Ruling: single-server mutation serialization plus atomic graph writes; distributed deployments are outside the MVP.

## Completion record

- Design builder check: no important unanswered questions.
- Task 1 complete: domain tests observed failing, then passing after negotiation implementation.
- Task 2 complete: real FalkorDB discovery, reservations, approvals, cancellation, invalidation, contention and restart tests passed.
- Task 3 complete: validated API and optional model advisor; malformed response and timeout exercised against a local HTTP server.
- Task 4 complete: desktop and 390px browser journeys verified, including profile create/edit, graph evidence, negotiation, withdrawal, alternative discovery, member approvals, history and reload.
- Task 5 complete: scope, features, implementation plan, architecture, queries, README, product hypotheses, submission checklist and demo script supplied.
- Independent whole-project review: approved scoped local sandbox, no Critical/Important findings. Reviewer additionally verified actual four-party traversal and concurrent duplicate approvals.
- Review minor corrected: agency dialog given an accessible name; browser verified its name and Escape behavior.
- Final regression: second embedded process previously could open the same persistent directory. Test observed failure, exclusive directory lock implemented, test passed.
- Final build verified after fixes: TypeScript passes; 21 tests in 4 files pass; production Vite build passes. npm audit: 0 vulnerabilities. npm run doctor executes a real FalkorDB query.
- Production server was started successfully and its health endpoint verified. It is not left running alongside the development server.
- Browser console: no errors. Native reset dialog focuses Keep workspace; Escape closes both reset and agency dialogs.
- Captioned browser demo recorded to artifacts/deadlock-demo.webm (no audio). Desktop/mobile screenshots are under artifacts/.
- Docker image tag and entrypoint/volume location checked against official sources; Docker execution and remote database deployment remain unverified because the local daemon is stopped.
- No paid model inference, public deployment, remote push or hackathon submission performed.
- Production serving verified on port 3001 using a separate temporary data directory: HTML 200, graph health OK, and three actual discovered cycles. Production process stopped afterward.
- Native macOS library linkage inspected; README documents Homebrew libomp and openssl@3 prerequisites. Captioned video duration verified with ffprobe: 32.28 seconds.

## Implementation decisions

- Ruling: root optional platform dependencies pin the corrected native release; the earlier macOS binary package contained Linux executables. Cost: Linux x64/macOS arm64 supported natively, other platforms need a remote database.
- Ruling: use short temporary Unix sockets while keeping graph files in the workspace, avoiding macOS path limits. Cost: socket paths change on restart; durable graph IDs do not.
- Ruling: use frontend polling in this cloud-synced workspace after observing stale dev-server modules. Cost: modest development-only filesystem polling.
- Ruling: lock the native data directory and fail closed on a leftover lock. Cost: unclean shutdown may require manual stale-lock removal after checking no process owns the graph.
- Ruling: the default is a key-free policy-agent negotiation protocol with optional model explanation. Cost: do not present it as default LLM-driven negotiation.
- Ruling: complete local setup is the deployment deliverable; authentication, distributed workers and external transactions are outside this MVP. Cost: add those capabilities before a public service.
