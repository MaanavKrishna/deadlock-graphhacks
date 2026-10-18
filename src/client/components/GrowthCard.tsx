import { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';
import type { GrowthOption } from '../../shared/types';
import { serviceNames } from '../../shared/types';
import { api } from '../api';

// Recruitment what-if from the graph: which missing profile would open the most loops.
export default function GrowthCard({ version }: { version: string }) {
  const [options, setOptions] = useState<GrowthOption[]>();
  useEffect(() => {
    api<GrowthOption[]>('/growth')
      .then(setOptions)
      .catch(() => setOptions([]));
  }, [version]);
  if (!options?.length) return null;
  const [top, ...rest] = options;
  return (
    <section className="growth-card" aria-label="Strengthen the network">
      <div className="growth-head">
        <Sprout size={18} aria-hidden="true" />
        <h2>Strengthen the network</h2>
      </div>
      <p>
        Recruit an agency offering <b>{serviceNames[top.offer]}</b> that needs{' '}
        <b>{serviceNames[top.need]}</b>: the graph finds <b>{top.newLoops} new loops</b>
        {top.reducesKeystone ? ', including loops that no longer depend on the keystone' : ''}.
      </p>
      <ul>
        {top.examples.map((e) => (
          <li key={e.join('|')}>{e.join(' → ')} → back</li>
        ))}
      </ul>
      {rest.length > 0 && (
        <p className="growth-rest">
          Next best:{' '}
          {rest
            .slice(0, 2)
            .map((o) => `${serviceNames[o.offer]} for ${serviceNames[o.need]} (+${o.newLoops})`)
            .join(' · ')}
        </p>
      )}
    </section>
  );
}
