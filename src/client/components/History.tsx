import { ArrowUpRight, History as HistoryIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { Deal, DealStatus, Run } from '../../shared/types';
import { Avatar } from './Network';
import { statusNames } from './NegotiationRoom';
import { Counter } from './StatsRow';

const order: DealStatus[] = [
  'awaiting_approval',
  'committed',
  'rejected',
  'invalidated',
  'cancelled',
];

export default function History({
  deals,
  runs,
  onOpen,
}: {
  deals: Deal[];
  runs: Run[];
  onOpen: (d: Deal) => void;
}) {
  const count = (s: DealStatus) => deals.filter((d) => d.status === s).length;
  return (
    <section className="activity v2">
      <div className="activity-summary">
        <div className="stat-tile">
          <span>Graph searches</span>
          <strong>
            <Counter value={runs.length} />
          </strong>
        </div>
        {order.map((s) => (
          <div key={s} className={`stat-tile ${count(s) ? `status-${s}` : ''}`}>
            <span>{statusNames[s]}</span>
            <strong>
              <Counter value={count(s)} />
            </strong>
          </div>
        ))}
      </div>
      {!deals.length ? (
        <div className="large-empty">
          <HistoryIcon size={34} />
          <h3>Nothing negotiated yet.</h3>
          <p>Find loops on the exchange desk and start a negotiation. Every decision lands here.</p>
        </div>
      ) : (
        <motion.ol
          className="timeline"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
        >
          {deals.map((d) => (
            <motion.li
              key={d.id}
              variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}
            >
              <span className={`timeline-dot ${d.status}`} aria-hidden="true" />
              <motion.button
                className="timeline-card"
                whileHover={{ x: 4 }}
                onClick={() => onOpen(d)}
              >
                <div className="avatar-stack">
                  {d.participants.map((a) => (
                    <Avatar key={a.id} agency={a} small />
                  ))}
                </div>
                <div className="history-description">
                  <strong>{d.participants.map((a) => a.name).join(' → ')}</strong>
                  <span>
                    {new Date(d.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {d.executedMode === 'model' ? 'Claude agents' : 'Policy agents'} · memory{' '}
                    {d.useMemory === false ? 'off' : 'on'} · {d.rounds} rounds ·{' '}
                    {d.legs.reduce((n, l) => n + l.hours, 0)}h
                  </span>
                  {d.reason && <em>{d.reason}</em>}
                </div>
                <span className={`status-label ${d.status}`}>{statusNames[d.status]}</span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </motion.button>
            </motion.li>
          ))}
        </motion.ol>
      )}
    </section>
  );
}
