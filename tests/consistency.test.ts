import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openGraph, type GraphConnection } from '../src/server/graph';
import { DomainError, Store } from '../src/server/store';

let connection: GraphConnection, dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dl-consistency-'));
  connection = await openGraph({ path: dir });
});
afterAll(async () => {
  await connection.close();
  await rm(dir, { recursive: true, force: true });
});

it('serves network edges straight from FalkorDB CAN_SERVE relationships', async () => {
  const store = await Store.attach(connection);
  await store.reset();
  const { edges } = await store.snapshot();
  const raw = await connection.graph.roQuery<{ from: string; to: string }>(
    'MATCH (a:Agency)-[:CAN_SERVE]->(b:Agency) RETURN a.id AS from, b.id AS to',
  );
  expect(edges).toHaveLength(raw.data!.length);
  expect(edges).toHaveLength(8);
  expect(edges).toContainEqual({ from: 'studio-north', to: 'motionhaus', service: 'design' });
  expect(edges.some((e) => edges.some((f) => f.from === e.to && f.to === e.from))).toBe(false);
});

it('two app instances on one graph cannot both commit from the same revision', async () => {
  const first = await Store.attach(connection),
    second = await Store.attach(connection);
  await first.reset();
  const run = await first.discover(),
    ids = run.candidates[0].agencyIds;
  const results = await Promise.allSettled([
    first.negotiate(run.id, ids),
    second.negotiate(run.id, ids),
  ]);
  const held = (await first.snapshot()).agencies.reduce((n, a) => n + a.reservedHours, 0);
  const succeeded = results.filter(
    (r) => r.status === 'fulfilled' && r.value.status === 'awaiting_approval',
  );
  const conflicts = results.filter(
    (r) => r.status === 'rejected' && r.reason instanceof DomainError && r.reason.status === 409,
  );
  // The later writer either saw the hold (policy rejection) or lost the revision race (409).
  expect(succeeded).toHaveLength(1);
  expect(conflicts.length + results.filter((r) => r.status === 'fulfilled').length).toBe(2);
  expect(held).toBe(30);
});
