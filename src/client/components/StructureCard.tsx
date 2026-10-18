import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Waypoints } from 'lucide-react';
import type { NetworkStructure } from '../../shared/types';
import { api } from '../api';

// Results of FalkorDB's built-in graph algorithms, recomputed when profiles change.
export default function StructureCard({ version }: { version: string }) {
  const [data, setData] = useState<NetworkStructure>();
  useEffect(() => {
    api<NetworkStructure>('/structure')
      .then(setData)
      .catch(() => setData(undefined));
  }, [version]);
  if (!data || data.agencies.length === 0) return null;
  const maxB = Math.max(...data.agencies.map((a) => a.betweenness), 1);
  const maxR = Math.max(...data.agencies.map((a) => a.pageRank), 0.001);
  const name = (id?: string) => data.agencies.find((a) => a.id === id)?.name ?? id;
  return (
    <section className="structure-card" aria-label="Network structure">
      <div className="growth-head">
        <Waypoints size={18} aria-hidden="true" />
        <h2>Network structure</h2>
        <span className="structure-algos">{data.algorithms.join(' · ')}</span>
      </div>
      <p>
        {data.broker ? (
          <>
            <b>{name(data.broker)}</b> brokers the most paths between other agencies (highest
            betweenness).{' '}
          </>
        ) : null}
        {data.components === 1 ? (
          'Every agency is reachable in one connected network.'
        ) : (
          <b className="structure-warn">
            {data.components} separate sub-networks can never trade with each other:{' '}
            {data.isolatedGroups.map((g) => g.map(name).join(', ')).join(' | ')}.
          </b>
        )}
      </p>
      <ol className="structure-bars">
        {data.agencies.map((a, i) => (
          <li key={a.id}>
            <span className="structure-name">{a.name}</span>
            <span className="structure-track" title={`Betweenness ${a.betweenness}`}>
              <motion.i
                initial={{ width: 0 }}
                animate={{ width: `${(a.betweenness / maxB) * 100}%` }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 120, damping: 20 }}
              />
            </span>
            <span className="structure-value">{a.betweenness}</span>
            <span className="structure-rank" title="PageRank">
              <motion.i
                initial={{ width: 0 }}
                animate={{ width: `${(a.pageRank / maxR) * 100}%` }}
                transition={{ delay: 0.2 + i * 0.05 }}
              />
            </span>
          </li>
        ))}
      </ol>
      <p className="structure-legend">
        <span className="legend-b" /> Betweenness (brokerage) <span className="legend-r" /> PageRank
        (incoming flow)
      </p>
    </section>
  );
}
