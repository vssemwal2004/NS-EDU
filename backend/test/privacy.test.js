// Pure unit tests for the DPDP privacy features: the under-18 rule on every public form, privacy-request
// parsing, reference numbers, due dates, anonymisation and the drive-form sensitive-question matcher.
// No database: nothing here opens a connection (run with MONGODB_URI pointing nowhere).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GUARDIAN_CONSENT_VERSION, indianMobile, parseAgeAndGuardian } from '../src/modules/privacy/guardian.js';
import {
  anonymiseLeadUpdate, dueDateOf, ERASED_NAME, formatPrivacyRef, isOverdue, parseAccountRequest, parsePublicRequest, parseResolution,
  PRIVACY_REF_PATTERN, PRIVACY_SLA_DAYS, refYear, RESPONSE_TIME_TEXT, sharedWithOf, withdrawUpdate,
} from '../src/modules/privacy/privacy-model.js';
import { CONSENT_VERSION, parseApplication, parseQuickApplication } from '../src/modules/applications/schema.js';
import { sensitiveTopicOf } from '../src/modules/drives/sensitive-fields.js';
import { parseFields } from '../src/modules/drives/form-fields.js';

const fieldsOf = (fn) => {
  try { fn(); } catch (error) { return error.details?.fields ?? { thrown: error.message }; }
  return null;
};

describe('under-18 rule (parseAgeAndGuardian)', () => {
  const now = new Date('2026-11-24T10:00:00Z');

  test('the age answer is required and must be a boolean', () => {
    for (const body of [{}, { isAdult: 'yes' }, { isAdult: null }, null]) {
      const errors = {};
      assert.deepEqual(parseAgeAndGuardian(body, errors, { now }), { isAdult: null, guardian: null });
      assert.ok(errors.isAdult);
    }
  });

  test('18 or older needs no guardian, and a guardian sent anyway is ignored', () => {
    const errors = {};
    assert.deepEqual(parseAgeAndGuardian({ isAdult: true, guardian: { name: 'X', phone: '1' } }, errors, { now }), { isAdult: true, guardian: null });
    assert.deepEqual(errors, {});
  });

  test('under 18 makes guardian name, mobile and consent required', () => {
    const errors = {};
    const result = parseAgeAndGuardian({ isAdult: false }, errors, { now });
    assert.equal(result.isAdult, false);
    assert.deepEqual(Object.keys(errors).sort(), ['guardian.consent', 'guardian.name', 'guardian.phone']);
  });

  test('a bad guardian mobile and an unticked consent are refused', () => {
    const errors = {};
    parseAgeAndGuardian({ isAdult: false, guardian: { name: 'Sunita Rao', phone: '12345', consent: 'true' } }, errors, { now });
    assert.deepEqual(Object.keys(errors).sort(), ['guardian.consent', 'guardian.phone']);
  });

  test('a valid guardian is stored with the consent time, version and wording naming the student', () => {
    const errors = {};
    const { guardian } = parseAgeAndGuardian({ isAdult: false, guardian: { name: '  Sunita   Rao ', phone: '098765 43210', consent: true } }, errors, { studentName: 'Asha Rao', now });
    assert.deepEqual(errors, {});
    assert.equal(guardian.name, 'Sunita Rao');
    assert.equal(guardian.phone, '+919876543210');
    assert.equal(guardian.consentAt, now);
    assert.equal(guardian.consentVersion, GUARDIAN_CONSENT_VERSION);
    assert.match(guardian.consentText, /parent or guardian of Asha Rao/);
  });

  test('indianMobile accepts +91 / 91 / 0 prefixes and 6-9 starts only', () => {
    assert.equal(indianMobile('+91 98765-43210'), '+919876543210');
    assert.equal(indianMobile('919876543210'), '+919876543210');
    assert.equal(indianMobile('5876543210'), null);
    assert.equal(indianMobile(9876543210), null);
  });
});

