import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { DomainError, type Store } from './store';
import { services } from '../shared/types';

const hours = z.number().finite().min(0.25).max(1000).multipleOf(0.25);
const agencySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(2).max(60),
  initials: z.string().trim().min(1).max(3),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().trim().max(240),
  offer: z.enum(services),
  need: z.enum(services),
  active: z.boolean(),
  capacityHours: hours,
  requestHours: hours,
  minReceiveHours: hours,
  hourlyCredits: z.number().finite().int().min(1).max(10000),
  maxImbalancePct: z.number().finite().min(0).max(100),
  deliveryDays: z.number().int().min(1).max(365),
  deadlineDays: z.number().int().min(1).max(365),
  revision: z.number().int().min(0),
  reservedHours: z.number().finite().min(0),
  committedHours: z.number().finite().min(0),
});
export function createApp(store: Store) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host)
          return res.status(403).json({ error: 'Cross-origin API access is disabled.' });
      } catch {
        return res.status(403).json({ error: 'Invalid request origin.' });
      }
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', async (_req, res) => {
    const s = await store.snapshot();
    res.json({ ok: true, database: s.database, agentMode: s.agentMode });
  });
  app.get('/api/state', async (_req, res) => res.json(await store.snapshot()));
  app.post('/api/discover', async (_req, res) => res.json(await store.discover()));
  app.post('/api/negotiate', async (req, res) => {
    const body = z
      .object({
        runId: z.string().min(1).max(80),
        agencyIds: z
          .array(z.string().min(1).max(80))
          .min(3)
          .max(4)
          .refine((ids) => new Set(ids).size === ids.length, 'Agencies must be distinct'),
      })
      .parse(req.body);
    res.json(await store.negotiate(body.runId, body.agencyIds));
  });
  app.post('/api/deals/:id/approve', async (req, res) => {
    const { agencyId } = z.object({ agencyId: z.string().min(1).max(80) }).parse(req.body);
    res.json(await store.approve(req.params.id, agencyId));
  });
  app.post('/api/deals/:id/cancel', async (req, res) =>
    res.json(await store.cancel(req.params.id)),
  );
  app.put('/api/agencies/:id', async (req, res) => {
    const agency = agencySchema.parse(req.body);
    if (agency.id !== req.params.id)
      throw new DomainError('Profile ID must match the requested agency.', 400);
    res.json(await store.saveAgency(agency));
  });
  app.post('/api/agencies', async (req, res) => {
    const agency = agencySchema.parse({
      ...req.body,
      id: randomUUID(),
      reservedHours: 0,
      committedHours: 0,
      revision: 0,
    });
    res.status(201).json(await store.saveAgency(agency, true));
  });
  app.post('/api/reset', async (req, res) => {
    z.object({ confirm: z.literal(true) }).parse(req.body);
    res.json(await store.reset());
  });
  app.get('/api/deals/:id/export', async (req, res) => {
    const state = await store.snapshot(),
      deal = state.deals.find((d) => d.id === req.params.id);
    if (!deal) throw new DomainError('Agreement not found.', 404);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="deadlock-${deal.id.slice(0, 8)}.json"`,
    );
    res.json({
      product: 'Deadlock',
      team: 'ContextSense',
      synthetic: true,
      notice: 'Sandbox capacity agreement. No services or money transferred.',
      deal,
      run: state.runs.find((r) => r.id === deal.runId),
    });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return void res
        .status(400)
        .json({
          error: error.issues
            .map((i) => `${i.path.join('.') || 'Request'}: ${i.message}`)
            .join('; '),
        });
    if (error instanceof DomainError)
      return void res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError || error.status === 400)
      return void res.status(400).json({ error: 'The request must contain valid JSON.' });
    if (error.status === 413)
      return void res.status(413).json({ error: 'Request is too large. Use a smaller profile.' });
    console.error('API operation failed:', error instanceof Error ? error.name : 'unknown');
    res
      .status(503)
      .json({
        error:
          'The graph operation failed. Check the server and database, then retry. Your last successful state is preserved.',
      });
  };
  app.use(errors);
  return app;
}
