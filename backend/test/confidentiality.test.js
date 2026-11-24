// Pure unit tests: no database. Run with an unreachable MONGODB_URI.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONFIDENTIALITY_POINTS, CONFIDENTIALITY_VERSION, confidentialityEnforced, confidentialityRecord, confidentialitySummary, confidentialityText, mustAcceptConfidentiality,
} from '../src/modules/access/confidentiality.js';

test('the undertaking has a version and about eight plain points', () => {
  const text = confidentialityText();
  assert.equal(text.version, CONFIDENTIALITY_VERSION);
  assert.ok(text.points.length >= 6 && text.points.length <= 10);
  assert.ok(CONFIDENTIALITY_POINTS.some((point) => /Digital Personal Data Protection Act, 2023/.test(point)));
  assert.ok(CONFIDENTIALITY_POINTS.every((point) => !/section\s+\d/i.test(point)), 'no section numbers');
});

test('staff must accept the current version; an older version does not count', () => {
  assert.equal(mustAcceptConfidentiality({ role: 'employee' }), true);
  assert.equal(mustAcceptConfidentiality({ role: 'employee', confidentiality: { version: 'old' } }), true);
  assert.equal(mustAcceptConfidentiality({ role: 'employee', confidentiality: { version: CONFIDENTIALITY_VERSION } }), false);
});

test('the API blocks employees who have not accepted, never owners (who still see the dialog)', () => {
  assert.equal(confidentialityEnforced({ role: 'employee', isOwner: false }), true);
  assert.equal(confidentialityEnforced({ role: 'employee', isOwner: false, confidentiality: { version: CONFIDENTIALITY_VERSION } }), false);
  assert.equal(confidentialityEnforced({ role: 'admin', isOwner: true }), false);
  assert.equal(confidentialityEnforced({ role: 'admin' }), false, 'bare owner document');
  assert.equal(mustAcceptConfidentiality({ role: 'admin', isOwner: true }), true);
  assert.equal(confidentialityEnforced(null), true, 'no staff: blocked');
});

test('the stored record carries version, time, IP and a capped browser string; the summary hides IP and browser', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  const record = confidentialityRecord({ ip: '10.0.0.1', userAgent: 'x'.repeat(500), now });
  assert.deepEqual(Object.keys(record).sort(), ['acceptedAt', 'ip', 'userAgent', 'version']);
  assert.equal(record.version, CONFIDENTIALITY_VERSION);
  assert.equal(record.acceptedAt, now);
  assert.equal(record.userAgent.length, 300);
  assert.deepEqual(confidentialitySummary({ confidentiality: record }), { version: CONFIDENTIALITY_VERSION, acceptedAt: now, current: true });
  assert.deepEqual(confidentialitySummary({}), { version: null, acceptedAt: null, current: false });
});
