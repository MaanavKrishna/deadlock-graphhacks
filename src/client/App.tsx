import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  GitBranch,
  History as HistoryIcon,
  Layers3,
  LoaderCircle,
  Network as NetworkIcon,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { Agency, Candidate, Deal, Run, Snapshot } from '../shared/types';
import { serviceNames } from '../shared/types';
import { api } from './api';
import Network, { Avatar } from './components/Network';
import NegotiationRoom from './components/NegotiationRoom';
import AgencyDirectory, { AgencyEditor } from './components/AgencyDirectory';
import History from './components/History';

type View = 'exchange' | 'agencies' | 'history' | 'guide';
export default function App() {
  const [state, setState] = useState<Snapshot>();
  const [view, setView] = useState<View>('exchange');
  const [candidate, setCandidate] = useState<Candidate>();
  const [dealId, setDealId] = useState<string>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<Agency | null | undefined>(undefined),
    [resetOpen, setResetOpen] = useState(false),
    [evidence, setEvidence] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false),
    [filter, setFilter] = useState('');
  const deal = state?.deals.find((d) => d.id === dealId),
    latestRun = state?.runs[0];
  async function refresh(initial = false) {
    const s = await api<Snapshot>('/state');
    setState(s);
    if (initial && s.deals.length) setDealId(s.deals[0].id);
    return s;
  }
  useEffect(() => {
    refresh(true).catch((e) => setError(e.message));
  }, []);
  async function action<T>(work: () => Promise<T>, message?: string): Promise<T | undefined> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await work();
      await refresh();
      if (message) setNotice(message);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function discover() {
    const run = await action(
      () => api<Run>('/discover', {}),
      'Graph search complete. Select an opportunity to inspect the exchange.',
    );
    if (run) {
      setCandidate(run.candidates.find((c) => c.feasible) ?? run.candidates[0]);
      setDealId(undefined);
      setView('exchange');
    }
  }
  async function startNegotiation() {
    if (!candidate || !latestRun) return;
    const d = await action(() =>
      api<Deal>('/negotiate', { runId: latestRun.id, agencyIds: candidate.agencyIds }),
    );
    if (d) {
      setDealId(d.id);
      setCandidate(undefined);
      setNotice(
        d.status === 'awaiting_approval'
          ? 'The agents agreed on terms. Each member can now approve.'
          : 'The agents could not agree. Inspect the log for the constraints.',
      );
    }
  }
  async function withdraw(a: Agency) {
    await action(
      () => api(`/agencies/${a.id}`, { ...a, active: false }, 'PUT'),
      `${a.name} is paused. Affected agreements were invalidated and their holds released.`,
    );
  }
  async function saveProfile(a: Agency, isNew: boolean) {
    setBusy(true);
    setError('');
    try {
      await api(isNew ? '/agencies' : `/agencies/${a.id}`, a, isNew ? 'POST' : 'PUT');
      await refresh();
      setCandidate(undefined);
      setNotice(
        isNew
          ? 'Agency added to the network.'
          : 'Profile saved. Discover exchanges to use the new terms.',
      );
    } finally {
      setBusy(false);
    }
  }
  const nav = [
    { id: 'exchange' as const, label: 'Exchange desk', icon: NetworkIcon },
    { id: 'agencies' as const, label: 'Agencies', icon: Users },
    { id: 'history' as const, label: 'Activity', icon: HistoryIcon },
  ];
  const available = state?.agencies.filter((a) => a.active).length ?? 0,
    pending = state?.deals.filter((d) => d.status === 'awaiting_approval').length ?? 0;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="sidebar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="Deadlock home">
          <span className="brand-mark">
            <i />
            <i />
          </span>
          <strong>deadlock</strong>
        </a>
        <span className="workspace-label">Community workspace</span>
        <div className="nav-items">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={view === n.id ? 'active' : ''}
              aria-current={view === n.id ? 'page' : undefined}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === 'agencies' && state && (
                <span className="nav-count">{state.agencies.length}</span>
              )}
              {n.id === 'history' && pending > 0 && <span className="nav-count">{pending}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-loop">↻</span>
            <strong>Good things go around.</strong>
            <p>Turn what you have into what you need.</p>
            <button
              onClick={() => {
                setView('guide');
                setGuideOpen(true);
              }}
            >
              How it works <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`help-nav ${view === 'guide' ? 'active' : ''}`}
            onClick={() => setView('guide')}
          >
            <CircleHelp size={17} />
            Guide & settings
          </button>
          <div className="workspace-person">
            <span className="person-avatar">C</span>
            <div>
              <strong>ContextSense</strong>
              <span>Graph Hacks workspace</span>
            </div>
            <span className="workspace-dot" />
          </div>
        </div>
      </nav>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>
              {view === 'exchange'
                ? 'Exchange desk'
                : view === 'agencies'
                  ? 'Agencies'
                  : view === 'history'
                    ? 'Activity'
                    : 'Guide & settings'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="demo-badge">Synthetic demo</span>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              disabled={busy}
              onClick={() => action(() => refresh(), 'Workspace refreshed.')}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <main id="main">
          <div className="page-intro">
            <div>
              <div className="page-kicker">
                <span className="live-dot" />A network of possibilities
              </div>
              <h1>
                {view === 'exchange'
                  ? 'Find your way to a deal.'
                  : view === 'agencies'
                    ? 'Different strengths. Shared possibilities.'
                    : view === 'history'
                      ? 'Nothing gets lost along the way.'
                      : 'A little context goes a long way.'}
              </h1>
              <p>
                {view === 'exchange'
                  ? 'Your spare capacity could be someone else’s next big thing.'
                  : view === 'agencies'
                    ? 'Bring an offer, name a need, and let the connections do their work.'
                    : view === 'history'
                      ? 'Revisit the paths, proposals and decisions that brought everyone together.'
                      : 'Understand the exchange, the agents, and the limits of this workspace.'}
              </p>
            </div>
            {view === 'exchange' && (
              <button
                className="primary discovery-button"
                disabled={busy || !state}
                onClick={discover}
              >
                {busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}
                Discover exchanges
              </button>
            )}
          </div>
          <div aria-live="polite" className="announcements">
            {error && (
              <div className="banner error" role="alert">
                <span>{error}</span>
                <button onClick={() => setError('')} aria-label="Dismiss error">
                  <X size={16} />
                </button>
              </div>
            )}
            {notice && (
              <div className="banner success">
                <Check size={16} />
                <span>{notice}</span>
                <button onClick={() => setNotice('')} aria-label="Dismiss notification">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          {!state ? (
            <div className="loading-state">
              {error ? (
                <>
                  <NetworkIcon size={30} />
                  <h2>Reconnect to your workspace</h2>
                  <p>Start the application server and FalkorDB, then try again.</p>
                  <button className="primary" onClick={() => action(() => refresh())}>
                    Retry connection
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle className="spin" size={30} />
                  <p>Connecting to your exchange network…</p>
                </>
              )}
            </div>
          ) : (
            <>
              {view === 'exchange' && (
                <div className="exchange-layout">
                  <div className="exchange-main">
                    <div className="context-strip">
                      <span>
                        <span className="mini-avatar-icon">
                          <Users size={14} />
                        </span>
                        <strong>{available}</strong> available agencies
                      </span>
                      <span>
                        <GitBranch size={14} />
                        <strong>
                          {latestRun?.candidates.filter((c) => c.feasible).length ?? '—'}
                        </strong>{' '}
                        feasible exchanges
                      </span>
                      <span>
                        <ShieldCheck size={14} />
                        <strong>{pending}</strong> awaiting approval
                      </span>
                    </div>
                    <Network
                      agencies={state.agencies}
                      selectedIds={deal?.agencyIds ?? candidate?.agencyIds ?? []}
                      onSelectAgency={setEditor}
                    />
                    <section className="opportunities">
                      <div className="section-title">
                        <div>
                          <h2>
                            Connected opportunities{' '}
                            <span className="count-badge">{latestRun?.candidates.length ?? 0}</span>
                          </h2>
                          <p>
                            {latestRun
                              ? 'Every path below was found in the graph.'
                              : 'The right exchange might be one connection away.'}
                          </p>
                        </div>
                        <button className="text-button" onClick={() => setEvidence(!evidence)}>
                          <Layers3 size={14} />
                          {evidence ? 'Hide evidence' : 'Graph evidence'}
                        </button>
                      </div>
                      {evidence && (
                        <div className="query-evidence">
                          <strong>How the graph finds the exchange</strong>
                          <p>
                            Offers and needs create directed connections. The query follows three or
                            four of them back to the starting agency. Representatives then check the
                            terms.
                          </p>
                          <pre>
                            {latestRun?.query ??
                              'MATCH p=(a:Agency)-[:CAN_SERVE*3..4]->(a)\nWHERE all(n IN nodes(p) WHERE n.active = true)\nRETURN [n IN nodes(p) | n.id] AS ids'}
                          </pre>
                          {latestRun && (
                            <span>
                              {latestRun.durationMs}ms search · {latestRun.candidates.length}{' '}
                              distinct cycles · {latestRun.id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      )}
                      {!latestRun ? (
                        <div className="opportunities-empty">
                          <span className="empty-graphic">
                            <GitBranch size={29} />
                          </span>
                          <div>
                            <h3>Three people can open a door that two can’t.</h3>
                            <p>Find a cycle where everyone gives what someone else needs.</p>
                            <button className="text-button" disabled={busy} onClick={discover}>
                              Find the first exchange <ArrowRight size={15} />
                            </button>
                          </div>
                        </div>
                      ) : latestRun.candidates.length === 0 ? (
                        <div className="opportunities-empty">
                          <GitBranch size={28} />
                          <div>
                            <h3>No connected exchange yet.</h3>
                            <p>
                              Try making more agencies available or adding a complementary offer and
                              need.
                            </p>
                            <button className="text-button" onClick={() => setView('agencies')}>
                              Manage agencies
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="opportunity-list">
                          {latestRun.candidates.map((c, i) => {
                            const selected = c.id === candidate?.id;
                            return (
                              <button
                                key={c.id}
                                className={`opportunity ${selected ? 'selected' : ''}`}
                                onClick={() => {
                                  setCandidate(c);
                                  setDealId(undefined);
                                }}
                              >
                                <div className="opportunity-top">
                                  <span
                                    className={`opportunity-type ${c.feasible ? '' : 'blocked'}`}
                                  >
                                    <GitBranch size={13} />
                                    {c.agencyIds.length}-way exchange
                                  </span>
                                  <span className="credit-total">
                                    {c.estimatedCredits.toLocaleString()}{' '}
                                    <small>credits exchanged</small>
                                  </span>
                                  {selected ? (
                                    <Check size={16} className="purple" />
                                  ) : (
                                    <ArrowUpRight size={16} />
                                  )}
                                </div>
                                <div className="opportunity-path">
                                  {c.agencyIds.map((id, j) => {
                                    const a = state.agencies.find((a) => a.id === id)!;
                                    return (
                                      <span className="path-member" key={id}>
                                        <Avatar agency={a} small />
                                        <strong>{a.name}</strong>
                                        {j < c.agencyIds.length - 1 && <ArrowRight size={13} />}
                                      </span>
                                    );
                                  })}
                                  <span className="loop-return">↻</span>
                                </div>
                                <div className="opportunity-bottom">
                                  <span className={c.feasible ? 'green' : 'amber'}>
                                    <span className="dot" />
                                    {c.feasible
                                      ? 'Passed checks at search'
                                      : 'Constraints need attention'}
                                  </span>
                                  <span>{c.reason ?? 'No direct swap needed'}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                    <div className="bottom-note">
                      <span className="brand-mark mini">
                        <i />
                        <i />
                      </span>
                      <p>Better deals start with better connections.</p>
                      <span>Powered by FalkorDB</span>
                    </div>
                  </div>
                  <NegotiationRoom
                    candidate={candidate}
                    deal={deal}
                    agencies={state.agencies}
                    busy={busy}
                    onNegotiate={startNegotiation}
                    onApprove={(id) => {
                      if (deal)
                        action(
                          () => api(`/deals/${deal.id}/approve`, { agencyId: id }),
                          'Approval recorded.',
                        );
                    }}
                    onCancel={() => {
                      if (deal)
                        action(
                          () => api(`/deals/${deal.id}/cancel`, {}),
                          'Agreement cancelled. Capacity holds released.',
                        );
                    }}
                    onWithdraw={withdraw}
                    onReroute={discover}
                  />
                </div>
              )}
              {view === 'agencies' && (
                <AgencyDirectory
                  agencies={state.agencies}
                  onEdit={setEditor}
                  onCreate={() => setEditor(null)}
                />
              )}
              {view === 'history' && (
                <History
                  deals={state.deals}
                  runs={state.runs}
                  onOpen={(d) => {
                    setDealId(d.id);
                    setCandidate(undefined);
                    setView('exchange');
                  }}
                />
              )}
              {view === 'guide' && (
                <section className="guide-grid">
                  <article className="guide-main">
                    <h2>An exchange that comes full circle.</h2>
                    <p>
                      Studio North needs words. Wordcraft needs a video. Motionhaus needs a brand.
                      No two can swap directly, but a connected agreement can help all three.
                    </p>
                    <ol className="guide-steps">
                      <li>
                        <span>1</span>
                        <div>
                          <h3>Discover the connection</h3>
                          <p>
                            FalkorDB follows offers and needs to find cycles of three or four
                            agencies.
                          </p>
                        </div>
                      </li>
                      <li>
                        <span>2</span>
                        <div>
                          <h3>Let representatives work out the terms</h3>
                          <p>
                            Each policy agent checks capacity, minimum hours, deadlines and credit
                            balance. Counteroffers must stay inside those limits.
                          </p>
                        </div>
                      </li>
                      <li>
                        <span>3</span>
                        <div>
                          <h3>Approve together</h3>
                          <p>
                            Capacity is held while each member reviews. The final human approval
                            commits the entire cycle at once.
                          </p>
                        </div>
                      </li>
                      <li>
                        <span>4</span>
                        <div>
                          <h3>Find a new path when plans change</h3>
                          <p>
                            Simulate a withdrawal. Pending agreements are invalidated, holds are
                            released, and a new graph search finds alternatives. The old decisions
                            remain in Activity.
                          </p>
                        </div>
                      </li>
                    </ol>
                    <button className="primary" disabled={busy} onClick={discover}>
                      <Play size={15} />
                      Start the demo
                    </button>
                  </article>
                  <div className="guide-side">
                    <article className="settings-card">
                      <h3>Workspace status</h3>
                      <dl>
                        <div>
                          <dt>Context layer</dt>
                          <dd>{state.database}</dd>
                        </div>
                        <div>
                          <dt>Representatives</dt>
                          <dd>{state.agentMode}</dd>
                        </div>
                        <div>
                          <dt>Data</dt>
                          <dd>Synthetic agencies only</dd>
                        </div>
                        <div>
                          <dt>Memory</dt>
                          <dd>Persistent graph history</dd>
                        </div>
                      </dl>
                      <p>
                        The default agents follow explicit policies. An optional server-configured
                        model can explain the outcome; it cannot change terms or approve an
                        agreement.
                      </p>
                    </article>
                    <article className="settings-card">
                      <h3>A safe place to try things</h3>
                      <p>
                        Approvals reserve fictional service capacity. No agency is contacted, no
                        money changes hands, and no service is delivered.
                      </p>
                      <button className="secondary" onClick={() => setResetOpen(true)}>
                        <RotateCcw size={15} />
                        Reset demo workspace
                      </button>
                      <p className="subtle">
                        Reset removes this workspace’s agencies and history and restores the
                        original six profiles.
                      </p>
                    </article>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <span className="live-dot" />
            {state?.database ?? 'Connecting to graph'}
          </span>
          <span>
            {state?.agentMode ?? 'Policy agents'}
            <span className="footer-divider" />
            Built by ContextSense
          </span>
        </footer>
      </div>
      {editor !== undefined && (
        <AgencyEditor
          agency={editor}
          busy={busy}
          onClose={() => setEditor(undefined)}
          onSave={saveProfile}
        />
      )}
      {resetOpen && (
        <ResetDialog
          busy={busy}
          onClose={() => setResetOpen(false)}
          onConfirm={async () => {
            const result = await action(
              () => api<Snapshot>('/reset', { confirm: true }),
              'Demo restored. A fresh network is ready.',
            );
            if (result) {
              setCandidate(undefined);
              setDealId(undefined);
              setResetOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}
function ResetDialog({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="reset-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <RotateCcw size={25} />
      <h2 id="reset-title">Start with a fresh network?</h2>
      <p>
        This removes the demo’s agreements, approvals, custom profiles and activity. The original
        six agencies will be restored.
      </p>
      <div className="modal-actions">
        <button className="secondary" disabled={busy} onClick={onClose} autoFocus>
          Keep workspace
        </button>
        <button className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? 'Resetting…' : 'Reset demo'}
        </button>
      </div>
    </dialog>
  );
}
