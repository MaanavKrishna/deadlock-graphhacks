# When no one can trade directly: finding deals as cycles in a graph

*Draft for the Graph Hacks blog prize. Edit it into your own voice before publishing.*

Studio North needs copywriting. Wordcraft can write, but it needs video. Motionhaus makes video, and it needs a brand designer, which is exactly what Studio North offers. No two of them can make a direct swap, but all three can make one together.

That's the problem behind **Deadlock**, a capacity exchange for small communities of creative agencies, built on FalkorDB for Graph Hacks. This post covers the graph model, the queries that do the work, and what changed once "memory" meant nodes and edges instead of a chat log.

## Matching is a cycle problem

Each agency is a node. `OFFERS` and `NEEDS` relationships point to four service nodes. FalkorDB then derives a direct compatibility edge:

```cypher
MATCH (provider:Agency)-[:OFFERS]->(s:Service)<-[:NEEDS]-(recipient:Agency)
WHERE provider.id <> recipient.id
CREATE (provider)-[:CAN_SERVE {service: s.id}]->(recipient)
```

A deal is a closed directed path of three or four agencies:

```cypher
MATCH p=(a:Agency)-[:CAN_SERVE*3..4]->(a)
WHERE all(n IN nodes(p) WHERE n.active = true)
RETURN [n IN nodes(p) | n.id] AS ids LIMIT 2000
```

The application merges rotations of the same loop (A→B→C is the same deal as B→C→A) but keeps direction, because reversing a loop changes who serves whom. It then runs each agency's constraints: capacity, deadlines, minimum scope and a value-balance limit. A graph that is merely connected is not the same as an exchange that is feasible, and the interface shows both.

## The graph explains itself

Once loops are paths, three useful questions become one-line variations of the same query.

**What breaks if someone leaves?** Run the traversal again with one agency excluded (`AND n.id <> $excluded`). The difference shows which loops break, which pending agreements and held hours are affected, and which partners are stranded.

**Who is the keystone?** Count loop membership. In our starter network, every loop runs through one designer. Nothing in the profiles makes that obvious, but the graph shows it immediately.

**Who should we recruit?** A new agency offering service X and needing Y closes one loop for every short path from an agency that needs X to one that offers Y:

```cypher
MATCH p=(a:Agency)-[:CAN_SERVE*1..2]->(b:Agency)
WHERE a.need = $offer AND b.offer = $need
RETURN [n IN nodes(p) | n.id] AS ids
```

Our tests add the suggested agency and check that exactly the predicted number of loops appears.

## Agents act, but the graph decides what is possible

Each agency has a representative, either deterministic policy code or a live Claude model. The model never invents terms. It first calls `inspect_exchange`, then chooses `accept_offer`, `counter_offer` (to a proposal that already passed every hard constraint) or `reject_offer`. A counter resets everyone's acceptance. Capacity is held only when all representatives agree on the same terms, and the deal commits only after a human approves for every member.

## Memory as structure

We store memory as graph structure rather than a transcript:

- `(:Lesson)-[:ABOUT]->(:Agency)` and `-[:LEARNED_FROM]->(:Deal)`: a preference a member taught, with its source.
- `(:Agency)-[:TRADED_WITH]->(:Agency)`: written for every leg of a committed agreement. Discovery ranks loops of proven partners higher.
- `(:Insight)-[:ABOUT]->(:Agency)`: written automatically when a negotiation fails, stamped with that agency's profile revision. Discovery flags the loop only while that revision is current, so stale knowledge expires on its own.

With memory switched off on the same profiles, a remembered 8-hour preference goes back to the original 10 hours. That comparison is how we show memory changed behaviour rather than claim it.

## Ask the graph, get sources

An "Ask the network" agent answers questions like *"What breaks if Motionhaus leaves?"* by chaining fixed, parameterized Cypher tools. The model picks tools and arguments; it never writes queries. Its answer may cite only node ids those tools actually returned. The same tools are served over MCP, so any MCP client can use the exchange graph.

## Many instances, one truth

Every write is a compare-and-swap inside FalkorDB. The statement begins by matching the workspace node at the revision we read, and every later clause groups on that value. If another instance wrote first, the match returns zero rows and nothing changes. Two serverless replicas racing for the same capacity can't both reserve it.

## What we would build next

Targeted writes in place of whole-workspace snapshots, per-community tenants, reservation expiry, and a pilot with a real professional community before adding payments.

*Deadlock is open source: https://github.com/MaanavKrishna/deadlock-graphhacks*
