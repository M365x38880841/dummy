const ROWS = [
  ['Time to first NDPA feature', 'Days instead of weeks: 8 modules plus validators, scoring and a CLI', 'Integration work moves to the backend controls below'],
  ['Consent evidence', 'Good UX, versioning, and withdrawal', 'Client storage is not evidence. You need a server ledger and subject binding'],
  ['Integration quality', 'Headless hooks and adapters compose well', 'The `<NDPRConsent adapter>` preset never loads saved consent (6.1.0). Every integration needs e2e tests'],
  ['Input handling', 'Shared structured validators with stable codes', 'No content sanitisation. Output encoding and CSP are mandatory'],
  ['Breach response', '72h clock and required-content checklist', 'Needs staff authentication, and it checks that fields are filled in, not that the facts are right'],
  ['Governance / CI', '`ndpr audit` gives a pipeline gate and management scorecard', 'Self-attested inputs. Needs CODEOWNERS and evidence links'],
  ['Maintenance', 'Active releases that track NDPC GAID changes', 'Single maintainer and fast major-version churn'],
];

const CONDITIONS = [
  'Pin an exact version (`"6.1.0"`), commit the lockfile, and review each upgrade diff and changelog before it merges.',
  'Make the API the consent system of record: `composeAdapters(apiAdapter(...), localStorageAdapter(...))`, HttpOnly subject binding, and server timestamps.',
  'Keep an append-only, tamper-evident consent and DSR log (HMAC chain or WORM storage).',
  'Always re-validate with `/server` validators, then encode on output. Enforce a strict `script-src` CSP.',
  'Put breach, DPIA, RoPA and the DSR admin behind SSO and role checks. The toolkit provides none.',
  'Gate CI with `npm audit`, `npm run security:probe` and `ndpr audit`. `ndpr.audit.json` needs DPO approval through CODEOWNERS.',
  'Wrap toolkit imports behind an internal `privacy/` module so a fork or replacement is a contained change.',
];

// Renders `backticked` spans as <code>.
const md = (s) => s.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

export default function VerdictPage() {
  return (
    <>
      <h1>Verdict</h1>
      <div className="callout verdict">
        <b>Recommendation: ADOPT, with conditions.</b> The toolkit saves a lot of NDPA domain and UI work and is honest about its
        limits. It is not a security or evidence layer. Adopt it as the UX and rules engine, and keep identity, integrity and
        assurance controls in our own backend.
      </div>

      <h2>Value vs concern</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Area</th><th>Value</th><th>Concern / our responsibility</th></tr></thead>
          <tbody>{ROWS.map(([a, v, c]) => <tr key={a}><td><b>{a}</b></td><td>{md(v)}</td><td>{md(c)}</td></tr>)}</tbody>
        </table>
      </div>

      <h2>Adoption conditions (definition of done)</h2>
      <ol className="conditions">{CONDITIONS.map((c) => <li key={c}>{md(c)}</li>)}</ol>

      <h2>When NOT to adopt</h2>
      <ul>
        <li>Non-React frontend: only <code>/server</code> and <code>/core</code> are usable.</li>
        <li>You only need a cookie banner, or you must support IAB TCF. Use a dedicated CMP.</li>
        <li>You need a vendor SLA or a certified audit trail out of the box.</li>
      </ul>
    </>
  );
}
