import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy } from 'lucide-react';
import type { Agency, Candidate } from '../../shared/types';
import { serviceNames } from '../../shared/types';
import { loopQuery } from '../../shared/loopQuery';

// Explainable result: every hop of the selected loop as the graph relationships that produced
// it, plus a query anyone can paste into FalkorDB to reproduce exactly this loop.
export default function LoopEvidence({
  candidate,
  agencies,
}: {
  candidate: Candidate;
  agencies: Agency[];
}) {
  const [copied, setCopied] = useState(false);
  const members = candidate.agencyIds.map((id) => agencies.find((a) => a.id === id));
  if (members.some((a) => !a)) return null;
  const loop = members as Agency[];
  const hops = loop.map((a, i) => ({ from: a, to: loop[(i + 1) % loop.length] }));
  const query = loopQuery(candidate.agencyIds);
  async function copy() {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <section className="loop-evidence" aria-label="Why the graph found this loop">
      <h3>Why the graph found this loop</h3>
      <ol>
        {hops.map(({ from, to }, i) => (
          <motion.li
            key={from.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <code>
              ({from.name})-[:OFFERS]→({serviceNames[from.offer]})←[:NEEDS]-({to.name})
            </code>
            <span>
              ⇒ <b>CAN_SERVE</b> · {from.name} delivers in {from.deliveryDays} days; {to.name} needs
              it by day {to.deadlineDays}
            </span>
          </motion.li>
        ))}
      </ol>
      <p className={`loop-evidence-result ${candidate.feasible ? '' : 'blocked'}`}>
        {candidate.feasible
          ? `Closed ${loop.length}-way path, all members active, every policy check passed at search.`
          : `Graph path exists, but a policy check fails: ${candidate.reason}`}
        {candidate.history?.tradedLegs
          ? ` ${candidate.history.tradedLegs} of ${loop.length} legs traded before.`
          : ''}
      </p>
      <div className="loop-evidence-query">
        <pre>{query}</pre>
        <button type="button" className="secondary" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy query'}
        </button>
      </div>
    </section>
  );
}
