import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openGraph } from '../src/server/graph';
const path = await mkdtemp(join(tmpdir(), 'dl-doctor-'));
try {
  const db = await openGraph({ path });
  try {
    const result = await db.graph.query('RETURN 1 AS ok');
    console.log('Real FalkorDB is ready.', JSON.stringify(result.data));
  } finally {
    await db.close();
  }
} finally {
  await rm(path, { recursive: true, force: true });
}
