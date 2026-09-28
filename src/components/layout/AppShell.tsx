import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useProfileSync } from '@/hooks/useProfileSync';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { pageMeta } from './pageMeta';

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  useDocumentTitle(pageMeta(pathname).title);
  useProfileSync();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="app-shell">
      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <Topbar onOpenNav={() => setNavOpen(true)} />
        {children}
      </main>
    </div>
  );
}
