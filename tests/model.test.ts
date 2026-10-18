import { it, expect } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { decideWithModel, parseDecision, type ModelConfig } from '../src/server/model';
import { buildProposals, runAgents } from '../src/server/agents';
import { seedAgencies } from '../src/server/seed';
const priorTool = (body: any) => body.messages.at(-1).role === 'tool';
const agencies = () =>
  ['motionhaus', 'wordcraft', 'studio-north'].map((id) => seedAgencies().find((a) => a.id === id)!);
it('executes inspect then counter/accept tools over the real provider protocol', async () => {
  let requests = 0;
  const offeredToolSets: string[][] = [];
  const counterMenus: string[][] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests++;
    offeredToolSets.push(body.tools.map((t: any) => t.function.name));
    const counter = body.tools.find((t: any) => t.function.name === 'counter_offer');
    if (priorTool(body))
      counterMenus.push(counter?.function.parameters.properties.proposalId.enum ?? []);
    expect(body.max_completion_tokens).toBe(2048);
    const prior = body.messages.at(-1);
    let name = 'inspect_exchange',
      args = {};
    if (prior.role === 'tool') {
      const context = JSON.parse(prior.content);
      if (context.current.id === 'requested') {
        name = 'counter_offer';
        args = { proposalId: 'lean', reason: 'A smaller first scope is preferable.' };
      } else {
        name = 'accept_offer';
        args = { reason: 'The revised scope meets my objective.' };
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call_' + requests,
                  type: 'function',
                  function: { name, arguments: JSON.stringify(args) },
                },
              ],
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const config: ModelConfig = {
    key: 'synthetic-test-key',
    name: 'protocol-test-model',
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  };
  try {
    const result = await runAgents(agencies(), buildProposals(agencies()), (c) =>
      decideWithModel(c, config),
    );
    expect(result.accepted).toBe(true);
    expect(result.legs.map((l) => l.hours)).toEqual([8, 8, 8]);
    expect(result.events.filter((e) => e.tool === 'inspect_exchange')).toHaveLength(4);
    expect(requests).toBe(8);
    expect(counterMenus[0]).toEqual(['lean']);
    expect(offeredToolSets[0]).toEqual(['inspect_exchange']);
    expect(offeredToolSets[1]).toEqual(['accept_offer', 'counter_offer', 'reject_offer']);
    expect(result.modelIdentityKnown).toBe(false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it('refuses extra arguments and invented proposal IDs', () => {
  expect(() =>
    parseDecision('counter_offer', '{"proposalId":"invented","reason":"Pretend"}', [
      'requested',
      'lean',
    ]),
  ).toThrow();
  expect(() =>
    parseDecision('accept_offer', '{"reason":"yes","hours":1000}', ['requested']),
  ).toThrow();
});
it('does not accept malformed provider output or a transport timeout', async () => {
  let hang = false;
  const server = createServer((req, res) => {
    req.resume();
    if (hang) return;
    res.end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const config: ModelConfig = {
    key: 'synthetic',
    name: 'test',
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    timeoutMs: 25,
  };
  const a = agencies(),
    p = buildProposals(a),
    context = {
      agency: a[0],
      participants: a,
      current: p[0],
      proposals: p,
      lessons: [],
      useMemory: true,
      round: 1,
    };
  try {
    await expect(decideWithModel(context, config)).rejects.toThrow();
    hang = true;
    await expect(decideWithModel(context, config)).rejects.toThrow();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it('asks once more when a rejection argues for accepting, and keeps genuine rejections', async () => {
  const replies: { name: string; args: object }[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const step = body.messages.filter((m: any) => m.role === 'tool').length;
    const reply = step === 0 ? { name: 'inspect_exchange', args: {} } : replies[step - 1];
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: `c${step}`,
                  type: 'function',
                  function: { name: reply.name, arguments: JSON.stringify(reply.args) },
                },
              ],
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const config: ModelConfig = {
    key: 'synthetic',
    name: 'test',
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  };
  const a = agencies(),
    p = buildProposals(a),
    context = {
      agency: a[0],
      participants: a,
      current: p[0],
      proposals: p,
      lessons: [],
      useMemory: true,
      round: 1,
    };
  try {
    replies.splice(
      0,
      replies.length,
      {
        name: 'reject_offer',
        args: { reason: 'Accepting the current terms is the appropriate decision.' },
      },
      { name: 'accept_offer', args: { reason: 'Terms meet my minimum.' } },
    );
    expect((await decideWithModel(context, config)).tool).toBe('accept_offer');
    replies.splice(0, replies.length, {
      name: 'reject_offer',
      args: { reason: 'Incoming hours cannot meet our launch objective; we cannot accept.' },
    });
    expect((await decideWithModel(context, config)).tool).toBe('reject_offer');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
