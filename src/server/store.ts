import { randomUUID } from 'node:crypto';
import type { Agency, Candidate, Deal, Run, Snapshot } from '../shared/types';
import { services } from '../shared/types';
import { canonicalCycle, event, negotiate as negotiateTerms } from './negotiation';
import { openGraph, type GraphConnection } from './graph';
import { seedAgencies } from './seed';
import { advise } from './advisor';

export class DomainError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export const CYCLE_QUERY = `MATCH p=(a:Agency)-[:CAN_SERVE*3..4]->(a)
WHERE all(n IN nodes(p) WHERE n.active = true)
RETURN [n IN nodes(p) | n.id] AS ids LIMIT 2000`;
type State = Pick<Snapshot, 'agencies' | 'deals' | 'runs'>;

export class Store {
  private tail: Promise<unknown> = Promise.resolve();
  private constructor(private connection: GraphConnection) {}
  static async open(
    options: { path?: string; url?: string; graphName?: string } = {},
  ): Promise<Store> {
    const store = new Store(await openGraph(options));
    try {
      const result = await store.connection.graph.query<{ count: number }>(
        'MATCH (a:Agency) RETURN count(a) AS count',
      );
      if (!result.data?.[0]?.count)
        await store.write({ agencies: seedAgencies(), deals: [], runs: [] });
      return store;
    } catch (error) {
      await store.close();
      throw error;
    }
  }
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => {});
    return result;
  }
  private async read(): Promise<State> {
    const result = await this.connection.graph.roQuery<{ kind: string; json: string }>(
      'MATCH (n) WHERE n:Agency OR n:Deal OR n:Run RETURN labels(n)[0] AS kind, n.json AS json',
    );
    const state: State = { agencies: [], deals: [], runs: [] };
    for (const row of result.data ?? []) {
      if (row.kind === 'Agency') state.agencies.push(JSON.parse(row.json));
      if (row.kind === 'Deal') state.deals.push(JSON.parse(row.json));
      if (row.kind === 'Run') state.runs.push(JSON.parse(row.json));
    }
    state.agencies.sort((a, b) => a.name.localeCompare(b.name));
    state.deals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    state.runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return state;
  }
  private async write(state: State): Promise<void> {
    // One atomic Cypher statement: reads never see half an agreement or reservation.
    const params: Record<string, string | number | boolean> = {};
    const lines = ['OPTIONAL MATCH (old) DETACH DELETE old WITH count(old) AS removed'];
    const agencyVars = new Map<string, string>(),
      runVars = new Map<string, string>();
    services.forEach((s, i) => {
      params[`s${i}`] = s;
      lines.push(`CREATE (s${i}:Service {id:$s${i}})`);
    });
    state.agencies.forEach((a, i) => {
      const v = `a${i}`;
      agencyVars.set(a.id, v);
      for (const [key, value] of Object.entries({
        id: a.id,
        name: a.name,
        active: a.active,
        offer: a.offer,
        need: a.need,
        json: JSON.stringify(a),
      }))
        params[`${v}${key}`] = value;
      lines.push(
        `CREATE (${v}:Agency {id:$${v}id,name:$${v}name,active:$${v}active,offer:$${v}offer,need:$${v}need,json:$${v}json})`,
      );
      lines.push(
        `CREATE (${v})-[:OFFERS]->(s${services.indexOf(a.offer)}) CREATE (${v})-[:NEEDS]->(s${services.indexOf(a.need)})`,
      );
    });
    state.runs.forEach((r, i) => {
      const v = `r${i}`;
      runVars.set(r.id, v);
      params[`${v}id`] = r.id;
      params[`${v}json`] = JSON.stringify(r);
      lines.push(`CREATE (${v}:Run {id:$${v}id,json:$${v}json})`);
    });
    state.deals.forEach((d, i) => {
      const v = `d${i}`;
      params[`${v}id`] = d.id;
      params[`${v}json`] = JSON.stringify(d);
      params[`${v}status`] = d.status;
      lines.push(`CREATE (${v}:Deal {id:$${v}id,status:$${v}status,json:$${v}json})`);
      if (runVars.has(d.runId)) lines.push(`CREATE (${v})-[:FROM_RUN]->(${runVars.get(d.runId)})`);
      d.agencyIds.forEach((id) => {
        if (agencyVars.has(id)) lines.push(`CREATE (${v})-[:INVOLVES]->(${agencyVars.get(id)})`);
      });
      d.events.forEach((e, j) => {
        const ev = `e${i}_${j}`;
        params[`${ev}id`] = e.id;
        params[`${ev}json`] = JSON.stringify(e);
        lines.push(
          `CREATE (${ev}:Event {id:$${ev}id,json:$${ev}json}) CREATE (${v})-[:HAS_EVENT]->(${ev})`,
        );
        if (agencyVars.has(e.actor))
          lines.push(`CREATE (${ev})-[:BY]->(${agencyVars.get(e.actor)})`);
      });
    });
    lines.push(
      'WITH count(*) AS written MATCH (provider:Agency)-[:OFFERS]->(service:Service)<-[:NEEDS]-(recipient:Agency) WHERE provider.id <> recipient.id CREATE (provider)-[:CAN_SERVE {service:service.id}]->(recipient) RETURN count(*) AS edges',
    );
    await this.connection.graph.query(lines.join('\n'), { params });
  }
  async snapshot(): Promise<Snapshot> {
    return {
      ...(await this.read()),
      database: this.connection.mode,
      agentMode:
        process.env.MODEL_API_KEY && process.env.MODEL_NAME
          ? 'Policy agents + model advisor'
          : 'Policy agents',
      synthetic: true,
    };
  }
  async reset(): Promise<Snapshot> {
    return this.exclusive(async () => {
      await this.write({ agencies: seedAgencies(), deals: [], runs: [] });
      return this.snapshot();
    });
  }
  async discover(): Promise<Run> {
    return this.exclusive(async () => {
      const started = performance.now(),
        state = await this.read();
      const result = await this.connection.graph.roQuery<{ ids: string[] }>(CYCLE_QUERY);
      const found = new Map<string, Candidate>();
      for (const row of result.data ?? []) {
        const ids = row.ids.slice(0, -1);
        if (new Set(ids).size !== ids.length) continue;
        const key = canonicalCycle(ids);
        if (found.has(key)) continue;
        const ordered = key.split('|'),
          agencies = ordered.map((id) => state.agencies.find((a) => a.id === id)!);
        const result = negotiateTerms(agencies);
        found.set(key, {
          id: key,
          agencyIds: ordered,
          names: agencies.map((a) => a.name),
          estimatedCredits: result.legs.reduce((s, l) => s + l.credits, 0),
          feasible: result.accepted,
          reason: result.reason,
        });
      }
      const candidates = [...found.values()].sort(
        (a, b) =>
          Number(b.feasible) - Number(a.feasible) ||
          b.estimatedCredits - a.estimatedCredits ||
          a.id.localeCompare(b.id),
      );
      const run: Run = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        candidates,
        query: CYCLE_QUERY,
        durationMs: Math.round(performance.now() - started),
      };
      state.runs.unshift(run);
      await this.write(state);
      return run;
    });
  }
  async negotiate(runId: string, ids: string[]): Promise<Deal> {
    return this.exclusive(async () => {
      const state = await this.read(),
        run = state.runs.find((r) => r.id === runId);
      if (!run) throw new DomainError('Search session not found. Discover exchanges again.', 404);
      if (!run.candidates.some((c) => canonicalCycle(c.agencyIds) === canonicalCycle(ids)))
        throw new DomainError('This exchange path was not found by the graph.', 400);
      const participants = ids.map((id) => state.agencies.find((a) => a.id === id));
      if (participants.some((a) => !a))
        throw new DomainError('An agency no longer exists. Discover exchanges again.');
      const agents = participants as Agency[],
        result = negotiateTerms(agents),
        now = new Date().toISOString();
      const memoryParams = Object.fromEntries(ids.map((id, i) => [`member${i}`, id]));
      const memory = await this.connection.graph.roQuery<{ agencyId: string; json: string }>(
        `MATCH (prior:Deal)-[:INVOLVES]->(member:Agency) WHERE ${ids.map((_, i) => `member.id = $member${i}`).join(' OR ')} RETURN member.id AS agencyId, prior.json AS json`,
        { params: memoryParams },
      );
      const context = ids.flatMap((id) => {
        const prior = (memory.data ?? [])
          .filter((row) => row.agencyId === id)
          .map((row) => JSON.parse(row.json) as Deal)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        return prior
          ? [
              event(
                id,
                0,
                'inspect',
                `Retrieved prior agreement ${prior.id.slice(0, 8)} from shared graph memory (${prior.status}). ${prior.reason ?? 'Previous terms retained as context.'} Rechecked current capacity and constraints before this proposal.`,
              ),
            ]
          : [];
      });
      const deal: Deal = {
        id: randomUUID(),
        runId,
        title: agents.map((a) => a.initials).join(' / '),
        status: result.accepted ? 'awaiting_approval' : 'rejected',
        createdAt: now,
        updatedAt: now,
        agencyIds: ids,
        participants: structuredClone(agents),
        legs: result.legs,
        events: [...context, ...result.events],
        approvals: [],
        rounds: result.rounds,
        reason: result.reason,
        totalCredits: result.legs.reduce((n, l) => n + l.credits, 0),
      };
      if (result.accepted) {
        for (const leg of deal.legs)
          state.agencies.find((a) => a.id === leg.from)!.reservedHours += leg.hours;
        deal.events.push(
          event(
            'coordinator',
            result.rounds,
            'reserve',
            'All representatives agree. Capacity held for this entire cycle; waiting for each member’s approval.',
          ),
        );
      }
      const advice = await advise(deal);
      if (advice) deal.events.push(event('advisor', result.rounds, 'advisor', advice));
      state.deals.unshift(deal);
      await this.write(state);
      return deal;
    });
  }
  async approve(dealId: string, agencyId: string): Promise<Deal> {
    return this.exclusive(async () => {
      const state = await this.read(),
        deal = this.getDeal(state, dealId);
      if (!deal.agencyIds.includes(agencyId))
        throw new DomainError('This agency is not part of the agreement.', 400);
      if (deal.status === 'committed') return deal;
      if (deal.status !== 'awaiting_approval')
        throw new DomainError(`This agreement is ${deal.status}. Discover a new exchange.`);
      if (deal.approvals.includes(agencyId)) return deal;
      deal.approvals.push(agencyId);
      deal.updatedAt = new Date().toISOString();
      deal.events.push(
        event(
          agencyId,
          deal.rounds,
          'approve',
          'Human approval recorded for this member in the sandbox.',
        ),
      );
      if (deal.approvals.length === deal.agencyIds.length) {
        for (const leg of deal.legs) {
          const agency = state.agencies.find((a) => a.id === leg.from)!;
          if (!agency.active || agency.reservedHours < leg.hours)
            throw new DomainError('Capacity changed. Cancel this agreement and search again.');
          agency.reservedHours -= leg.hours;
          agency.committedHours += leg.hours;
        }
        deal.status = 'committed';
        deal.events.push(
          event(
            'coordinator',
            deal.rounds,
            'commit',
            'Every member approved. All capacity commitments were recorded together. No work or payment was transferred.',
          ),
        );
      }
      await this.write(state);
      return deal;
    });
  }
  async cancel(dealId: string): Promise<Deal> {
    return this.exclusive(async () => {
      const state = await this.read(),
        deal = this.getDeal(state, dealId);
      if (deal.status === 'cancelled') return deal;
      if (deal.status !== 'awaiting_approval')
        throw new DomainError('Only an agreement awaiting approval can be cancelled.');
      this.release(state, deal);
      deal.status = 'cancelled';
      deal.updatedAt = new Date().toISOString();
      deal.events.push(
        event(
          'coordinator',
          deal.rounds,
          'cancel',
          'Agreement cancelled. Every capacity hold has been released.',
        ),
      );
      await this.write(state);
      return deal;
    });
  }
  async saveAgency(input: Agency, create = false): Promise<Agency> {
    return this.exclusive(async () => {
      const state = await this.read(),
        existing = state.agencies.find((a) => a.id === input.id);
      if (!existing && !create)
        throw new DomainError('Agency not found. Refresh the workspace.', 404);
      if (existing && create) throw new DomainError('This agency already exists.');
      if (!existing && state.agencies.length >= 30)
        throw new DomainError('This demo supports up to 30 agencies.');
      if (existing && input.revision !== existing.revision)
        throw new DomainError('This profile changed in another session. Reload before editing.');
      if (existing && input.capacityHours < existing.committedHours)
        throw new DomainError('Capacity cannot be reduced below committed hours.');
      if (input.offer === input.need)
        throw new DomainError('Offer and need must be different services.', 400);
      if (input.minReceiveHours > input.requestHours)
        throw new DomainError('Minimum hours cannot exceed requested hours.', 400);
      for (const deal of state.deals.filter(
        (d) => d.status === 'awaiting_approval' && d.agencyIds.includes(input.id),
      )) {
        this.release(state, deal);
        deal.status = 'invalidated';
        deal.updatedAt = new Date().toISOString();
        deal.reason = `${input.name}'s availability or terms changed. All holds released.`;
        deal.events.push(event(input.id, deal.rounds, 'invalidate', deal.reason));
      }
      const agency: Agency = {
        ...input,
        reservedHours: existing?.reservedHours ?? 0,
        committedHours: existing?.committedHours ?? 0,
        revision: (existing?.revision ?? 0) + 1,
      };
      if (existing) state.agencies[state.agencies.indexOf(existing)] = agency;
      else state.agencies.push(agency);
      await this.write(state);
      return agency;
    });
  }
  private getDeal(state: State, id: string): Deal {
    const deal = state.deals.find((d) => d.id === id);
    if (!deal) throw new DomainError('Agreement not found.', 404);
    return deal;
  }
  private release(state: State, deal: Deal): void {
    for (const leg of deal.legs) {
      const agency = state.agencies.find((a) => a.id === leg.from)!;
      agency.reservedHours = Math.max(0, agency.reservedHours - leg.hours);
    }
  }
  async close(): Promise<void> {
    await this.tail;
    await this.connection.close();
  }
}
