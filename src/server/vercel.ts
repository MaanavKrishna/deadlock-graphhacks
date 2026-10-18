// Vercel entrypoint source (bundled to api/index.js by npm run build:api). Same API as index.ts, backed by a remote
// FalkorDB (FALKORDB_URL, e.g. FalkorDB Cloud). Static assets are served from public/.
import { Store } from './store';
import { createApp } from './api';

if (!process.env.FALKORDB_URL)
  throw new Error('Set FALKORDB_URL to a FalkorDB instance for the hosted deployment.');
const store = await Store.open({
  url: process.env.FALKORDB_URL,
  graphName: process.env.FALKORDB_GRAPH ?? 'deadlock',
});
export default createApp(store);
