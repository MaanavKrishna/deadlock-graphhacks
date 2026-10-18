import { it, expect } from 'vitest';
import { memoryComparison } from '../src/shared/comparison';
import type { Deal } from '../src/shared/types';
import { seedAgencies } from '../src/server/seed';
const base = () =>
  ({
    id: 'before',
    agencyIds: ['studio-north', 'motionhaus', 'wordcraft'],
    participants: seedAgencies().filter((a) =>
      ['studio-north', 'motionhaus', 'wordcraft'].includes(a.id),
    ),
    status: 'cancelled',
    executedMode: 'policy',
    useMemory: false,
    legs: [],
    createdAt: '2026-10-18T10:00:00Z',
  }) as unknown as Deal;
it('compares only matching profiles, available capacity, path and execution mode', () => {
  const without = base(),
    withMemory = { ...base(), id: 'after', useMemory: true, createdAt: '2026-10-18T11:00:00Z' };
  expect(memoryComparison([withMemory, without], 'studio-north')?.withMemory.id).toBe('after');
  const changed = structuredClone(withMemory);
  changed.participants[0].reservedHours = 3;
  expect(memoryComparison([changed, without], 'studio-north')).toBeUndefined();
  expect(
    memoryComparison([{ ...withMemory, executedMode: 'model' }, without], 'studio-north'),
  ).toBeUndefined();
});

it('requires the same known provider-reported model for a model comparison', () => {
  const without = {
    ...base(),
    executedMode: 'model' as const,
    model: 'actual-A',
    requestedModel: 'alias',
    modelIdentityKnown: true,
  };
  const withMemory = { ...without, id: 'after', useMemory: true };
  expect(memoryComparison([without, withMemory], 'studio-north')).toBeDefined();
  expect(
    memoryComparison([without, { ...withMemory, model: 'actual-B' }], 'studio-north'),
  ).toBeUndefined();
  expect(
    memoryComparison([without, { ...withMemory, modelIdentityKnown: false }], 'studio-north'),
  ).toBeUndefined();
});
