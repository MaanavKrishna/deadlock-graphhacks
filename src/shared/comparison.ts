import type { Deal } from './types';
export function memoryComparison(
  deals: Deal[],
  agencyId: string,
): { without: Deal; withMemory: Deal } | undefined {
  const eligible = deals.filter(
    (d) =>
      d.agencyIds.includes(agencyId) &&
      (d.executedMode !== 'model' || (d.modelIdentityKnown === true && Boolean(d.model))) &&
      ['awaiting_approval', 'committed', 'cancelled', 'invalidated'].includes(d.status),
  );
  const signature = (d: Deal) =>
    JSON.stringify({
      mode: d.executedMode ?? 'policy',
      model: d.executedMode === 'model' ? d.model : undefined,
      provider: d.executedMode === 'model' ? d.modelProvider : undefined,
      requestedModel: d.executedMode === 'model' ? d.requestedModel : undefined,
      path: d.agencyIds,
      profiles: [...d.participants].sort((a, b) => a.id.localeCompare(b.id)),
    });
  for (const withMemory of eligible
    .filter((d) => d.useMemory === true)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const without = eligible.find(
      (d) => d.useMemory === false && signature(d) === signature(withMemory),
    );
    if (without) return { without, withMemory };
  }
}
