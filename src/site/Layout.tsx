import type { ReactNode } from 'react';
import { Link, usePath } from './router';

export function Layout({ children }: { children: ReactNode }) {
  const path = usePath();
  const nav = [
    { to: '/play', label: 'Take the test' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/replay', label: 'Replays' },
  ];
  return (
    <div className="site">
      <header className="site-header">
        <div className="wrap site-header-row">
          <Link to="/" className="wordmark">
            Computer-Use Benchmark
          </Link>
          <nav className="site-nav">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className={path.startsWith(n.to) ? 'is-current' : ''}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div className="wrap">
          <span>Computer-Use Benchmark</span>
          <span>Every run on this site is reproducible from its seed.</span>
        </div>
      </footer>
    </div>
  );
}
