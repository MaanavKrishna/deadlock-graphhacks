import { AnimatePresence, motion } from 'motion/react';
import { LoaderCircle } from 'lucide-react';
import type { Agency, NegotiationEvent } from '../../shared/types';

// Representative decisions streamed from the server while the negotiation runs.
export default function LiveFeed({
  events,
  agencies,
  mode,
}: {
  events: NegotiationEvent[];
  agencies: Agency[];
  mode: 'policy' | 'model';
}) {
  const name = (id: string) => agencies.find((a) => a.id === id)?.name ?? 'Coordinator';
  return (
    <section className="live-feed" aria-live="polite" aria-label="Live negotiation">
      <header>
        <LoaderCircle size={16} className="spin" aria-hidden="true" />
        <strong>
          {mode === 'model' ? 'Claude representatives negotiating' : 'Representatives negotiating'}
        </strong>
        <span>{events.length} decisions</span>
      </header>
      <ol>
        <AnimatePresence initial={false}>
          {events.map((e) => (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className={`live-${e.action}`}
            >
              <span className="live-meta">
                <b>{name(e.actor)}</b>
                {e.tool && <code>{e.tool}</code>}
                <em>R{e.round}</em>
              </span>
              <span className="live-reason">{e.reason}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {events.length === 0 && <p className="live-wait">Reading the graph context…</p>}
    </section>
  );
}
