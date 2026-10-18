import { Link } from '../router';

const repo = 'https://github.com/MaanavKrishna/deadlock-graphhacks';

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle
        cx="9"
        cy="14"
        r="6"
        fill="none"
        stroke={dark ? '#8f8cf5' : '#5b57f0'}
        strokeWidth="2.4"
      />
      <circle
        cx="19"
        cy="14"
        r="6"
        fill="none"
        stroke={dark ? '#ffffff' : '#111318'}
        strokeWidth="2.4"
      />
    </svg>
  );
}

export function SiteHeader({ dark = false, docs = false }: { dark?: boolean; docs?: boolean }) {
  return (
    <header className={`site-header ${dark ? 'dark' : ''}`}>
      <div className="site-wrap site-header-row">
        <Link to="/" className="site-brand">
          <Logo dark={dark} />
          <span>deadlock</span>
          {docs && <em>docs</em>}
        </Link>
        <nav aria-label="Site">
          {!docs && (
            <>
              <a href="/#how">How it works</a>
              <a href="/#graph">The graph</a>
              <Link to="/docs">Docs</Link>
            </>
          )}
          <a href={repo}>GitHub</a>
          <Link to="/app" className="btn btn-small">
            Open the app
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-wrap site-footer-row">
        <span>Deadlock · team ContextSense · sample agencies are synthetic</span>
        <span>
          <Link to="/docs">Docs</Link>
          <a href={repo}>GitHub</a>
        </span>
      </div>
    </footer>
  );
}
