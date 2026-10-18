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
    | 'invalidate';
  reason: string;
  at: string;
  tool?: string;
  proposalId?: string;
  evidenceIds?: string[];
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
  requestedMode?: 'policy' | 'model';
  executedMode?: 'policy' | 'model';
  model?: string;
  requestedModel?: string;
  modelProvider?: string;
  modelIdentityKnown?: boolean;
  useMemory?: boolean;
  lessonIds?: string[];
  proposalId?: string;
}
export interface Candidate {
  id: string;
  agencyIds: string[];
  names: string[];
  estimatedCredits: number;
  feasible: boolean;
  reason?: string;
  // Graph memory consulted at discovery time.
  history?: {
    tradedLegs: number;
    sourceDealIds: string[];
    priorFailures: { agencyId: string; dealId: string; reason?: string }[];
  };
}
export interface Run {
  id: string;
  createdAt: string;
  candidates: Candidate[];
  query: string;
  durationMs: number;
}
export interface GraphEdge {
  from: string;
  to: string;
  service: Service;
}
export interface LoopStats {
  total: number;
  byAgency: Record<string, number>;
  // Agencies that every current loop runs through.
  keystoneIds: string[];
}
export interface Impact {
  agencyId: string;
  loopsBefore: number;
  loopsAfter: number;
  broken: { agencyIds: string[]; names: string[] }[];
  pendingDeals: { id: string; title: string; heldHours: number }[];
  releasedHours: number;
  reroutes: { agencyId: string; loops: number }[];
  stranded: string[];
}
export interface Snapshot {
  agencies: Agency[];
  loops: LoopStats;
  // Directed CAN_SERVE relationships as stored in FalkorDB.
  edges: GraphEdge[];
  deals: Deal[];
  runs: Run[];
  database: string;
  agentMode: string;
  synthetic: boolean;
  modelConfigured?: boolean;
  modelName?: string;
  lessons: Lesson[];
  insights: Insight[];
  scenario?: 'starter' | 'launch' | 'custom';
  accessRequired?: boolean;
}
export interface NegotiationResult {
  reportedModels?: string[];
  modelIdentityKnown?: boolean;
  accepted: boolean;
  legs: Leg[];
  events: NegotiationEvent[];
  rounds: number;
  reason?: string;
  proposalId?: string;
}
export interface Proposal {
  id: string;
  label: string;
  legs: Leg[];
}
export interface Lesson {
  id: string;
  agencyId: string;
  dealId: string;
  preferredHours: number;
  statement: string;
  createdAt: string;
  active?: boolean;
}
// Episodic memory written automatically when a negotiation fails. It applies only while
// the blocking agency's profile revision is unchanged.
export interface Insight {
  id: string;
  agencyId: string;
  dealId: string;
  loopKey: string;
  reason: string;
  revision: number;
  createdAt: string;
}
export interface GrowthOption {
  offer: Service;
  need: Service;
  newLoops: number;
  examples: string[][];
  // True when some new loop avoids every current keystone agency.
  reducesKeystone: boolean;
}
export interface Source {
  type: 'agency' | 'deal' | 'lesson' | 'insight' | 'loop';
  id: string;
  label: string;
}
export interface Answer {
  question: string;
  answer: string;
  sources: Source[];
  trace: { tool: string; args: unknown; resultCount: number }[];
  model?: string;
}
export interface AgentContext {
  agency: Agency;
  participants: Agency[];
  current: Proposal;
  proposals: Proposal[];
  lessons: Lesson[];
  useMemory: boolean;
  round: number;
}
export interface AgentDecision {
  reportedModels?: string[];
  modelIdentityKnown?: boolean;
  tool: 'accept_offer' | 'counter_offer' | 'reject_offer';
  proposalId?: string;
  reason: string;
  trace?: { tool: string; reason: string; evidenceIds?: string[] }[];
}
export interface NegotiationOptions {
  mode?: 'policy' | 'model';
  useMemory?: boolean;
}
export const serviceNames: Record<Service, string> = {
  design: 'Brand design',
  video: 'Video production',
  copy: 'Copywriting',
  development: 'Web development',
};
