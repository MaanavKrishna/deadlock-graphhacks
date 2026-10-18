# Graph Hacks submission checklist

Project: **Deadlock**. Team: **ContextSense**.

## Public links

- Repository: https://github.com/MaanavKrishna/deadlock-graphhacks
- Video (v0.3, current interface): [ADD NEW VIDEO URL]
- Earlier v0.2 walkthrough: https://github.com/MaanavKrishna/deadlock-graphhacks/releases/download/v0.2.0/deadlock-live-demo.mp4
- Release/downloads: https://github.com/MaanavKrishna/deadlock-graphhacks/releases/tag/v0.2.0
- Deployment: Vercel + FalkorDB Cloud configuration in README; complete local setup also documented. Live URL: [ADD AFTER DEPLOY]

## Suggested description

Deadlock is a graph-native capacity exchange for small creative-agency communities. Agency representatives negotiate three- and four-party service swaps that direct pairwise matching cannot find. FalkorDB discovers exchange cycles, stores shared negotiation memory, and preserves the evidence behind each agreement. If a participant withdraws, pending holds release and the graph finds an alternative. Humans approve each member before the cycle commits together.

## Tracks

- **Agents That Act on Connected Data:** Cypher cycle traversal selects participants; constrained agents counter terms and create capacity holds and commitments. What-if traversals explain what breaks if an agency leaves, flag keystone agencies and predict which recruit would open the most loops. Graph queries are agent tools, chained by the Ask agent and exposed to any client through an MCP server.
- **Company Brain:** "Ask the network" answers questions about who offers what, who depends on whom, and why each agreement ended as it did, chaining graph tools and citing the agency, deal, lesson and insight nodes it used. Decisions trace back to source events; insights expire when the underlying profile changes.
- **Agent Memory and Coordination:** Representative decisions, shared reservations, approval state and prior agreements and source-backed scope lessons persist across sessions. A live memory ablation changed received scope from 10h to 8h; disabling memory restores baseline terms in the controlled policy integration test.

## Included

- [x] Source implementation and dependency lockfile.
- [x] README with complete verified native local setup.
- [x] Graph data model and dependent queries/algorithm explanation.
- [x] Synthetic data provenance.
- [x] AI-assistance disclosure.
- [x] Demo storyboard and recording script.
- [x] Earlier v0.2 narrated recording (`artifacts/deadlock-live-demo.mp4`, disclosed synthetic voice).
- [ ] New v0.3 video recorded from `docs/DEMO-V3.md`.
- [x] v0.3: landing, docs, workspace v2 with motion, FalkorDB algorithms, withdrawal what-if, recruitment what-if, self-learning memory, Ask with sources, MCP server, live negotiation streaming, compare-and-swap writes, access key, rate limits.
- [x] Automated tests plus desktop/mobile browser verification.
- [x] Docker configuration supplied (native setup is the tested path).

## Human steps before submission

- [ ] Review the source and make a meaningful participant contribution; verify and understand the implementation.
- [ ] Be able to explain the graph model, exact cycle query, negotiation limits, persistence and transaction boundary.
- [ ] Paste the published repository URL into the submission.
- [ ] Review the published narrated video and paste its URL into the submission.
- [x] Public repository/video URLs included in README.
- [ ] Submit before the event deadline shown on the official site.
- [ ] Name all three entered tracks in the form: Agents That Act on Connected Data; Agent Memory and Coordination; Company Brain.
- [ ] Disclose AI coding assistance accurately.

Public repository and video links are recorded below after publication. No hosted application or hackathon submission is claimed. Complete local instructions are the deployment path. The team's membership locks after submission according to the event rules provided by the participant.

## Technical understanding prompts

1. Why does the seed have no direct reciprocal pair but several three-agency cycles?
2. How does `CAN_SERVE` derive from `OFFERS` and `NEEDS` inside FalkorDB?
3. Why deduplicate cycle rotations but preserve direction?
4. How does a representative calculate available hours and credit-balance limits?
5. What happens when the sixth round ends without a stable exchange?
6. Which write converts all holds into commitments?
7. What prevents two requests in this single process from overbooking?
8. What changes would be required for multiple server instances?
9. What exactly is remembered between sessions, and how is it retrieved?
10. What does the optional model do, and what can it never do?
