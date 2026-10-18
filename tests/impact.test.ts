import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';

let store: Store, dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dl-impact-'));
  store = await Store.open({ path: dir });
});
beforeEach(async () => {
  await store.reset();
});
afterAll(async () => {
  await store.close();
  await rm(dir, { recursive: true, force: true });
});

it('counts graph loops per agency and names the keystone', async () => {
  const { loops } = await store.snapshot();
  // Starter network: SN-MH-WC, SN-FL-WC, SN-PF-IC. Studio North is in every loop.
  expect(loops.total).toBe(3);
  expect(loops.byAgency['studio-north']).toBe(3);
  expect(loops.byAgency['wordcraft']).toBe(2);
  expect(loops.byAgency['ink-and-code']).toBe(1);
  expect(loops.keystoneIds).toEqual(['studio-north']);
});

it('previews what breaks if an agency withdraws, using a what-if graph traversal', async () => {
  const run = await store.discover();
  const loop = run.candidates.find((c) => c.agencyIds.includes('motionhaus'))!;
  const deal = await store.negotiate(run.id, loop.agencyIds);
  const impact = await store.impact('motionhaus');
  expect(impact.loopsBefore).toBe(3);
  expect(impact.loopsAfter).toBe(2);
  expect(impact.broken.map((l) => l.agencyIds)).toEqual([loop.agencyIds]);
  expect(impact.pendingDeals).toEqual([{ id: deal.id, title: deal.title, heldHours: 30 }]);
  expect(impact.releasedHours).toBe(30);
  // Wordcraft and Studio North stay connected through the Frame Lab loop.
  expect(impact.stranded).toEqual([]);
  expect(impact.reroutes.find((r) => r.agencyId === 'wordcraft')?.loops).toBe(1);
  // Nothing was changed by the preview.
  expect((await store.snapshot()).agencies.find((a) => a.id === 'motionhaus')!.active).toBe(true);
});

it('reports partners left with no loop at all', async () => {
  const impact = await store.impact('pixel-forge');
  expect(impact.loopsAfter).toBe(2);
  expect(impact.stranded).toEqual(['ink-and-code']);
});