describe('under-18 rule on the apply forms', () => {
  const year = new Date().getUTCFullYear();
  const quick = (extra = {}) => ({
    mode: 'quick', applicant: { fullName: 'Asha Rao', phone: '9876543210', email: 'asha@example.com', city: 'Pune' },
    preference: { institutionSlug: 'test-university', programmeName: 'B.Tech' },
    consent: { contactConsent: true, privacyAccepted: true, version: CONSENT_VERSION }, ...extra,
  });

  test('quick apply without the age answer is refused', () => {
    assert.ok(fieldsOf(() => parseQuickApplication(quick())).isAdult);
  });

  test('quick apply by a minor needs the guardian block', () => {
    const fields = fieldsOf(() => parseQuickApplication(quick({ isAdult: false })));
    assert.ok(fields['guardian.name'] && fields['guardian.phone'] && fields['guardian.consent']);
  });

  test('quick apply stores isAdult on the applicant and the guardian beside it', () => {
    const adult = parseQuickApplication(quick({ isAdult: true }));
    assert.equal(adult.applicant.isAdult, true);
    assert.equal(adult.guardian, null);
    const minor = parseQuickApplication(quick({ isAdult: false, guardian: { name: 'Sunita Rao', phone: '9812345678', consent: true } }));
    assert.equal(minor.applicant.isAdult, false);
    assert.equal(minor.guardian.phone, '+919812345678');
  });

  test('the detailed form refuses "18 or older" when the date of birth says otherwise', () => {
    const body = {
      isAdult: true,
      applicant: { fullName: 'Asha Rao', email: 'asha@example.com', phone: '9876543210', dateOfBirth: `${year - 16}-01-15`, city: 'Pune', state: 'Maharashtra' },
      academics: { highestQualification: 'class-10', board: 'CBSE', passingYear: year, scoreType: 'percentage', score: 90 },
      preference: { institutionSlug: 'test-university', courseSlug: 'btech', intakeYear: year, studyMode: 'full-time' },
      consent: { contactConsent: true, privacyAccepted: true, version: CONSENT_VERSION },
    };
    assert.match(fieldsOf(() => parseApplication(body)).isAdult, /under 18/);
  });

  test('an old consent version is refused so stale forms reload the new wording', () => {
    const fields = fieldsOf(() => parseQuickApplication(quick({ isAdult: true, consent: { contactConsent: true, privacyAccepted: true, version: '2026-10' } })));
    assert.ok(fields['consent.version']);
  });
});

describe('privacy request parsing', () => {
  test('the public form needs an email or a mobile to reply to', () => {
    const fields = fieldsOf(() => parsePublicRequest({ name: 'Ravi', relationship: 'self', type: 'access' }));
    assert.ok(fields.email);
  });

  test('a parent must name the student, and a grievance needs details', () => {
    const fields = fieldsOf(() => parsePublicRequest({ name: 'Sunita Rao', phone: '9876543210', relationship: 'parent-guardian', type: 'grievance', details: 'bad' }));
    assert.deepEqual(Object.keys(fields).sort(), ['details', 'studentName']);
  });

  test('a valid public request normalises the mobile', () => {
    const data = parsePublicRequest({ name: 'Sunita Rao', phone: '+91 98765 43210', relationship: 'parent-guardian', studentName: 'Asha Rao', type: 'erasure' });
    assert.equal(data.requester.phone, '+919876543210');
    assert.equal(data.subjectName, 'Asha Rao');
    assert.equal(data.type, 'erasure');
  });

  test('unknown types and relationships are refused', () => {
    const fields = fieldsOf(() => parsePublicRequest({ name: 'Ravi', email: 'r@example.com', relationship: 'friend', type: 'hack' }));
    assert.ok(fields.relationship && fields.type);
  });

  test('account erasure needs DELETE typed exactly; correction needs details', () => {
    assert.ok(fieldsOf(() => parseAccountRequest({ type: 'erasure', confirm: 'delete' })).confirm);
    assert.deepEqual(parseAccountRequest({ type: 'erasure', confirm: ' DELETE ' }), { type: 'erasure', details: '' });
    assert.ok(fieldsOf(() => parseAccountRequest({ type: 'correction', details: 'x' })).details);
    assert.ok(fieldsOf(() => parseAccountRequest({ type: 'access' })).type);
  });

  test('done and rejected need a reason; new is not a resolution', () => {
    assert.ok(fieldsOf(() => parseResolution({ status: 'rejected' })).reason);
    assert.ok(fieldsOf(() => parseResolution({ status: 'new' })).status);
    assert.deepEqual(parseResolution({ status: 'in-progress' }), { status: 'in-progress', reason: '' });
    assert.deepEqual(parseResolution({ status: 'done', reason: ' Copy emailed ' }), { status: 'done', reason: 'Copy emailed' });
  });
});

