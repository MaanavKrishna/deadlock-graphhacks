import { useState } from 'react';
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
  onNegotiate: () => void;
  onApprove: (id: string) => void;
  onCancel: () => void;
  onWithdraw: (a: Agency) => void;
  onReroute: () => void;
};
export default function NegotiationRoom({
  candidate,
  deal,
  agencies,
  busy,
  onNegotiate,
  onApprove,
  onCancel,
  onWithdraw,
  onReroute,
}: Props) {
  const [tab, setTab] = useState<'agreement' | 'conversation'>('agreement');
  const members =
    deal?.participants ??
    candidate?.agencyIds.map((id) => agencies.find((a) => a.id === id)!).filter(Boolean) ??
    [];
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
              {deal.events.map((e) => {
                const a = members.find((a) => a.id === e.actor);
                return (
                  <div key={e.id} className={`log-entry ${e.action}`}>
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
                        <strong>
                          {a?.name ?? (e.actor === 'advisor' ? 'Model advisor' : 'Coordinator')}
                        </strong>
                        <span>{e.round === 0 ? 'Context' : `Round ${e.round}`}</span>
                      </div>
                      <span className={`action-label ${e.action}`}>{e.action}</span>
                      <p>{e.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="room-actions">
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
                    Simulate withdrawal
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
                  <p>Capacity committed together in the sandbox.</p>
                </div>
              </div>
            )}
            {deal && (
              <a className="export-button" href={`/api/deals/${deal.id}/export`} download>
                <Download size={14} />
                Download agreement & evidence
              </a>
            )}
            <p className="sandbox-note">Synthetic agencies. No money or services transferred.</p>
          </div>
        </>
      )}
    </aside>
  );
}
