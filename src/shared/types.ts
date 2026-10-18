export const services = ['design', 'video', 'copy', 'development'] as const;
export type Service = (typeof services)[number];
export interface Agency {
  id: string;
  name: string;
  initials: string;
  color: string;
  description: string;
  offer: Service;
  need: Service;
  active: boolean;
  capacityHours: number;
  reservedHours: number;
  committedHours: number;
  requestHours: number;
  minReceiveHours: number;
  hourlyCredits: number;
  maxImbalancePct: number;
  deliveryDays: number;
  deadlineDays: number;
  revision: number;
}
export interface Leg {
  from: string;
  to: string;
  service: Service;
  hours: number;
  credits: number;
  deliveryDays: number;
}
export type DealStatus =
  'negotiating' | 'rejected' | 'awaiting_approval' | 'committed' | 'cancelled' | 'invalidated';
export interface NegotiationEvent {
  id: string;
  actor: string;
  round: number;
  action:
    | 'inspect'
    | 'counter'
    | 'accept'
    | 'reject'
    | 'reserve'
    | 'approve'
    | 'commit'
    | 'cancel'
    | 'invalidate'
    | 'advisor';
  reason: string;
  at: string;
}
export interface Deal {
  id: string;
  runId: string;
  title: string;
  status: DealStatus;
  createdAt: string;
  updatedAt: string;
  agencyIds: string[];
  participants: Agency[];
  legs: Leg[];
  events: NegotiationEvent[];
  approvals: string[];
  rounds: number;
  reason?: string;
  totalCredits: number;
}
export interface Candidate {
  id: string;
  agencyIds: string[];
  names: string[];
  estimatedCredits: number;
  feasible: boolean;
  reason?: string;
}
export interface Run {
  id: string;
  createdAt: string;
  candidates: Candidate[];
  query: string;
  durationMs: number;
}
export interface Snapshot {
  agencies: Agency[];
  deals: Deal[];
  runs: Run[];
  database: string;
  agentMode: string;
  synthetic: true;
}
export interface NegotiationResult {
  accepted: boolean;
  legs: Leg[];
  events: NegotiationEvent[];
  rounds: number;
  reason?: string;
}
export const serviceNames: Record<Service, string> = {
  design: 'Brand design',
  video: 'Video production',
  copy: 'Copywriting',
  development: 'Web development',
};
