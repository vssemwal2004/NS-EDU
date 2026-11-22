import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ObjectId } from 'mongodb';
import { cutoffAt, leastLoaded, onTimeForBatch, previousDay, sharePerEmployee } from '../src/modules/lead-distribution/service.js';

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
