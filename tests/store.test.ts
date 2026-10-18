import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';

let store: Store, dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dl-test-'));
  store = await Store.open({ path: dir });
});
beforeEach(async () => {
  await store.reset();
});
afterAll(async () => {
  await store.close();
  await rm(dir, { recursive: true, force: true });
});
const firstDeal = async () => {
  const run = await store.discover();
  return store.negotiate(run.id, run.candidates[0].agencyIds);
};
describe('FalkorDB exchange lifecycle', () => {
  it('refuses a second embedded server using the same persistent directory', async () => {
    let second: Store | undefined;
    let failure: unknown;
    try {
      second = await Store.open({ path: dir });
    } catch (error) {
      failure = error;
    }
    if (second) await second.close();
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('already in use');
  });
  it('discovers actual cycles and excludes direct reciprocal pairs', async () => {
    const run = await store.discover();
    expect(run.candidates.length).toBeGreaterThanOrEqual(3);
    expect(
      run.candidates.some(
        (c) => c.agencyIds.includes('motionhaus') && c.agencyIds.includes('wordcraft'),
      ),
    ).toBe(true);
    expect(
      run.candidates.every(
        (c) => c.agencyIds.length >= 3 && new Set(c.agencyIds).size === c.agencyIds.length,
      ),
    ).toBe(true);
    expect(run.query).toContain('CAN_SERVE*3..4');
  });
  it('reserves then commits every leg only on final human approval', async () => {
    let deal = await firstDeal();
    expect(deal.status).toBe('awaiting_approval');
    let state = await store.snapshot();
    expect(state.agencies.find((a) => a.id === deal.legs[0].from)?.reservedHours).toBe(10);
    deal = await store.approve(deal.id, deal.agencyIds[0]);
    expect(deal.status).toBe('awaiting_approval');
    for (const id of deal.agencyIds.slice(1)) deal = await store.approve(deal.id, id);
    expect(deal.status).toBe('committed');
    await store.approve(deal.id, deal.agencyIds[0]);
    state = await store.snapshot();
    for (const leg of deal.legs)
      expect(state.agencies.find((a) => a.id === leg.from)).toMatchObject({
        reservedHours: 0,
        committedHours: leg.hours,
      });
  });
  it('does not overbook under concurrent negotiations', async () => {
    const run = await store.discover(),
      ids = run.candidates[0].agencyIds;
    const results = await Promise.all([store.negotiate(run.id, ids), store.negotiate(run.id, ids)]);
    expect(results.filter((d) => d.status === 'awaiting_approval')).toHaveLength(1);
    expect(results.filter((d) => d.status === 'rejected')).toHaveLength(1);
  });
  it('withdrawal releases the complete cycle and supports an alternative', async () => {
    const run = await store.discover();
    const candidate = run.candidates.find((c) => c.agencyIds.includes('motionhaus'))!;
    const deal = await store.negotiate(run.id, candidate.agencyIds);
    const agency = (await store.snapshot()).agencies.find((a) => a.id === 'motionhaus')!;
    await store.saveAgency({ ...agency, active: false });
    const state = await store.snapshot();
    expect(state.deals.find((d) => d.id === deal.id)?.status).toBe('invalidated');
    expect(state.agencies.every((a) => a.reservedHours === 0)).toBe(true);
    await expect(store.approve(deal.id, deal.agencyIds[0])).rejects.toThrow();
    const rerun = await store.discover();
    expect(rerun.candidates.length).toBeGreaterThan(0);
    expect(rerun.candidates.every((c) => !c.agencyIds.includes('motionhaus'))).toBe(true);
  });
  it('cancels once and rejects invented paths', async () => {
    const deal = await firstDeal();
    await store.cancel(deal.id);
    await store.cancel(deal.id);
    expect((await store.snapshot()).agencies.every((a) => a.reservedHours === 0)).toBe(true);
    const run = await store.discover();
    await expect(
      store.negotiate(run.id, ['studio-north', 'wordcraft', 'motionhaus']),
    ).rejects.toThrow();
  });
  it('persists approvals, events and holds across close and reopen', async () => {
    const deal = await firstDeal();
    await store.approve(deal.id, deal.agencyIds[0]);
    await store.close();
    store = await Store.open({ path: dir });
    const state = await store.snapshot(),
      restored = state.deals.find((d) => d.id === deal.id)!;
    expect(restored.approvals).toEqual([deal.agencyIds[0]]);
    expect(restored.events.some((e) => e.action === 'approve')).toBe(true);
    expect(state.agencies.some((a) => a.reservedHours > 0)).toBe(true);
  });
  it('retrieves relevant prior negotiations as representative context', async () => {
    const original = await firstDeal();
    await store.cancel(original.id);
    const run = await store.discover(),
      retry = await store.negotiate(run.id, original.agencyIds);
    expect(
      retry.events.some(
        (e) => e.action === 'inspect' && e.reason.includes(original.id.slice(0, 8)),
      ),
    ).toBe(true);
    expect(retry.status).toBe('awaiting_approval');
  });
});
