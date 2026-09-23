// Reference backend for the demo. Shows the server-side half the toolkit does
// NOT do for you: identity binding, server timestamps, tamper-evident records,
// size limits, rate limits and security headers. Storage is in-memory on purpose
// (demo only): swap the arrays for a database with append-only permissions.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import {
  validateConsentStructured,
  validateDsrSubmissionStructured,
  assessBreachNotification,
  runNdprAudit,
  formatNdprAuditReport,
} from '@tantainnovative/ndpr-toolkit/server';

const PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3001;
const HMAC_KEY = process.env.CONSENT_LOG_HMAC_KEY || (PROD ? null : 'dev-only-insecure-key');
if (!HMAC_KEY) {
  console.error('CONSENT_LOG_HMAC_KEY must be set in production');
  process.exit(1);
}

const ALLOWED_DSR_TYPES = ['information', 'access', 'rectification', 'erasure', 'restriction', 'portability', 'objection', 'automated_decision_making', 'withdraw_consent'];
const MAX_FIELD = 200;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: PROD
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            // The toolkit's theme/progress components set inline style attributes.
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: null, // TLS is terminated upstream; keeps plain-http local demos working
          },
        }
      : false, // Vite dev server injects inline scripts for HMR
  }),
);
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api', express.json({ limit: '16kb' }));

// ---- Subject binding: server-issued, HttpOnly, never readable by page JS ----
const SUBJECT_COOKIE = 'ndpr_sid';
function subjectId(req, res) {
  const raw = req.headers.cookie || '';
  const match = raw.split(/;\s*/).find((c) => c.startsWith(`${SUBJECT_COOKIE}=`));
  const existing = match?.slice(SUBJECT_COOKIE.length + 1);
  if (existing && /^anon_[0-9a-f-]{36}$/.test(existing)) return existing;
  const id = `anon_${crypto.randomUUID()}`;
  res.cookie(SUBJECT_COOKIE, id, { httpOnly: true, sameSite: 'strict', secure: PROD, maxAge: 180 * 24 * 3600 * 1000, path: '/' });
  return id;
}

// ---- Tamper-evident consent log: each entry HMACs the previous hash ----
const consentLog = [];
const currentConsent = new Map();
function appendConsent(entry) {
  const prevHash = consentLog.at(-1)?.hash ?? 'GENESIS';
  const body = { seq: consentLog.length + 1, ...entry, prevHash };
  const hash = crypto.createHmac('sha256', HMAC_KEY).update(JSON.stringify(body)).digest('hex');
  const record = { ...body, hash };
  consentLog.push(record);
  return record;
}
function verifyChain() {
  let prev = 'GENESIS';
  for (const r of consentLog) {
    const { hash, ...body } = r;
    const expected = crypto.createHmac('sha256', HMAC_KEY).update(JSON.stringify(body)).digest('hex');
    if (body.prevHash !== prev || expected !== hash) return { ok: false, brokenAt: r.seq };
    prev = hash;
  }
  return { ok: true, length: consentLog.length };
}

const bad = (res, errors, status = 422) => res.status(status).json({ errors });

// apiAdapter contract: GET = load, POST = save, DELETE = remove
app.get('/api/consent', (req, res) => {
  res.json(currentConsent.get(subjectId(req, res)) ?? null);
});

app.post('/api/consent', (req, res) => {
  const sid = subjectId(req, res);
  const { valid, errors, data } = validateConsentStructured(req.body);
  if (!valid) return bad(res, errors);
  const keys = Object.keys(data.consents);
  if (keys.length > 20 || keys.some((k) => !/^[a-z0-9_-]{1,40}$/i.test(k))) {
    return bad(res, [{ field: 'consents', code: 'consent_keys_invalid', message: 'Unexpected consent keys' }]);
  }
  const receivedAt = Date.now();
  // Evidence uses the SERVER clock; the client clock is kept only as metadata.
  const record = appendConsent({
    subject: sid,
    action: 'save',
    consents: data.consents,
    version: String(data.version).slice(0, 20),
    method: String(data.method).slice(0, 20),
    clientTimestamp: data.timestamp,
    clientClockSkewMs: data.timestamp - receivedAt,
    receivedAt,
  });
  currentConsent.set(sid, data);
  res.status(201).json(data);
  console.info(`[consent] seq=${record.seq} subject=${sid.slice(0, 13)}…`);
});

app.delete('/api/consent', (req, res) => {
  const sid = subjectId(req, res);
  currentConsent.delete(sid);
  appendConsent({ subject: sid, action: 'withdraw', receivedAt: Date.now() });
  res.status(204).end();
});

