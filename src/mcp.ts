// MCP server: lets MCP clients (Claude Desktop, Claude Code, …) choose Deadlock's graph tools
// and act on what the graph shows. It proxies a running Deadlock server over HTTP, so it works
// against local operation and the hosted deployment alike. Human approval is never exposed.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { graphTools } from './server/tools';

const base = (process.env.DEADLOCK_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
async function call(path: string, body: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.ACCESS_KEY) headers['x-access-key'] = process.env.ACCESS_KEY;
  const response = await fetch(`${base}/api${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Deadlock API ${response.status}`);
  return data;
}
const text = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const server = new McpServer({ name: 'deadlock', version: '0.3.0' });
for (const t of graphTools)
  server.registerTool(t.name, { description: t.description, inputSchema: t.input }, async (args) =>
    text(await call(`/tools/${t.name}`, args)),
  );
server.registerTool(
  'discover_exchanges',
  {
    description:
      'Run the FalkorDB cycle traversal and persist a discovery run. Returns ranked loops with feasibility and graph memory.',
    inputSchema: z.object({}).strict(),
  },
  async () => text(await call('/discover', {})),
);
server.registerTool(
  'negotiate_loop',
  {
    description:
      'Negotiate one discovered loop with policy representatives. On agreement capacity is held, pending human approval in the Deadlock app; this tool cannot approve.',
    inputSchema: z
      .object({
        runId: z.string().min(1).max(80),
        agencyIds: z.array(z.string().min(1).max(80)).min(3).max(4),
      })
      .strict(),
  },
  async ({ runId, agencyIds }) =>
    text(await call('/negotiate', { runId, agencyIds, mode: 'policy' })),
);
await server.connect(new StdioServerTransport());