describe('reference numbers and due dates', () => {
  test('PR-<year>-<6 digits>', () => {
    assert.equal(formatPrivacyRef(2026, 123), 'PR-2026-000123');
    assert.equal(formatPrivacyRef(2026, 1234567), 'PR-2026-1234567');
    assert.match(formatPrivacyRef(2026, 1), PRIVACY_REF_PATTERN);
    assert.doesNotMatch('GV-2026-000001', PRIVACY_REF_PATTERN);
  });

  test('the counter year is the India-time year', () => {
    assert.equal(refYear(new Date('2026-12-31T19:00:00Z')), 2027);
    assert.equal(refYear(new Date('2026-12-31T18:00:00Z')), 2026);
  });

  test('due date is the SLA after filing; only open requests can be overdue', () => {
    const createdAt = new Date('2026-11-01T00:00:00Z');
    const dueAt = dueDateOf(createdAt);
    assert.equal((dueAt - createdAt) / 86_400_000, PRIVACY_SLA_DAYS);
    const later = new Date(dueAt.getTime() + 1);
    assert.equal(isOverdue({ status: 'new', dueAt }, later), true);
    assert.equal(isOverdue({ status: 'in-progress', dueAt }, later), true);
    assert.equal(isOverdue({ status: 'done', dueAt }, later), false);
    assert.equal(isOverdue({ status: 'new', dueAt }, createdAt), false);
    assert.match(RESPONSE_TIME_TEXT, /30 days at most; we aim for 7/);
  });
});

describe('anonymising a lead', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  const lead = {
    _id: 'abc123', applicant: { fullName: 'Asha Rao', email: 'asha@example.com', phone: '+919876543210', city: 'Pune', state: 'Maharashtra' },
    guardian: { name: 'Sunita Rao', phone: '+919812345678', consentAt: now, consentVersion: 'guardian-2026-11', consentText: 'I am the parent or guardian of Asha Rao…' },
    answers: [{ id: 'q1', label: 'Father’s name', type: 'text', value: 'Mohan' }], callback: { message: 'Call me' }, preference: { institutionName: 'X University', message: 'Hi' },
  };

  test('personal fields become tombstones; stats fields are untouched', () => {
    const { $set } = anonymiseLeadUpdate(lead, { now, requestRef: 'PR-2026-000001' });
    assert.equal($set['applicant.fullName'], ERASED_NAME);
    assert.equal($set['applicant.email'], '');
    assert.equal($set['applicant.phone'], 'erased-abc123');
    assert.deepEqual($set.nameTokens, []);
    assert.equal($set.answers[0].value, null);
    assert.equal($set.answers[0].label, 'Father’s name');
    assert.equal($set.guardian.phone, '');
    assert.doesNotMatch(JSON.stringify($set.guardian), /Sunita|Asha/);
    assert.equal($set['callback.message'], '');
    assert.equal($set['preference.message'], '');
    assert.equal($set['consent.ip'], '');
    assert.equal($set.studentId, null);
    assert.deepEqual($set.erasure, { at: now, requestRef: 'PR-2026-000001' });
    assert.ok($set.contactConsent.withdrawnAt);
    for (const kept of ['applicant.city', 'applicant.state', 'status', 'channel', 'createdAt', 'preference.institutionName']) assert.equal(Object.hasOwn($set, kept), false);
  });

  test('phone tombstones differ per lead (one-phone-per-drive unique index)', () => {
    const a = anonymiseLeadUpdate({ _id: 'a' }).$set['applicant.phone'];
    const b = anonymiseLeadUpdate({ _id: 'b' }).$set['applicant.phone'];
    assert.notEqual(a, b);
  });

  test('a lead without guardian, callback or preference gets no such keys', () => {
    const { $set } = anonymiseLeadUpdate({ _id: 'x' }, { now });
    for (const key of ['guardian', 'callback.message', 'preference.message']) assert.equal(Object.hasOwn($set, key), false);
  });

  test('withdrawal sets the do-not-contact flag', () => {
    assert.deepEqual(withdrawUpdate({ now, via: 'account', requestRef: 'PR-2026-000002' }).$set.contactConsent, { withdrawnAt: now, via: 'account', requestRef: 'PR-2026-000002' });
  });
});

