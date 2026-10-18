import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Minimal path router: /, /docs and /app. Server and Vercel rewrite these to index.html.
export type Route = 'landing' | 'docs' | 'app';
export function routeOf(path: string): Route {
  if (path.startsWith('/app')) return 'app';
  if (path.startsWith('/docs')) return 'docs';
  return 'landing';
}
export function navigate(to: string) {
  if (to === window.location.pathname + window.location.hash) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (!to.includes('#')) window.scrollTo({ top: 0 });
}
export function useRoute(): Route {
  const [route, setRoute] = useState(() => routeOf(window.location.pathname));
  useEffect(() => {
    const update = () => setRoute(routeOf(window.location.pathname));
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return route;
}
export function Link({
  to,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      href={to}
      {...props}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    />
  );
}
