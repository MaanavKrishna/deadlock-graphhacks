import { useEffect, useRef } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';
import type { Snapshot } from '../../shared/types';

function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = String(value);
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (node.textContent = String(Math.round(v * 4) / 4)),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span ref={ref}>{value}</span>;
}

// Live network health, every figure read from the graph snapshot.
export default function StatsRow({ state }: { state: Snapshot }) {
  const active = state.agencies.filter((a) => a.active).length;
  const held = state.agencies.reduce((n, a) => n + a.reservedHours, 0);
  const committed = state.agencies.reduce((n, a) => n + a.committedHours, 0);
  const keystones = state.loops.keystoneIds
    .map((id) => state.agencies.find((a) => a.id === id)?.name)
    .filter(Boolean);
  const tiles = [
    { label: 'Active agencies', value: <Counter value={active} /> },
    { label: 'Loops in the graph', value: <Counter value={state.loops.total} /> },
    {
      label: keystones.length === 1 ? 'Keystone' : 'Keystones',
      value: (
        <span className="stat-text">
          {keystones.length === 0
            ? 'None'
            : keystones.length > 2
              ? `${keystones.length} agencies`
              : keystones.join(', ')}
        </span>
      ),
    },
    { label: 'Hours held', value: <Counter value={held} />, tone: 'held' },
    { label: 'Hours committed', value: <Counter value={committed} />, tone: 'committed' },
  ];
  return (
    <motion.div
      className="stats-row"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      {tiles.map((t) => (
        <motion.div
          key={t.label}
          className={`stat-tile ${t.tone ?? ''}`}
          variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
        >
          <span>{t.label}</span>
          <strong>{t.value}</strong>
        </motion.div>
      ))}
    </motion.div>
  );
}
