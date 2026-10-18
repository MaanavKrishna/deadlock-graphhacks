import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Clock3, Pencil, Plus, X } from 'lucide-react';
import type { Agency } from '../../shared/types';
import { services, serviceNames } from '../../shared/types';
import { Avatar } from './Network';

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
          Credits are a shared comparison unit in this demo. They are not money. Value flexibility
          limits how much more an agency gives than receives.
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
