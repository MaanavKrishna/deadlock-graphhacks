import { BinaryManager, ConfigGenerator, ServerManager } from 'falkordblite';
import { FalkorDB, type Graph } from 'falkordb';
import { mkdir, readFile, open, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export interface GraphConnection {
  graph: Graph;
  mode: string;
  close(): Promise<void>;
}
export async function openGraph(
  options: { path?: string; url?: string; graphName?: string } = {},
): Promise<GraphConnection> {
  const name = options.graphName ?? 'deadlock';
  if (options.url) {
    const client = await FalkorDB.connect({ url: options.url });
    return {
      graph: client.selectGraph(name),
      mode: 'FalkorDB · remote',
      close: () => client.close(),
    };
  }
  const path = resolve(options.path ?? '.data/graph');
  await mkdir(path, { recursive: true });
  const lockPath = join(path, '.deadlock.lock');
  try {
    const lock = await open(lockPath, 'wx', 0o600);
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    await lock.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error(
        `This graph directory is already in use or has a stale lock: ${lockPath}. Stop the other server. After an unclean shutdown, remove this lock only after confirming no server uses the directory.`,
      );
    throw error;
  }
  try {
    const manager = new BinaryManager();
    const bins = await manager.ensureBinaries();
    const modulePath = process.env.FALKORDB_MODULE_PATH ?? bins.falkordbModulePath;
    const redisServerPath = process.env.REDIS_SERVER_PATH ?? bins.redisServerPath;
    const header = await readFile(redisServerPath).then((b) => b.subarray(0, 4));
    if (process.platform === 'darwin' && header[0] === 0x7f)
      throw new Error(
        'The packaged Redis executable is for Linux. Run npm run setup:db, or set FALKORDB_URL.',
      );
    // Keep the socket short even when the persistent directory is in a deep OneDrive path.
    const socketPath = join(tmpdir(), `dl-${randomUUID().slice(0, 8)}.sock`);
    const config = new ConfigGenerator({
      dbDir: `"${path}"`,
      unixSocketPath: socketPath,
      falkordbModulePath: `"${modulePath}"`,
      logLevel: 'warning',
      additionalConfig: { appendonly: 'yes', appendfsync: 'always', save: '""' },
    }).generate();
    const server = new ServerManager({
      redisServerPath,
      config,
      socketPath,
      startupTimeoutMs: 15000,
    });
    await server.start();
    try {
      const client = await FalkorDB.connect({ socket: { path: socketPath } });
      return {
        graph: client.selectGraph(name),
        mode: 'FalkorDB · local',
        close: async () => {
          await client.close();
          await server.stop();
          await unlink(lockPath);
        },
      };
    } catch (error) {
      await server.stop();
      throw error;
    }
  } catch (error) {
    await unlink(lockPath).catch(() => {});
    throw error;
  }
}
