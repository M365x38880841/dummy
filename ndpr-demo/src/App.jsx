import { useEffect, useState } from 'react';
import Overview from './pages/Overview.jsx';
import ConsentPage from './pages/ConsentPage.jsx';
import DsrPage from './pages/DsrPage.jsx';
import BreachPage from './pages/BreachPage.jsx';
import CompliancePage from './pages/CompliancePage.jsx';
import CookiesPage from './pages/CookiesPage.jsx';
import LabPage from './pages/LabPage.jsx';
import VerdictPage from './pages/VerdictPage.jsx';

// Ordered as a presentation: value first, then risk, then the decision.
const PAGES = [
  { id: 'overview', label: 'Overview', el: Overview },
  { id: 'consent', label: '1 · Consent', el: ConsentPage },
  { id: 'dsr', label: '2 · Subject Rights', el: DsrPage },
  { id: 'breach', label: '3 · Breach 72h', el: BreachPage },
  { id: 'compliance', label: '4 · Compliance & Audit', el: CompliancePage },
  { id: 'cookies', label: '5 · Cookie Scan', el: CookiesPage },
  { id: 'lab', label: '⚠ Security Lab', el: LabPage },
  { id: 'verdict', label: 'Verdict', el: VerdictPage },
];

const fromHash = () => PAGES.find((p) => `#${p.id}` === window.location.hash)?.id ?? 'overview';

export default function App() {
  const [page, setPage] = useState(fromHash);
  useEffect(() => {
    const onHash = () => setPage(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const Current = PAGES.find((p) => p.id === page).el;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>🇳🇬</span>
          <div>
            <strong>NDPR Toolkit</strong>
            <small>Adoption demo: value &amp; concerns</small>
          </div>
        </div>
        <nav aria-label="Demo sections">
          {PAGES.map((p) => (
            <a key={p.id} href={`#${p.id}`} className={p.id === page ? 'active' : ''} aria-current={p.id === page ? 'page' : undefined}>
              {p.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="content">
        <Current />
      </main>
      <footer className="foot">
        Demo of <code>@tantainnovative/ndpr-toolkit@6.1.0</code>. Not legal advice. The in-memory backend resets on restart.
      </footer>
    </div>
  );
}
