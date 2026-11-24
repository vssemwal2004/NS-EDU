import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ObjectId } from 'mongodb';
import { cutoffAt, leastLoaded, onTimeForBatch, previousDay, sessionsOf, sharePerEmployee, workedMinutes } from '../src/modules/lead-distribution/service.js';

test('worked time runs to now while on duty and stops at check-out', () => {
  const checkedInAt = new Date('2026-12-01T04:00:00Z');
  assert.equal(workedMinutes(null), null);
  assert.equal(workedMinutes({ checkedInAt: null }), null);
  assert.equal(workedMinutes({ checkedInAt }, new Date('2026-12-01T06:15:20Z')), 135);
  assert.equal(workedMinutes({ checkedInAt, checkedOutAt: new Date('2026-12-01T12:30:00Z') }, new Date('2026-12-02T00:00:00Z')), 510);
  // A clock skew never shows negative time.
  assert.equal(workedMinutes({ checkedInAt }, new Date('2026-12-01T03:59:00Z')), 0);
});

test('worked time adds up every session; gaps while checked out do not count', () => {
  const at = (time) => new Date(`2026-12-01T${time}:00Z`);
  const record = { checkedInAt: at('04:00'), checkedOutAt: null, sessions: [
    { inAt: at('04:00'), outAt: at('06:00') }, // 2 h
    { inAt: at('07:00'), outAt: at('07:30') }, // 30 min
    { inAt: at('08:00'), outAt: null }, // open: runs to now
  ] };
  assert.equal(workedMinutes(record, at('09:15')), 120 + 30 + 75);
  assert.deepEqual(sessionsOf({ checkedInAt: at('04:00'), checkedOutAt: at('05:00') }), [{ inAt: at('04:00'), outAt: at('05:00') }]);
  assert.deepEqual(sessionsOf(null), []);
});

test('IST source day and cutoff cross UTC and month boundaries correctly', () => {
  assert.equal(previousDay('2026-12-01'), '2026-11-30');
  assert.equal(cutoffAt('2026-12-01', '12:00').toISOString(), '2026-12-01T06:30:00.000Z');
});

test('the initial share reserves one equal block per employee', () => {
  assert.equal(sharePerEmployee(100, 10), 10);
  assert.equal(sharePerEmployee(103, 10), 10);
  assert.equal(sharePerEmployee(100, 0), 0);
});

test('50 unclaimed leads are shared equally across five checked-in employees', () => {
  const active = Array.from({ length: 5 }, (_, order) => ({ order, count: 10 }));
  for (let index = 0; index < 50; index += 1) leastLoaded(active).count += 1;
  assert.deepEqual(active.map((person) => person.count), [20, 20, 20, 20, 20]);
});

test('a check-in at or after the cutoff gets no automatic share', () => {
  const employeeId = new ObjectId();
  const cutoff = cutoffAt('2026-12-01', '12:00');
  assert.equal(onTimeForBatch(new Date(cutoff.getTime() - 1), cutoff, [employeeId], employeeId), true);
  assert.equal(onTimeForBatch(cutoff, cutoff, [employeeId], employeeId), false);
  assert.equal(onTimeForBatch(new Date(cutoff.getTime() - 1), cutoff, [], employeeId), false);
});
