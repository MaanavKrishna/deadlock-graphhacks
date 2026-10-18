import type {
  Agency,
  Proposal,
  AgentContext,
  AgentDecision,
  NegotiationResult,
  Lesson,
} from '../shared/types';
import { negotiate, event, validateLegs } from './negotiation';
export function buildProposals(agencies: Agency[], lessons: Lesson[] = []): Proposal[] {
  const proposals: Proposal[] = [];
  for (const [id, label, scale] of [
    ['requested', 'Requested scope', 1],
    ['lean', 'Smaller first collaboration', 0.8],
  ] as const) {
    const result = negotiate(
      agencies.map((a) => ({
        ...a,
        requestHours: Math.max(a.minReceiveHours, Math.floor(a.requestHours * scale * 4) / 4),
      })),
    );
    if (result.accepted && !validateLegs(agencies, result.legs))
      proposals.push({ id, label, legs: result.legs });
  }
  const valid = lessons.filter((l) => {
    const a = agencies.find((a) => a.id === l.agencyId);
    return a && l.active !== false && l.preferredHours >= a.minReceiveHours;
  });
  if (valid.length) {
    const remembered = negotiate(
      agencies.map((a) => ({
        ...a,
        requestHours: Math.min(
          a.requestHours,
          valid.find((l) => l.agencyId === a.id)?.preferredHours ?? a.requestHours,
        ),
      })),
    );
    if (
      remembered.accepted &&
      !validateLegs(agencies, remembered.legs) &&
      JSON.stringify(remembered.legs) !== JSON.stringify(proposals[0]?.legs)
    ) {
      for (let i = proposals.length - 1; i >= 1; i--)
        if (JSON.stringify(proposals[i].legs) === JSON.stringify(remembered.legs))
          proposals.splice(i, 1);
      proposals.push({
        id: 'remembered',
        label: 'Scope informed by prior participant feedback',
        legs: remembered.legs,
      });
    }
  }
  return proposals;
}
export async function decideWithPolicy(context: AgentContext): Promise<AgentDecision> {
  const own = context.useMemory
    ? context.lessons.filter((l) => l.agencyId === context.agency.id)
    : [];
  const remembered = context.proposals.find((p) => p.id === 'remembered');
  const received = context.current.legs.find((l) => l.to === context.agency.id)!.hours;
  const preference = own.find(
    (l) => l.preferredHours >= context.agency.minReceiveHours && received > l.preferredHours,
  );
  const trace = [
    {
      tool: 'inspect_exchange',
      reason: `Read graph terms and ${own.length} source-backed preferences for ${context.agency.name}.`,
      evidenceIds: own.map((l) => l.id),
    },
  ];
  if (preference && remembered && context.current.id !== remembered.id)
    return {
      tool: 'counter_offer',
      proposalId: remembered.id,
      reason: `Prior participant feedback prefers at most ${preference.preferredHours}h received. Propose the feasible remembered scope.`,
      trace,
    };
  return {
    tool: 'accept_offer',
    reason: 'Current feasible terms meet the representative’s scope objective.',
    trace,
  };
}
export async function runAgents(
  agencies: Agency[],
  proposals: Proposal[],
  decide: (c: AgentContext, signal?: AbortSignal) => Promise<AgentDecision>,
  options: { lessons?: Lesson[]; useMemory?: boolean; timeoutMs?: number } = {},
): Promise<NegotiationResult> {
  let current = proposals[0];
  const events: NegotiationResult['events'] = [];
  let round = 0;
  const reportedModels = new Set<string>();
  let modelIdentityKnown = true;
  const reject = (reason: string, actor = 'coordinator'): NegotiationResult => ({
    accepted: false,
    reportedModels: [...reportedModels],
    modelIdentityKnown,
    legs: current?.legs ?? [],
    events: [...events, event(actor, round, 'reject', reason)],
    rounds: round,
    reason,
    proposalId: current?.id,
  });
  if (!current) return negotiate(agencies);
  for (const proposal of proposals) {
    const problem = validateLegs(agencies, proposal.legs);
    if (problem) return reject(problem);
  }
  const seen = new Set([current.id]),
    accepted = new Set<string>();
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
  try {
    for (round = 1; round <= 6; round++) {
      let countered = false;
      for (const agency of agencies) {
        if (controller.signal.aborted)
          return reject('Negotiation time budget exceeded. No capacity held.');
        let decision: AgentDecision;
        try {
          decision = await decide(
            {
              agency,
              participants: agencies,
              current,
              proposals: proposals.filter((p) => p.id === current.id || !seen.has(p.id)),
              lessons: options.lessons ?? [],
              useMemory: options.useMemory ?? true,
              round,
            },
            controller.signal,
          );
        } catch {
          return reject(
            'Model request or tool validation failed. No policy fallback or capacity hold was applied.',
            agency.id,
          );
        }
        if (controller.signal.aborted)
          return reject('Negotiation time budget exceeded. No capacity held.');
        if (decision.modelIdentityKnown !== true) modelIdentityKnown = false;
        for (const name of decision.reportedModels ?? []) reportedModels.add(name);
        for (const trace of decision.trace ?? []) {
          const e = event(agency.id, round, 'inspect', trace.reason);
          e.tool = trace.tool;
          e.evidenceIds = trace.evidenceIds;
          events.push(e);
        }
        if (!['accept_offer', 'counter_offer', 'reject_offer'].includes(decision.tool))
          return reject('Unknown representative tool.', agency.id);
        const action =
          decision.tool === 'accept_offer'
            ? 'accept'
            : decision.tool === 'counter_offer'
              ? 'counter'
              : 'reject';
        const e = event(agency.id, round, action, decision.reason);
        e.tool = decision.tool;
        e.proposalId = decision.proposalId ?? current.id;
        e.evidenceIds =
          options.useMemory === false
            ? []
            : (options.lessons ?? []).filter((l) => l.agencyId === agency.id).map((l) => l.id);
        events.push(e);
        if (decision.tool === 'reject_offer') return reject(decision.reason, agency.id);
        if (decision.tool === 'counter_offer') {
          const next = proposals.find((p) => p.id === decision.proposalId);
          if (!next || seen.has(next.id))
            return reject(
              'Counteroffer is unknown, unchanged, or repeats an earlier proposal.',
              agency.id,
            );
          current = next;
          seen.add(next.id);
          accepted.clear();
          countered = true;
          events.push(
            event(
              'coordinator',
              round,
              'inspect',
              'Terms changed. Every representative must accept the new proposal again.',
            ),
          );
          break;
        }
        accepted.add(agency.id);
      }
      if (!countered && accepted.size === agencies.length) {
        const problem = validateLegs(agencies, current.legs);
        if (problem) return reject(problem);
        return {
          accepted: true,
          reportedModels: [...reportedModels],
          modelIdentityKnown,
          legs: current.legs,
          events,
          rounds: round,
          proposalId: current.id,
        };
      }
    }
    round = 6;
    return reject('Representatives did not agree within six rounds.');
  } finally {
    clearTimeout(timer);
  }
}