describe('who a lead was shared with', () => {
  test('team only, may share, shared since the applied stage', () => {
    assert.equal(sharedWithOf({ preference: {} }).state, 'team');
    assert.deepEqual(sharedWithOf({ preference: { institutionName: 'X University' }, status: 'contacted' }), { state: 'may-share', institution: 'X University', since: null });
    const at = new Date('2026-11-02T00:00:00Z');
    assert.deepEqual(sharedWithOf({ preference: { institutionName: 'X University' }, status: 'admitted', statusHistory: [{ status: 'new' }, { status: 'applied-to-university', at }] }), { state: 'shared', institution: 'X University', since: at });
  });
});

describe('drive forms refuse sensitive questions', () => {
  test('matcher finds identity, financial and sensitive-category questions', () => {
    const cases = {
      'Aadhaar number': 'Aadhaar numbers', 'Aadhar No.': 'Aadhaar numbers', 'PAN': 'PAN numbers', 'PAN card number': 'PAN numbers',
      'Bank account number': 'bank, UPI or card details', 'UPI ID': 'bank, UPI or card details', 'IFSC code': 'bank, UPI or card details',
      'Any medical condition?': 'health or medical information', 'Blood group': 'health or medical information', 'Disability (if any)': 'health or medical information',
      'Caste': 'caste or religion', 'Religion': 'caste or religion', 'Fingerprint': 'biometric data',
    };
    for (const [label, topic] of Object.entries(cases)) assert.equal(sensitiveTopicOf({ label }), topic, label);
  });

  test('ordinary questions pass, including near-misses', () => {
    for (const label of ['Favourite subject', 'Interested in medical courses?', 'Banking careers', 'Pan India travel ok?', 'Company name', 'Parent’s occupation', 'Expected percentage']) {
      assert.equal(sensitiveTopicOf({ label }), null, label);
    }
  });

  test('help text and choices are checked too', () => {
    assert.equal(sensitiveTopicOf({ label: 'Category', options: ['General', 'OBC', 'SC/ST'] }), 'caste or religion');
    assert.equal(sensitiveTopicOf({ label: 'ID', help: 'Your Aadhaar' }), 'Aadhaar numbers');
  });

  test('parseFields refuses a sensitive custom question with a clear error on its label', () => {
    const fields = fieldsOf(() => parseFields([{ label: 'Aadhaar number', type: 'text' }]));
    assert.match(fields['fields.0.label'], /cannot ask for Aadhaar/);
    assert.equal(fieldsOf(() => parseFields([{ label: 'Favourite subject', type: 'text' }])), null);
  });
});
