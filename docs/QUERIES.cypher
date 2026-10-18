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
MATCH (n) WHERE n:Agency OR n:Deal OR n:Run
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
