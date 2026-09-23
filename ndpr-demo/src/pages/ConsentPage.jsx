import { useCallback, useEffect, useMemo, useState } from 'react';
import { NDPRConsent } from '@tantainnovative/ndpr-toolkit/presets';
import { ConsentBanner, useConsent } from '@tantainnovative/ndpr-toolkit/consent';
import { apiAdapter, composeAdapters, localStorageAdapter } from '@tantainnovative/ndpr-toolkit/adapters';
import { validateConsentStructured } from '@tantainnovative/ndpr-toolkit/core';
import { api, fmtTime } from '../api.js';

const OPTIONS = [
  { id: 'essential', label: 'Essential', description: 'Login session and security. Always on.', required: true, purpose: 'Service delivery' },
  { id: 'analytics', label: 'Analytics', description: 'Anonymous usage statistics.', required: false, purpose: 'Product analytics' },
  { id: 'marketing', label: 'Marketing', description: 'Personalised offers by email and ads.', required: false, purpose: 'Direct marketing' },
];
const QUICK_KEY = 'ndpr_consent'; // the toolkit's default key for <NDPRConsent />
const PROP_KEY = 'demo_adapter_prop_consent';
const HARD_KEY = 'demo_hardened_consent';
const KEYS = [QUICK_KEY, PROP_KEY, HARD_KEY];

const readLocal = (key) => {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
};

// Hardened: the headless hook LOADS through the adapter (API first, cache second)
// and awaits persistence; the toolkit banner is only the view.
function HardenedConsent({ adapter, onPersisted }) {
  const c = useConsent({ options: OPTIONS, adapter, version: '1.0' });
  return (
    <>
      <ConsentBanner
        options={OPTIONS}
        position="inline"
        manageStorage={false}
        show={!c.isLoading && c.shouldShowBanner}
        onSave={async (s) => { await c.updateConsent(s.consents); onPersisted(); }}
      />
      {!c.isLoading && !c.shouldShowBanner && (
        <p className="note">
          Stored choice: analytics <b>{String(c.hasConsent('analytics'))}</b>, marketing <b>{String(c.hasConsent('marketing'))}</b>.{' '}
          <button onClick={async () => { await c.resetConsent(); onPersisted(); }}>Withdraw</button>
        </p>
      )}
      {c.persistenceError && <p className="pill bad">Persistence failed: {c.persistenceError.message}</p>}
    </>
  );
}

