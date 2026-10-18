import type { Agency } from '../shared/types';
import { seedAgencies } from './seed';
export function showcaseAgencies(): Agency[] {
  const agencies = seedAgencies();
  for (const a of agencies) a.maxImbalancePct = 20;
  Object.assign(
    agencies.find((a) => a.id === 'studio-north')!,
    {
      hourlyCredits: 110,
      requestHours: 9,
      deadlineDays: 5,
      description:
        'Launch a new brand. Prefer the largest useful scope that respects remembered participant feedback.',
    },
  );
  Object.assign(
    agencies.find((a) => a.id === 'motionhaus')!,
    { hourlyCredits: 125, capacityHours: 10 },
  );
  Object.assign(
    agencies.find((a) => a.id === 'wordcraft')!,
    { hourlyCredits: 95, requestHours: 12, deadlineDays: 4 },
  );
  Object.assign(
    agencies.find((a) => a.id === 'frame-lab')!,
    { hourlyCredits: 90, requestHours: 8, maxImbalancePct: 25 },
  );
  Object.assign(
    agencies.find((a) => a.id === 'pixel-forge')!,
    { hourlyCredits: 110 },
  );
  const base = seedAgencies()[0];
  agencies.push(
    {
      ...base,
      id: 'orbit-films',
      name: 'Orbit Films',
      initials: 'OF',
      color: '#b57e53',
      offer: 'video',
      need: 'design',
      hourlyCredits: 120,
      capacityHours: 10,
      requestHours: 11,
      deliveryDays: 3,
      deadlineDays: 7,
      maxImbalancePct: 20,
      description: 'Film studio with ten hours free before launch.',
    },
    {
      ...base,
      id: 'shipyard',
      name: 'Shipyard',
      initials: 'SY',
      color: '#4f839f',
      offer: 'development',
      need: 'video',
      hourlyCredits: 90,
      capacityHours: 14,
      requestHours: 10,
      deliveryDays: 4,
      deadlineDays: 6,
      maxImbalancePct: 20,
      description: 'Developers trading a launch site for product footage.',
    },
    {
      ...base,
      id: 'signal-press',
      name: 'Signal Press',
      initials: 'SP',
      color: '#a87aa6',
      offer: 'copy',
      need: 'development',
      hourlyCredits: 100,
      capacityHours: 11,
      requestHours: 12,
      deliveryDays: 2,
      deadlineDays: 7,
      maxImbalancePct: 20,
      description: 'Editorial team exchanging copy for a launch microsite.',
    },
    {
      ...base,
      id: 'premiere',
      name: 'Premiere',
      initials: 'PR',
      color: '#a36767',
      offer: 'video',
      need: 'design',
      hourlyCredits: 180,
      capacityHours: 20,
      requestHours: 14,
      deliveryDays: 9,
      deadlineDays: 7,
      maxImbalancePct: 20,
      description:
        'High-value production offer whose nine-day turnaround misses the launch deadline.',
    },
  );
  return agencies;
}
