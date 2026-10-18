import { randomUUID } from 'node:crypto';
import type {
  Agency,
  Candidate,
  Deal,
  Run,
  Snapshot,
  NegotiationOptions,
  Service,
  Impact,
  LoopStats,
  Insight,
  GrowthOption,
  NetworkStructure,
} from '../shared/types';
import { services } from '../shared/types';
import { canonicalCycle, event, negotiate as negotiateTerms } from './negotiation';
import { openGraph, type GraphConnection } from './graph';
import { seedAgencies } from './seed';
import { showcaseAgencies } from './showcase';
import { buildProposals, runAgents, decideWithPolicy } from './agents';
import { modelConfig, decideWithModel, type ModelConfig } from './model';
import type { Lesson } from '../shared/types';

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
// What-if variant: the same traversal with one agency treated as withdrawn.
const CYCLE_WITHOUT_QUERY = `MATCH p=(a:Agency)-[:CAN_SERVE*3..4]->(a)
WHERE all(n IN nodes(p) WHERE n.active = true AND n.id <> $excluded)
RETURN [n IN nodes(p) | n.id] AS ids LIMIT 2000`;
type State = Pick<Snapshot, 'agencies' | 'deals' | 'runs' | 'lessons'> & {
  insights?: Insight[];
  workspace?: { scenario: 'starter' | 'launch' | 'custom'; synthetic: boolean };
  // Graph revision this state was read at; undefined means the graph has no workspace yet.
  revision?: number;
};

