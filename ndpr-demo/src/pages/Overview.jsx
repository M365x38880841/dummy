const MODULES = [
  ['Consent', '§25–26', 'Banner, preferences, pluggable storage'],
  ['Data Subject Rights', '§34–38', 'Request form + server validator'],
  ['Breach Notification', '§40 / GAID Art. 33', '72-hour readiness engine'],
  ['DPIA', '§28', 'Questionnaire + risk report'],
  ['Privacy Policy', '§27', 'Generator + PDF/DOCX export'],
  ['Lawful Basis', '§25', 'Processing activity tracker'],
  ['Cross-Border', '§41–43', 'Transfer mechanism manager'],
  ['RoPA', '§29', 'Records of processing + CSV export'],
];

export default function Overview() {
  return (
    <>
      <section className="hero">
        <h1>Should we adopt <code>ndpr-toolkit</code>?</h1>
        <p className="lead">
          A working app that runs the real package so stakeholders can judge it on observed behaviour. Each section shows
          <span className="pill good">Value</span> what it saves us, and
          <span className="pill warn">Concern</span> what we still have to own.
        </p>
      </section>

      <div className="grid cols-3">
        <div className="card stat"><b>8</b><span>NDPA modules in one package</span></div>
        <div className="card stat"><b>0</b><span>runtime dependencies (UI peers are optional)</span></div>
        <div className="card stat"><b>1</b><span>CLI compliance gate for CI (<code>ndpr audit</code>)</span></div>
      </div>

      <h2>What ships in the box</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Module</th><th>NDPA reference</th><th>What you get</th></tr></thead>
          <tbody>
            {MODULES.map(([m, s, d]) => (
              <tr key={m}><td>{m}</td><td><code>{s}</code></td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>How this demo is built</h2>
      <div className="grid cols-2">
        <div className="card">
          <h3>Frontend (React + Vite)</h3>
          <p>Uses the toolkit's <code>/presets</code>, <code>/core</code> and <code>/adapters</code> entry points as a product team would.</p>
        </div>
        <div className="card">
          <h3>Backend (Express)</h3>
          <p>
            Uses <code>/server</code> validators plus the controls the toolkit leaves to you: HttpOnly subject binding, server
            timestamps, an HMAC hash-chained consent log, rate limits, body limits, and CSP/Helmet headers.
          </p>
        </div>
      </div>

      <div className="callout">
        <b>Suggested walkthrough (15 min):</b> Consent → Subject Rights → Breach → Compliance → Cookie Scan → <b>Security Lab</b> → Verdict.
      </div>
    </>
  );
}
