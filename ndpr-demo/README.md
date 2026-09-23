# NDPR Toolkit Adoption Demo

A working React + Express app that runs the real
[`@tantainnovative/ndpr-toolkit`](https://github.com/mr-tanta/ndpr-toolkit) (pinned to **6.1.0**). It shows stakeholders
**what the package gives us** and **what we still have to own** before we adopt it. Every claim in the UI comes from
behaviour you can observe live, not from slides.

> Not legal advice. The backend stores data in memory and resets on restart.

## Quick start

```bash
cd ndpr-demo
npm ci
npm run dev            # API :3001 + Vite :5173 → open http://localhost:5173
```

Production mode (Helmet/CSP on). Use this for the XSS/CSP part of the demo:

```bash
npm run build
CONSENT_LOG_HMAC_KEY=$(openssl rand -hex 32) npm start   # http://localhost:3001
```

Docker:

```bash
docker build -t ndpr-demo .
docker run --rm -p 3001:3001 -e CONSENT_LOG_HMAC_KEY=$(openssl rand -hex 32) ndpr-demo
```

| Script | Purpose |
|---|---|
| `npm run security:probe` | Runs the Security Lab checks against the installed toolkit from the CLI. Add `--strict` to exit 1 on high findings, for example to gate a version bump. |
| `npm run audit:ndpr` | The toolkit's `ndpr audit` CLI against `ndpr.audit.json` |
| `npm run audit:deps` | `npm audit` on production dependencies, high severity and above |
| `npm run ci` | All of the above plus the build. CI runs the same steps (`.github/workflows/ndpr-demo.yml`) |

## Presenter script (≈15 min)

| # | Page | Do this | Point to make |
|---|---|---|---|
| 1 | **Consent** | Click *Accept All* in A, B and C, then *Simulate page reload*. | A and C remember the choice. **B shows the banner again.** The README's `adapter` prop is write-only in 6.1.0. |
| | | Click *Forge consent in localStorage*. | Any script can write "consent" that the toolkit trusts. Client state is not evidence. |
| | | Click *Reject All* in C, then *Simulate insider DB edit*. | Our HMAC hash chain shows **BROKEN**. The toolkit has no tamper evidence, so we add it ourselves. |
| 2 | **Subject Rights** | *Send malformed request*. | The validator rejects it with stable error codes. This is a strength. |
| | | *Send stored-XSS payload*, then tick *Vulnerable admin view*. | The validator **accepted** HTML. With `npm run dev` the script runs. With `npm start` the CSP blocks it. Output encoding and CSP are our job. |
| 3 | **Breach 72h** | Log the three sample incidents. | You get the 72-hour countdown and the NDPC required-content checklist. It checks that fields are filled in, not that the facts are right. |
| 4 | **Compliance** | *Run audit* (FAIL), then *Tick everything* and *Run audit* (PASS 100/100). | The CI gate trusts self-attested booleans. It needs CODEOWNERS and evidence behind each flag. |
| 5 | **Cookie Scan** | *Marketing adds tags*. | Finds shadow trackers. It cannot see HttpOnly cookies, storage, or fingerprinting. |
| 6 | **Security Lab** | Scroll. | 3 high and 3 medium confirmed live, plus governance risks. |
| 7 | **Verdict** | | **Adopt, with conditions.** Read out the definition of done. |

## Findings (v6.1.0, verified September 2026)

| Finding | Severity | Evidence |
|---|---|---|
| `<NDPRConsent adapter>` never calls `adapter.load()`, and saves are fire-and-forget | High (functional) | `dist/chunk-OXCJJTG5.mjs` sets `manageStorage: !adapter` and calls `n.save(i)` without awaiting it. Consent page, column B. |
| Forged or future-dated consent passes `validateConsentStructured` | High / Med | `npm run security:probe` |
| HTML payloads pass `validateDsrSubmissionStructured` unchanged | High | Security Lab and DSR page |
| `sanitizeInput('javascript:…')` is returned unchanged | Medium | Security Lab |
| Built-in browser adapters self-report `evidenceSuitability: "ux-state-only"` | High (by design) | Security Lab |
| `ndpr audit` passes on self-attested flags | Medium | Compliance page |
| One maintainer (~530 of 531 commits) · 5 major versions between Apr and Jul 2026 · SECURITY.md still lists 5.x as supported | Governance | Upstream repo |

**Strengths:** zero runtime dependencies, pure React-free `/server` and `/core` entry points, stable error codes, honest
adapter capability metadata, the audit fails closed when DCPMI requires CAR evidence, and section-cited legal references throughout.

## Architecture: what the demo adds around the toolkit

```
Browser (React)                              Express API (server/index.js)
────────────────                             ─────────────────────────────
toolkit presets / hooks / core  ──JSON──▶    toolkit /server validators
                                             + HttpOnly SameSite=Strict subject cookie
                                             + server-side timestamps (client clock = metadata)
                                             + HMAC-SHA256 hash-chained consent ledger
                                             + field length caps, allow-listed DSR types
                                             + rate limit (60/min), 16 kB body limit
                                             + Helmet: CSP script-src 'self', HSTS, frame-ancestors 'none'
                                             + no stack traces in error responses
```

`POST /api/consent/log/tamper` exists **only for the demo**. Disable it with `DEMO_TAMPER=0`, and never copy it into a real app.

## Adoption conditions (definition of done)

1. Pin the exact version, commit the lockfile, and review each upgrade's changelog and diff.
2. Make the API the consent system of record (`useConsent` + `composeAdapters(apiAdapter, localStorageAdapter)`), with an HttpOnly subject cookie and server timestamps.
3. Keep an append-only, tamper-evident consent and DSR log (HMAC chain or WORM storage).
4. Re-validate with `/server` on every write. Encode on output. Enforce a strict `script-src` CSP.
5. Put breach, DPIA, RoPA and the DSR admin behind SSO and role checks.
6. CI: `npm audit` + `security:probe` + `ndpr audit`. `ndpr.audit.json` needs DPO approval through CODEOWNERS.
7. Wrap toolkit imports behind an internal `privacy/` module so a fork or replacement stays contained.
