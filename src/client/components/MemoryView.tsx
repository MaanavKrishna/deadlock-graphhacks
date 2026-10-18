import { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, ArrowRight, ExternalLink } from 'lucide-react';
import type { Snapshot, Deal } from '../../shared/types';
import { memoryComparison } from '../../shared/comparison';
import { Counter } from './StatsRow';
export default function MemoryView({
  state,
  onOpen,
}: {
  state: Snapshot;
  onOpen: (d: Deal) => void;
}) {
  const [selected, setSelected] = useState('');
  const current =
    selected || state.lessons.find((l) => l.active !== false)?.agencyId || state.agencies[0]?.id;
  const agency = state.agencies.find((a) => a.id === current),
    comparison = memoryComparison(state.deals, current);
  return (
    <section className="memory-view v2">
      <div className="section-title">
        <div>
          <h2>Memory that changes the next decision</h2>
          <p>Participant feedback becomes source-backed preferences. Hard limits stay unchanged.</p>
        </div>
        <span className="quiet-pill">
          <BookOpen size={14} />
          {state.lessons.filter((l) => l.active !== false).length} active lessons
        </span>
      </div>
      <div className="activity-summary">
        {[
          ['Active lessons', state.lessons.filter((l) => l.active !== false).length],
          ['Superseded lessons', state.lessons.filter((l) => l.active === false).length],
          [
            'Insights in force',
            state.insights.filter(
              (i) => state.agencies.find((a) => a.id === i.agencyId)?.revision === i.revision,
            ).length,
          ],
          ['Committed agreements', state.deals.filter((d) => d.status === 'committed').length],
        ].map(([label, value]) => (
          <div className="stat-tile" key={label as string}>
            <span>{label}</span>
            <strong>
              <Counter value={value as number} />
            </strong>
          </div>
        ))}
      </div>
      <div className="memory-comparison">
        <div className="memory-comparison-heading">
          <h3>Same constraints. Different context.</h3>
          <label>
            Compare agency
            <select
              aria-label="Compare agency"
              value={current}
              onChange={(e) => setSelected(e.target.value)}
            >
              {state.agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {comparison ? (
          <>
            <div className="comparison-columns">
              {[
                { label: 'Memory disabled', deal: comparison.without },
                { label: 'Memory enabled', deal: comparison.withMemory },
              ].map(({ label, deal }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: label === 'Memory enabled' ? 0.15 : 0 }}
                  className={label === 'Memory enabled' ? 'with-memory' : ''}
                >
                  <span>{label}</span>
                  <strong>{deal.legs.find((l) => l.to === current)?.hours}h</strong>
                  <p>{agency?.name} receives</p>
                  <button className="text-button" onClick={() => onOpen(deal)}>
                    Inspect agreement {deal.id.slice(0, 8)} <ExternalLink size={12} />
                  </button>
                </motion.div>
              ))}
            </div>
            <p className="comparison-proof">
              Matched path, execution mode, model identity where applicable, profiles and available
              capacity. These are recorded outcomes, not estimated savings.
            </p>
          </>
        ) : (
          <div className="memory-empty">
            <BookOpen size={25} />
            <p>
              To see a controlled comparison, negotiate with memory off, cancel to release capacity,
              record a preference, then negotiate the same path with memory on using the same mode.
            </p>
          </div>
        )}
      </div>
      <div className="lesson-list">
        {state.lessons.length === 0 ? (
          <div className="large-empty">
            <h3>Teach a representative after its first negotiation.</h3>
            <p>
              Open an agreement and record the received scope that participant would prefer next
              time.
            </p>
          </div>
        ) : (
          state.lessons.map((lesson) => {
            const a = state.agencies.find((a) => a.id === lesson.agencyId),
              source = state.deals.find((d) => d.id === lesson.dealId);
            return (
              <motion.article
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                key={lesson.id}
                className={`lesson-card ${lesson.active === false ? 'superseded' : ''}`}
              >
                <div>
                  <strong>{a?.name ?? lesson.agencyId}</strong>
                  <span className="quiet-pill">
                    {lesson.active === false ? 'Superseded' : 'Active preference'}
                  </span>
                </div>
                <p>{lesson.statement}</p>
                <div className="lesson-source">
                  <span>Lesson {lesson.id.slice(0, 8)}</span>
                  <ArrowRight size={13} />
                  <button
                    className="text-button"
                    disabled={!source}
                    onClick={() => source && onOpen(source)}
                  >
                    Source negotiation {lesson.dealId.slice(0, 8)}
                  </button>
                </div>
                <small>
                  {state.synthetic
                    ? 'Feedback on example agencies. '
                    : 'Participant-entered feedback. '}
                  It changes future objectives, not hard limits.
                </small>
              </motion.article>
            );
          })
        )}
      </div>
      <div className="section-title">
        <div>
          <h2>Learned from outcomes</h2>
          <p>
            Written automatically. Committed agreements become TRADED_WITH partner edges; failed
            negotiations become insights that discovery flags until the blocking profile changes.
          </p>
        </div>
      </div>
      <div className="lesson-list">
        {state.insights.length === 0 ? (
          <div className="large-empty">
            <h3>No outcomes recorded yet.</h3>
            <p>Failed negotiations and completed partnerships will appear here.</p>
          </div>
        ) : (
          state.insights.map((insight) => {
            const a = state.agencies.find((a) => a.id === insight.agencyId),
              source = state.deals.find((d) => d.id === insight.dealId),
              stale = a ? a.revision !== insight.revision : true;
            return (
              <motion.article
                key={insight.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`lesson-card ${stale ? 'superseded' : ''}`}
              >
                <div>
                  <strong>{a?.name ?? insight.agencyId}</strong>
                  <span>{stale ? 'Profile changed since' : 'Applies to current profile'}</span>
                </div>
                <p>{insight.reason}</p>
                <div className="lesson-source">
                  <span>Insight {insight.id.slice(0, 8)}</span>
                  {source && (
                    <button className="text-button" onClick={() => onOpen(source)}>
                      Source negotiation {insight.dealId.slice(0, 8)}
                    </button>
                  )}
                </div>
              </motion.article>
            );
          })
        )}
      </div>
    </section>
  );
}
