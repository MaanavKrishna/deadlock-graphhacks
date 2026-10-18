// Cypher that reproduces one discovered loop, hop by hop, over CAN_SERVE relationships.
export function loopQuery(agencyIds: string[]): string {
  const safe = agencyIds.map((id) => id.replace(/[^a-zA-Z0-9_-]/g, ''));
  return `MATCH ${safe
    .map((id, i) => `(a${i}:Agency {id:'${id}'})`)
    .join(
      '-[:CAN_SERVE]->',
    )}-[:CAN_SERVE]->(a0)\nRETURN ${safe.map((_, i) => `a${i}.name`).join(', ')}`;
}
