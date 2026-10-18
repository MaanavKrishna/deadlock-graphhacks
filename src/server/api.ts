import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { DomainError, type Store } from './store';
import { services } from '../shared/types';
import { askNetwork } from './ask';
import { graphTools, runGraphTool } from './tools';

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
const digest = (value: string) => createHash('sha256').update(value).digest();
// ACCESS_KEY protects actions that are destructive (workspace replacement) or spend the
// operator's model credits. Everything else stays open so visitors can try the exchange.
export interface RateLimits {
  windowMs: number;
  reads: number;
  writes: number;
  // Requests that spend model credits: Ask and live-model negotiations.
  costly: number;
}
const defaultLimits: RateLimits = { windowMs: 10 * 60_000, reads: 1200, writes: 120, costly: 20 };
export function createApp(
  store: Store,
  options: { accessKey?: () => string | undefined; rateLimits?: RateLimits } = {},
) {
  const accessKey = options.accessKey ?? (() => process.env.ACCESS_KEY?.trim() || undefined);
  const requireKey = (req: express.Request) => {
    const expected = accessKey();
    if (!expected) return;
    const supplied = req.get('x-access-key') ?? '';
    if (!timingSafeEqual(digest(supplied), digest(expected)))
      throw new DomainError('This action needs the workspace access key.', 401);
  };
  const app = express();
  app.disable('x-powered-by');
  // Behind Vercel (or another proxy) the client address arrives in X-Forwarded-For.
  if (process.env.VERCEL || process.env.TRUST_PROXY === '1') app.set('trust proxy', true);
  const limits = options.rateLimits ?? defaultLimits;
  // Fixed-window counters per client and class, held in memory. On serverless each instance
  // counts separately, which still caps bursts from one client against one instance.
  const windows = new Map<string, { start: number; count: number }>();
  const hasKey = (req: express.Request) => {
    const expected = accessKey();
    const supplied = req.get('x-access-key');
    return Boolean(expected && supplied && timingSafeEqual(digest(supplied), digest(expected)));
  };
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
  app.use('/api', (req, res, next) => {
    if (hasKey(req)) return next();
    const costly =
      req.path === '/ask' ||
      (req.path.startsWith('/negotiate') && (req.body as { mode?: string })?.mode === 'model');
    const kind = costly
      ? 'costly'
      : req.method === 'GET' || req.path.startsWith('/tools/')
        ? 'reads'
        : 'writes';
    const now = Date.now();
    if (windows.size > 10_000)
      for (const [k, w] of windows) if (now - w.start > limits.windowMs) windows.delete(k);
    const key = `${req.ip}|${kind}`;
    const current = windows.get(key);
    const entry =
      current && now - current.start < limits.windowMs ? current : { start: now, count: 0 };
    entry.count++;
    windows.set(key, entry);
    if (entry.count > limits[kind]) {
      res.setHeader('Retry-After', String(Math.ceil((entry.start + limits.windowMs - now) / 1000)));
      return res.status(429).json({
        error:
          kind === 'costly'
            ? 'Too many AI requests from this connection. Try again in a few minutes.'
            : 'Too many requests from this connection. Try again in a few minutes.',
      });
    }
    next();
  });
  app.get('/api/health', async (_req, res) => {
    const s = await store.snapshot();
    res.json({ ok: true, database: s.database, agentMode: s.agentMode });
  });
  app.get('/api/state', async (_req, res) =>
    res.json({ ...(await store.snapshot()), accessRequired: Boolean(accessKey()) }),
  );
  app.get('/api/structure', async (_req, res) => res.json(await store.structure()));
  app.get('/api/growth', async (_req, res) => res.json(await store.growth()));
  app.get('/api/agencies/:id/impact', async (req, res) =>
    res.json(await store.impact(req.params.id)),
  );
  // Read-only graph tools (also served to MCP clients through src/mcp.ts).
  app.post('/api/tools/:name', async (req, res) => {
    if (!graphTools.some((t) => t.name === req.params.name))
      throw new DomainError('Unknown graph tool.', 404);
    res.json(await runGraphTool(store, req.params.name, req.body ?? {}));
  });
  app.post('/api/ask', async (req, res) => {
    const { question } = z.object({ question: z.string().trim().min(3).max(500) }).parse(req.body);
    requireKey(req);
    const config = store.currentModel();
    if (!config)
      throw new DomainError(
        'Asking the network needs a configured model (MODEL_API_KEY and MODEL_NAME).',
        400,
      );
    try {
      res.json(await askNetwork(store, question, config));
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        `The agent could not finish: ${(error as Error).message.slice(0, 160)}`,
        502,
      );
    }
  });
  app.post('/api/discover', async (_req, res) => res.json(await store.discover()));
  app.post('/api/negotiate', async (req, res) => {
    const body = z
      .object({
        runId: z.string().min(1).max(80),
        mode: z.enum(['policy', 'model']).optional(),
        useMemory: z.boolean().optional(),
        agencyIds: z
          .array(z.string().min(1).max(80))
          .min(3)
          .max(4)
          .refine((ids) => new Set(ids).size === ids.length, 'Agencies must be distinct'),
      })
      .parse(req.body);
    if (body.mode === 'model') requireKey(req);
    res.json(
      await store.negotiate(body.runId, body.agencyIds, {
        mode: body.mode,
        useMemory: body.useMemory,
      }),
    );
  });
  // Same negotiation, streamed: one JSON line per representative decision as it happens,
  // then the persisted deal (or an error) as the last line.
  app.post('/api/negotiate/stream', async (req, res) => {
    const body = z
      .object({
        runId: z.string().min(1).max(80),
        mode: z.enum(['policy', 'model']).optional(),
        useMemory: z.boolean().optional(),
        agencyIds: z
          .array(z.string().min(1).max(80))
          .min(3)
          .max(4)
          .refine((ids) => new Set(ids).size === ids.length, 'Agencies must be distinct'),
      })
      .parse(req.body);
    if (body.mode === 'model') requireKey(req);
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const send = (line: unknown) => res.write(JSON.stringify(line) + '\n');
    try {
      const deal = await store.negotiate(
        body.runId,
        body.agencyIds,
        { mode: body.mode, useMemory: body.useMemory },
        (event) => send({ type: 'event', event }),
      );
      send({ type: 'deal', deal });
    } catch (error) {
      send({
        type: 'error',
        error:
          error instanceof DomainError
            ? error.message
            : 'The negotiation could not finish. Nothing was reserved.',
      });
    }
    res.end();
  });
  app.post('/api/deals/:id/approve', async (req, res) => {
    const { agencyId } = z.object({ agencyId: z.string().min(1).max(80) }).parse(req.body);
    res.json(await store.approve(req.params.id, agencyId));
  });
  app.post('/api/deals/:id/cancel', async (req, res) =>
    res.json(await store.cancel(req.params.id)),
  );
  app.post('/api/deals/:id/lessons', async (req, res) => {
    const { agencyId, preferredHours } = z
      .object({ agencyId: z.string().min(1).max(80), preferredHours: hours })
      .parse(req.body);
    res.status(201).json(await store.recordLesson(req.params.id, agencyId, preferredHours));
  });
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
    const body = z
      .object({
        confirm: z.literal(true),
        scenario: z.enum(['starter', 'launch', 'empty']).optional(),
      })
      .parse(req.body);
    requireKey(req);
    res.json(await store.reset(body.scenario));
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
      synthetic: state.synthetic,
      notice: 'Capacity agreement record. No services or money transferred.',
      deal,
      run: state.runs.find((r) => r.id === deal.runId),
    });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return void res.status(400).json({
        error: error.issues.map((i) => `${i.path.join('.') || 'Request'}: ${i.message}`).join('; '),
      });
    if (error instanceof DomainError)
      return void res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError || error.status === 400)
      return void res.status(400).json({ error: 'The request must contain valid JSON.' });
    if (error.status === 413)
      return void res.status(413).json({ error: 'Request is too large. Use a smaller profile.' });
    console.error('API operation failed:', error instanceof Error ? error.name : 'unknown');
    res.status(503).json({
      error:
        'The graph operation failed. Check the server and database, then retry. Your last successful state is preserved.',
    });
  };
  app.use(errors);
  return app;
}
