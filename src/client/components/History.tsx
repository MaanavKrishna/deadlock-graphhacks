import { ArrowUpRight, GitBranch, History as HistoryIcon } from 'lucide-react';
import type { Deal, Run } from '../../shared/types';
import { Avatar } from './Network';
import { statusNames } from './NegotiationRoom';
export default function History({
  deals,
  runs,
  onOpen,
}: {
  deals: Deal[];
  runs: Run[];
  onOpen: (d: Deal) => void;
}) {
  return (
    <section>
      <div className="section-title">
        <div>
          <h2>Every decision has a history</h2>
          <p>
            {runs.length} graph searches. {deals.length} negotiations. Context that stays.
          </p>
        </div>
        <span className="quiet-pill">
          <HistoryIcon size={14} />
          Persistent memory
        </span>
      </div>
      {!deals.length ? (
        <div className="large-empty">
          <HistoryIcon size={34} />
          <h3>A clean slate, ready for connections.</h3>
          <p>Discover an exchange and start a negotiation. Every decision will appear here.</p>
        </div>
      ) : (
        <div className="history-list">
          {deals.map((d) => (
            <button className="history-row" key={d.id} onClick={() => onOpen(d)}>
              <div className="avatar-stack">
                {d.participants.map((a) => (
                  <Avatar key={a.id} agency={a} small />
                ))}
              </div>
              <div className="history-description">
                <strong>{d.participants.map((a) => a.name).join(' / ')}</strong>
                <span>
                  {new Date(d.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {d.rounds} rounds · {d.events.length} recorded decisions
                </span>
              </div>
              <span className={`status-label ${d.status}`}>{statusNames[d.status]}</span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
