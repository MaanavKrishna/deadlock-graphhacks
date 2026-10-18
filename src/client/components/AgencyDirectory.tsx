import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Clock3, Pencil, Plus, X } from 'lucide-react';
import type { Agency, Impact } from '../../shared/types';
import { services, serviceNames } from '../../shared/types';
import { api } from '../api';
import { Avatar } from './Network';

// What-if preview: FalkorDB re-runs the loop traversal without this agency.
function ImpactPreview({ agency }: { agency: Agency }) {
  const [impact, setImpact] = useState<Impact>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api<Impact>(`/agencies/${encodeURIComponent(agency.id)}/impact`)
      .then(setImpact)
      .catch(() => setFailed(true));
  }, [agency.id]);
  if (failed) return null;
  if (!impact)
    return (
      <div className="impact-preview" aria-live="polite">
        Checking what depends on {agency.name}…
      </div>
    );
  const names = new Map(
    impact.broken.flatMap((l) => l.agencyIds.map((id, i) => [id, l.names[i]] as const)),
  );
  return (
    <section className="impact-preview" aria-label={`If ${agency.name} withdraws`}>
      <strong>If {agency.name} pauses</strong>
      <p>
        Breaks {impact.broken.length} of {impact.loopsBefore} graph loop
        {impact.loopsBefore === 1 ? '' : 's'}
        {impact.pendingDeals.length > 0 &&
          `, invalidates ${impact.pendingDeals.length} pending agreement${impact.pendingDeals.length === 1 ? '' : 's'} and releases ${impact.releasedHours}h of held capacity`}
        .
      </p>
      {impact.broken.length > 0 && (
        <ul>
          {impact.broken.map((l) => (
            <li key={l.agencyIds.join('|')}>{l.names.join(' → ')} → back</li>
          ))}
        </ul>
      )}
      {impact.reroutes.length > 0 && (
        <p>
          Still routable:{' '}
          {impact.reroutes
            .map(
              (r) =>
                `${names.get(r.agencyId) ?? r.agencyId} (${r.loops} loop${r.loops === 1 ? '' : 's'})`,
            )
            .join(', ')}
          .
        </p>
      )}
      {impact.stranded.length > 0 && (
        <p className="impact-stranded">
          Left with no exchange: {impact.stranded.map((id) => names.get(id) ?? id).join(', ')}.
        </p>
      )}
    </section>
  );
}

export default function AgencyDirectory({
  agencies,
  onEdit,
  onCreate,
}: {
  agencies: Agency[];
  onEdit: (a: Agency) => void;
  onCreate: () => void;
}) {
  return (
    <section className="directory">
      <div className="section-title">
        <div>
          <h2>The people behind the possibilities</h2>
          <p>Every offer and need adds a new connection.</p>
        </div>
        <button className="primary" onClick={onCreate}>
          <Plus size={16} />
          Add agency
        </button>
      </div>
      <div className="directory-list">
        {agencies.map((a) => (
          <article key={a.id} className={`agency-row ${!a.active ? 'paused' : ''}`}>
            <div className="agency-identity">
              <Avatar agency={a} />
              <div>
                <h3>{a.name}</h3>
                <p>{a.description}</p>
              </div>
            </div>
            <div className="agency-exchange">
              <span>
                <small>Offers</small>
                {serviceNames[a.offer]}
              </span>
              <ArrowRight size={16} />
              <span>
                <small>Needs</small>
                {serviceNames[a.need]}
              </span>
            </div>
            <div className="agency-capacity">
              <strong>
                {Math.max(0, a.capacityHours - a.reservedHours - a.committedHours)}
                <small>h available</small>
              </strong>
              <span>
                {a.reservedHours}h held / {a.committedHours}h committed
              </span>
            </div>
            <button className="icon-button" aria-label={`Edit ${a.name}`} onClick={() => onEdit(a)}>
              <Pencil size={16} />
            </button>
            <span className={`availability ${a.active ? '' : 'off'}`}>
              {a.active ? 'Available' : 'Paused'}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
export function AgencyEditor({
  agency,
  onClose,
  onSave,
  busy,
}: {
  agency: Agency | null;
  onClose: () => void;
  onSave: (a: Agency, isNew: boolean) => Promise<void>;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState<Agency>(
    agency ?? {
      id: 'new',
      name: '',
      initials: '',
      description: '',
      color: '#5652d6',
      offer: 'design',
      need: 'copy',
      active: true,
      capacityHours: 12,
      reservedHours: 0,
      committedHours: 0,
      requestHours: 10,
      minReceiveHours: 6,
      hourlyCredits: 100,
      maxImbalancePct: 15,
      deliveryDays: 3,
      deadlineDays: 7,
      revision: 0,
    },
  );
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function update<K extends keyof Agency>(key: K, next: Agency[K]) {
    setValue((v) => ({ ...v, [key]: next }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await onSave(
        {
          ...value,
          initials:
            value.initials ||
            value.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 3)
              .toUpperCase(),
        },
        !agency,
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="agency-dialog"
      aria-labelledby="agency-dialog-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form onSubmit={save}>
        <div className="modal-heading">
          <div>
            <span className="subtle-label">Agency profile</span>
            <h2 id="agency-dialog-title">{agency ? agency.name : 'Make a new connection'}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close agency profile"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {agency && agency.reservedHours > 0 && (
          <div className="inline-warning">
            Saving this profile will invalidate pending agreements and release their capacity holds.
          </div>
        )}
        {agency?.active && <ImpactPreview agency={agency} />}
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-grid">
          <label className="wide">
            Agency name
            <input
              autoFocus
              required
              maxLength={60}
              minLength={2}
              value={value.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <label className="wide">
            About the agency
            <textarea
              maxLength={240}
              rows={2}
              value={value.description}
              onChange={(e) => update('description', e.target.value)}
            />
          </label>
          <label>
            Offers
            <select
              value={value.offer}
              onChange={(e) => update('offer', e.target.value as Agency['offer'])}
            >
              {services.map((s) => (
                <option key={s} value={s}>
                  {serviceNames[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Needs
            <select
              value={value.need}
              onChange={(e) => update('need', e.target.value as Agency['need'])}
            >
              {services.map((s) => (
                <option key={s} value={s}>
                  {serviceNames[s]}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ['capacityHours', 'Total capacity (hours)', 0.25, 1000, 0.25],
              ['requestHours', 'Requested hours', 0.25, 1000, 0.25],
              ['minReceiveHours', 'Minimum received (hours)', 0.25, 1000, 0.25],
              ['hourlyCredits', 'Credits per offered hour', 1, 10000, 1],
              ['deliveryDays', 'Delivery time (days)', 1, 365, 1],
              ['deadlineDays', 'Receive by (day)', 1, 365, 1],
              ['maxImbalancePct', 'Value flexibility (%)', 0, 100, 1],
            ] as const
          ).map(([key, label, min, max, step]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                required
                min={min}
                max={max}
                step={step}
                value={value[key]}
                onChange={(e) => update(key, Number(e.target.value))}
              />
            </label>
          ))}
          <label>
            Agency color
            <input
              type="color"
              value={value.color}
              onChange={(e) => update('color', e.target.value)}
            />
          </label>
        </div>
        <label className="switch-line">
          <input
            type="checkbox"
            checked={value.active}
            onChange={(e) => update('active', e.target.checked)}
          />
          <span>Available for new exchanges</span>
        </label>
        <p className="form-help">
          Credits are a shared comparison unit in this workspace. They are not money. Value
          flexibility limits how much more an agency gives than receives.
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : agency ? 'Save profile' : 'Add agency'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
