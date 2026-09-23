import { useState } from 'react';
import { scanCookies } from '@tantainnovative/ndpr-toolkit/core';

// What the privacy notice says we use.
const DECLARED = [
  { name: 'demo_theme', category: 'necessary', provider: 'This app', purpose: 'Remembers UI theme' },
];
// Simulates a marketing team adding tags without telling the DPO.
const TRACKERS = ['_ga=GA1.1.123.456', '_fbp=fb.1.123.456', '_hjSessionUser_1=abc', '_clck=xyz', 'mystery_uid=42'];

const setCookie = (c) => { document.cookie = `${c}; path=/; SameSite=Lax; max-age=3600`; };
const clearCookies = () => document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter(Boolean)
  .forEach((n) => { document.cookie = `${n}=; path=/; max-age=0`; });

export default function CookiesPage() {
  const [scan, setScan] = useState(() => scanCookies(DECLARED));
  const rescan = () => setScan(scanCookies(DECLARED));

  return (
    <>
      <h1>5 · Cookie scanner <small>NDPA §25–26</small></h1>
      <p className="lead">Compares the cookies actually present with the cookies your notice declares, and names known third-party trackers.</p>

      <div className="toolbar">
        <button onClick={() => { setCookie('demo_theme=dark'); rescan(); }}>Set declared cookie</button>
        <button className="warn" onClick={() => { TRACKERS.forEach(setCookie); rescan(); }}>Marketing adds tags (undeclared)</button>
        <button onClick={() => { clearCookies(); rescan(); }}>Clear cookies</button>
        <button onClick={rescan}>Rescan</button>
      </div>

      <div className="grid cols-3">
        <div className="card stat"><b>{scan.total}</b><span>cookies visible to JS</span></div>
        <div className="card stat"><b>{scan.undeclared.length}</b><span>undeclared (compliance gap)</span></div>
        <div className="card stat"><b>{scan.identified?.length ?? 0}</b><span>identified by built-in registry</span></div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cookie</th><th>Status</th><th>Category</th><th>Provider</th><th>Purpose</th></tr></thead>
            <tbody>
              {scan.cookies.length === 0 && <tr><td colSpan={5}>No cookies visible.</td></tr>}
              {scan.cookies.map((c) => (
                <tr key={c.name}>
                  <td><code>{c.name}</code></td>
                  <td>{c.matchedBy === 'declared' ? <span className="pill good">declared</span> : c.matchedBy === 'known' ? <span className="pill warn">undeclared · known</span> : <span className="pill bad">undeclared · unknown</span>}</td>
                  <td>{c.category ?? '-'}</td>
                  <td>{c.provider ?? '-'}</td>
                  <td>{c.purpose ?? '-'}</td>
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
            <li>Catches shadow tracking that marketing adds without telling the DPO. This is one of the most common real-world consent failures.</li>
            <li>The built-in registry names Google, Meta, Hotjar, Clarity and others, so reports are actionable.</li>
            <li>It is pure, so you can run it in a Playwright job against staging on each release.</li>
          </ul>
        </div>
        <div className="card warn-edge">
          <h3>Concern</h3>
          <ul>
            <li>It only sees <code>document.cookie</code>. HttpOnly cookies such as this app's own <code>ndpr_sid</code>, third-party cookies, localStorage, IndexedDB and fingerprinting are all invisible to it.</li>
            <li>It scans the page after scripts have already run. Detecting a tracker does not block it, so you still need consent-gated tag loading.</li>
            <li>The known-cookie registry is a static list that goes stale without package upgrades.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
