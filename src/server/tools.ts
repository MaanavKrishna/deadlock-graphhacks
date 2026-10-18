import { z } from 'zod';
import type { Agency, Deal, Insight, Lesson, NegotiationEvent, Source } from '../shared/types';
import { services } from '../shared/types';
import type { Store } from './store';

// Graph tools shared by the "Ask the network" agent and the MCP server. Every tool runs a
// fixed, parameterized Cypher query: models choose tools and arguments, never write Cypher.
export interface ToolResult {
  data: unknown;
  sources: Source[];
}
interface GraphTool<S extends z.ZodType> {
  name: string;
  description: string;
  input: S;
  run(store: Store, args: z.infer<S>): Promise<ToolResult>;
}
const tool = <S extends z.ZodType>(t: GraphTool<S>) => t;
const free = (a: Agency) => Math.max(0, a.capacityHours - a.reservedHours - a.committedHours);
const agencySource = (a: { id: string; name: string }): Source => ({
  type: 'agency',
  id: a.id,
  label: a.name,
});
const dealSource = (d: Deal): Source => ({
  type: 'deal',
  id: d.id,
  label: `${d.title} (${d.status})`,
});
const agencyId = z.string().min(1).max(80).describe('Agency id, e.g. "studio-north"');

export const graphTools = [
  tool({
    name: 'list_agencies',
    description:
      'List every agency with what it offers, what it needs, availability and free hours.',
    input: z.object({}).strict(),
    async run(store) {
      const rows = await store.readGraph<{ json: string }>(
        'MATCH (a:Agency) RETURN a.json AS json ORDER BY a.name',
      );
      const agencies = rows.map((r) => JSON.parse(r.json) as Agency);
      return {
        data: agencies.map((a) => ({
          id: a.id,
          name: a.name,
          offers: a.offer,
          needs: a.need,
          active: a.active,
          freeHours: free(a),
          deadlineDay: a.deadlineDays,
          deliveryDays: a.deliveryDays,
        })),
        sources: agencies.map(agencySource),
      };
    },
  }),
  tool({
    name: 'find_providers',
    description: 'Find active agencies that offer a service, with their free capacity.',
    input: z.object({ service: z.enum(services) }).strict(),
    async run(store, { service }) {
      const rows = await store.readGraph<{ json: string }>(
        'MATCH (a:Agency)-[:OFFERS]->(:Service {id:$service}) WHERE a.active = true RETURN a.json AS json',
        { service },
      );
      const agencies = rows.map((r) => JSON.parse(r.json) as Agency);
      return {
        data: agencies.map((a) => ({
          id: a.id,
          name: a.name,
          freeHours: free(a),
          deliveryDays: a.deliveryDays,
          creditsPerHour: a.hourlyCredits,
        })),
        sources: agencies.map(agencySource),
      };
    },
  }),
  tool({
    name: 'who_can_serve',
    description:
      'Multi-hop view around one agency: who can serve its need (incoming CAN_SERVE), whom it can serve, and the closed loops it belongs to.',
    input: z.object({ agencyId }).strict(),
    async run(store, { agencyId: id }) {
      const incoming = await store.readGraph<{ id: string; name: string; service: string }>(
        'MATCH (p:Agency)-[r:CAN_SERVE]->(a:Agency {id:$id}) RETURN p.id AS id, p.name AS name, r.service AS service',
        { id },
      );
      const outgoing = await store.readGraph<{ id: string; name: string; service: string }>(
        'MATCH (a:Agency {id:$id})-[r:CAN_SERVE]->(b:Agency) RETURN b.id AS id, b.name AS name, r.service AS service',
        { id },
      );
      const loops = (await store.listLoops()).filter((l) => l.agencyIds.includes(id));
      return {
        data: { canBeServedBy: incoming, canServe: outgoing, loops: loops.map((l) => l.names) },
        sources: [...incoming, ...outgoing].map(agencySource),
      };
    },
  }),
  tool({
    name: 'find_loops',
    description:
      'Run the graph cycle traversal (3–4 agencies, active only). Optionally keep loops through one agency.',
    input: z.object({ agencyId: agencyId.optional() }).strict(),
    async run(store, { agencyId: id }) {
      const loops = (await store.listLoops()).filter((l) => !id || l.agencyIds.includes(id));
      return {
        data: loops,
        sources: loops.map((l) => ({
          type: 'loop' as const,
          id: l.id,
          label: l.names.join(' → '),
        })),
      };
    },
  }),
  tool({
    name: 'withdrawal_impact',
    description:
      'What breaks if an agency withdraws: broken loops, pending agreements and held hours released, partners still routable, partners stranded.',
    input: z.object({ agencyId }).strict(),
    async run(store, { agencyId: id }) {
      const impact = await store.impact(id);
      const [self] = await store.readGraph<{ name: string }>(
        'MATCH (a:Agency {id:$id}) RETURN a.name AS name',
        { id },
      );
      const named = new Map(
        impact.broken.flatMap((l) => l.agencyIds.map((a, i) => [a, l.names[i]] as const)),
      );
      named.set(id, self?.name ?? id);
      return {
        data: impact,
        sources: [
          ...[...named].map(([agency, name]) => agencySource({ id: agency, name })),
          ...impact.pendingDeals.map((d) => ({
            type: 'deal' as const,
            id: d.id,
            label: `${d.title} (awaiting_approval)`,
          })),
        ],
      };
    },
  }),
  tool({
    name: 'agency_history',
    description:
      'Everything the graph remembers about an agency: agreements it was in, lessons about it, failure insights and trading partners.',
    input: z.object({ agencyId }).strict(),
    async run(store, { agencyId: id }) {
      const deals = (
        await store.readGraph<{ json: string }>(
          'MATCH (d:Deal)-[:INVOLVES]->(:Agency {id:$id}) RETURN d.json AS json',
          { id },
        )
      ).map((r) => JSON.parse(r.json) as Deal);
      const lessons = (
        await store.readGraph<{ json: string }>(
          'MATCH (l:Lesson)-[:ABOUT]->(:Agency {id:$id}) RETURN l.json AS json',
          { id },
        )
      ).map((r) => JSON.parse(r.json) as Lesson);
      const insights = (
        await store.readGraph<{ json: string }>(
          'MATCH (i:Insight)-[:ABOUT]->(:Agency {id:$id}) RETURN i.json AS json',
          { id },
        )
      ).map((r) => JSON.parse(r.json) as Insight);
      const partners = await store.readGraph<{ id: string; name: string; trades: number }>(
        'MATCH (:Agency {id:$id})-[t:TRADED_WITH]-(b:Agency) RETURN b.id AS id, b.name AS name, count(t) AS trades',
        { id },
      );
      deals.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return {
        data: {
          agreements: deals.slice(0, 15).map((d) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            updatedAt: d.updatedAt,
            reason: d.reason,
          })),
          lessons: lessons.map((l) => ({
            id: l.id,
            statement: l.statement,
            active: l.active !== false,
            sourceDealId: l.dealId,
          })),
          insights: insights.map((i) => ({ id: i.id, reason: i.reason, sourceDealId: i.dealId })),
          partners,
        },
        sources: [
          ...deals.slice(0, 15).map(dealSource),
          ...lessons.map((l) => ({ type: 'lesson' as const, id: l.id, label: l.statement })),
          ...insights.map((i) => ({ type: 'insight' as const, id: i.id, label: i.reason })),
          ...partners.map(agencySource),
        ],
      };
    },
  }),
  tool({
    name: 'explain_deal',
    description:
      'Trace an agreement back to its sources: the discovery run, every representative decision in order, and lessons learned from it.',
    input: z.object({ dealId: z.string().min(1).max(80) }).strict(),
    async run(store, { dealId }) {
      const [row] = await store.readGraph<{ json: string; run: string | null }>(
        'MATCH (d:Deal {id:$dealId}) OPTIONAL MATCH (d)-[:FROM_RUN]->(r:Run) RETURN d.json AS json, r.id AS run',
        { dealId },
      );
      if (!row) return { data: { error: 'No agreement with that id.' }, sources: [] };
      const deal = JSON.parse(row.json) as Deal;
      const events = (
        await store.readGraph<{ json: string; by: string | null }>(
          'MATCH (:Deal {id:$dealId})-[:HAS_EVENT]->(e:Event) OPTIONAL MATCH (e)-[:BY]->(a:Agency) RETURN e.json AS json, a.name AS by',
          { dealId },
        )
      )
        .map((r) => ({ ...(JSON.parse(r.json) as NegotiationEvent), by: r.by ?? 'Coordinator' }))
        .sort((a, b) => a.at.localeCompare(b.at));
      const lessons = await store.readGraph<{ id: string }>(
        'MATCH (l)-[:LEARNED_FROM]->(:Deal {id:$dealId}) RETURN l.id AS id',
        { dealId },
      );
      return {
        data: {
          id: deal.id,
          title: deal.title,
          status: deal.status,
          mode: deal.executedMode,
          model: deal.model,
          legs: deal.legs,
          reason: deal.reason,
          fromRun: row.run,
          decisions: events.map((e) => ({
            round: e.round,
            by: e.by,
            action: e.action,
            tool: e.tool,
            reason: e.reason,
          })),
          learnedFromThis: lessons.map((l) => l.id),
        },
        sources: [dealSource(deal)],
      };
    },
  }),
];
export type GraphToolName = (typeof graphTools)[number]['name'];

export async function runGraphTool(store: Store, name: string, args: unknown): Promise<ToolResult> {
  const found = graphTools.find((t) => t.name === name);
  if (!found) throw new Error(`Unknown graph tool ${name}`);
  return found.run(store, found.input.parse(args) as never);
}
