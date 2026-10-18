import { resolve } from 'node:path';
import express from 'express';
import { Store } from './store';
import { createApp } from './api';

// Optional .env; missing files are a normal key-free setup.
try {
  process.loadEnvFile('.env');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const store = await Store.open({
  path: process.env.DATA_DIR ?? '.data/graph',
  url: process.env.FALKORDB_URL,
  graphName: process.env.FALKORDB_GRAPH ?? 'deadlock',
});
const app = createApp(store);
let vite: Awaited<ReturnType<(typeof import('vite'))['createServer']>> | undefined;
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve('public')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('public/index.html')));
} else {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT ?? 3000),
  host = process.env.HOST ?? '127.0.0.1';
const server = app.listen(port, host, () =>
  console.log(`Deadlock is ready at http://${host}:${port}`),
);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close();
  await vite?.close();
  await store.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
