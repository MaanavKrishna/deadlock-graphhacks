import { randomUUID } from 'node:crypto';
import type { Agency, Leg, NegotiationEvent, NegotiationResult } from '../shared/types';

export function event(
  actor: string,
  round: number,
  action: NegotiationEvent['action'],
  reason: string,
): NegotiationEvent {
  return { id: randomUUID(), actor, round, action, reason, at: new Date().toISOString() };
}
export function canonicalCycle(ids: string[]): string {
  return ids.map((_, i) => [...ids.slice(i), ...ids.slice(0, i)].join('|')).sort()[0] ?? '';
}
export function validateLegs(agencies: Agency[], legs: Leg[]): string | undefined {
  if (
    agencies.length < 3 ||
    agencies.length > 4 ||
    new Set(agencies.map((a) => a.id)).size !== agencies.length ||
    legs.length !== agencies.length
  )
    return 'Invalid participant cycle.';
  for (let i = 0; i < agencies.length; i++) {
    const a = agencies[i],
      next = agencies[(i + 1) % agencies.length],
      out = legs[i],
      inc = legs[(i + legs.length - 1) % legs.length];
    if (
      !a.active ||
      out.from !== a.id ||
      out.to !== next.id ||
      out.service !== a.offer ||
      a.offer !== next.need
    )
      return 'The proposal does not follow the current graph path.';
    if (
      !Number.isFinite(out.hours) ||
      out.hours * 4 !== Math.round(out.hours * 4) ||
      out.hours < next.minReceiveHours ||
      out.hours > next.requestHours
    )
      return 'Proposed hours violate the recipient scope limits.';
    if (out.hours > a.capacityHours - a.reservedHours - a.committedHours)
      return 'Proposed hours exceed available capacity.';
    if (out.deliveryDays !== a.deliveryDays || inc.deliveryDays > a.deadlineDays)
      return 'Proposed delivery violates a deadline.';
    if (
      out.credits !== out.hours * a.hourlyCredits ||
      out.credits > inc.credits * (1 + a.maxImbalancePct / 100) + 0.001
    )
      return 'Proposed credits violate the value balance.';
  }
}
const floorQuarter = (n: number) => Math.floor((n + 1e-8) * 4) / 4;
export function negotiate(agencies: Agency[]): NegotiationResult {
  const events: NegotiationEvent[] = [];
  let rounds = 0;
  const legs: Leg[] = agencies.map((a, i) => ({
    from: a.id,
    to: agencies[(i + 1) % agencies.length].id,
    service: a.offer,
    hours: agencies[(i + 1) % agencies.length].requestHours,
    credits: agencies[(i + 1) % agencies.length].requestHours * a.hourlyCredits,
    deliveryDays: a.deliveryDays,
  }));
  const reject = (reason: string, actor = 'coordinator'): NegotiationResult => {
    events.push(event(actor, rounds, 'reject', reason));
    return { accepted: false, legs, events, rounds, reason };
  };
  if (
    agencies.length < 3 ||
    agencies.length > 4 ||
    new Set(agencies.map((a) => a.id)).size !== agencies.length
  )
    return reject('An exchange requires three or four distinct agencies.');
  for (let i = 0; i < agencies.length; i++) {
    const a = agencies[i],
      next = agencies[(i + 1) % agencies.length],
      prev = agencies[(i + agencies.length - 1) % agencies.length];
    if (!a.active) return reject(`${a.name} is unavailable.`, a.id);
    if (a.offer !== next.need)
      return reject(`${a.name}'s offer does not match ${next.name}'s need.`, a.id);
    if (prev.deliveryDays > a.deadlineDays)
      return reject(
        `${a.name}'s deadline is day ${a.deadlineDays}; ${prev.name} needs ${prev.deliveryDays} days.`,
        a.id,
      );
    events.push(
      event(
        a.id,
        0,
        'inspect',
        `Need ${a.minReceiveHours}–${a.requestHours}h of ${a.need} by day ${a.deadlineDays}. Available to give: ${Math.max(0, a.capacityHours - a.reservedHours - a.committedHours)}h.`,
      ),
    );
  }
  for (rounds = 1; rounds <= 6; rounds++) {
    let changed = false;
    for (let i = 0; i < agencies.length; i++) {
      const a = agencies[i],
        next = agencies[(i + 1) % agencies.length];
      const outgoing = legs[i],
        incoming = legs[(i + legs.length - 1) % legs.length];
      if (incoming.hours < a.minReceiveHours)
        return reject(
          `${a.name} requires at least ${a.minReceiveHours}h; the incoming offer is ${incoming.hours}h.`,
          a.id,
        );
      const capacity = Math.max(0, a.capacityHours - a.reservedHours - a.committedHours);
      const valueLimit = floorQuarter(
        (incoming.credits * (1 + a.maxImbalancePct / 100)) / a.hourlyCredits,
      );
      const allowed = floorQuarter(Math.min(outgoing.hours, capacity, valueLimit));
      if (allowed < next.minReceiveHours)
        return reject(
          `${a.name} can offer ${allowed}h within capacity and credit limits, below ${next.name}'s ${next.minReceiveHours}h minimum.`,
          a.id,
        );
      if (allowed < outgoing.hours) {
        const before = outgoing.hours;
        outgoing.hours = allowed;
        outgoing.credits = allowed * a.hourlyCredits;
        changed = true;
        events.push(
          event(
            a.id,
            rounds,
            'counter',
            `Counter ${before}h → ${allowed}h of ${a.offer}. Keep capacity available and outgoing value within ${a.maxImbalancePct}% of incoming value.`,
          ),
        );
      }
    }
    if (!changed) {
      agencies.forEach((a, i) => {
        const out = legs[i],
          inc = legs[(i + legs.length - 1) % legs.length];
        events.push(
          event(
            a.id,
            rounds,
            'accept',
            `Accept: give ${out.hours}h (${out.credits} credits), receive ${inc.hours}h (${inc.credits} credits) by day ${inc.deliveryDays}. All policy checks pass.`,
          ),
        );
      });
      return { accepted: true, legs, events, rounds };
    }
  }
  rounds = 6;
  return reject('No stable agreement within six negotiation rounds. No capacity was reserved.');
}
