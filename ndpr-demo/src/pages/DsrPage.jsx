import { useCallback, useEffect, useState } from 'react';
import { NDPRSubjectRights } from '@tantainnovative/ndpr-toolkit/presets';
import { api, fmtTime } from '../api.js';

// Harmless payload that proves script execution by flagging the page and showing an alert.
const XSS = `<img src=x onerror="document.body.dataset.pwned='dsr';alert('Stored XSS: script ran from a DSR name field')">`;

export default function DsrPage() {
  const [inbox, setInbox] = useState([]);
  const [unsafe, setUnsafe] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(() => api('/api/dsr').then(setInbox).catch((e) => setMsg(e.message)), []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const sendMalicious = async () => {
    try {
      const r = await api('/api/dsr', {
        method: 'POST',
        body: { requestType: 'access', dataSubject: { fullName: XSS, email: 'attacker@example.ng', identifierType: 'email', identifierValue: 'attacker@example.ng' }, submittedAt: Date.now() },
      });
      setMsg(`Accepted by validateDsrSubmissionStructured → ${r.reference}. The payload is now in the DPO inbox.`);
      refresh();
    } catch (e) { setMsg(e.message); }
  };

  const sendInvalid = async () => {
    try {
      await api('/api/dsr', { method: 'POST', body: { requestType: 'delete_everything', dataSubject: { email: 'not-an-email' } } });
    } catch (e) {
      setMsg(`Rejected (422): ${e.data?.errors?.map((x) => x.code).join(', ')}`);
    }
  };

  return (
    <>
      <h1>2 · Data Subject Rights <small>NDPA Part VI §34–38</small></h1>
      <p className="lead">The same validation rules run in the form and in the API. The request lands in a DPO inbox with a reference number and a 30-day due date.</p>

      <div className="grid cols-2">
        <div className="card">
          <h3>Public request form <span className="pill">&lt;NDPRSubjectRights submitTo="/api/dsr" /&gt;</span></h3>
          <NDPRSubjectRights
            submitTo="/api/dsr"
            submitOptions={{ credentials: 'same-origin' }}
            onSubmit={() => setTimeout(refresh, 400)}
            onSubmitError={({ response }) => setMsg(`Server rejected the request (${response?.status ?? 'network'})`)}
          />
        </div>

        <div className="card">
          <h3>DPO inbox</h3>
          <div className="toolbar">
            <button onClick={sendInvalid}>Send malformed request</button>
            <button className="warn" onClick={sendMalicious}>Send stored-XSS payload</button>
            <label className="switch">
              <input type="checkbox" checked={unsafe} onChange={(e) => setUnsafe(e.target.checked)} />
              Vulnerable admin view (innerHTML)
            </label>
          </div>
          {msg && <div className="callout" role="status">{msg}</div>}
          <div className="table-wrap">
            <table className="compact">
              <thead><tr><th>Ref</th><th>Type</th><th>Name</th><th>Email</th><th>Due by</th></tr></thead>
              <tbody>
                {inbox.length === 0 && <tr><td colSpan={5}>No requests yet.</td></tr>}
                {inbox.map((t) => (
                  <tr key={t.reference}>
                    <td><code>{t.reference}</code></td>
                    <td>{t.requestType}</td>
                    {unsafe
                      ? <td className="danger-cell" dangerouslySetInnerHTML={{ __html: t.fullName }} />
                      : <td>{t.fullName}</td>}
                    <td>{t.email}</td>
                    <td>{fmtTime(t.dueBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Safe view: React renders the name as text. Vulnerable view: it renders like a typical email template or legacy admin
            tool. Under <code>npm start</code> (production), the CSP blocks the inline handler. Under <code>npm run dev</code> there is no CSP, so the script runs.
          </p>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card good-edge">
          <h3>Value</h3>
          <ul>
            <li>Covers all nine NDPA request types, including automated decision-making and consent withdrawal.</li>
            <li><code>validateDsrSubmissionStructured</code> returns stable error codes such as <code>request_type_not_allowed</code>, so client and server stay in sync without a hand-written schema.</li>
            <li><code>submitTo</code> wires the form to your API in one prop.</li>
          </ul>
        </div>
        <div className="card warn-edge">
          <h3>Concern</h3>
          <ul>
            <li>The validators check shape, not content safety. HTML and script payloads pass through unchanged, so output encoding is your job everywhere the data goes (inbox, emails, PDFs, exports).</li>
            <li>There is no identity verification, deduplication, abuse protection or SLA tracking. A DSR portal is a PII-harvesting and spam target, so add rate limits, CAPTCHA, and email verification.</li>
            <li><code>identifierValue</code> is free text. If your verification process asks for NIN, BVN or account numbers, you are collecting high-risk identifiers through a public form. Minimise them, and encrypt them at rest.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
