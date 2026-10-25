// Test-only: mints a signed student session cookie straight from the backend modules,
// the same way backend/src/modules/student-auth does after OTP verification.
// Used by the gated-route specs so they never need a real OTP email.
import { setTimeout as sleep } from 'node:timers/promises';

const backend = new URL('../../../backend/src/', import.meta.url);
const mod = (p) => import(new URL(p, backend).href);

export const TEST_EMAIL = 'e2e-integration@gyaanvidhya.test';

export async function mintStudentSession(email = TEST_EMAIL) {
  const { collection, COLLECTIONS } = await mod('db/collections.js');
  const { signSession } = await mod('lib/jwt.js');
  const students = await collection(COLLECTIONS.students);
  const now = new Date();
  const student = await students.findOneAndUpdate(
    { email },
    { $setOnInsert: { email, name: 'E2E Student', status: 'active', createdAt: now }, $set: { lastLoginAt: now } },
    { upsert: true, returnDocument: 'after' },
  );
  return {
    student,
    cookie: {
      name: 'nsedu_student',
      value: signSession(student._id.toString(), 'student', 6 * 60 * 60),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  };
}

// Activity rows this student produced. Batches leave the browser every 5s or on pagehide, so a
// caller polls: close the page first, then wait for the beacon to land.
export async function studentEvents(email = TEST_EMAIL, { type, query, timeoutMs = 15000 } = {}) {
  const { collection, COLLECTIONS } = await mod('db/collections.js');
  const student = await (await collection(COLLECTIONS.students)).findOne({ email });
  if (!student) return [];
  const events = await collection(COLLECTIONS.studentEvents);
  const filter = { studentId: student._id, ...(type && { type }), ...(query && { query }) };
  for (const deadline = Date.now() + timeoutMs; Date.now() < deadline;) {
    const rows = await events.find(filter).sort({ at: -1 }).toArray();
    if (rows.length) return rows;
    await sleep(400);
  }
  return [];
}

export async function cleanupStudentSession(email = TEST_EMAIL) {
  const { collection, COLLECTIONS } = await mod('db/collections.js');
  const students = await collection(COLLECTIONS.students);
  const student = await students.findOne({ email });
  if (student) {
    await (await collection(COLLECTIONS.studentEvents)).deleteMany({ studentId: student._id });
    const applications = await collection(COLLECTIONS.applications);
    const ids = (await applications.find({ studentId: student._id }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    await (await collection(COLLECTIONS.applicationNotes)).deleteMany({ applicationId: { $in: ids } });
    await applications.deleteMany({ studentId: student._id });
    await students.deleteOne({ _id: student._id });
  }
}

export async function closeSessionDb() {
  const { closeDb } = await mod('db/collections.js');
  await closeDb();
}
