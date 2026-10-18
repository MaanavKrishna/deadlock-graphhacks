# Deadlock v0.3 demo script (3:00)

Record at 1440×900. Open with 5 seconds on the landing page (`/`): the loop draws itself. Then click **Open the app**, with the example network freshly loaded (**Settings → Replace workspace**) and a live model configured. Narrate in your own voice. Each beat lists what to click and what to say.

## 0:00–0:20 — The problem
- **Show:** Exchange desk, network with 6 agencies.
- **Say:** "Six agencies each have spare hours and one need, and none of them can swap directly. Deadlock stores offers and needs in FalkorDB, derives `CAN_SERVE` edges inside the graph, and finds closed loops where everyone gives and everyone gets."

## 0:20–0:45 — The graph finds the loop, and its weak point
- **Click:** Discover exchanges. Point at the 3 loops and the **Keystone** badge on Studio North.
- **Say:** "A variable-length Cypher traversal returned three 3-way loops. The graph also shows that every loop runs through Studio North. It's the keystone, and the network's single point of failure."
- **Scroll:** Strengthen the network.
- **Say:** "A path query tests every missing profile. Recruiting a designer who needs copy would open three new loops that avoid the keystone. The tests check that prediction against the real addition."

## 0:45–1:20 — Agents act, humans approve
- **Click:** the Motionhaus / Wordcraft / Studio North loop. Point at **Why the graph found this loop**: each hop is an OFFERS/NEEDS match, and the copyable query reproduces the loop in FalkorDB.
- **Click:** **Start negotiation** in Live model mode. The live feed streams each Claude tool call as it happens; afterwards open the Agent log.
- **Say:** "Each agency has its own Claude representative. It must call `inspect_exchange`, then accept, counter to a pre-validated proposal, or reject. The server re-checks capacity, deadlines and value balance, then holds capacity. Nothing commits until every member approves." Approve one member.

## 1:20–1:45 — What breaks if someone leaves
- **Click:** Motionhaus on the network.
- **Say:** "Before anyone withdraws, FalkorDB re-runs the traversal without Motionhaus. One of three loops breaks, this pending agreement and its held hours would be released, and Wordcraft and Studio North can still be routed."
- **Click:** close the preview, then **Pause an agency** in the drawer. Point out that the agreement is invalidated and the holds are released.

## 1:45–2:15 — Memory that learns
- **Say:** "Memory works two ways. Members can teach a preference." Open Teach a scope preference and remember 8h for Studio North.
- **Say:** "The graph also learns on its own. A committed deal writes `TRADED_WITH` partner edges that rank proven loops higher. A failed negotiation writes an `Insight` node about the blocking agency, which stays flagged until that agency's profile changes."
- **Click:** Memory, and show lessons and outcomes with their source links.

## 2:15–2:45 — Ask the network, with sources
- **Click:** Ask the network, then "Which agency does every exchange loop depend on?"
- **Say:** "This agent can only call fixed, parameterized graph tools: find loops, withdrawal impact, agency history, decision trace. It must cite the nodes it retrieved, and the tool trace is right here." Expand the tool calls.
- **Say:** "The same tools are exposed as an MCP server, so Claude Desktop or Claude Code can query and act on the graph. Approval stays human."

## 2:45–3:00 — Close
- **Show:** README "What the graph does" table, or the Activity page.
- **Say:** "Without FalkorDB there are no loops, no impact analysis, no memory and no answers. Deadlock is open source, with 45 tests, local setup and a hosted deployment path."

**Before publishing:** check that every number you say matches the screen, since live model choices can differ between runs. State on screen that agencies are synthetic.
