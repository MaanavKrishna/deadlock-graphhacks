import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  X,
  Clock3,
} from 'lucide-react';
import type { Agency, Candidate, Deal } from '../../shared/types';
import { serviceNames } from '../../shared/types';
import { Avatar } from './Network';

export const statusNames: Record<Deal['status'], string> = {
  negotiating: 'Negotiating',
  rejected: 'No agreement',
  awaiting_approval: 'Awaiting approval',
  committed: 'Committed',
  cancelled: 'Cancelled',
  invalidated: 'Needs a new path',
};
type Props = {
  candidate?: Candidate;
  deal?: Deal;
  agencies: Agency[];
  busy: boolean;
  sampleData: boolean;
  onNegotiate: () => void;
  onApprove: (id: string) => void;
  onCancel: () => void;
  onWithdraw: (a: Agency) => void;
  onReroute: () => void;
  onRemember: (agencyId: string, hours: number) => void;
};
export default function NegotiationRoom({
  candidate,
  deal,
  agencies,
  busy,
  sampleData,
  onNegotiate,
  onApprove,
  onCancel,
  onWithdraw,
  onReroute,
  onRemember,
}: Props) {
  const [tab, setTab] = useState<'agreement' | 'conversation'>('agreement');
  const members =
    deal?.participants ??
    candidate?.agencyIds.map((id) => agencies.find((a) => a.id === id)!).filter(Boolean) ??
    [];
  const [teach, setTeach] = useState(false),
    [scopeAgency, setScopeAgency] = useState(''),
    [preferredHours, setPreferredHours] = useState(8);
  useEffect(() => {
    setTeach(false);
    setScopeAgency(
      deal?.agencyIds.includes('studio-north') ? 'studio-north' : (deal?.agencyIds[0] ?? ''),
    );
    setPreferredHours(8);
  }, [deal?.id]);
  return (
    <aside className="room">
      <div className="room-heading">
        <span className="room-icon">
          <GitBranch size={20} />
        </span>
        <div>
          <h2>{deal ? 'Negotiation room' : 'A deal takes a network'}</h2>
          <p>
            {deal
              ? `Agreement ${deal.id.slice(0, 8)}`
              : 'One connection can unlock the whole exchange.'}
          </p>
        </div>
        {deal && <span className={`status-dot ${deal.status}`} />}
      </div>
      {!candidate && !deal ? (
        <div className="room-empty">
          <div className="empty-orbit">
            <i />
            <i />
            <i />
            <GitBranch size={32} />
          </div>
          <h3>Your next agreement starts here.</h3>
          <p>
            Discover an exchange to see who can help whom. Their agents will work out the terms
            together.
          </p>
          <div className="how-mini">
            <span>
              <b>1</b>Find a connected exchange
            </span>
            <span>
              <b>2</b>Let the agents negotiate
            </span>
            <span>
              <b>3</b>Every member approves
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="room-summary">
            {deal && (
              <div className="execution-label">
                {deal.executedMode === 'model'
                  ? `Live model · ${deal.modelIdentityKnown ? deal.model : `${deal.requestedModel ?? 'unknown'} (requested; actual identity unavailable)`}`
                  : 'Policy simulation'}
                {deal.proposalId && ` · ${deal.proposalId} proposal`}
                {` · memory ${deal.useMemory === false ? 'off' : 'on'}`}
              </div>
            )}
            <div className="avatar-stack">
              {members.map((a) => (
                <Avatar key={a.id} agency={a} small />
              ))}
            </div>
            <span className={`status-label ${deal?.status ?? ''}`}>
              {deal ? statusNames[deal.status] : `${members.length} members, one opportunity`}
            </span>
            <h3>
              {deal?.status === 'committed'
                ? 'A whole cycle. One agreement.'
                : deal?.status === 'invalidated'
                  ? 'A change is a new starting point.'
                  : 'Everyone brings something. Everyone gets something.'}
            </h3>
            <p>
              {deal?.reason ??
                (deal
                  ? 'Terms checked against each member’s capacity, deadline and credit limits.'
                  : 'An exchange becomes possible when the last connection closes the loop.')}
            </p>
          </div>
          {deal && (
            <div className="room-tabs" role="tablist" aria-label="Agreement details">
              <button
                role="tab"
                aria-selected={tab === 'agreement'}
                onClick={() => setTab('agreement')}
              >
                Agreement
              </button>
              <button
                role="tab"
                aria-selected={tab === 'conversation'}
                onClick={() => setTab('conversation')}
              >
                Agent log <span>{deal.events.length}</span>
              </button>
            </div>
          )}
          {!deal || tab === 'agreement' ? (
            <div className="terms-list">
              {members.map((a, i) => {
                const outgoing = deal?.legs.find((l) => l.from === a.id),
                  incoming = deal?.legs.find((l) => l.to === a.id),
                  approved = deal?.approvals.includes(a.id);
                return (
                  <div className="member-term" key={a.id}>
                    <div className="member-title">
                      <Avatar agency={a} small />
                      <strong>{a.name}</strong>
                      {approved && <Check size={15} className="green" />}
                    </div>
                    <div className="give-receive">
                      <div>
                        <span>Gives</span>
                        <strong>
                          {outgoing?.hours ?? members[(i + 1) % members.length].requestHours}h{' '}
                          {serviceNames[a.offer].toLowerCase()}
                        </strong>
                      </div>
                      <ArrowRight size={15} />
                      <div>
                        <span>Receives</span>
                        <strong>
                          {incoming?.hours ?? a.requestHours}h {serviceNames[a.need].toLowerCase()}
                        </strong>
                      </div>
                    </div>
                    {deal && (
                      <div className="term-meta">
                        <span>
                          <Clock3 size={12} />
                          Incoming by day {incoming?.deliveryDays}
                        </span>
                        <span>{outgoing?.credits.toLocaleString()} credits given</span>
                      </div>
                    )}
                    {deal?.status === 'awaiting_approval' && (
                      <button
                        className={`approval-button ${approved ? 'approved' : ''}`}
                        disabled={busy || approved}
                        onClick={() => onApprove(a.id)}
                      >
                        {approved ? (
                          <>
                            <CheckCheck size={14} />
                            Approval recorded
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={14} />
                            Approve for {a.name}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="agent-log">
              {deal.events.map((e, i) => {
                const a = members.find((a) => a.id === e.actor);
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.05, duration: 0.3 }}
                    className={`log-entry ${e.action}`}
                  >
                    <div className="log-marker">
                      {a ? (
                        <Avatar agency={a} small />
                      ) : e.action === 'commit' ? (
                        <CheckCheck size={15} />
                      ) : (
                        <GitBranch size={15} />
                      )}
                    </div>
                    <div>
                      <div className="log-title">
                        <strong>{a?.name ?? 'Coordinator'}</strong>
                        <span>{e.round === 0 ? 'Context' : `Round ${e.round}`}</span>
                      </div>
                      <span className={`action-label ${e.action}`}>{e.action}</span>
                      {e.tool && (
                        <code className="tool-label">
                          {e.tool}
                          {e.proposalId && `(${e.proposalId})`}
                        </code>
                      )}
                      <p>{e.reason}</p>
                      {!!e.evidenceIds?.length && (
                        <span className="lesson-citations">
                          Evidence: {e.evidenceIds.map((id) => id.slice(0, 8)).join(', ')}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          <div className="room-actions">
            {deal && (
              <div className="teach-agent">
                <button className="text-button" disabled={busy} onClick={() => setTeach(!teach)}>
                  {teach ? 'Close learning form' : 'Teach a scope preference'}
                </button>
                {teach && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onRemember(scopeAgency, preferredHours);
                    }}
                  >
                    <label>
                      Participant
                      <select
                        aria-label="Lesson participant"
                        value={scopeAgency}
                        onChange={(e) => setScopeAgency(e.target.value)}
                      >
                        {members.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Prefer receiving at most (hours)
                      <input
                        aria-label="Preferred received hours"
                        type="number"
                        required
                        min={0.25}
                        max={1000}
                        step={0.25}
                        value={preferredHours}
                        onChange={(e) => setPreferredHours(Number(e.target.value))}
                      />
                    </label>
                    <button className="secondary" disabled={busy}>
                      Remember preference
                    </button>
                    <p>
                      This records participant feedback for future negotiations. Cancel pending
                      proposals to free capacity before rerunning.
                    </p>
                  </form>
                )}
              </div>
            )}
            {!deal && (
              <>
                <div className="policy-note">
                  <ShieldCheck size={15} />
                  <span>Each member’s limits stay in control.</span>
                </div>
                <button className="primary full" disabled={busy} onClick={onNegotiate}>
                  <MessageSquare size={16} />
                  {busy ? 'Agents are working…' : 'Start negotiation'}
                </button>
              </>
            )}
            {deal?.status === 'awaiting_approval' && (
              <>
                <div
                  className="approval-meter"
                  role="progressbar"
                  aria-label="Human approvals"
                  aria-valuemin={0}
                  aria-valuemax={members.length}
                  aria-valuenow={deal.approvals.length}
                >
                  <motion.i
                    initial={false}
                    animate={{ width: `${(deal.approvals.length / members.length) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
                <p className="approval-note">
                  {deal.approvals.length} of {members.length} human approvals. Capacity is held; the
                  whole cycle commits after the final approval.
                </p>
                <div className="split-actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      const a =
                        agencies.find(
                          (a) =>
                            a.id ===
                            deal.agencyIds.find(
                              (id) => agencies.find((x) => x.id === id)?.offer === 'video',
                            ),
                        ) ?? agencies.find((a) => a.id === deal.agencyIds[0]);
                      if (a) onWithdraw(a);
                    }}
                  >
                    Pause an agency
                  </button>
                  <button className="text-button danger" disabled={busy} onClick={onCancel}>
                    Cancel
                  </button>
                </div>
              </>
            )}
            {deal && ['invalidated', 'rejected', 'cancelled'].includes(deal.status) && (
              <button className="primary full" disabled={busy} onClick={onReroute}>
                <GitBranch size={16} />
                Find another path
              </button>
            )}
            {deal?.status === 'committed' && (
              <div className="committed-note">
                <ShieldCheck size={19} />
                <div>
                  <strong>All members approved</strong>
                  <p>Capacity committed together in the workspace.</p>
                </div>
              </div>
            )}
            {deal && (
              <a className="export-button" href={`/api/deals/${deal.id}/export`} download>
                <Download size={14} />
                Download agreement & evidence
              </a>
            )}
            <p className="sandbox-note">
              {sampleData ? 'Example agencies are synthetic. ' : ''}Capacity agreements only; no
              money moves.
            </p>
          </div>
        </>
      )}
    </aside>
  );
}
