import { it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/server/store';
it('finds a feasible four-party path and an attractive blocked path in the launch scenario', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dl-showcase-')),
    store = await Store.open({ path: dir });
  try {
    await store.reset('launch');
    const state = await store.snapshot();
    expect(state.agencies).toHaveLength(10);
    expect(new Set(state.agencies.map((a) => a.hourlyCredits)).size).toBeGreaterThan(3);
    const run = await store.discover();
    const four = run.candidates.find(
      (c) =>
        c.feasible &&
        c.agencyIds.length === 4 &&
        c.agencyIds.includes('orbit-films') &&
        c.agencyIds.includes('shipyard') &&
        c.agencyIds.includes('signal-press'),
    );
    expect(four).toBeTruthy();
    const deal = await store.negotiate(run.id, four!.agencyIds, { mode: 'policy' });
    expect(deal.status).toBe('awaiting_approval');
    await store.cancel(deal.id);
    const blocked = run.candidates.find(
      (c) => !c.feasible && c.agencyIds.includes('premiere') && c.reason?.includes('deadline'),
    );
    expect(blocked).toBeTruthy();
    expect(blocked!.estimatedCredits).toBeGreaterThan(3000);
    expect((await store.negotiate(run.id, blocked!.agencyIds)).status).toBe('rejected');
    expect((await store.snapshot()).agencies.every((a) => a.reservedHours === 0)).toBe(true);
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
