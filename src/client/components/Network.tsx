import { useMemo } from 'react';
import { ArrowUpRight, CircleDot, Maximize2 } from 'lucide-react';
import type { Agency, GraphEdge, LoopStats } from '../../shared/types';
import { serviceNames } from '../../shared/types';

export function Avatar({ agency, small = false }: { agency: Agency; small?: boolean }) {
  return (
    <span
      className={`avatar ${small ? 'small' : ''}`}
      style={{ background: agency.color + '18', color: agency.color }}
    >
      {agency.initials}
    </span>
  );
}
export default function Network({
  agencies,
  graphEdges,
  loops,
  selectedIds,
  onSelectAgency,
}: {
  agencies: Agency[];
  graphEdges: GraphEdge[];
  loops?: LoopStats;
  selectedIds: string[];
  onSelectAgency: (a: Agency) => void;
}) {
  const canvasHeight = agencies.length > 8 ? 600 : 400;
  const positions = useMemo(
    () =>
      new Map(
        agencies.map((a, i) => {
          const angle = (i / agencies.length) * 2 * Math.PI - Math.PI / 2;
          return [
            a.id,
            {
              x: 380 + 270 * Math.cos(angle),
              y: canvasHeight / 2 + (canvasHeight / 2 - 63) * Math.sin(angle),
            },
          ];
        }),
      ),
    [agencies, canvasHeight],
  );
  // Wires are the CAN_SERVE relationships FalkorDB derived, not a client-side guess.
  const byId = new Map(agencies.map((a) => [a.id, a]));
  const edges = graphEdges.flatMap((e) => {
    const from = byId.get(e.from),
      to = byId.get(e.to);
    return from && to ? [{ from, to }] : [];
  });
  const selectedEdges = selectedIds.map(
    (id, i) => `${id}:${selectedIds[(i + 1) % selectedIds.length]}`,
  );
  const directPairs =
    edges.filter((e) => edges.some((f) => f.from.id === e.to.id && f.to.id === e.from.id)).length /
    2;
  return (
    <section className="network-panel" aria-label="Exchange network">
      <div className="panel-heading">
        <div>
          <h2>The exchange network</h2>
          <p>Follow the connections. Find the way forward.</p>
        </div>
        <span className="quiet-pill">
          <CircleDot size={13} />
          {agencies.filter((a) => a.active).length} available
          {loops ? ` · ${loops.total} loop${loops.total === 1 ? '' : 's'}` : ''}
        </span>
      </div>
      <div className={`network-canvas ${agencies.length > 8 ? 'many' : ''}`}>
        <svg
          viewBox={`0 0 760 ${canvasHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="network-wires"
        >
          <defs>
            <marker
              id="arrow-muted"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L7,3.5 L0,7" fill="#c6c9dd" />
            </marker>
            <marker
              id="arrow-selected"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L7,3.5 L0,7" fill="#7168db" />
            </marker>
          </defs>
          {edges.map(({ from, to }) => {
            const p = positions.get(from.id)!,
              q = positions.get(to.id)!,
              dx = q.x - p.x,
              dy = q.y - p.y,
              d = Math.hypot(dx, dy),
              ux = dx / d,
              uy = dy / d;
            const active = selectedEdges.includes(`${from.id}:${to.id}`),
              available = from.active && to.active;
            const x1 = p.x + ux * 49,
              y1 = p.y + uy * 33,
              x2 = q.x - ux * 57,
              y2 = q.y - uy * 37;
            return (
              <path
                key={from.id + to.id}
                d={`M${x1},${y1} Q${(x1 + x2) / 2 - uy * 20},${(y1 + y2) / 2 + ux * 20} ${x2},${y2}`}
                fill="none"
                stroke={active ? '#7168db' : '#c6c9dd'}
                strokeWidth={active ? 2.8 : 1.3}
                strokeDasharray={!available ? '5 5' : undefined}
                opacity={available ? (active ? 1 : 0.55) : 0.25}
                markerEnd={`url(#arrow-${active ? 'selected' : 'muted'})`}
              />
            );
          })}
        </svg>
        <div className="network-center">
          <span className="loop-symbol">↻</span>
          <strong>
            {selectedIds.length ? `${selectedIds.length}-way exchange` : 'Better together'}
          </strong>
          <span>
            {directPairs === 0
              ? 'No direct swaps. New possibilities.'
              : `${directPairs} direct swaps in the network`}
          </span>
        </div>
        {agencies.map((a) => {
          const p = positions.get(a.id)!;
          return (
            <button
              key={a.id}
              className={`network-node ${selectedIds.includes(a.id) ? 'selected' : ''} ${!a.active ? 'unavailable' : ''}`}
              style={{ left: `${(p.x / 760) * 100}%`, top: `${(p.y / canvasHeight) * 100}%` }}
              onClick={() => onSelectAgency(a)}
              aria-label={`View ${a.name}${loops?.keystoneIds.includes(a.id) ? ', keystone: every loop runs through it' : ''}`}
            >
              {loops?.keystoneIds.includes(a.id) && <em className="keystone-badge">Keystone</em>}
              <Avatar agency={a} />
              <strong>{a.name}</strong>
              <span>
                {!a.active
                  ? 'Unavailable'
                  : `${Math.max(0, a.capacityHours - a.reservedHours - a.committedHours)}h available`}
              </span>
            </button>
          );
        })}
      </div>
      <div className="network-footer">
        <span>
          <span className="legend-line" />
          CAN_SERVE edge in FalkorDB
        </span>
        <span>
          <span className="legend-line chosen" />
          Selected exchange
        </span>
        {loops && loops.keystoneIds.length > 0 && loops.keystoneIds.length < agencies.length && (
          <span>
            <em className="keystone-badge inline">Keystone</em>
            Every loop runs through it
          </span>
        )}
        <span className="network-hint">
          <ArrowUpRight size={13} />
          Select an agency to inspect
        </span>
      </div>
    </section>
  );
}
