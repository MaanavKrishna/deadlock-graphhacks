import { it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/server/store';
import { seedAgencies } from '../src/server/seed';
it('keeps a user workspace empty across restarts and supports user profiles and discovery', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dl-workspace-'));
  let store = await Store.open({ path: dir });
  try {
    await store.reset('empty');
    expect((await store.snapshot()).agencies).toHaveLength(0);
    expect((await store.snapshot()).synthetic).toBe(false);
    await store.close();
    store = await Store.open({ path: dir });
    expect((await store.snapshot()).agencies).toHaveLength(0);
    for (const a of seedAgencies().filter((a) =>
      ['motionhaus', 'wordcraft', 'studio-north'].includes(a.id),
    ))
      await store.saveAgency({ ...a, name: 'Custom ' + a.name }, true);
    expect((await store.snapshot()).scenario).toBe('custom');
    expect((await store.snapshot()).synthetic).toBe(false);
    expect((await store.discover()).candidates.some((c) => c.feasible)).toBe(true);
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
