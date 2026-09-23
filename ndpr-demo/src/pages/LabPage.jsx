import { useMemo, useState } from 'react';
import { runChecks } from '../lab/checks.js';

// Non-code adoption risks, with the evidence we checked (Sept 2026, v6.1.0).
const GOVERNANCE = [
  ['Preset adapter is write-only', 'high', '<NDPRConsent adapter={...}> passes manageStorage=false and only calls adapter.save() (fire-and-forget). It never calls load(). The banner reappears on every visit and API save errors are swallowed. See Consent → column B.', 'Use useConsent({ adapter }) with <ConsentBanner manageStorage={false} show={shouldShowBanner} />. Add an e2e test that checks consent survives a page reload, and report the issue upstream.'],
  ['Maintainer concentration', 'high', 'About 530 of 531 commits come from one author, and CODEOWNERS lists only @mr-tanta.', 'Bus factor of 1. Pin exact versions, vendor-review each upgrade, and be ready to fork.'],
  ['API churn', 'medium', 'Five major versions between 2.0 (Apr 4, 2026) and 6.0 (Jul 19, 2026). 4.0 and 5.0 shipped on the same day.', 'Expect breaking upgrades roughly quarterly. Budget time for them, and wrap the toolkit behind your own module boundary.'],
  ['Security policy drift', 'medium', 'SECURITY.md lists "5.x (latest minor)" as supported, but the current release line is 6.x.', 'Confirm the support window with the maintainer before relying on it for fixes.'],
  ['Regulatory snapshot', 'medium', 'DCPMI tiers, fees, CAR deadlines and the cookie registry are versioned rulesets inside the package.', 'Subscribe to releases. Use the options overrides when the NDPC publishes changes before the package does.'],
  ['Not legal advice', 'medium', 'Every module says it is an implementation aid. Scores are "implementation-readiness", not certification.', 'Keep DPO/legal sign-off in the loop. Do not present scores as regulator approval.'],
  ['Frontend coupling', 'low', 'UI is React 18/19 only, with 8 UI peer deps. PDF/DOCX export pulls optional jspdf/docx (jspdf has had advisories; the toolkit requires 4.2.1 or later).', 'Use /server and /core from non-React stacks. Run npm audit and SCA in CI.'],
  ['CSP compatibility', 'low', 'Components set inline style attributes, so style-src needs \'unsafe-inline\'. Scripts can stay strict (script-src \'self\').', 'Acceptable. Keep script-src strict, which is what blocks the stored-XSS demo in production.'],
];

const sevClass = { high: 'bad', medium: 'warn', low: 'muted', info: 'good' };

export default function LabPage() {
  const [nonce, setNonce] = useState(0);
  const checks = useMemo(() => runChecks(), [nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const exposed = checks.filter((c) => c.exposed);

  return (
    <>
      <h1>⚠ Security Lab</h1>
      <p className="lead">
        These checks run live, in your browser, against the installed package. Run the same suite from the terminal with <code>npm run security:probe</code>.
      </p>
      <div className="toolbar">
        <button onClick={() => setNonce((n) => n + 1)}>Re-run checks</button>
        <span className="pill bad">{exposed.filter((c) => c.severity === 'high').length} high</span>
        <span className="pill warn">{exposed.filter((c) => c.severity === 'medium').length} medium</span>
        <span className="pill good">{checks.filter((c) => c.strength).length} strength</span>
      </div>

      <div className="lab">
        {checks.map((c) => (
          <article key={c.id} className={`card lab-item ${c.strength ? 'good-edge' : c.exposed ? `${sevClass[c.severity]}-edge` : ''}`}>
            <header>
              <span className={`pill ${c.strength ? 'good' : sevClass[c.severity]}`}>{c.strength ? 'STRENGTH' : c.exposed ? `CONFIRMED · ${c.severity}` : 'not reproduced'}</span>
              <small>{c.category}</small>
            </header>
            <h3>{c.title}</h3>
            <pre className="code small">{c.observed}</pre>
            <p><b>Why it matters:</b> {c.why}</p>
            <p><b>Mitigation:</b> {c.mitigation}</p>
          </article>
        ))}
      </div>

      <h2>Supply-chain &amp; governance risks</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Risk</th><th>Level</th><th>Evidence</th><th>Mitigation</th></tr></thead>
          <tbody>
            {GOVERNANCE.map(([r, lvl, ev, mit]) => (
              <tr key={r}><td><b>{r}</b></td><td><span className={`pill ${sevClass[lvl]}`}>{lvl}</span></td><td>{ev}</td><td>{mit}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="callout">
        <b>Framing for stakeholders:</b> none of these is a CVE. One is a functional bug worth reporting upstream (the write-only preset adapter). The rest are <b>shared-responsibility gaps</b>. The toolkit
        handles NDPA structure and UX. Identity, integrity, output encoding, authorisation and evidence remain the application team's job.
      </div>
    </>
  );
}
