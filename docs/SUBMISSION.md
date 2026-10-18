# Graph Hacks submission checklist

Project: **Deadlock**. Team: **ContextSense**.

## Suggested description

Deadlock is a graph-native capacity exchange for small creative-agency communities. Agency representatives negotiate three- and four-party service swaps that direct pairwise matching cannot find. FalkorDB discovers exchange cycles, stores shared negotiation memory, and preserves the evidence behind each agreement. If a participant withdraws, pending holds release and the graph finds an alternative. Humans approve each member before the cycle commits together.

## Tracks

- **Agents That Act on Connected Data:** Cypher cycle traversal selects participants; constrained agents counter terms and create capacity holds and commitments.
- **Agent Memory and Coordination:** Representative decisions, shared reservations, approval state and prior agreements persist across sessions; subsequent representatives retrieve relevant previous agreements as context.

## Included

- [x] Source implementation and dependency lockfile.
- [x] README with complete verified native local setup.
- [x] Graph data model and dependent queries/algorithm explanation.
- [x] Synthetic data provenance.
- [x] AI-assistance disclosure.
- [x] Demo storyboard and recording script.
- [x] Local captioned recording of the working flow (`artifacts/deadlock-demo.webm`, no audio).
- [x] Automated tests plus desktop/mobile browser verification.
- [x] Docker configuration supplied (native setup is the tested path).

## Human steps before submission

- [ ] Review the source and make a meaningful participant contribution; verify and understand the implementation.
- [ ] Be able to explain the graph model, exact cycle query, negotiation limits, persistence and transaction boundary.
- [ ] Create/push a **public repository** and paste its actual URL into the submission.
- [ ] Record or review a working demo video, publish it, and paste its actual URL.
- [ ] Add the public repository/video URLs to README if desired.
- [ ] Submit before the event deadline shown on the official site.
- [ ] Name both entered tracks in the form.
- [ ] Disclose AI coding assistance accurately.

No public repository, hosted site, uploaded video or hackathon submission is claimed by the local build. Complete local instructions are the deployment path. The team's membership locks after submission according to the event rules provided by the participant.

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
