import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';
import { createApp } from '../src/server/api';
let store: Store, dir: string, app: ReturnType<typeof createApp>;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dl-api-'));
  store = await Store.open({ path: dir });
  app = createApp(store);
});
beforeEach(async () => {
  await store.reset();
});
afterAll(async () => {
  await store.close();
  await rm(dir, { recursive: true, force: true });
});
it('serves graph-backed state and rejects invalid profile quantities', async () => {
  const state = await request(app).get('/api/state');
  expect(state.status).toBe(200);
  expect(state.body.agencies).toHaveLength(6);
  const agency = state.body.agencies[0];
  const invalid = await request(app)
    .put(`/api/agencies/${agency.id}`)
    .send({ ...agency, capacityHours: -2 });
  expect(invalid.status).toBe(400);
  expect(invalid.body.error).toBeTruthy();
});
it('rejects unknown sessions and mismatched paths without mutation', async () => {
  expect(
    (
      await request(app)
        .post('/api/negotiate')
        .send({ runId: 'unknown', agencyIds: ['a', 'b', 'c'] })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post('/api/negotiate')
        .send({ runId: 'unknown', agencyIds: ['a', 'a', 'c'] })
    ).status,
  ).toBe(400);
  expect((await request(app).get('/api/state')).body.deals).toHaveLength(0);
});
it('creates profiles and rejects stale edits or route identity tampering', async () => {
  const agency = (await store.snapshot()).agencies[0];
  const saved = await request(app)
    .put(`/api/agencies/${agency.id}`)
    .send({ ...agency, description: 'Updated profile' });
  expect(saved.status).toBe(200);
  expect((await request(app).put(`/api/agencies/${agency.id}`).send(agency)).status).toBe(409);
  expect(
    (
      await request(app)
        .put(`/api/agencies/${agency.id}`)
        .send({ ...agency, id: 'wrong-id' })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .put('/api/agencies/does-not-exist')
        .send({ ...agency, id: 'does-not-exist' })
    ).status,
  ).toBe(404);
  const created = await request(app)
    .post('/api/agencies')
    .send({ ...agency, id: undefined, name: 'New agency' });
  expect(created.status).toBe(201);
  expect(created.body.id).toBeTruthy();
});
it('exports a complete agreement and protects reset and cross-origin mutations', async () => {
  const run = await store.discover(),
    deal = await store.negotiate(run.id, run.candidates[0].agencyIds);
  const exported = await request(app).get(`/api/deals/${deal.id}/export`);
  expect(exported.status).toBe(200);
  expect(exported.body.deal.id).toBe(deal.id);
  expect(exported.body.synthetic).toBe(true);
  expect((await request(app).post('/api/reset').send({ confirm: false })).status).toBe(400);
  expect(
    (await request(app).post('/api/discover').set('Origin', 'https://untrusted.example').send({}))
      .status,
  ).toBe(403);
});
it('requires the access key for workspace replacement and paid model runs when one is configured', async () => {
  const locked = createApp(store, { accessKey: () => 'correct horse' });
  expect((await request(locked).get('/api/state')).status).toBe(200);
  expect((await request(locked).post('/api/reset').send({ confirm: true })).status).toBe(401);
  expect(
    (await request(locked).post('/api/reset').set('x-access-key', 'wrong').send({ confirm: true }))
      .status,
  ).toBe(401);
  const run = await request(locked).post('/api/discover').send({});
  expect(run.status).toBe(200);
  const model = await request(locked)
    .post('/api/negotiate')
    .send({ runId: run.body.id, agencyIds: run.body.candidates[0].agencyIds, mode: 'model' });
  expect(model.status).toBe(401);
  const policy = await request(locked)
    .post('/api/negotiate')
    .send({ runId: run.body.id, agencyIds: run.body.candidates[0].agencyIds, mode: 'policy' });
  expect(policy.status).toBe(200);
  expect(
    (
      await request(locked)
        .post('/api/reset')
        .set('x-access-key', 'correct horse')
        .send({ confirm: true })
    ).status,
  ).toBe(200);
  expect((await request(locked).get('/api/state')).body.accessRequired).toBe(true);
});
it('serves read-only graph tools for MCP clients and rejects unknown tools', async () => {
  const providers = await request(app).post('/api/tools/find_providers').send({ service: 'copy' });
  expect(providers.status).toBe(200);
  expect(providers.body.sources.map((s: { id: string }) => s.id).sort()).toEqual([
    'ink-and-code',
    'wordcraft',
  ]);
  expect((await request(app).post('/api/tools/delete_graph').send({})).status).toBe(404);
  expect((await request(app).post('/api/tools/find_providers').send({ service: 'x' })).status).toBe(
    400,
  );
});
it('streams a negotiation as NDJSON ending with the persisted deal', async () => {
  const run = await request(app).post('/api/discover').send({});
  const response = await request(app)
    .post('/api/negotiate/stream')
    .send({ runId: run.body.id, agencyIds: run.body.candidates[0].agencyIds, mode: 'policy' });
  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toContain('application/x-ndjson');
  const lines = response.text
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const last = lines.at(-1);
  expect(last.type).toBe('deal');
  expect(last.deal.status).toBe('awaiting_approval');
  const bad = await request(app)
    .post('/api/negotiate/stream')
    .send({ runId: 'missing', agencyIds: ['a', 'b', 'c'] });
  expect(
    bad.text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
      .at(-1).type,
  ).toBe('error');
});
