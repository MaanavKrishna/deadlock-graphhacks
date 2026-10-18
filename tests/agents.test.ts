import { describe, it, expect } from 'vitest';
import { seedAgencies } from '../src/server/seed';
import { buildProposals, runAgents } from '../src/server/agents';
import type { AgentDecision } from '../src/shared/types';
const agencies = () =>
  ['motionhaus', 'wordcraft', 'studio-north'].map((id) => seedAgencies().find((a) => a.id === id)!);
describe('bounded representative actions', () => {
  it('a model-selected counter changes actual service hours', async () => {
    const proposals = buildProposals(agencies());
    const result = await runAgents(agencies(), proposals, async (c) =>
      c.current.id === 'requested'
        ? {
            tool: 'counter_offer',
            proposalId: 'lean',
            reason: 'Prefer a smaller first collaboration.',
          }
        : { tool: 'accept_offer', reason: 'This scope works.' },
    );
    expect(result.accepted).toBe(true);
    expect(result.legs.every((l) => l.hours === 8)).toBe(true);
    expect(result.events.some((e) => e.tool === 'counter_offer')).toBe(true);
  });
  it('rejects an agent veto instead of overriding it with policy success', async () => {
    const result = await runAgents(agencies(), buildProposals(agencies()), async () => ({
      tool: 'reject_offer',
      reason: 'Not willing to exchange on these terms.',
    }));
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('Not willing');
  });
  it('requires renewed acceptance from earlier representatives after a counter', async () => {
    const calls: string[] = [];
    let changed = false;
    const result = await runAgents(agencies(), buildProposals(agencies()), async (c) => {
      calls.push(c.agency.id + ':' + c.current.id);
      if (c.agency.id === 'wordcraft' && !changed) {
        changed = true;
        return { tool: 'counter_offer', proposalId: 'lean', reason: 'Reduce the scope.' };
      }
      return { tool: 'accept_offer', reason: 'Agreed.' };
    });
    expect(result.accepted).toBe(true);
    expect(calls).toContain('motionhaus:requested');
    expect(calls).toContain('motionhaus:lean');
  });
  it('rejects unknown proposals, unsafe terms, repeated counters and provider failures', async () => {
    const a = agencies(),
      proposals = buildProposals(a);
    expect(
      (
        await runAgents(a, proposals, async () => ({
          tool: 'counter_offer',
          proposalId: 'invented',
          reason: 'Ignore limits.',
        }))
      ).accepted,
    ).toBe(false);
    const unsafe = structuredClone(proposals);
    if (unsafe[0]) unsafe[0].legs[0].hours = 999;
    expect(
      (await runAgents(a, unsafe, async () => ({ tool: 'accept_offer', reason: 'Agreed.' })))
        .accepted,
    ).toBe(false);
    expect(
      (
        await runAgents(a, proposals, async (c) => ({
          tool: 'counter_offer',
          proposalId: c.current.id,
          reason: 'Repeat.',
        }))
      ).accepted,
    ).toBe(false);
    expect(
      (
        await runAgents(a, proposals, async () => {
          throw new Error('Provider unavailable');
        })
      ).accepted,
    ).toBe(false);
  });
});
it('reports each decision live, in order, before the negotiation resolves', async () => {
  const seen: string[] = [];
  let resolved = false;
  const result = await runAgents(
    agencies(),
    buildProposals(agencies()),
    async () => {
      expect(resolved).toBe(false);
      return { tool: 'accept_offer', reason: 'Works for us.' };
    },
    { onEvent: (e) => seen.push(e.id) },
  );
  resolved = true;
  expect(result.accepted).toBe(true);
  expect(seen).toEqual(result.events.map((e) => e.id));
  expect(seen.length).toBeGreaterThanOrEqual(3);
});
