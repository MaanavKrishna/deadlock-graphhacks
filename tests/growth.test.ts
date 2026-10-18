import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';
import { seedAgencies } from '../src/server/seed';

let store: Store, dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dl-growth-'));
  store = await Store.open({ path: dir });
  await store.reset();
});
afterAll(async () => {
  await store.close();
  await rm(dir, { recursive: true, force: true });
});

it('ranks the offer/need profile that would open the most new loops', async () => {
  const growth = await store.growth();
  const top = growth[0];
  // Starter: design is needed three times but offered only by Studio North. A second
  // designer who needs copy closes MH→WC, FL→WC and PF→IC into new loops.
  expect(top).toMatchObject({ offer: 'design', need: 'copy', newLoops: 3 });
  expect(top.examples[0]).toHaveLength(3);
  expect(top.reducesKeystone).toBe(true);
  // The prediction is real: adding that profile produces exactly that many new loops.
  const before = (await store.snapshot()).loops.total;
  await store.saveAgency(
    {
      ...seedAgencies()[0],
      id: 'new-designer',
      name: 'New Designer',
      offer: 'design',
      need: 'copy',
    },
    true,
  );
  expect((await store.snapshot()).loops.total).toBe(before + top.newLoops);
});
