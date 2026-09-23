// Security & trust checks run against the REAL toolkit (not mocks).
// Pure module: runs in the browser (Security Lab page) and in Node
// (`npm run security:probe`, CI). Each check returns an observed result so the
// demo shows live behaviour of the installed version, not claims from a slide.
import {
  validateConsentStructured,
  validateDsrSubmissionStructured,
  sanitizeInput,
  runNdprAudit,
} from '@tantainnovative/ndpr-toolkit/core';
import {
  localStorageAdapter,
  cookieAdapter,
  apiAdapter,
} from '@tantainnovative/ndpr-toolkit/adapters';

const XSS_NAME = '<img src=x onerror=alert(document.domain)>';

const validDsr = (fullName) => ({
  requestType: 'access',
  dataSubject: { fullName, email: 'ada@example.ng', identifierType: 'email', identifierValue: 'ada@example.ng' },
  submittedAt: Date.now(),
});

const forgedConsent = (overrides = {}) => ({
  consents: { essential: true, analytics: true, marketing: true },
  timestamp: Date.now(),
  version: '1.0',
  method: 'banner',
  hasInteracted: true,
  ...overrides,
});

const allTrueCompliance = {
  consent: { hasConsentMechanism: true, hasPurposeSpecification: true, hasWithdrawalMechanism: true, hasMinorProtection: true, consentRecordsRetained: true },
  dsr: { hasRequestMechanism: true, supportsAccess: true, supportsRectification: true, supportsErasure: true, supportsPortability: true, supportsObjection: true, responseTimelineDays: 30 },
  dpia: { conductedForHighRisk: true, documentedRisks: true, mitigationMeasures: true },
  breach: { hasNotificationProcess: true, notifiesWithin72Hours: true, hasRiskAssessment: true, hasRecordKeeping: true },
  policy: { hasPrivacyPolicy: true, isPubliclyAccessible: true, lastUpdated: new Date().toISOString().slice(0, 10), coversAllSections: true },
  lawfulBasis: { documentedForAllProcessing: true, hasLegitimateInterestAssessment: true },
  crossBorder: { hasTransferMechanisms: true, adequacyAssessed: true, ndpcApprovalObtained: true },
  ropa: { maintained: true, includesAllProcessing: true, lastReviewed: new Date().toISOString().slice(0, 10) },
};

/**
 * severity: how bad it is if you rely on the toolkit alone.
 * exposed:  true when the observed behaviour confirms the concern.
 */
