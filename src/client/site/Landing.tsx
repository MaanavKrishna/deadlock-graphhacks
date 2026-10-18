import { motion, useReducedMotion, type Variants } from 'motion/react';
import {
  ArrowRight,
  GitBranch,
  Network,
  Brain,
  MessageSquareText,
  Plug,
  ShieldCheck,
  Waypoints,
  Radio,
} from 'lucide-react';
import { Link } from '../router';
import { SiteHeader, SiteFooter } from './SiteChrome';

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const nodes = [
  { name: 'Studio North', gives: 'gives design', color: '#b7b5fb', x: 50, y: 16 },
  { name: 'Motionhaus', gives: 'gives video', color: '#4fd1b5', x: 80, y: 67 },
  { name: 'Wordcraft', gives: 'gives copy', color: '#f0a35c', x: 20, y: 67 },
];
const arcs = [
  { d: 'M220 70 A150 150 0 0 1 350 295', color: '#8f8cf5' },
  { d: 'M350 295 A150 150 0 0 1 90 295', color: '#4fd1b5' },
  { d: 'M90 295 A150 150 0 0 1 220 70', color: '#f0a35c' },
];

function LoopVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="hero-visual" role="img" aria-label="Three agencies form an exchange loop">
      <svg viewBox="0 0 440 440" aria-hidden="true">
        <circle cx="220" cy="220" r="150" className="hero-orbit" />
        {arcs.map((arc, i) => (
          <motion.path
            key={arc.d}
            d={arc.d}
            fill="none"
            stroke={arc.color}
            strokeWidth={3}
            strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, delay: 0.5 + i * 0.7, ease: 'easeInOut' }}
          />
        ))}
        {!reduce && (
          <motion.circle
            r={6}
            fill="#ffffff"
            initial={{ offsetDistance: '0%' }}
            animate={{ offsetDistance: '100%' }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear', delay: 2.6 }}
            style={{
              offsetPath:
                "path('M220 70 A150 150 0 0 1 350 295 A150 150 0 0 1 90 295 A150 150 0 0 1 220 70')",
            }}
          />
        )}
      </svg>
      {nodes.map((n, i) => (
        <motion.div
          key={n.name}
          className="hero-node"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          initial={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }}
          animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
          transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 260, damping: 22 }}
        >
          <strong>{n.name}</strong>
          <span style={{ color: n.color }}>{n.gives}</span>
        </motion.div>
      ))}
      <motion.div
        className="hero-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.7, duration: 0.6 }}
      >
        <b>3-way</b>
        <span>no direct swap exists</span>
      </motion.div>
    </div>
  );
}

const steps = [
  [
    'Map offers and needs',
    'Each agency says what it can give and what it needs. FalkorDB derives who can serve whom.',
  ],
  [
    'The graph finds loops',
    'A Cypher traversal finds closed three- and four-party paths, then checks capacity, deadlines and value balance.',
  ],
  [
    'Agents negotiate',
    'Each member’s Claude representative accepts, counters to a pre-validated proposal, or rejects.',
  ],
  [
    'Humans approve',
    'Capacity is held, never committed, until every member signs off. Then the whole loop commits at once.',
  ],
];
const features = [
  {
    icon: GitBranch,
    title: 'What breaks if someone leaves?',
    body: 'A what-if traversal shows broken loops, released holds and who is stranded, before anyone withdraws.',
  },
  {
    icon: Network,
    title: 'Keystones and who to recruit',
    body: 'See the agency every loop depends on, and which new profile would open the most new loops.',
  },
  {
    icon: Waypoints,
    title: 'Real graph algorithms',
    body: 'FalkorDB PageRank, betweenness and connected components find the broker and the sub-networks that can never trade.',
  },
  {
    icon: Radio,
    title: 'Watch agents negotiate',
    body: 'Every Claude representative decision streams live, then the whole loop waits for human approval.',
  },
  {
    icon: Brain,
    title: 'Memory that learns',
    body: 'Completed deals become partner edges. Failures become insights that expire when profiles change.',
  },
  {
    icon: MessageSquareText,
    title: 'Ask the network',
    body: 'Plain-language questions, answered by graph tools, with every agency, deal and lesson cited.',
  },
  {
    icon: Plug,
    title: 'MCP built in',
    body: 'Claude Desktop and Claude Code can query and act on the exchange graph. Approval stays human.',
  },
  {
    icon: ShieldCheck,
    title: 'Safe when scaled out',
    body: 'Every write is a compare-and-swap inside the graph, so replicas never double-book capacity.',
  },
];

export default function Landing() {
  return (
    <div className="site site-dark">
      <SiteHeader dark />
      <main id="main">
        <section className="hero">
          <motion.div className="hero-copy" variants={stagger} initial="hidden" animate="show">
            <motion.span variants={rise} className="eyebrow-pill">
              Built on FalkorDB · Graph Hacks 2026
            </motion.span>
            <motion.h1 variants={rise}>Three can trade where two can’t.</motion.h1>
            <motion.p variants={rise}>
              Deadlock finds the loops hidden in your network: agencies whose spare hours fit
              together only in a circle. AI representatives negotiate the terms. Every member
              approves. The graph remembers.
            </motion.p>
            <motion.div variants={rise} className="hero-actions">
              <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link to="/app" className="btn btn-accent">
                  Find your first loop <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </motion.span>
              <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link to="/docs" className="btn btn-ghost">
                  Read the docs
                </Link>
              </motion.span>
            </motion.div>
          </motion.div>
          <LoopVisual />
        </section>

        <section id="how" className="band-light">
          <div className="site-wrap">
            <motion.h2
              className="section-heading"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
            >
              From spare hours to a signed-off loop in four steps.
            </motion.h2>
            <motion.div
              className="step-grid"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
            >
              {steps.map(([title, body], i) => (
                <motion.article key={title} variants={rise} className="step-card">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="graph" className="site-wrap graph-section">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="eyebrow-mono">The graph does the work</span>
            <h2 className="section-heading">
              Remove FalkorDB and nothing works. That’s the point.
            </h2>
          </motion.div>
          <motion.div
            className="feature-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {features.map((f) => (
              <motion.article
                key={f.title}
                variants={rise}
                whileHover={{ y: -4, borderColor: '#3d3f52' }}
                className="feature-card"
              >
                <f.icon size={22} aria-hidden="true" />
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </motion.article>
            ))}
          </motion.div>
          <motion.pre
            className="code-card"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <b>MATCH</b> p=(a:Agency)-[:CAN_SERVE*3..4]-&gt;(a){'\n'}
            <b>WHERE</b> all(n IN nodes(p) WHERE n.active = true){'\n'}
            <b>RETURN</b> [n IN nodes(p) | n.id] AS ids
          </motion.pre>
        </section>

        <section className="site-wrap cta-wrap">
          <motion.div
            className="cta"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2>Your next deal is one connection away.</h2>
            <Link to="/app" className="btn btn-light">
              Open the exchange
            </Link>
          </motion.div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
