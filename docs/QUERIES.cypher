// Deadlock's graph queries. Runtime source: src/server/store.ts.
// Parameter values are passed through the official FalkorDB client, not string interpolation.

// 1. Compatibility is derived inside the graph from actual service relationships.
MATCH (provider:Agency)-[:OFFERS]->(service:Service)<-[:NEEDS]-(recipient:Agency)
WHERE provider.id <> recipient.id
CREATE (provider)-[:CAN_SERVE {service:service.id}]->(recipient);

// 2. The product's core matching algorithm: bounded directed cycle traversal.
MATCH p=(a:Agency)-[:CAN_SERVE*3..4]->(a)
WHERE all(n IN nodes(p) WHERE n.active = true)
RETURN [n IN nodes(p) | n.id] AS ids LIMIT 2000;
// Runtime removes the repeated closing node, rejects repeated participants,
// canonicalizes rotations (not reverse direction), and checks each agency policy.

// 3. Read persistent profiles, runs and agreement snapshots in one consistent read.
MATCH (n) WHERE n:Agency OR n:Deal OR n:Run OR n:Lesson
RETURN labels(n)[0] AS kind, n.json AS json;

// 4. Retrieve shared context from previous negotiations for a participant.
MATCH (prior:Deal)-[:INVOLVES]->(member:Agency)
WHERE member.id = $member0
RETURN member.id AS agencyId, prior.json AS json;
// Runtime extends the predicate with up to four parameterized member IDs,
// retrieves the most recently updated agreement for each and records the retrieval.

// 5. Inspect the audit path for a deal (use in FalkorDB Browser / redis-cli).
MATCH (d:Deal {id:$dealId})-[:HAS_EVENT]->(e:Event)
RETURN d.id, d.status, e.json;

// 6. Find pending agreements affected by an agency change.
MATCH (d:Deal)-[:INVOLVES]->(a:Agency {id:$agencyId})
WHERE d.status = 'awaiting_approval'
RETURN d.json;
// The current MVP loads the full workspace snapshot for transitions and performs
// the equivalent participant filter. Above query makes the dependency inspectable.

// 7. Atomic write pattern (illustrative, not a standalone runnable query).
// OPTIONAL MATCH (old) DETACH DELETE old WITH count(old) AS removed
// CREATE (...typed Agency, Service, Run, Deal and Event nodes with parameterized data...)
// CREATE (...OFFERS, NEEDS, INVOLVES, FROM_RUN, HAS_EVENT, BY relationships...)
// WITH count(*) AS written
// MATCH (provider:Agency)-[:OFFERS]->(service:Service)<-[:NEEDS]-(recipient:Agency)
// WHERE provider.id <> recipient.id
// CREATE (provider)-[:CAN_SERVE {service:service.id}]->(recipient)
// RETURN count(*) AS edges
// The complete generated statement is the write() function in store.ts. One graph
// transaction replaces a small workspace snapshot; this is not a scale claim.

// 8. Retrieve active participant feedback through the graph.
MATCH (lesson:Lesson)-[:ABOUT]->(agency:Agency)
WHERE lesson.active = true AND agency.id = $member0
RETURN lesson.json AS json;
// Runtime extends predicate for up to four participant IDs.

// 9. Trace a remembered preference to its negotiation source.
MATCH (lesson:Lesson)-[:ABOUT]->(agency:Agency),
      (lesson)-[:LEARNED_FROM]->(source:Deal)
RETURN agency.name, lesson.json, source.id, source.status;

// 10. Network view: the UI draws exactly these derived relationships.
MATCH (a:Agency)-[r:CAN_SERVE]->(b:Agency)
RETURN a.id AS from, b.id AS to, r.service AS service;

// 11. Compare-and-swap guard that opens every workspace write (see write() in store.ts).
// MATCH (w:Workspace) WHERE coalesce(w.revision, 0) = $expected
// WITH coalesce(w.revision, 0) AS rev
// OPTIONAL MATCH (old) DETACH DELETE old WITH rev, count(old) AS removed
// CREATE (:Workspace {revision:$nextRevision, writeId:$writeId, ...}) ...

// 12. What-if withdrawal: the cycle traversal with one agency excluded.
MATCH p=(a:Agency)-[:CAN_SERVE*3..4]->(a)
WHERE all(n IN nodes(p) WHERE n.active = true AND n.id <> $excluded)
RETURN [n IN nodes(p) | n.id] AS ids LIMIT 2000;

// 13. Recruitment what-if: a new agency offering $offer and needing $need closes one loop per path.
MATCH p=(a:Agency)-[:CAN_SERVE*1..2]->(b:Agency)
WHERE a.need = $offer AND b.offer = $need AND all(n IN nodes(p) WHERE n.active = true)
RETURN [n IN nodes(p) | n.id] AS ids LIMIT 500;

// 14. Self-learning memory consulted by discovery.
MATCH (a:Agency)-[t:TRADED_WITH]->(b:Agency)
RETURN a.id AS from, b.id AS to, collect(DISTINCT t.dealId) AS deals;
MATCH (i:Insight)-[:ABOUT]->(a:Agency) WHERE i.revision = a.revision
RETURN i.json AS json;

// 15. Decision trace used by the explain_deal tool.
MATCH (:Deal {id:$dealId})-[:HAS_EVENT]->(e:Event) OPTIONAL MATCH (e)-[:BY]->(a:Agency)
RETURN e.json AS json, a.name AS by;
