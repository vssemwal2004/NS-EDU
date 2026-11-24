// Pure unit tests: no database. Run with an unreachable MONGODB_URI.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ANONYMISED_NAME, anonymiseLeadUpdate, anonymiseTaskUpdate, applyAnonymise, DEFAULT_RETENTION_MONTHS, isDueForRetention, lastActivityOf, retentionCutoff, retentionMonths, staleLeadFilter,
} from '../src/modules/applications/retention-rules.js';

test('cutoff is whole calendar months back, clamped to the end of shorter months', () => {
  assert.equal(retentionCutoff(new Date('2026-11-24T10:30:00Z'), 24).toISOString(), '2024-11-24T10:30:00.000Z');
  assert.equal(retentionCutoff(new Date('2026-03-31T00:00:00Z'), 1).toISOString(), '2026-02-28T00:00:00.000Z');
  assert.equal(retentionCutoff(new Date('2026-03-31T00:00:00Z'), 25).toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(retentionCutoff(new Date('2026-01-15T00:00:00Z'), 13).toISOString(), '2024-12-15T00:00:00.000Z');
});

test('RETENTION_MONTHS: 6 to 120 whole months, otherwise 24', () => {
  assert.equal(DEFAULT_RETENTION_MONTHS, 24);
  assert.equal(retentionMonths(undefined), 24);
  assert.equal(retentionMonths('36'), 36);
  assert.equal(retentionMonths('3'), 24);
  assert.equal(retentionMonths('abc'), 24);
  assert.equal(retentionMonths('12.5'), 24);
  assert.equal(retentionMonths('121'), 24);
});

test('last activity is the latest of crm.lastActivityAt, updatedAt and createdAt', () => {
  const createdAt = new Date('2023-01-01');
  assert.equal(lastActivityOf({ createdAt }).toISOString(), createdAt.toISOString());
  assert.equal(lastActivityOf({ createdAt, updatedAt: new Date('2023-06-01'), crm: { lastActivityAt: new Date('2023-03-01') } }).toISOString(), new Date('2023-06-01').toISOString());
  assert.equal(lastActivityOf({ createdAt, crm: { lastActivityAt: new Date('2024-02-01') } }).toISOString(), new Date('2024-02-01').toISOString());
  assert.equal(lastActivityOf({}), null);
});

test('a lead is due only when every activity date is before the cutoff and no follow-up is still to come', () => {
  const now = new Date('2026-11-24T00:00:00Z');
  const cutoff = retentionCutoff(now, 24);
  const old = new Date('2024-01-01');
  assert.ok(isDueForRetention({ createdAt: old, updatedAt: old, status: 'admitted' }, cutoff, now), 'every status, admitted included');
  assert.ok(!isDueForRetention({ createdAt: old, updatedAt: new Date('2025-05-01') }, cutoff, now));
  assert.ok(!isDueForRetention({ createdAt: old, crm: { lastActivityAt: new Date('2026-01-01') } }, cutoff, now));
  assert.ok(!isDueForRetention({ createdAt: old, crm: { nextFollowUpAt: new Date('2026-12-01') } }, cutoff, now));
  assert.ok(isDueForRetention({ createdAt: old, crm: { nextFollowUpAt: new Date('2024-02-01') } }, cutoff, now), 'a missed old follow-up does not hold it');
  assert.ok(!isDueForRetention({ createdAt: old, anonymisedAt: old }, cutoff, now), 'never twice');
  assert.ok(!isDueForRetention({}, cutoff, now), 'no dates: left alone');
});

test('the database filter matches the same rule', () => {
  const now = new Date('2026-11-24T00:00:00Z');
  const cutoff = retentionCutoff(now, 24);
  const filter = staleLeadFilter(cutoff, now);
  assert.deepEqual(filter.anonymisedAt, { $exists: false });
  assert.deepEqual(filter.createdAt, { $lt: cutoff });
  assert.equal(filter.$and.length, 3);
});

test('anonymising removes personal fields and keeps what analytics need', () => {
  const now = new Date('2026-11-24T00:00:00Z');
  const doc = {
    _id: 'abc123', ref: 'GV-2024-000001', channel: 'school-drive', status: 'admitted', formId: 'form1',
    applicant: { fullName: 'Asha Rao', phone: '+919876543210', email: 'asha@gmail.com', dateOfBirth: '2008-01-01', gender: 'female', pincode: '248001', guardianName: 'R. Rao', guardianPhone: '+919811111122', city: 'Dehradun', state: 'Uttarakhand', address: '12 Rajpur Road' },
    guardian: { name: 'R. Rao', phone: '+919811111122' },
    nameTokens: ['asha', 'rao'], cityKey: 'dehradun', studentId: 'student1',
    preference: { courseName: 'B.Tech', institutionName: 'Graphic Era', message: 'Call me after 6 at 98765 43210' },
    callback: { preferredTime: 'evening', message: 'my number is 98765 43210', name: 'Asha' },
    answers: [{ id: 'fullName', type: 'text', value: 'Asha Rao' }, { id: 'phone', type: 'phone', value: '+919876543210' }, { id: 'stream', type: 'select', value: 'pcm' }, { id: 'interests', type: 'checkbox', value: ['engineering'] }],
    school: { name: 'DPS Dehradun', district: 'Dehradun', state: 'Uttarakhand' },
    academics: { classLevel: '12', schoolStream: 'pcm' },
    crm: { heat: 'hot', score: 80, tags: ['scholarship'], lostReason: 'Asha chose another college', lastActivityAt: new Date('2024-01-01') },
    consent: { contactConsent: true, version: '2026-10', userAgent: 'Mozilla', ip: '1.2.3.4' },
    source: { path: '/apply', utmSource: 'google', ip: '1.2.3.4' },
    statusHistory: [{ status: 'new', at: new Date('2024-01-01') }],
    assignedEmployeeIds: ['emp1'], createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-02'),
  };
  const out = applyAnonymise(doc, now);
  assert.deepEqual(out.applicant, { fullName: ANONYMISED_NAME, phone: 'anon-abc123', email: '', city: 'Dehradun', state: 'Uttarakhand' });
  assert.equal(out.guardian, undefined);
  assert.equal(out.studentId, undefined);
  assert.deepEqual(out.nameTokens, []);
  assert.equal(out.preference.message, '');
  assert.equal(out.preference.courseName, 'B.Tech');
  assert.deepEqual(out.callback, { preferredTime: 'evening' });
  assert.deepEqual(out.answers.map((answer) => answer.id), ['stream', 'interests']);
  assert.equal(out.crm.lostReason, '');
  assert.equal(out.crm.heat, 'hot');
  assert.equal(out.consent.userAgent, undefined);
  assert.equal(out.consent.ip, undefined);
  assert.equal(out.consent.contactConsent, true);
  assert.equal(out.source.ip, undefined);
  assert.equal(out.source.utmSource, 'google');
  assert.equal(out.anonymisedAt, now);
  // Kept for analytics.
  for (const key of ['ref', 'channel', 'status', 'formId', 'cityKey', 'school', 'academics', 'statusHistory', 'assignedEmployeeIds', 'createdAt', 'updatedAt']) assert.deepEqual(out[key], doc[key], key);
  // No personal value survives anywhere in the document.
  const text = JSON.stringify(out);
  for (const secret of ['Asha', '9876543210', 'asha@gmail.com', '2008-01-01', '248001', 'Rajpur', '9811111122', '1.2.3.4', 'Mozilla']) assert.ok(!text.includes(secret), secret);
});

test('the bin variant writes under lead.*, and the update never sets and unsets the same path', () => {
  const update = anonymiseLeadUpdate({ _id: 'x', applicant: {}, preference: {} }, new Date(), 'lead.');
  assert.ok(Object.keys(update.$set).every((key) => key.startsWith('lead.')));
  assert.ok(Object.keys(update.$unset).every((key) => key.startsWith('lead.')));
  const sets = Object.keys(update.$set);
  for (const path of Object.keys(update.$unset)) assert.ok(!sets.some((set) => set === path || path.startsWith(`${set}.`) || set.startsWith(`${path}.`)), path);
});

test('follow-ups of an anonymised lead lose the name and phone copies', () => {
  assert.deepEqual(anonymiseTaskUpdate({ kind: 'call' }).$set, { leadName: ANONYMISED_NAME, leadPhone: '', title: 'Call follow-up (anonymised)' });
});
