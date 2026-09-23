import { useMemo, useState } from 'react';
import { NDPRComplianceDashboard } from '@tantainnovative/ndpr-toolkit/presets';
import { classifyDCPMI } from '@tantainnovative/ndpr-toolkit/core';
import { api } from '../api.js';

const today = new Date().toISOString().slice(0, 10);
const INITIAL = {
  consent: { hasConsentMechanism: true, hasPurposeSpecification: true, hasWithdrawalMechanism: true, hasMinorProtection: false, consentRecordsRetained: true },
  dsr: { hasRequestMechanism: true, supportsAccess: true, supportsRectification: true, supportsErasure: false, supportsPortability: false, supportsObjection: false, responseTimelineDays: 30 },
  dpia: { conductedForHighRisk: false, documentedRisks: false, mitigationMeasures: false },
  breach: { hasNotificationProcess: true, notifiesWithin72Hours: true, hasRiskAssessment: false, hasRecordKeeping: true },
  policy: { hasPrivacyPolicy: true, isPubliclyAccessible: true, lastUpdated: today, coversAllSections: false },
  lawfulBasis: { documentedForAllProcessing: false, hasLegitimateInterestAssessment: false },
  crossBorder: { hasTransferMechanisms: false, adequacyAssessed: false, ndpcApprovalObtained: false },
  ropa: { maintained: false, includesAllProcessing: false, lastReviewed: today },
};
const human = (k) => k.replace(/^(has|supports|is)/, '').replace(/([A-Z])/g, ' $1').trim();

export default function CompliancePage() {
  const [input, setInput] = useState(INITIAL);
  const [subjects, setSubjects] = useState(1200);
  const [audit, setAudit] = useState(null);
  const [busy, setBusy] = useState(false);

  const dcpmi = useMemo(() => classifyDCPMI({ dataSubjectsInSixMonths: subjects }), [subjects]);

  const toggle = (mod, key) => setInput((s) => ({ ...s, [mod]: { ...s[mod], [key]: !s[mod][key] } }));
  const setAll = (v) => setInput((s) => Object.fromEntries(Object.entries(s).map(([m, o]) => [m, Object.fromEntries(Object.entries(o).map(([k, x]) => [k, typeof x === 'boolean' ? v : x]))])));

  const runAudit = async () => {
    setBusy(true);
    try { setAudit(await api('/api/audit', { method: 'POST', body: { compliance: input, dcpmi: { dataSubjectsInSixMonths: subjects }, minScore: 70 } })); }
    catch (e) { setAudit({ text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h1>4 · Compliance score, DCPMI &amp; audit gate</h1>
      <p className="lead">Toggle controls and watch the score, the NDPC registration tier, and the CI audit verdict change.</p>

      <div className="grid cols-2">
        <div className="card">
          <h3>Self-assessment</h3>
          <div className="toolbar">
            <button onClick={() => setInput(INITIAL)}>Realistic startup</button>
            <button className="warn" onClick={() => { setAll(true); setSubjects(150); }}>Tick everything (“compliance theatre”)</button>
          </div>
          <div className="checks">
            {Object.entries(input).map(([mod, fields]) => (
              <fieldset key={mod}>
                <legend>{mod}</legend>
                {Object.entries(fields).filter(([, v]) => typeof v === 'boolean').map(([k, v]) => (
                  <label key={k}><input type="checkbox" checked={v} onChange={() => toggle(mod, k)} /> {human(k)}</label>
                ))}
              </fieldset>
            ))}
          </div>

          <h3>DCPMI designation (GAID 2025)</h3>
          <label className="slider">
            Data subjects processed in 6 months: <b>{subjects.toLocaleString()}</b>
            <input type="range" min={0} max={10000} step={50} value={subjects} onChange={(e) => setSubjects(Number(e.target.value))} />
          </label>
          <p>
            Tier <span className="pill">{dcpmi.tier ?? 'none'}</span> · DCPMI: <b>{String(dcpmi.isDCPMI)}</b> · Annual fee:{' '}
            <b>{dcpmi.annualFeeNGN != null ? `₦${dcpmi.annualFeeNGN.toLocaleString()}` : '-'}</b>
          </p>
          <p className="note">Thresholds and fees are a hard-coded snapshot of the NDPC ruleset. When the NDPC revises them, you need a package upgrade or an options override.</p>
        </div>

        <div className="card">
          <NDPRComplianceDashboard input={input} title="NDPA readiness" showRecommendations maxRecommendations={4} />
        </div>
      </div>

      <div className="card">
        <h3>CI gate: same engine as <code>npx ndpr audit</code></h3>
        <button onClick={runAudit} disabled={busy}>{busy ? 'Running…' : 'Run audit on server'}</button>
        {audit && (
          <>
            {audit.result && <p>Verdict: {audit.result.passed ? <span className="pill good">PASS · exit 0</span> : <span className="pill bad">FAIL · exit 1</span>}</p>}
            <pre className="code terminal">{audit.text}</pre>
          </>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card good-edge">
          <h3>Value</h3>
          <ul>
            <li>Gives management a single readiness number with prioritised, section-cited recommendations.</li>
            <li><code>ndpr audit</code> exits non-zero, so compliance becomes a pipeline gate next to SAST and dependency scans.</li>
            <li>DCPMI tier, fee and CAR filing dates are calculated for you, which saves admin work each year.</li>
            <li>It fails closed: set the slider above 200 and the audit fails until you supply Compliance Audit Return evidence.</li>
          </ul>
        </div>
        <div className="card warn-edge">
          <h3>Concern</h3>
          <ul>
            <li>Every input is a self-attested boolean. Click “Tick everything” (which also drops volume below the DCPMI threshold) and the gate passes at 100/100 with no evidence behind it.</li>
            <li>A green pipeline can give management and auditors false assurance. Protect <code>ndpr.audit.json</code> with CODEOWNERS (DPO) and link each flag to evidence.</li>
            <li>Regulatory values (tiers, fees, deadlines) are versioned rulesets. Regulatory change becomes a dependency-upgrade task.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
