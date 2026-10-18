import { describe, it, expect } from 'vitest';
import { canonicalCycle, negotiate } from '../src/server/negotiation';
import type { Agency } from '../src/shared/types';

const a = (
  id: string,
  offer: Agency['offer'],
  need: Agency['need'],
  extra: Partial<Agency> = {},
): Agency => ({
  id,
  name: id,
  initials: id,
  color: '#5652d6',
  description: 'Test fixture',
  offer,
  need,
  active: true,
  capacityHours: 12,
  reservedHours: 0,
  committedHours: 0,
  requestHours: 10,
  minReceiveHours: 6,
  hourlyCredits: 100,
  maxImbalancePct: 10,
  deliveryDays: 3,
  deadlineDays: 7,
  revision: 1,
  ...extra,
});
const cycle = () => [a('a', 'design', 'copy'), a('b', 'video', 'design'), a('c', 'copy', 'video')];
describe('negotiation policies', () => {
  it('deduplicates rotations without merging reversed cycles', () => {
    expect(canonicalCycle(['b', 'c', 'a'])).toBe(canonicalCycle(['a', 'b', 'c']));
    expect(canonicalCycle(['a', 'c', 'b'])).not.toBe(canonicalCycle(['a', 'b', 'c']));
  });
  it('accepts a three-party exchange with explicit participant decisions', () => {
    const result = negotiate(cycle());
    expect(result.accepted).toBe(true);
    expect(result.legs).toHaveLength(3);
    expect(result.events.filter((e) => e.action === 'accept')).toHaveLength(3);
    expect(result.legs[0]).toMatchObject({ from: 'a', to: 'b', hours: 10, credits: 1000 });
  });
  it('counters within available capacity and recipient minimums', () => {
    const agencies = cycle();
    agencies[0].reservedHours = 4;
    const result = negotiate(agencies);
    expect(result.accepted).toBe(true);
    expect(result.legs[0].hours).toBeLessThanOrEqual(8);
    expect(result.events.some((e) => e.action === 'counter')).toBe(true);
  });
  it('rejects impossible delivery rather than inventing a new deadline', () => {
    const agencies = cycle();
    agencies[0].deliveryDays = 9;
    expect(negotiate(agencies)).toMatchObject({
      accepted: false,
      reason: expect.stringContaining('deadline'),
    });
  });
  it('rejects a recipient minimum above available provider capacity', () => {
    const agencies = cycle();
    agencies[0].capacityHours = 4;
    expect(negotiate(agencies).accepted).toBe(false);
  });
  it('rejects direct pairs, repeated agencies and incompatible service paths', () => {
    expect(negotiate(cycle().slice(0, 2)).accepted).toBe(false);
    expect(negotiate([cycle()[0], cycle()[1], cycle()[0]]).accepted).toBe(false);
    const agencies = cycle();
    agencies[0].offer = 'development';
    expect(negotiate(agencies).accepted).toBe(false);
  });
  it('enforces value balance for every accepted participant', () => {
    const agencies = cycle();
    agencies[0].hourlyCredits = 140;
    const result = negotiate(agencies);
    expect(result.accepted).toBe(true);
    if (result.accepted)
      for (let i = 0; i < 3; i++) {
        expect(result.legs[i].credits).toBeLessThanOrEqual(
          result.legs[(i + 2) % 3].credits * 1.1 + 0.01,
        );
        expect(result.legs[(i + 2) % 3].hours).toBeGreaterThanOrEqual(agencies[i].minReceiveHours);
      }
    expect(result.events.length).toBeGreaterThan(0);
  });
});