app.get('/api/consent/log', (_req, res) => {
  res.json({ integrity: verifyChain(), entries: consentLog.slice(-25).reverse() });
});

// DEMO-ONLY: simulates an insider editing the database to show the chain breaking.
// Never ship an endpoint like this. Set DEMO_TAMPER=0 to disable it.
app.post('/api/consent/log/tamper', (_req, res) => {
  if (process.env.DEMO_TAMPER === '0') return res.status(404).end();
  const target = consentLog.find((r) => r.action === 'save');
  if (!target) return bad(res, [{ code: 'nothing_to_tamper', message: 'Save a consent choice first' }], 409);
  target.consents = { ...target.consents, marketing: !target.consents.marketing };
  res.json({ tampered: target.seq, integrity: verifyChain() });
});

// ---- Data Subject Requests ----
const dsrInbox = [];
app.post('/api/dsr', (req, res) => {
  const { valid, errors, data } = validateDsrSubmissionStructured(req.body, { allowedRequestTypes: ALLOWED_DSR_TYPES });
  if (!valid) return bad(res, errors);
  const ds = data.dataSubject;
  const tooLong = Object.entries(ds).filter(([, v]) => typeof v === 'string' && v.length > MAX_FIELD);
  if (tooLong.length) return bad(res, tooLong.map(([k]) => ({ field: `dataSubject.${k}`, code: 'too_long', message: `Max ${MAX_FIELD} chars` })));

  const receivedAt = Date.now();
  const ticket = {
    reference: `DSR-${new Date(receivedAt).getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    subject: subjectId(req, res),
    requestType: data.requestType,
    // Stored raw. Encoding happens at render time (React text nodes). Rendering this
    // with innerHTML anywhere downstream (emails, PDFs, admin tools) is stored XSS.
    fullName: ds.fullName,
    email: ds.email,
    identifierType: ds.identifierType,
    receivedAt,
    dueBy: receivedAt + 30 * 24 * 3600 * 1000, // NDPA response window used by the toolkit's defaults
    status: 'received',
  };
  dsrInbox.unshift(ticket);
  res.status(201).json({ ok: true, reference: ticket.reference, dueBy: ticket.dueBy });
});
app.get('/api/dsr', (_req, res) => res.json(dsrInbox.slice(0, 50)));

// ---- Breach intake + NDPC 72h readiness ----
const breaches = [];
app.post('/api/breach', (req, res) => {
  const b = req.body ?? {};
  const errors = [];
  if (typeof b.title !== 'string' || !b.title.trim()) errors.push({ field: 'title', code: 'title_required', message: 'Title is required' });
  if (!Number.isSafeInteger(b.discoveredAt) || b.discoveredAt > Date.now() + 60_000) errors.push({ field: 'discoveredAt', code: 'discovered_at_invalid', message: 'discoveredAt must be a past ms timestamp' });
  if (errors.length) return bad(res, errors);

  const report = {
    affectedSystems: [],
    dataTypes: [],
    reporter: { name: '', email: '', department: '' },
    ...b,
    id: `BR-${crypto.randomUUID().slice(0, 8)}`,
    status: b.status ?? 'ongoing',
    reportedAt: Date.now(),
  };
  const assessment = assessBreachNotification(report, { asOf: Date.now() });
  breaches.unshift({ report, assessment });
  res.status(201).json({ id: report.id, assessment });
});
app.get('/api/breach', (_req, res) => res.json(breaches.slice(0, 20)));

// ---- Compliance audit (same engine as the `ndpr audit` CLI) ----
app.post('/api/audit', (req, res) => {
  const { compliance, dcpmi, minScore } = req.body ?? {};
  if (!compliance || typeof compliance !== 'object') return bad(res, [{ field: 'compliance', code: 'required', message: 'compliance is required' }]);
  try {
    const result = runNdprAudit({ compliance, ...(dcpmi ? { dcpmi } : {}) }, { minScore: Number(minScore) || 70 });
    res.json({ result, text: formatNdprAuditReport(result, { color: false }) });
  } catch (err) {
    bad(res, [{ code: 'audit_failed', message: String(err?.message ?? err).slice(0, 300) }], 400);
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

if (PROD) {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  app.use(express.static(dist, { index: 'index.html', maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Never leak stack traces
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ errors: [{ code: status === 413 ? 'payload_too_large' : 'server_error', message: status < 500 ? err.message : 'Internal error' }] });
});

app.listen(PORT, () => console.log(`NDPR demo API on http://localhost:${PORT} (${PROD ? 'production' : 'development'})`));