export function runChecks() {
  const checks = [];
  const add = (c) => checks.push(c);

  // 1. Consent integrity — a client can forge "consent" that validates.
  {
    const r = validateConsentStructured(forgedConsent());
    add({
      id: 'consent-forgery',
      title: 'Forged consent record passes validation',
      severity: 'high',
      category: 'Integrity / evidence',
      exposed: r.valid === true,
      observed: `validateConsentStructured(forged) → valid=${r.valid}, errors=${r.errors.length}`,
      why: 'Validation is structural only. Nothing binds a consent record to a person, a session or a server-side event, so a record submitted by a client proves nothing to a regulator.',
      mitigation: 'Treat client consent as UX state. Stamp time server-side, bind to an HttpOnly subject cookie / authenticated user, and keep an append-only, tamper-evident log (this demo uses an HMAC hash chain).',
    });
  }

  // 2. Timestamp trust — far-future timestamps accepted.
  {
    const r = validateConsentStructured(forgedConsent({ timestamp: Date.now() + 365 * 24 * 3600 * 1000 }));
    add({
      id: 'consent-future-ts',
      title: 'Consent timestamp one year in the future is accepted',
      severity: 'medium',
      category: 'Integrity / evidence',
      exposed: r.valid === true,
      observed: `validateConsentStructured({timestamp: now + 1y}) → valid=${r.valid}`,
      why: 'A client-controlled clock can backdate or post-date consent, which undermines audit trails and "consent_stale" checks.',
      mitigation: 'Ignore client timestamps for evidence. Record receivedAt on the server; keep the client value only as metadata.',
    });
  }

  // 3. Stored XSS surface — HTML accepted in DSR fields.
  {
    const r = validateDsrSubmissionStructured(validDsr(XSS_NAME));
    add({
      id: 'dsr-html',
      title: 'HTML/script payload accepted in a DSR submission',
      severity: 'high',
      category: 'Injection (stored XSS)',
      exposed: r.valid === true && r.data?.dataSubject?.fullName === XSS_NAME,
      observed: `validateDsrSubmissionStructured({fullName: ${JSON.stringify(XSS_NAME)}}) → valid=${r.valid}, value returned unchanged`,
      why: 'Validators check presence and format, not content safety. The payload reaches your DPO inbox, email templates, PDFs and admin tools as-is. Any place that renders it with innerHTML / dangerouslySetInnerHTML / an email HTML template is a stored-XSS sink.',
      mitigation: 'Encode on output (React text nodes, template auto-escaping), add a length/charset allow-list on the server, and ship a strict CSP.',
    });
  }

  // 4. sanitizeInput is HTML-entity encoding, not context-aware sanitisation.
  {
    const out = sanitizeInput('javascript:alert(1)');
    add({
      id: 'sanitize-js-url',
      title: 'sanitizeInput() leaves javascript: URLs intact',
      severity: 'medium',
      category: 'Injection (XSS)',
      exposed: out.toLowerCase().startsWith('javascript:'),
      observed: `sanitizeInput("javascript:alert(1)") → ${JSON.stringify(out)}`,
      why: 'The helper escapes HTML special characters. That is correct for HTML text, but it offers no protection when the value lands in an href/src, a script, CSS or a SQL/NoSQL query.',
      mitigation: 'Use context-specific encoding: URL allow-lists (https: only) for links, parameterised queries for storage, and do not treat sanitizeInput as a general security control.',
    });
  }

  // 5. Built-in browser adapters self-declare they are not evidence.
  {
    const caps = {
      localStorage: localStorageAdapter('probe').capabilities,
      cookie: cookieAdapter('probe').capabilities,
      api: apiAdapter('/probe').capabilities,
    };
    add({
      id: 'adapter-evidence',
      title: 'Default storage (localStorage/cookie) is "ux-state-only"',
      severity: 'high',
      category: 'Integrity / evidence',
      exposed: caps.localStorage.evidenceSuitability === 'ux-state-only',
      observed: `localStorage → ${caps.localStorage.integrity}/${caps.localStorage.evidenceSuitability}; cookie → ${caps.cookie.integrity}/${caps.cookie.evidenceSuitability}; api → ${caps.api.evidenceSuitability}`,
      why: 'The zero-config quick start (<NDPRConsent />) stores consent in localStorage. The package itself labels that "unverified-client-state". Teams that stop at the quick start have no defensible consent records. The cookie adapter is JavaScript-written, so it cannot be HttpOnly.',
      mitigation: 'Use composeAdapters(apiAdapter(...), localStorageAdapter(...)) and make the API the system of record. Credit to the maintainers: the capability metadata makes this explicit.',
    });
  }

  // 6. Compliance audit = self-attestation.
  {
    const r = runNdprAudit({ compliance: allTrueCompliance }, { minScore: 90 });
    add({
      id: 'audit-self-attest',
      title: 'CI compliance gate passes on unverified self-attested booleans',
      severity: 'medium',
      category: 'Governance / assurance',
      exposed: r.passed === true,
      observed: `runNdprAudit(all flags = true, minScore 90) → passed=${r.passed}, score=${r.score}`,
      why: '`ndpr audit` scores a JSON file someone typed. It cannot check that erasure, 72-hour notification or DPIAs happen. A green check can create false assurance for management and auditors.',
      mitigation: 'Require CODEOWNERS (DPO) approval on ndpr.audit.json, link each flag to evidence (runbook, ticket, test), and back critical flags with automated tests.',
    });
  }

  // 7. Positive control — the validator does reject malformed input.
  {
    const r = validateDsrSubmissionStructured({ requestType: 'drop_table', dataSubject: {} }, { allowedRequestTypes: ['access', 'erasure'] });
    add({
      id: 'dsr-rejects-bad',
      title: 'Malformed / disallowed DSR payloads are rejected with stable codes',
      severity: 'info',
      category: 'Strength',
      exposed: false,
      strength: r.valid === false,
      observed: `valid=${r.valid}; codes=${r.errors.map((e) => e.code).join(', ')}`,
      why: 'Stable error codes let the same rules run on client and server, which removes a whole class of "validated only in the browser" bugs.',
      mitigation: 'Always call the /server validators in your API handler, with allowedRequestTypes set.',
    });
  }

  return checks;
}
