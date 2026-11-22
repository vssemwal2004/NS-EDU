import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { ObjectId } from 'mongodb';

const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.NODE_ENV = 'test';

test('daily allocation, cutoff redistribution, late check-in and old pending leads', { skip }, async () => {
  const { getDb, closeDb } = await import('../src/db/collections.js');
  const { checkIn, checkOut, distributionStatus, reconcileDistribution } = await import('../src/modules/lead-distribution/service.js');
  const db = await getDb();
  try {
    const employees = Array.from({ length: 10 }, (_, index) => ({ _id: new ObjectId(), role: 'employee', status: 'active', email: `employee${index}@example.com` }));
    await db.collection('admins').insertMany(employees);
    const yesterday = new Date('2026-11-30T06:30:00.000Z');
    await db.collection('applications').insertMany(Array.from({ length: 100 }, (_, index) => ({
      ref: `GV-D-${index}`, status: 'new', channel: 'web-apply', assignedEmployeeIds: [], createdAt: yesterday, updatedAt: yesterday,
    })));
    // Manual assignments and unfinished older leads stay outside the automatic pool.
    const manualId = new ObjectId();
    await db.collection('applications').insertMany([
      { _id: manualId, ref: 'GV-D-MANUAL', status: 'new', assignedEmployeeIds: [employees[9]._id], assignmentSource: 'manual', createdAt: yesterday },
      { ref: 'GV-D-OLD', status: 'new', assignedEmployeeIds: [employees[0]._id], createdAt: new Date('2026-11-28T06:30:00.000Z') },
    ]);
    const before = new Date('2026-12-01T03:30:00.000Z');
    const after = new Date('2026-12-01T06:31:00.000Z');
    for (const person of employees.slice(0, 5)) {
      const status = await checkIn(person, before);
      assert.equal(status.assignedToday, 10);
    }
    await reconcileDistribution(after);
    for (const person of employees.slice(0, 5)) {
      assert.equal(await db.collection('applications').countDocuments({ autoAssigneeId: person._id }), 20);
    }
    const late = await checkIn(employees[5], after);
    assert.equal(late.late, true);
    assert.equal(late.assignedToday, 0);
    await checkOut(employees[0], new Date('2026-12-01T12:30:00.000Z'));
    assert.equal((await distributionStatus(employees[0], after)).pending, 21);
    assert.equal((await db.collection('applications').findOne({ _id: manualId })).assignmentSource, 'manual');
    assert.equal(await db.collection('applications').countDocuments({ assignedEmployeeIds: [] }), 0);
  } finally {
    await db.dropDatabase();
    await closeDb();
  }
});
