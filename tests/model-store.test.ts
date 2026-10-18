import { it, expect } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/server/store';
it('persists actual model-selected terms and never reserves after a model veto or malformed reply', async () => {
  let mode = 'counter';
  let calls = 0;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const prior = body.messages.at(-1);
    let name = 'inspect_exchange',
      args = {};
    if (prior.role === 'tool') {
      const context = JSON.parse(prior.content);
      if (mode === 'veto') {
        name = 'reject_offer';
        args = { reason: 'Prefer not to join this exchange.' };
      } else if (context.current.id === 'requested') {
        name = 'counter_offer';
        args = { proposalId: 'lean', reason: 'Prefer smaller scope.' };
      } else {
        name = 'accept_offer';
        args = { reason: 'Agreed.' };
      }
    }
    res.end(
      mode === 'malformed'
        ? '{}'
        : JSON.stringify({
            model: 'reported-protocol-model',
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: 'step_' + ++calls,
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
  const dir = await mkdtemp(join(tmpdir(), 'dl-ai-'));
  const store = await Store.open({
    path: dir,
    modelConfig: () => ({
      key: 'synthetic',
      name: 'protocol-model',
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    }),
  });
  try {
    const run = await store.discover(),
      candidate = run.candidates.find((c) => c.agencyIds.includes('motionhaus'))!;
    const deal = await store.negotiate(run.id, candidate.agencyIds, { mode: 'model' });
    expect(deal.executedMode).toBe('model');
    expect(deal.model).toBe('reported-protocol-model');
    expect(deal.requestedModel).toBe('protocol-model');
    expect(deal.modelIdentityKnown).toBe(true);
    expect(deal.legs.every((l) => l.hours === 8)).toBe(true);
    expect(
      (await store.snapshot()).agencies.find((a) => a.id === 'motionhaus')!.reservedHours,
    ).toBe(8);
    await store.cancel(deal.id);
    mode = 'veto';
    expect((await store.negotiate(run.id, candidate.agencyIds, { mode: 'model' })).status).toBe(
      'rejected',
    );
    mode = 'malformed';
    expect((await store.negotiate(run.id, candidate.agencyIds, { mode: 'model' })).status).toBe(
      'rejected',
    );
    expect((await store.snapshot()).agencies.every((a) => a.reservedHours === 0)).toBe(true);
  } finally {
    await store.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