export class Store {
  private tail: Promise<unknown> = Promise.resolve();
  private constructor(
    private connection: GraphConnection,
    private resolveModel: () => ModelConfig | undefined = modelConfig,
  ) {}
  static async open(
    options: {
      path?: string;
      url?: string;
      graphName?: string;
      modelConfig?: () => ModelConfig | undefined;
    } = {},
  ): Promise<Store> {
    return Store.attach(await openGraph(options), options.modelConfig);
  }
  // Several Store instances may share one graph (e.g. serverless replicas); writes are
  // guarded by the graph-side workspace revision rather than this process's queue alone.
  static async attach(
    connection: GraphConnection,
    resolveModel: () => ModelConfig | undefined = modelConfig,
  ): Promise<Store> {
    const store = new Store(connection, resolveModel);
    try {
      const result = await store.connection.graph.query<{ count: number }>(
        'MATCH (n) WHERE n:Agency OR n:Workspace RETURN count(n) AS count',
      );
      if (!result.data?.[0]?.count)
        await store
          .write({ agencies: seedAgencies(), deals: [], runs: [], lessons: [] })
          .catch((error) => {
            // Another instance seeded the empty graph first; its workspace is kept.
            if (!(error instanceof DomainError)) throw error;
          });
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
    const result = await this.connection.graph.roQuery<{
      kind: string;
      json: string;
      revision: number | null;
    }>(
      'MATCH (n) WHERE n:Agency OR n:Deal OR n:Run OR n:Lesson OR n:Insight OR n:Workspace RETURN labels(n)[0] AS kind, n.json AS json, n.revision AS revision',
    );
    const state: State = { agencies: [], deals: [], runs: [], lessons: [], insights: [] };
    for (const row of result.data ?? []) {
      if (row.kind === 'Workspace') {
        state.workspace = JSON.parse(row.json);
        state.revision = row.revision ?? 0;
      }
      if (row.kind === 'Agency') state.agencies.push(JSON.parse(row.json));
      if (row.kind === 'Deal') state.deals.push(JSON.parse(row.json));
      if (row.kind === 'Run') state.runs.push(JSON.parse(row.json));
      if (row.kind === 'Lesson') state.lessons.push(JSON.parse(row.json));
      if (row.kind === 'Insight') state.insights!.push(JSON.parse(row.json));
    }
    state.agencies.sort((a, b) => a.name.localeCompare(b.name));
    state.deals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    state.runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return state;
  }
  private async write(state: State): Promise<void> {
    // One atomic Cypher statement: reads never see half an agreement or reservation.
    // Compare-and-swap: the statement only runs if the workspace revision is unchanged since
    // this state was read. Grouping by `rev` makes every later clause see zero rows otherwise.
    const params: Record<string, string | number | boolean> = {};
    const writeId = randomUUID(),
      nextRevision = (state.revision ?? 0) + 1;
    params.writeId = writeId;
    params.nextRevision = nextRevision;
    const lines =
      state.revision === undefined
        ? [
            'OPTIONAL MATCH (w:Workspace) WITH count(w) AS existing WHERE existing = 0 WITH 0 AS rev',
            'OPTIONAL MATCH (old) DETACH DELETE old WITH rev, count(old) AS removed',
          ]
        : [
            'MATCH (w:Workspace) WHERE coalesce(w.revision, 0) = $expected WITH coalesce(w.revision, 0) AS rev',
            'OPTIONAL MATCH (old) DETACH DELETE old WITH rev, count(old) AS removed',
          ];
    if (state.revision !== undefined) params.expected = state.revision;
    const agencyVars = new Map<string, string>(),
      runVars = new Map<string, string>(),
      dealVars = new Map<string, string>();
    const workspace = state.workspace ?? {
      scenario: state.agencies.some((a) => a.id === 'premiere') ? 'launch' : 'starter',
      synthetic: true,
    };
    params.workspace = JSON.stringify(workspace);
    lines.push(
      'CREATE (:Workspace {id:"workspace",json:$workspace,revision:$nextRevision,writeId:$writeId})',
    );
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
        revision: a.revision,
        offer: a.offer,
        need: a.need,
        json: JSON.stringify(a),
      }))
        params[`${v}${key}`] = value;
      lines.push(
        `CREATE (${v}:Agency {id:$${v}id,name:$${v}name,active:$${v}active,revision:$${v}revision,offer:$${v}offer,need:$${v}need,json:$${v}json})`,
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
      dealVars.set(d.id, v);
      params[`${v}id`] = d.id;
      params[`${v}json`] = JSON.stringify(d);
      params[`${v}status`] = d.status;
      lines.push(`CREATE (${v}:Deal {id:$${v}id,status:$${v}status,json:$${v}json})`);
      if (runVars.has(d.runId)) lines.push(`CREATE (${v})-[:FROM_RUN]->(${runVars.get(d.runId)})`);
      d.agencyIds.forEach((id) => {
        if (agencyVars.has(id)) lines.push(`CREATE (${v})-[:INVOLVES]->(${agencyVars.get(id)})`);
      });
      // Completed agreements become durable partner history between agencies.
      if (d.status === 'committed')
        d.legs.forEach((leg, j) => {
          const from = agencyVars.get(leg.from),
            to = agencyVars.get(leg.to);
          if (!from || !to) return;
          params[`${v}t${j}`] = leg.hours;
          lines.push(`CREATE (${from})-[:TRADED_WITH {dealId:$${v}id,hours:$${v}t${j}}]->(${to})`);
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
    state.lessons.forEach((lesson, i) => {
      const v = `lesson${i}`;
      params[`${v}id`] = lesson.id;
      params[`${v}json`] = JSON.stringify(lesson);
      params[`${v}active`] = lesson.active !== false;
      lines.push(`CREATE (${v}:Lesson {id:$${v}id,json:$${v}json,active:$${v}active})`);
      if (agencyVars.has(lesson.agencyId))
        lines.push(`CREATE (${v})-[:ABOUT]->(${agencyVars.get(lesson.agencyId)})`);
      if (dealVars.has(lesson.dealId))
        lines.push(`CREATE (${v})-[:LEARNED_FROM]->(${dealVars.get(lesson.dealId)})`);
    });
    (state.insights ?? []).forEach((insight, i) => {
      const v = `insight${i}`;
      params[`${v}id`] = insight.id;
      params[`${v}json`] = JSON.stringify(insight);
      params[`${v}revision`] = insight.revision;
      lines.push(`CREATE (${v}:Insight {id:$${v}id,json:$${v}json,revision:$${v}revision})`);
      if (agencyVars.has(insight.agencyId))
        lines.push(`CREATE (${v})-[:ABOUT]->(${agencyVars.get(insight.agencyId)})`);
      if (dealVars.has(insight.dealId))
        lines.push(`CREATE (${v})-[:LEARNED_FROM]->(${dealVars.get(insight.dealId)})`);
    });
    lines.push(
      'WITH rev, count(*) AS written MATCH (provider:Agency)-[:OFFERS]->(service:Service)<-[:NEEDS]-(recipient:Agency) WHERE provider.id <> recipient.id CREATE (provider)-[:CAN_SERVE {service:service.id}]->(recipient) RETURN count(*) AS edges',
    );
    await this.connection.graph.query(lines.join('\n'), { params });
    const check = await this.connection.graph.roQuery<{ writeId: string }>(
      'MATCH (w:Workspace) RETURN w.writeId AS writeId',
    );
    if (check.data?.[0]?.writeId !== writeId)
      throw new DomainError(
        'The workspace changed in another session while this action ran. Nothing was saved; reload and retry.',
      );
    state.revision = nextRevision;
  }
  // Distinct directed loops (rotations merged) currently in the graph.
  private async loops(excluded?: string): Promise<string[][]> {
    const result = excluded
      ? await this.connection.graph.roQuery<{ ids: string[] }>(CYCLE_WITHOUT_QUERY, {
          params: { excluded },
        })
      : await this.connection.graph.roQuery<{ ids: string[] }>(CYCLE_QUERY);
    const found = new Map<string, string[]>();
    for (const row of result.data ?? []) {
      const ids = row.ids.slice(0, -1);
      if (new Set(ids).size !== ids.length) continue;
      const key = canonicalCycle(ids);
      if (!found.has(key)) found.set(key, key.split('|'));
    }
    return [...found.values()];
  }
  private loopStats(loops: string[][]): LoopStats {
    const byAgency: Record<string, number> = {};
    for (const loop of loops) for (const id of loop) byAgency[id] = (byAgency[id] ?? 0) + 1;
    return {
      total: loops.length,
      byAgency,
      keystoneIds: loops.length
        ? Object.keys(byAgency)
            .filter((id) => byAgency[id] === loops.length)
            .sort()
        : [],
    };
  }
  // FalkorDB's native algorithm procedures over the derived CAN_SERVE graph: PageRank (who
  // receives the most flow), betweenness (who brokers paths between others) and weakly
  // connected components (sub-networks that can never trade with each other).
  async structure(): Promise<NetworkStructure> {
    const config = "{nodeLabels: ['Agency'], relationshipTypes: ['CAN_SERVE']}";
    const [rank, between, wcc, names] = await Promise.all([
      this.readGraph<{ id: string; score: number }>(
        "CALL algo.pageRank('Agency', 'CAN_SERVE') YIELD node, score RETURN node.id AS id, score",
      ),
      this.readGraph<{ id: string; score: number }>(
        // Sample every node with a fixed seed so scores are exact and repeatable.
        "CALL algo.betweenness({nodeLabels: ['Agency'], relationshipTypes: ['CAN_SERVE'], samplingSize: 1000, samplingSeed: 7}) YIELD node, score RETURN node.id AS id, score",
      ),
      this.readGraph<{ id: string; componentId: number }>(
        `CALL algo.WCC(${config}) YIELD node, componentId RETURN node.id AS id, componentId`,
      ),
      this.readGraph<{ id: string; name: string }>(
        'MATCH (a:Agency) RETURN a.id AS id, a.name AS name',
      ),
    ]);
    const agencies = names.map(({ id, name }) => ({
      id,
      name,
      pageRank: Math.round((rank.find((r) => r.id === id)?.score ?? 0) * 1000) / 1000,
      betweenness: Math.round((between.find((r) => r.id === id)?.score ?? 0) * 10) / 10,
      componentId: wcc.find((r) => r.id === id)?.componentId ?? -1,
    }));
    const groups = new Map<number, string[]>();
    for (const a of agencies)
      groups.set(a.componentId, [...(groups.get(a.componentId) ?? []), a.id]);
    const broker = [...agencies].sort((a, b) => b.betweenness - a.betweenness)[0];
    return {
      algorithms: ['algo.pageRank', 'algo.betweenness', 'algo.WCC'],
      components: groups.size,
      broker: broker && broker.betweenness > 0 ? broker.id : undefined,
      isolatedGroups: groups.size > 1 ? [...groups.values()] : [],
      agencies: agencies.sort((a, b) => b.betweenness - a.betweenness || b.pageRank - a.pageRank),
    };
  }
  // Recruitment what-if: a hypothetical agency offering `offer` and needing `need` closes a
  // loop for every simple CAN_SERVE path from an agency needing `offer` to one offering `need`
  // (one or two hops, giving loops of three or four).
  async growth(): Promise<GrowthOption[]> {
    const state = await this.read();
    const keystones = this.loopStats(await this.loops()).keystoneIds;
    const name = (id: string) => state.agencies.find((a) => a.id === id)?.name ?? id;
    const options: GrowthOption[] = [];
    for (const offer of services)
      for (const need of services) {
        if (offer === need) continue;
        const rows = await this.readGraph<{ ids: string[] }>(
          `MATCH p=(a:Agency)-[:CAN_SERVE*1..2]->(b:Agency)
WHERE a.need = $offer AND b.offer = $need AND all(n IN nodes(p) WHERE n.active = true)
RETURN [n IN nodes(p) | n.id] AS ids LIMIT 500`,
          { offer, need },
        );
        const paths = rows.map((r) => r.ids).filter((ids) => new Set(ids).size === ids.length);
        if (!paths.length) continue;
        options.push({
          offer,
          need,
          newLoops: paths.length,
          examples: paths.slice(0, 3).map((ids) => ['New agency', ...ids.map(name)]),
          reducesKeystone:
            keystones.length > 0 && paths.some((ids) => !keystones.some((k) => ids.includes(k))),
        });
      }
    return options.sort(
      (a, b) =>
        b.newLoops - a.newLoops ||
        Number(b.reducesKeystone) - Number(a.reducesKeystone) ||
        `${a.offer}${a.need}`.localeCompare(`${b.offer}${b.need}`),
    );
  }
  currentModel(): ModelConfig | undefined {
    return this.resolveModel();
  }
  // Read-only access for the graph tools; queries are fixed strings with parameters.
  async readGraph<T>(query: string, params: Record<string, string | number | boolean> = {}) {
    return (await this.connection.graph.roQuery<T>(query, { params })).data ?? [];
  }
  async listLoops(): Promise<{ id: string; agencyIds: string[]; names: string[] }[]> {
    const [loops, state] = await Promise.all([this.loops(), this.read()]);
    const name = (id: string) => state.agencies.find((a) => a.id === id)?.name ?? id;
    return loops.map((ids) => ({ id: ids.join('|'), agencyIds: ids, names: ids.map(name) }));
  }
  async impact(agencyId: string): Promise<Impact> {
    const state = await this.read();
    if (!state.agencies.some((a) => a.id === agencyId))
      throw new DomainError('Agency not found.', 404);
    const [before, after] = await Promise.all([this.loops(), this.loops(agencyId)]);
    const broken = before.filter((loop) => loop.includes(agencyId));
    const pending = await this.connection.graph.roQuery<{ json: string }>(
      "MATCH (d:Deal)-[:INVOLVES]->(a:Agency {id:$agencyId}) WHERE d.status = 'awaiting_approval' RETURN d.json AS json",
      { params: { agencyId } },
    );
    const pendingDeals = (pending.data ?? []).map((row) => {
      const deal = JSON.parse(row.json) as Deal;
      return {
        id: deal.id,
        title: deal.title,
        heldHours: deal.legs.reduce((n, l) => n + l.hours, 0),
      };
    });
    const partners = [...new Set(broken.flat())].filter((id) => id !== agencyId).sort();
    const afterStats = this.loopStats(after);
    const name = (id: string) => state.agencies.find((a) => a.id === id)?.name ?? id;
    return {
      agencyId,
      loopsBefore: before.length,
      loopsAfter: after.length,
      broken: broken.map((ids) => ({ agencyIds: ids, names: ids.map(name) })),
      pendingDeals,
      releasedHours: pendingDeals.reduce((n, d) => n + d.heldHours, 0),
      reroutes: partners
        .map((id) => ({ agencyId: id, loops: afterStats.byAgency[id] ?? 0 }))
        .filter((r) => r.loops > 0),
      stranded: partners.filter((id) => !afterStats.byAgency[id]),
    };
  }
  async snapshot(): Promise<Snapshot> {
    const config = this.resolveModel();
    const data = await this.read();
    return {
      ...data,
      loops: this.loopStats(await this.loops()),
      insights: data.insights ?? [],
      scenario:
        data.workspace?.scenario ??
        (data.agencies.some((a) => a.id === 'premiere')
          ? 'launch'
          : data.agencies.length === 6
            ? 'starter'
            : 'custom'),
      edges:
        (
          await this.connection.graph.roQuery<{ from: string; to: string; service: Service }>(
            'MATCH (a:Agency)-[r:CAN_SERVE]->(b:Agency) RETURN a.id AS from, b.id AS to, r.service AS service',
          )
        ).data ?? [],
      database: this.connection.mode,
      agentMode: config ? 'Model agents available' : 'Policy simulation',
      modelConfigured: Boolean(config),
      modelName: config?.name,
      synthetic: data.workspace?.synthetic ?? true,
    };
  }
  async reset(scenario: 'starter' | 'launch' | 'empty' = 'starter'): Promise<Snapshot> {
    return this.exclusive(async () => {
      const { revision } = await this.read();
      await this.write({
        revision,
        agencies:
          scenario === 'empty' ? [] : scenario === 'launch' ? showcaseAgencies() : seedAgencies(),
        workspace: {
          scenario: scenario === 'empty' ? 'custom' : scenario,
          synthetic: scenario !== 'empty',
        },
        deals: [],
        runs: [],
        lessons: [],
        insights: [],
      });
      return this.snapshot();
    });
  }
  async discover(): Promise<Run> {
    return this.exclusive(async () => {
      const started = performance.now(),
        state = await this.read();
      const result = await this.connection.graph.roQuery<{ ids: string[] }>(CYCLE_QUERY);
      // Graph memory: partner history and failures that still apply to current profiles.
      const traded = await this.connection.graph.roQuery<{
        from: string;
        to: string;
        deals: string[];
      }>(
        'MATCH (a:Agency)-[t:TRADED_WITH]->(b:Agency) RETURN a.id AS from, b.id AS to, collect(DISTINCT t.dealId) AS deals',
      );
      const current = await this.connection.graph.roQuery<{ json: string }>(
        'MATCH (i:Insight)-[:ABOUT]->(a:Agency) WHERE i.revision = a.revision RETURN i.json AS json',
      );
      const tradedLegs = new Map(
        (traded.data ?? []).map((row) => [`${row.from}>${row.to}`, row.deals]),
      );
      const insights = (current.data ?? []).map((row) => JSON.parse(row.json) as Insight);
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
          history: (() => {
            const legDeals = ordered.flatMap(
              (id, i) => tradedLegs.get(`${id}>${ordered[(i + 1) % ordered.length]}`) ?? [],
            );
            return {
              tradedLegs: ordered.filter((id, i) =>
                tradedLegs.has(`${id}>${ordered[(i + 1) % ordered.length]}`),
              ).length,
              sourceDealIds: [...new Set(legDeals)],
              priorFailures: insights
                .filter((i) => i.loopKey === key)
                .map((i) => ({ agencyId: i.agencyId, dealId: i.dealId, reason: i.reason })),
            };
          })(),
        });
      }
      const candidates = [...found.values()].sort(
        (a, b) =>
          Number(b.feasible) - Number(a.feasible) ||
          (a.history?.priorFailures.length ?? 0) - (b.history?.priorFailures.length ?? 0) ||
          (b.history?.tradedLegs ?? 0) - (a.history?.tradedLegs ?? 0) ||
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
  async negotiate(runId: string, ids: string[], options: NegotiationOptions = {}): Promise<Deal> {
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
        policyResult = negotiateTerms(agents),
        now = new Date().toISOString();
      const mode = options.mode ?? 'policy',
        config = mode === 'model' ? this.resolveModel() : undefined;
      if (mode === 'model' && !config)
        throw new DomainError(
          'Configure MODEL_API_KEY, MODEL_NAME and MODEL_BASE_URL in the ignored .env file for live model agents.',
        );
      const useMemory = options.useMemory ?? true;
      let lessons: Lesson[] = [];
      if (useMemory) {
        const lessonParams = Object.fromEntries(ids.map((id, i) => [`member${i}`, id]));
        const retrieved = await this.connection.graph.roQuery<{ json: string }>(
          `MATCH (lesson:Lesson)-[:ABOUT]->(member:Agency) WHERE lesson.active = true AND (${ids.map((_, i) => `member.id = $member${i}`).join(' OR ')}) RETURN lesson.json AS json`,
          { params: lessonParams },
        );
        lessons = (retrieved.data ?? []).map((row) => JSON.parse(row.json) as Lesson);
      }
      const result =
        policyResult.accepted && (mode === 'model' || lessons.length > 0)
          ? await runAgents(
              agents,
              buildProposals(agents, lessons),
              mode === 'model'
                ? (context, signal) => decideWithModel(context, config!, signal)
                : decideWithPolicy,
              { lessons, useMemory },
            )
          : policyResult;
      const memoryParams = Object.fromEntries(ids.map((id, i) => [`member${i}`, id]));
      const memory = await this.connection.graph.roQuery<{ agencyId: string; json: string }>(
        `MATCH (prior:Deal)-[:INVOLVES]->(member:Agency) WHERE ${ids.map((_, i) => `member.id = $member${i}`).join(' OR ')} RETURN member.id AS agencyId, prior.json AS json`,
        { params: memoryParams },
      );
      const context = !useMemory
        ? []
        : ids.flatMap((id) => {
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
        requestedMode: mode,
        executedMode: mode === 'model' && policyResult.accepted ? 'model' : 'policy',
        model: result.reportedModels?.join(', ') || undefined,
        requestedModel: config?.name,
        modelProvider: config
          ? new URL(config.baseUrl).origin + new URL(config.baseUrl).pathname
          : undefined,
        modelIdentityKnown:
          mode === 'model' &&
          policyResult.accepted &&
          result.modelIdentityKnown === true &&
          Boolean(result.reportedModels?.length),
        useMemory: options.useMemory ?? true,
        lessonIds: lessons.map((l) => l.id),
        proposalId: result.proposalId ?? 'requested',
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
      const blocker = [...result.events].reverse().find((e) => e.action === 'reject')?.actor;
      const blocking = agents.find((a) => a.id === blocker);
      // Transport failures and timeouts say nothing about the agency, so they are not remembered.
      const transient = /^(Model request|Negotiation time budget)/.test(result.reason ?? '');
      if (!result.accepted && blocking && !transient) {
        state.insights = [
          {
            id: randomUUID(),
            agencyId: blocking.id,
            dealId: deal.id,
            loopKey: canonicalCycle(ids),
            reason: result.reason ?? 'Negotiation rejected.',
            revision: blocking.revision,
            createdAt: now,
          },
          ...(state.insights ?? []),
        ].slice(0, 500);
        deal.events.push(
          event(
            'coordinator',
            result.rounds,
            'inspect',
            `Remembered this failure on ${blocking.name}'s current profile. Future discovery will flag this loop until that profile changes.`,
          ),
        );
      }
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
  async recordLesson(dealId: string, agencyId: string, preferredHours: number): Promise<Lesson> {
    return this.exclusive(async () => {
      const state = await this.read(),
        deal = this.getDeal(state, dealId);
      if (!deal.agencyIds.includes(agencyId))
        throw new DomainError('The source negotiation does not involve this agency.', 400);
      if (
        !Number.isFinite(preferredHours) ||
        preferredHours < 0.25 ||
        preferredHours > 1000 ||
        preferredHours * 4 !== Math.round(preferredHours * 4)
      )
        throw new DomainError(
          'Preferred scope must be a quarter-hour value between 0.25 and 1000.',
          400,
        );
      if (state.lessons.length >= 500)
        throw new DomainError(
          'This demo has reached its lesson limit. Export history before resetting.',
        );
      for (const prior of state.lessons) if (prior.agencyId === agencyId) prior.active = false;
      const lesson: Lesson = {
        id: randomUUID(),
        agencyId,
        dealId,
        preferredHours,
        statement: `Participant feedback: prefer receiving at most ${preferredHours}h in a new exchange.`,
        createdAt: new Date().toISOString(),
        active: true,
      };
      state.lessons.unshift(lesson);
      const e = event(
        agencyId,
        deal.rounds,
        'inspect',
        `Participant taught a future scope preference of ${preferredHours}h. Hard profile constraints are unchanged.`,
      );
      e.tool = 'remember_preference';
      e.evidenceIds = [lesson.id];
      deal.events.push(e);
      await this.write(state);
      return lesson;
    });
  }
}
