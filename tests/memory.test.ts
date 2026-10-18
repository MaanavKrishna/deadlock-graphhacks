import { beforeAll, afterAll, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/server/store';
let store: Store, dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dl-memory-'));
  store = await Store.open({ path: dir });
});
afterAll(async () => {
  await store.close();
  await rm(dir, { recursive: true, force: true });
});
it('a source-backed lesson changes the next negotiation after restart, with identical profile constraints', async () => {
  const run = await store.discover(),
    ids = run.candidates.find((c) => c.agencyIds.includes('motionhaus'))!.agencyIds;
  const first = await store.negotiate(run.id, ids, { mode: 'policy', useMemory: false });
  expect(first.legs.find((l) => l.to === 'studio-north')!.hours).toBe(10);
  await store.cancel(first.id);
  const profiles = (await store.snapshot()).agencies;
  const lesson = await store.recordLesson(first.id, 'studio-north', 8);
  await store.close();
  store = await Store.open({ path: dir });
  const remembered = await store.negotiate(run.id, ids, { mode: 'policy', useMemory: true });
  expect(remembered.legs.find((l) => l.to === 'studio-north')!.hours).toBe(8);
  expect(remembered.lessonIds).toContain(lesson.id);
  expect(remembered.proposalId).toBe('remembered');
  expect(
    remembered.events.some((e) => e.tool === 'counter_offer' && e.evidenceIds?.includes(lesson.id)),
  ).toBe(true);
  await store.cancel(remembered.id);
  const without = await store.negotiate(run.id, ids, { mode: 'policy', useMemory: false });
  expect(without.legs.find((l) => l.to === 'studio-north')!.hours).toBe(10);
  await store.cancel(without.id);
  expect((await store.snapshot()).agencies).toEqual(profiles);
});
it('requires a real source involving the agency and preserves hard limits for infeasible preferences', async () => {
  const state = await store.snapshot(),
    source = state.deals[0];
  await expect(store.recordLesson('invented', 'studio-north', 8)).rejects.toThrow();
  await expect(store.recordLesson(source.id, 'pixel-forge', 8)).rejects.toThrow();
  await expect(store.recordLesson(source.id, 'studio-north', -1)).rejects.toThrow();
  await store.recordLesson(source.id, 'studio-north', 2);
  const run = await store.discover(),
    deal = await store.negotiate(run.id, source.agencyIds, { useMemory: true });
  expect(deal.legs.find((l) => l.to === 'studio-north')!.hours).toBeGreaterThanOrEqual(6);
});
