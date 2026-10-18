import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';

let store: Store, dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dl-learning-'));
  store = await Store.open({ path: dir });
});
beforeEach(async () => {
  await store.reset();
});
afterAll(async () => {
  await store.close();
  await rm(dir, { recursive: true, force: true });
});
const edit = async (id: string, change: Record<string, unknown>) => {
  const agency = (await store.snapshot()).agencies.find((a) => a.id === id)!;
  return store.saveAgency({ ...agency, ...change });
};
const isLoop = (ids: string[], members: string[]) =>
  members.every((m) => ids.includes(m)) && ids.length === members.length;

it('committed agreements become TRADED_WITH edges that lift proven loops in discovery', async () => {
  for (const a of (await store.snapshot()).agencies) await edit(a.id, { capacityHours: 40 });
  const first = await store.discover();
  const loop = first.candidates.find((c) =>
    isLoop(c.agencyIds, ['studio-north', 'motionhaus', 'wordcraft']),
  )!;
  expect(first.candidates[0].id).not.toBe(loop.id);
  let deal = await store.negotiate(first.id, loop.agencyIds);
  for (const id of deal.agencyIds) deal = await store.approve(deal.id, id);
  expect(deal.status).toBe('committed');

  const again = await store.discover();
  expect(again.candidates[0].agencyIds).toEqual(loop.agencyIds);
  expect(again.candidates[0].history?.tradedLegs).toBe(3);
  expect(again.candidates[0].history?.sourceDealIds).toEqual([deal.id]);
});

it('a failed negotiation is remembered on the path until the blocking profile changes', async () => {
  await edit('wordcraft', { deadlineDays: 2 });
  const run = await store.discover();
  const loop = run.candidates.find((c) =>
    isLoop(c.agencyIds, ['studio-north', 'motionhaus', 'wordcraft']),
  )!;
  const failed = await store.negotiate(run.id, loop.agencyIds);
  expect(failed.status).toBe('rejected');
  const { insights } = await store.snapshot();
  expect(insights).toHaveLength(1);
  expect(insights[0]).toMatchObject({ agencyId: 'wordcraft', dealId: failed.id });

  const remembered = (await store.discover()).candidates.find((c) => c.id === loop.id)!;
  expect(remembered.history?.priorFailures).toEqual([
    { agencyId: 'wordcraft', dealId: failed.id, reason: failed.reason },
  ]);

  // Knowledge stays current: once Wordcraft's profile changes, the old failure no longer applies.
  await edit('wordcraft', { deadlineDays: 7 });
  const fresh = (await store.discover()).candidates.find((c) => c.id === loop.id)!;
  expect(fresh.history?.priorFailures ?? []).toEqual([]);
  expect(fresh.feasible).toBe(true);
});