export default function ConsentPage() {
  const [nonce, setNonce] = useState(0);
  const [log, setLog] = useState({ integrity: null, entries: [] });
  const [msg, setMsg] = useState('');

  const propAdapter = useMemo(() => localStorageAdapter(PROP_KEY), []);
  const hardAdapter = useMemo(
    () => composeAdapters(apiAdapter('/api/consent', { credentials: 'same-origin', timeoutMs: 5000 }), localStorageAdapter(HARD_KEY)),
    [],
  );

  const refresh = useCallback(async () => {
    try { setLog(await api('/api/consent/log')); } catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { refresh(); }, [refresh, nonce]);

  const remount = (text) => { setMsg(text); setNonce((n) => n + 1); };

  const reset = async () => {
    KEYS.forEach((k) => localStorage.removeItem(k));
    await api('/api/consent', { method: 'DELETE' }).catch(() => {});
    remount('All three reset. The withdrawal was logged on the server.');
  };

  const forge = () => {
    const forged = { consents: { essential: true, analytics: true, marketing: true }, timestamp: Date.now(), version: '1.0', method: 'banner', hasInteracted: true };
    KEYS.forEach((k) => localStorage.setItem(k, JSON.stringify(forged)));
    remount('A script wrote a forged "accept all" into localStorage. Components were remounted, as if on the next page load.');
  };

  const tamper = async () => {
    try {
      const r = await api('/api/consent/log/tamper', { method: 'POST' });
      setMsg(`An insider flipped "marketing" on record #${r.tampered} in the database. Integrity check → ${r.integrity.ok ? 'OK' : `BROKEN at #${r.integrity.brokenAt}`}.`);
      refresh();
    } catch (e) { setMsg(e.message); }
  };

  const quickState = readLocal(QUICK_KEY);
  const propState = readLocal(PROP_KEY);
  const serverHasRecord = log.entries.some((e) => e.action === 'save');

  return (
    <>
      <h1>1 · Consent management <small>NDPA §25–26</small></h1>
      <p className="lead">
        Three ways to wire the same consent UI. Make a choice in each, click <b>Simulate page reload</b>, then try the attack buttons.
      </p>

      <div className="toolbar">
        <button onClick={() => remount('Components remounted (same as a page reload).')}>Simulate page reload</button>
        <button onClick={reset}>Reset all</button>
        <button className="warn" onClick={forge}>Forge consent in localStorage</button>
        <button className="danger" onClick={tamper}>Simulate insider DB edit</button>
      </div>
      {msg && <div className="callout" role="status">{msg}</div>}

      <div className="grid cols-3 consent-grid">
        <div className="card">
          <h3>A · Zero-config <span className="pill warn">localStorage</span></h3>
          <pre className="code">{'<NDPRConsent />'}</pre>
          <div className="banner-host" data-testid="quick">
            <NDPRConsent key={`q${nonce}`} position="inline" options={OPTIONS} />
          </div>
          <h4>What the page trusts</h4>
          <pre className="code small">{quickState ? JSON.stringify(quickState, null, 2) : '(nothing stored → banner shown)'}</pre>
          {quickState && (
            <p className="note">
              <code>validateConsentStructured()</code> → <b>{String(validateConsentStructured(quickState).valid)}</b>. The record is valid,
              but it has no subject, no server time and no integrity check, so any script can write one.
            </p>
          )}
        </div>

        <div className="card bad-edge">
          <h3>B · Adapter prop <span className="pill bad">defect</span></h3>
          <pre className="code">{`<NDPRConsent adapter={localStorageAdapter(
  '${PROP_KEY}')} />`}</pre>
          <div className="banner-host" data-testid="prop">
            <NDPRConsent key={`p${nonce}`} position="inline" options={OPTIONS} adapter={propAdapter} />
          </div>
          <p className="note">
            Stored: <b>{propState ? 'yes' : 'no'}</b>. In v6.1.0, the preset only calls <code>adapter.save()</code>. It never calls <code>load()</code> and never awaits
            the save. The banner comes back on every reload, and API save failures are silently lost. This is the README's
            "server-side persistence" example.
          </p>
        </div>

        <div className="card good-edge">
          <h3>C · Hardened <span className="pill good">API is system of record</span></h3>
          <pre className="code">{`useConsent({ adapter: composeAdapters(
  apiAdapter('/api/consent'),
  localStorageAdapter('${HARD_KEY}')) })
+ <ConsentBanner manageStorage={false} />`}</pre>
          <div className="banner-host" data-testid="hard">
            <HardenedConsent key={`h${nonce}`} adapter={hardAdapter} onPersisted={() => setTimeout(refresh, 200)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Server ledger for C (HttpOnly subject cookie · server timestamps · HMAC hash chain)</h3>
        <p>
          Chain integrity:{' '}
          {log.integrity ? (
            log.integrity.ok ? <span className="pill good">verified · {log.integrity.length} entries</span> : <span className="pill bad">BROKEN at #{log.integrity.brokenAt}</span>
          ) : '…'}
          {!serverHasRecord && <span className="pill warn">no consent saved on server</span>}
        </p>
        <div className="table-wrap">
          <table className="compact">
            <thead><tr><th>#</th><th>Action</th><th>Granted</th><th>Server time</th><th>Client clock skew</th><th>Hash</th></tr></thead>
            <tbody>
              {log.entries.length === 0 && <tr><td colSpan={6}>No entries yet. Make a choice in banner C.</td></tr>}
              {log.entries.map((e) => (
                <tr key={e.seq}>
                  <td>{e.seq}</td>
                  <td>{e.action}</td>
                  <td>{e.consents ? Object.entries(e.consents).filter(([, v]) => v).map(([k]) => k).join(', ') : '-'}</td>
                  <td>{fmtTime(e.receivedAt)}</td>
                  <td>{e.clientClockSkewMs != null ? `${Math.round(e.clientClockSkewMs / 1000)}s` : '-'}</td>
                  <td><code>{e.hash.slice(0, 12)}…</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card good-edge">
          <h3>Value</h3>
          <ul>
            <li>Purpose-specific options with required and optional categories, withdrawal, versioning and staleness checks, all ready to use.</li>
            <li>The headless <code>useConsent</code> hook plus pluggable adapters give a clean path to a server-side system of record.</li>
            <li>Adapters declare their own guarantees (<code>evidenceSuitability: "ux-state-only"</code>). This is honest and easy to audit.</li>
          </ul>
        </div>
        <div className="card warn-edge">
          <h3>Concern</h3>
          <ul>
            <li>The zero-config default is localStorage. Any script on the page (an XSS payload or a third-party tag) can forge consent.</li>
            <li>Option B, the documented <code>adapter</code> prop, is write-only in 6.1.0. Test the integration you choose. Do not trust the README alone.</li>
            <li>Even in C, a forged local cache is trusted when the API has no record. Server-side actions such as marketing email must read the <b>server ledger</b>, never the client.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
