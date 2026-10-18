import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { SiteHeader, SiteFooter } from './SiteChrome';

const sections = [
  { id: 'quickstart', label: 'Quickstart', group: 'Guide' },
  { id: 'model', label: 'Graph model', group: 'Guide' },
  { id: 'queries', label: 'Core queries', group: 'Guide' },
  { id: 'agents', label: 'Agents and approval', group: 'Guide' },
  { id: 'memory', label: 'Memory', group: 'Guide' },
  { id: 'ask', label: 'Ask the network', group: 'Integrate' },
  { id: 'mcp', label: 'MCP server', group: 'Integrate' },
  { id: 'api', label: 'HTTP API', group: 'Integrate' },
  { id: 'deploy', label: 'Deploy', group: 'Integrate' },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <motion.section
      id={id}
      className="doc-section"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45 }}
    >
      <h2>{title}</h2>
      {children}
    </motion.section>
  );
}
const Code = ({ children }: { children: string }) => <pre className="doc-code">{children}</pre>;

export default function Docs() {
  const [active, setActive] = useState('quickstart');
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return (
    <div className="site site-docs">
      <SiteHeader docs />
      <div className="site-wrap docs-layout">
        <nav aria-label="Docs sections" className="docs-nav">
          {['Guide', 'Integrate'].map((group) => (
            <div key={group}>
              <span>{group}</span>
              {sections
                .filter((s) => s.group === group)
                .map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    aria-current={active === s.id ? 'true' : undefined}
                    className={active === s.id ? 'active' : ''}
                  >
                    {active === s.id && <motion.i layoutId="docs-active" className="docs-active" />}
                    <b>{s.label}</b>
                  </a>
                ))}
            </div>
          ))}
        </nav>
        <main id="main" className="docs-content">
          <Section id="quickstart" title="Quickstart">
            <p className="doc-lead">
              Run a real FalkorDB graph and the full app locally. No API key is needed for policy
              agents.
            </p>
            <Code>{'npm ci\nnpm run doctor\nnpm run dev   # http://127.0.0.1:3000/app'}</Code>
            <p className="doc-callout">
              <strong>Live agents:</strong> set <code>MODEL_API_KEY</code>,{' '}
              <code>MODEL_NAME=claude-haiku-5-5</code> and{' '}
              <code>MODEL_BASE_URL=https://api.anthropic.com/v1</code> in <code>.env</code>. Keys
              stay on the server.
            </p>
          </Section>
          <Section id="model" title="Graph model">
            <div className="doc-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Relationship</th>
                    <th scope="col">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['(Agency)-[:OFFERS|NEEDS]->(Service)', 'What each agency gives and wants'],
                    [
                      '(Agency)-[:CAN_SERVE]->(Agency)',
                      'Derived in the graph from OFFERS and NEEDS',
                    ],
                    ['(Deal)-[:INVOLVES]->(Agency)', 'Participants of an agreement'],
                    [
                      '(Deal)-[:HAS_EVENT]->(Event)-[:BY]->(Agency)',
                      'Every representative decision, in order',
                    ],
                    [
                      '(Lesson|Insight)-[:ABOUT]->(Agency)',
                      'Taught preferences and learned failures',
                    ],
                    [
                      '(Lesson|Insight)-[:LEARNED_FROM]->(Deal)',
                      'Memory traced to its source agreement',
                    ],
                    ['(Agency)-[:TRADED_WITH]->(Agency)', 'Proven partners from committed deals'],
                  ].map(([rel, meaning]) => (
                    <tr key={rel}>
                      <td>
                        <code>{rel}</code>
                      </td>
                      <td>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section id="queries" title="Core queries">
            <p>Discovery: closed loops of three or four active agencies.</p>
            <Code>
              {
                'MATCH p=(a:Agency)-[:CAN_SERVE*3..4]->(a)\nWHERE all(n IN nodes(p) WHERE n.active = true)\nRETURN [n IN nodes(p) | n.id] AS ids LIMIT 2000'
              }
            </Code>
            <p>What-if withdrawal: the same traversal with one agency excluded.</p>
            <Code>
              {'... WHERE all(n IN nodes(p) WHERE n.active = true AND n.id <> $excluded)'}
            </Code>
            <p>Recruitment: a new agency offering X and needing Y closes one loop per path.</p>
            <Code>
              {
                'MATCH p=(a:Agency)-[:CAN_SERVE*1..2]->(b:Agency)\nWHERE a.need = $offer AND b.offer = $need\nRETURN [n IN nodes(p) | n.id] AS ids'
              }
            </Code>
          </Section>
          <Section id="agents" title="Agents and approval">
            <p>
              Each agency’s representative (deterministic policy or a live Claude model) must call{' '}
              <code>inspect_exchange</code>, then <code>accept_offer</code>,{' '}
              <code>counter_offer</code> to a pre-validated proposal, or <code>reject_offer</code>.
              A counter resets every acceptance. Limits: six rounds, three tool calls per turn,
              sixty seconds. The server re-checks capacity, deadlines, minimums and value balance
              before holding capacity. A human approves for every member before the loop commits in
              one graph write.
            </p>
          </Section>
          <Section id="memory" title="Memory">
            <ul>
              <li>
                <strong>Taught lessons</strong> set a preferred received scope; the next negotiation
                proposes it when feasible. Turning memory off restores the baseline terms.
              </li>
              <li>
                <strong>TRADED_WITH</strong> edges from committed deals rank loops of proven
                partners higher.
              </li>
              <li>
                <strong>Insights</strong> from failed negotiations flag the loop while the blocking
                agency’s profile revision is unchanged.
              </li>
            </ul>
          </Section>
          <Section id="ask" title="Ask the network">
            <p>
              An agent answers questions by chaining fixed graph tools: <code>list_agencies</code>,{' '}
              <code>find_providers</code>, <code>who_can_serve</code>, <code>find_loops</code>,{' '}
              <code>withdrawal_impact</code>, <code>agency_history</code>, <code>explain_deal</code>
              , <code>recruit_suggestions</code>. It never writes Cypher, and it may only cite node
              ids those tools returned.
            </p>
          </Section>
          <Section id="mcp" title="MCP server">
            <p>
              Give Claude Desktop or Claude Code the same graph tools, plus{' '}
              <code>discover_exchanges</code> and <code>negotiate_loop</code>. It cannot approve.
            </p>
            <Code>
              {
                '{\n  "mcpServers": {\n    "deadlock": {\n      "command": "npx",\n      "args": ["tsx", "src/mcp.ts"],\n      "env": { "DEADLOCK_URL": "http://127.0.0.1:3000" }\n    }\n  }\n}'
              }
            </Code>
          </Section>
          <Section id="api" title="HTTP API">
            <div className="doc-table">
              <table>
                <tbody>
                  {[
                    [
                      'GET /api/state',
                      'Profiles, CAN_SERVE edges, loop stats, deals, lessons, insights',
                    ],
                    ['POST /api/discover', 'Persisted graph search with ranked loops'],
                    ['POST /api/negotiate', '{runId, agencyIds, mode?, useMemory?}'],
                    ['POST /api/deals/:id/approve', '{agencyId}: one human approval'],
                    ['GET /api/agencies/:id/impact', 'What-if withdrawal'],
                    ['GET /api/growth', 'Recruitment suggestions'],
                    ['POST /api/ask', '{question}: sourced answer (access key when set)'],
                    ['POST /api/tools/:name', 'Read-only graph tools'],
                  ].map(([route, what]) => (
                    <tr key={route}>
                      <td>
                        <code>{route}</code>
                      </td>
                      <td>{what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section id="deploy" title="Deploy">
            <p>
              Import the repository in Vercel and set <code>FALKORDB_URL</code> (FalkorDB Cloud,{' '}
              <code>rediss://…</code>), <code>ACCESS_KEY</code> and the optional model variables.
              Replicas share one graph safely: every write is a compare-and-swap on the workspace
              revision.
            </p>
          </Section>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
