import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
  MessageSquareText,
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
import type { Agency, Candidate, Deal, NegotiationEvent, Run, Snapshot } from '../shared/types';
import { serviceNames } from '../shared/types';
import { api, streamNegotiation } from './api';
import Network, { Avatar } from './components/Network';
import NegotiationRoom from './components/NegotiationRoom';
import AgencyDirectory, { AgencyEditor } from './components/AgencyDirectory';
import History from './components/History';
import MemoryView from './components/MemoryView';
import AskView from './components/AskView';
import GrowthCard from './components/GrowthCard';
import StatsRow from './components/StatsRow';
import LiveFeed from './components/LiveFeed';
import StructureCard from './components/StructureCard';

type View = 'exchange' | 'ask' | 'agencies' | 'history' | 'memory' | 'guide';
// Every workspace view has its own address, so views can be bookmarked, shared and
// navigated with the browser's back and forward buttons.
const viewPaths: Record<View, string> = {
  exchange: '/app',
  ask: '/app/ask',
  agencies: '/app/agencies',
  history: '/app/activity',
  memory: '/app/memory',
  guide: '/app/settings',
};
function viewFromPath(path: string): View {
  const match = (Object.entries(viewPaths) as [View, string][]).find(
    ([view, p]) => view !== 'exchange' && path.startsWith(p),
  );
  return match ? match[0] : 'exchange';
}
const dealFromUrl = () => new URLSearchParams(window.location.search).get('deal') ?? undefined;
export default function App() {
  const [state, setState] = useState<Snapshot>();
  const [view, setViewState] = useState<View>(() => viewFromPath(window.location.pathname));
  function setView(next: View) {
    setViewState(next);
    const target = viewPaths[next];
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
      window.scrollTo({ top: 0 });
    }
  }
  useEffect(() => {
    const titles: Record<View, string> = {
      exchange: 'Exchange desk',
      ask: 'Ask the network',
      agencies: 'Agencies',
      history: 'Activity',
      memory: 'Memory',
      guide: 'Settings',
    };
    document.title = `${titles[view]} · Deadlock`;
  }, [view]);
  useEffect(() => {
    const onPop = () => {
      setViewState(viewFromPath(window.location.pathname));
      const linked = dealFromUrl();
      if (linked) setDealId(linked);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [candidate, setCandidate] = useState<Candidate>();
  const [dealId, setDealId] = useState<string | undefined>(dealFromUrl);
  const [liveEvents, setLiveEvents] = useState<NegotiationEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  // Keep the open agreement in the address (/app?deal=…) so it can be shared or reopened.
  useEffect(() => {
    if (!window.location.pathname.startsWith('/app')) return;
    const url = new URL(window.location.href);
    if (view === 'exchange' && dealId) url.searchParams.set('deal', dealId);
    else url.searchParams.delete('deal');
    if (url.href !== window.location.href) window.history.replaceState({}, '', url);
  }, [dealId, view]);
  const [agentMode, setAgentMode] = useState<'policy' | 'model'>('policy');
  const [useMemory, setUseMemory] = useState(true);
  const [resetScenario, setResetScenario] = useState<'starter' | 'launch' | 'empty'>('starter');
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
    if (initial && !dealFromUrl() && s.deals.length) setDealId(s.deals[0].id);
    if (initial) setAgentMode(s.modelConfigured ? 'model' : 'policy');
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
    setLiveEvents([]);
    setStreaming(true);
    const d = await action(() =>
      streamNegotiation<NegotiationEvent, Deal>(
        {
          runId: latestRun.id,
          agencyIds: candidate.agencyIds,
          mode: agentMode,
          useMemory,
        },
        (e) => setLiveEvents((list) => [...list, e]),
      ),
    ).finally(() => setStreaming(false));
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
    { id: 'exchange' as const, label: 'Exchange desk', short: 'Exchange', icon: NetworkIcon },
    { id: 'ask' as const, label: 'Ask the network', short: 'Ask', icon: MessageSquareText },
    { id: 'agencies' as const, label: 'Agencies', short: 'Agencies', icon: Users },
    { id: 'history' as const, label: 'Activity', short: 'Activity', icon: HistoryIcon },
    { id: 'memory' as const, label: 'Memory', short: 'Memory', icon: BookOpen },
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
        <div className="nav-items">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={view === n.id ? 'active' : ''}
              aria-current={view === n.id ? 'page' : undefined}
              title={n.label}
            >
              {view === n.id && (
                <motion.i
                  layoutId="rail-active"
                  className="rail-active"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <n.icon size={20} />
              <span className="rail-label">{n.short}</span>
              {n.id === 'agencies' && state && (
                <span className="nav-count">{state.agencies.length}</span>
              )}
              {n.id === 'history' && pending > 0 && <span className="nav-count">{pending}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button
            className={`help-nav ${view === 'guide' ? 'active' : ''}`}
            onClick={() => setView('guide')}
            title="Settings and guide"
            aria-current={view === 'guide' ? 'page' : undefined}
          >
            {view === 'guide' && (
              <motion.i
                layoutId="rail-active"
                className="rail-active"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <Settings2 size={20} />
            <span className="rail-label">Settings</span>
          </button>
        </div>
      </nav>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="workspace-title">
              {state?.synthetic === false ? 'Your network' : 'Example network'}
            </span>
            <ChevronRight size={13} />
            <strong>
              {view === 'exchange'
                ? 'Exchange desk'
                : view === 'ask'
                  ? 'Ask the network'
                  : view === 'agencies'
                    ? 'Agencies'
                    : view === 'history'
                      ? 'Activity'
                      : view === 'memory'
                        ? 'Memory'
                        : 'Settings'}
            </strong>
          </div>
          <div className="topbar-right">
            <select
              aria-label="Workspace setup"
              className="scenario-select"
              value={state?.scenario ?? 'starter'}
              disabled={busy || !state}
              onChange={(e) => {
                setResetScenario(e.target.value as 'starter' | 'launch' | 'empty');
                setResetOpen(true);
              }}
            >
              <option value="starter">Example · 6 agencies</option>
              <option value="launch">Challenge · 10 agencies</option>
              <option value="empty">Start your own network</option>
              <option value="custom" disabled>
                Your network
              </option>
            </select>
            <span className="status-pill live">
              <i />
              {state?.database ?? 'Connecting'}
            </span>
            {state?.modelConfigured && (
              <span className="status-pill agents">Claude agents ready</span>
            )}
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
                  ? 'Find the loops in your network.'
                  : view === 'ask'
                    ? 'Ask the graph. Get sources.'
                    : view === 'agencies'
                      ? 'Different strengths. Shared possibilities.'
                      : view === 'history'
                        ? 'Nothing gets lost along the way.'
                        : view === 'memory'
                          ? 'A better next time starts here.'
                          : 'A little context goes a long way.'}
              </h1>
              <p>
                {view === 'exchange'
                  ? 'FalkorDB traces who can serve whom, finds closed exchanges and shows what each one depends on.'
                  : view === 'ask'
                    ? 'An agent chains graph tools to answer, then cites every agency, agreement and lesson it used.'
                    : view === 'agencies'
                      ? 'Bring an offer, name a need, and let the connections do their work.'
                      : view === 'history'
                        ? 'Revisit the paths, proposals and decisions that brought everyone together.'
                        : view === 'memory'
                          ? 'Preferences persist in the graph, with a path back to the decision that taught them.'
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
            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="banner error"
                  role="alert"
                >
                  <span>{error}</span>
                  <button onClick={() => setError('')} aria-label="Dismiss error">
                    <X size={16} />
                  </button>
                </motion.div>
              )}
              {notice && (
                <motion.div
                  key="notice"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="banner success"
                >
                  <Check size={16} />
                  <span>{notice}</span>
                  <button onClick={() => setNotice('')} aria-label="Dismiss notification">
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {view === 'exchange' && (
                <div className="exchange-layout">
                  <div className="exchange-main">
                    <StatsRow state={state} />
                    <div className="agent-controls">
                      <label>
                        Representatives
                        <select
                          aria-label="Negotiation mode"
                          value={agentMode}
                          disabled={busy}
                          onChange={(e) => setAgentMode(e.target.value as 'policy' | 'model')}
                        >
                          <option value="policy">Policy simulation</option>
                          <option value="model" disabled={!state.modelConfigured}>
                            Live model agents{state.modelConfigured ? '' : ' — configure .env'}
                          </option>
                        </select>
                      </label>
                      <label className="memory-switch">
                        <input
                          type="checkbox"
                          checked={useMemory}
                          disabled={busy}
                          onChange={(e) => setUseMemory(e.target.checked)}
                        />
                        Use learned preferences
                      </label>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => action(() => refresh(), 'Model configuration refreshed.')}
                      >
                        <RefreshCw size={13} />
                        Refresh configuration
                      </button>
                      <span>
                        {state.modelConfigured
                          ? `Ready: ${state.modelName}`
                          : 'No model key configured'}
                      </span>
                    </div>
                    {state.agencies.length < 3 && !state.synthetic && (
                      <motion.div
                        className="workspace-onboarding"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <span className="onboarding-step">
                          {state.agencies.length} of 3 agencies
                        </span>
                        <h2>Your network starts with an offer.</h2>
                        <p>
                          Add agencies with what they offer, what they need, spare hours and
                          deadlines. With three complementary profiles the graph can close its first
                          loop.
                        </p>
                        <div className="onboarding-meter" aria-hidden="true">
                          <motion.i
                            animate={{ width: `${(state.agencies.length / 3) * 100}%` }}
                            transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                          />
                        </div>
                        <div className="onboarding-actions">
                          <button className="primary" onClick={() => setEditor(null)}>
                            <Plus size={15} />
                            Add agency
                          </button>
                          <button
                            className="secondary"
                            onClick={() => {
                              setResetScenario('starter');
                              setResetOpen(true);
                            }}
                          >
                            Load the example network
                          </button>
                        </div>
                      </motion.div>
                    )}
                    <Network
                      agencies={state.agencies}
                      graphEdges={state.edges}
                      loops={state.loops}
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
                              <motion.button
                                key={c.id}
                                layout
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06, duration: 0.35 }}
                                whileHover={{ y: -2 }}
                                disabled={busy}
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
                                    <small>
                                      {c.feasible ? 'proposed credits' : 'requested credits'}
                                    </small>
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
                                {c.history?.tradedLegs || c.history?.priorFailures.length ? (
                                  <div className="candidate-memory">
                                    {c.history.tradedLegs > 0 && (
                                      <span className="memory-proven">
                                        Graph memory: {c.history.tradedLegs} of {c.agencyIds.length}{' '}
                                        legs traded before
                                      </span>
                                    )}
                                    {c.history.priorFailures.map((f) => (
                                      <span className="memory-failed" key={f.dealId}>
                                        Failed before ({f.dealId.slice(0, 8)}): {f.reason}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                    <div className="insight-cards">
                      <StructureCard
                        version={state.agencies.map((a) => `${a.id}:${a.revision}`).join(',')}
                      />
                      <GrowthCard
                        version={state.agencies.map((a) => `${a.id}:${a.revision}`).join(',')}
                      />
                    </div>
                    <div className="bottom-note">
                      <span className="brand-mark mini">
                        <i />
                        <i />
                      </span>
                      <p>Better deals start with better connections.</p>
                      <span>Powered by FalkorDB</span>
                    </div>
                  </div>
                  <motion.div
                    className="room-drawer"
                    key={deal?.id ?? candidate?.id ?? 'empty'}
                    initial={{ opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  >
                    {streaming && (
                      <LiveFeed events={liveEvents} agencies={state.agencies} mode={agentMode} />
                    )}
                    <NegotiationRoom
                      candidate={candidate}
                      deal={deal}
                      agencies={state.agencies}
                      busy={busy}
                      sampleData={state.synthetic}
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
                      onRemember={(agencyId, preferredHours) => {
                        if (deal)
                          action(
                            () => api(`/deals/${deal.id}/lessons`, { agencyId, preferredHours }),
                            'Preference saved in the graph. Future representatives can use it.',
                          );
                      }}
                    />
                  </motion.div>
                </div>
              )}
              {view === 'agencies' && (
                <AgencyDirectory
                  agencies={state.agencies}
                  loops={state.loops}
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
              {view === 'ask' && (
                <AskView
                  state={state}
                  onOpenDeal={(d) => {
                    setDealId(d.id);
                    setCandidate(undefined);
                    setView('exchange');
                  }}
                  onOpenAgency={(id) => setEditor(state.agencies.find((a) => a.id === id))}
                />
              )}
              {view === 'memory' && (
                <MemoryView
                  state={state}
                  onOpen={(d) => {
                    setDealId(d.id);
                    setCandidate(undefined);
                    setView('exchange');
                  }}
                />
              )}
              {view === 'guide' && (
                <section className="guide-grid v2">
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
                            Pause an agency. Its pending agreements are invalidated, holds are
                            released, and a new graph search finds alternatives. The old decisions
                            remain in Activity.
                          </p>
                        </div>
                      </li>
                    </ol>
                    <button className="primary" disabled={busy} onClick={discover}>
                      <Play size={15} />
                      Find loops now
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
                          <dd>
                            {state.synthetic
                              ? 'Example network (synthetic agencies)'
                              : 'User-entered agency profiles'}
                          </dd>
                        </div>
                        <div>
                          <dt>Memory</dt>
                          <dd>Persistent graph history</dd>
                        </div>
                      </dl>
                      <p>
                        Live model representatives inspect graph context and choose to accept,
                        counter or reject a validated proposal. Policy simulation is also available.
                        Learned preferences can change the next proposal; humans approve every
                        agreement.
                      </p>
                    </article>
                    <article className="settings-card">
                      <h3>Workspace</h3>
                      <p>
                        {state.synthetic
                          ? 'The example network uses synthetic agencies.'
                          : 'Approvals reserve the service capacity entered in this workspace.'}{' '}
                        The app records agreed capacity. No agency is contacted, no money changes
                        hands, and no service is delivered.
                      </p>
                      <div className="scenario-cards" role="group" aria-label="Replace workspace">
                        {(
                          [
                            ['starter', 'Example network', '6 synthetic agencies, 3 loops'],
                            [
                              'launch',
                              'Launch challenge',
                              '10 agencies, 4-party loops, a late trap',
                            ],
                            ['empty', 'Your own network', 'Start empty and add real profiles'],
                          ] as const
                        ).map(([id, title, detail]) => (
                          <motion.button
                            key={id}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className={`scenario-card ${state.scenario === (id === 'empty' ? 'custom' : id) ? 'current' : ''}`}
                            onClick={() => {
                              setResetScenario(id);
                              setResetOpen(true);
                            }}
                          >
                            <strong>{title}</strong>
                            <span>{detail}</span>
                          </motion.button>
                        ))}
                      </div>
                      <p className="subtle">
                        Replacing asks for confirmation and clears this graph’s agencies,
                        agreements, lessons and activity.
                      </p>
                    </article>
                  </div>
                </section>
              )}
            </motion.div>
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
          scenario={resetScenario}
          busy={busy}
          onClose={() => setResetOpen(false)}
          onConfirm={async () => {
            const result = await action(
              () => api<Snapshot>('/reset', { confirm: true, scenario: resetScenario }),
              'Workspace ready.',
            );
            if (result) {
              setCandidate(undefined);
              setDealId(undefined);
              setResetOpen(false);
              setView(resetScenario === 'empty' ? 'agencies' : 'exchange');
            }
          }}
        />
      )}
    </div>
  );
}
function ResetDialog({
  scenario,
  busy,
  onClose,
  onConfirm,
}: {
  scenario: 'starter' | 'launch' | 'empty';
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
      <h2 id="reset-title">
        Load the{' '}
        {scenario === 'empty'
          ? 'empty workspace'
          : scenario === 'launch'
            ? 'launch challenge'
            : 'example network'}
        ?
      </h2>
      <p>
        This replaces agencies and clears agreements, approvals, lessons and activity.
        {scenario === 'empty'
          ? ' Add your own agency offers, needs and constraints to begin.'
          : scenario === 'launch'
            ? ' The ten-agency challenge includes unequal rates, a four-party exchange and a deadline conflict.'
            : ' The original six agencies will be restored.'}
      </p>
      <div className="modal-actions">
        <button className="secondary" disabled={busy} onClick={onClose} autoFocus>
          Keep workspace
        </button>
        <button className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? 'Preparing…' : 'Replace workspace'}
        </button>
      </div>
    </dialog>
  );
}
