import { useCallback, useEffect, useState } from 'react';
import { NDPRBreachReport } from '@tantainnovative/ndpr-toolkit/presets';
import { api, fmtTime } from '../api.js';

const HOUR = 3600_000;
const sample = (hoursAgo, complete) => ({
  title: `Exposed S3 bucket with KYC documents (${hoursAgo}h ago)`,
  description: 'Public-read ACL found on a bucket holding customer ID scans.',
  category: 'unauthorized_access',
  discoveredAt: Date.now() - hoursAgo * HOUR,
  occurredAt: Date.now() - (hoursAgo + 48) * HOUR,
  reporter: { name: 'SecOps On-call', email: 'secops@example.ng', department: 'Security' },
  affectedSystems: ['kyc-docs-bucket'],
  dataTypes: ['government_id', 'contact'],
  estimatedAffectedSubjects: 1840,
  ...(complete && {
    involvesSensitiveData: false,
    approximateRecordCount: 2100,
    dataSubjectCategories: ['customers'],
    likelyConsequences: 'Identity theft and fraudulent account opening.',
    mitigationMeasures: 'ACL revoked, access logs preserved, keys rotated, affected customers to be notified.',
    initialActions: 'Bucket made private within 20 minutes of discovery.',
    dpoContact: { name: 'Jane DPO', email: 'dpo@example.ng' },
    status: 'contained',
  }),
});

function Assessment({ a }) {
  const t = a.timing;
  const hrs = t?.hoursRemaining;
  return (
    <div className="assessment">
      <div className="meter" aria-label={`Completeness ${a.completeness}%`}>
        <span style={{ width: `${a.completeness}%` }} />
      </div>
      <p>
        <b>{a.completeness}%</b> of NDPC notification content present ·{' '}
        {t?.overdue ? <span className="pill bad">72h window OVERDUE</span> : <span className={`pill ${hrs < 24 ? 'warn' : 'good'}`}>{hrs?.toFixed(1)}h left to notify NDPC</span>}
        {a.dataSubjectCommunicationRequired && <span className="pill warn">data subjects must be told (§40(3))</span>}
      </p>
      {a.missing?.length > 0 && (
        <details>
          <summary>{a.missing.length} missing item(s)</summary>
          <ul>{a.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export default function BreachPage() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');
  const refresh = useCallback(() => api('/api/breach').then(setItems).catch((e) => setMsg(e.message)), []);
  useEffect(() => { refresh(); }, [refresh]);

  const post = async (body) => {
    try { await api('/api/breach', { method: 'POST', body }); refresh(); } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <h1>3 · Breach notification <small>NDPA §40 · GAID 2025 Art. 33</small></h1>
      <p className="lead">The 72-hour clock starts at discovery. The toolkit checks each report against the content the NDPC requires and tracks the deadline.</p>

      <div className="toolbar">
        <button onClick={() => post(sample(6, true))}>Log complete incident (6h ago)</button>
        <button className="warn" onClick={() => post(sample(60, false))}>Log thin incident (60h ago)</button>
        <button className="danger" onClick={() => post(sample(80, false))}>Log overdue incident (80h ago)</button>
      </div>
      {msg && <div className="callout" role="status">{msg}</div>}

      <div className="grid cols-2">
        <div className="card">
          <h3>Incident register (server-side <code>assessBreachNotification</code>)</h3>
          {items.length === 0 && <p>No incidents yet. Use the buttons above or the form.</p>}
          {items.map(({ report, assessment }) => (
            <div key={report.id} className="incident">
              <h4>{report.title}</h4>
              <small>{report.id} · discovered {fmtTime(report.discoveredAt)}</small>
              <Assessment a={assessment} />
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Staff report form <span className="pill">&lt;NDPRBreachReport /&gt;</span></h3>
          <NDPRBreachReport submitTo="/api/breach" submitOptions={{ credentials: 'same-origin' }} onSubmit={() => setTimeout(refresh, 400)} />
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card good-edge">
          <h3>Value</h3>
          <ul>
            <li>Each required notification item is mapped to its legal source, which removes guesswork from a stressful, time-boxed process.</li>
            <li>The live countdown and phased-report support match how incidents actually unfold.</li>
            <li>The logic is pure and has no React, so the same check runs in the API, CI, or a Slack bot.</li>
          </ul>
        </div>
        <div className="card warn-edge">
          <h3>Concern</h3>
          <ul>
            <li>It checks that fields are filled in, not that the facts are right. "100% complete" does not mean the NDPC was notified.</li>
            <li>The breach form must sit behind staff authentication. The toolkit ships none. An open form lets anyone plant fake incidents.</li>
            <li>Incident data is highly sensitive. You own encryption, access control and retention for it.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
