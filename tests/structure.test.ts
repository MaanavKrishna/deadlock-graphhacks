import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';
import { seedAgencies } from '../src/server/seed';
import { runGraphTool } from '../src/server/tools';

let store: Store, dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dl-structure-'));
  store = await Store.open({ path: dir });
});
afterAll(async () => {
  await store.close();
  await rm(dir, { recursive: true, force: true });
});

it('runs FalkorDB algorithms: betweenness finds the broker, PageRank and components are reported', async () => {
  await store.reset();
  const structure = await store.structure();
  expect(structure.components).toBe(1);
  expect(structure.broker).toBe('studio-north');
  const sn = structure.agencies.find((a) => a.id === 'studio-north')!;
  expect(sn.betweenness).toBeGreaterThan(0);
  expect(sn.pageRank).toBeGreaterThan(
    structure.agencies.find((a) => a.id === 'motionhaus')!.pageRank,
  );
  expect(structure.algorithms).toEqual(['algo.pageRank', 'algo.betweenness', 'algo.WCC']);
  const tool = await runGraphTool(store, 'network_structure', {});
  expect((tool.data as { broker: string }).broker).toBe('studio-north');
});

it('detects separate sub-networks that can never trade with each other', async () => {
  await store.reset('empty');
  const base = seedAgencies()[0];
  const add = (id: string, offer: string, need: string) =>
    store.saveAgency({ ...base, id, name: id, offer, need } as typeof base, true);
  // Design/video traders and copy/development traders never meet.
  await add('a', 'design', 'video');
  await add('b', 'video', 'design');
  await add('c', 'copy', 'development');
  await add('d', 'development', 'copy');
  const structure = await store.structure();
  expect(structure.components).toBe(2);
  expect(structure.isolatedGroups.map((g) => g.sort())).toEqual(
    expect.arrayContaining([
      ['a', 'b'],
      ['c', 'd'],
    ]),
  );
});
