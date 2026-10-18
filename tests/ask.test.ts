import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';
import { askNetwork } from '../src/server/ask';
import { runGraphTool } from '../src/server/tools';

let store: Store, dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dl-ask-'));
  store = await Store.open({ path: dir });
  await store.reset();
});
afterAll(async () => {
  await store.close();
  await rm(dir, { recursive: true, force: true });
});

it('graph tools answer multi-hop questions from fixed Cypher', async () => {
  const providers = await runGraphTool(store, 'find_providers', { service: 'video' });
  expect(providers.sources.map((s) => s.id).sort()).toEqual(['frame-lab', 'motionhaus']);
  const around = await runGraphTool(store, 'who_can_serve', { agencyId: 'wordcraft' });
  expect((around.data as { loops: string[][] }).loops).toHaveLength(2);
  await expect(runGraphTool(store, 'find_providers', { service: 'payroll' })).rejects.toThrow();
  await expect(runGraphTool(store, 'drop_everything', {})).rejects.toThrow();
});

it('chains tools over the real protocol and keeps only citations it retrieved', async () => {
  const run = await store.discover();
  const deal = await store.negotiate(
    run.id,
    run.candidates.find((c) => c.agencyIds.includes('motionhaus'))!.agencyIds,
  );
  const script = [
    { name: 'list_agencies', args: {} },
    { name: 'withdrawal_impact', args: { agencyId: 'motionhaus' } },
    {
      name: 'final_answer',
      args: {
        answer: 'Pausing Motionhaus breaks one loop and releases 30 held hours.',
        sourceIds: ['motionhaus', deal.id, 'invented-node'],
      },
    },
  ];
  const seenTools: string[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    seenTools.push(...body.tools.map((t: any) => t.function.name));
    const step = script[body.messages.filter((m: any) => m.role === 'tool').length];
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        model: 'protocol-test-model',
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: `call_${step.name}`,
                  type: 'function',
                  function: { name: step.name, arguments: JSON.stringify(step.args) },
                },
              ],
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const answer = await askNetwork(store, 'What breaks if Motionhaus leaves?', {
      key: 'synthetic-test-key',
      name: 'protocol-test-model',
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    expect(answer.trace.map((t) => t.tool)).toEqual(['list_agencies', 'withdrawal_impact']);
    expect(answer.sources.map((s) => s.id)).toEqual(['motionhaus', deal.id]);
    expect(answer.model).toBe('protocol-test-model');
    expect(seenTools).toContain('explain_deal');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
