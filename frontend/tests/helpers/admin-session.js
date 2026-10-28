// Test-only: a throwaway owner-admin account and its signed session cookie, minted from the
// backend modules (no password login), plus cleanup of everything the admin specs create.
const backend = new URL('../../../backend/src/', import.meta.url);
const mod = (p) => import(new URL(p, backend).href);

export const TEST_ADMIN_EMAIL = 'e2e-admin@gyaanvidhya.test';
export const E2E_SCHOOL = 'E2E Test School';

export async function mintAdminSession(email = TEST_ADMIN_EMAIL) {
  const { collection, COLLECTIONS } = await mod('db/collections.js');
  const { signSession } = await mod('lib/jwt.js');
  const admin = await (await collection(COLLECTIONS.admins)).findOneAndUpdate(
    { email },
    { $setOnInsert: { email, role: 'admin', passwordHash: 'not-a-login', mustChangePassword: false, createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  );
  return {
    admin,
    cookie: { name: 'nsedu_admin', value: signSession(admin._id.toString(), 'admin', 2 * 60 * 60), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Strict' },
  };
}

export async function cleanupAdminSession(email = TEST_ADMIN_EMAIL) {
  const { collection, COLLECTIONS } = await mod('db/collections.js');
  const forms = await collection(COLLECTIONS.leadForms);
  const ids = (await forms.find({ 'school.name': E2E_SCHOOL }, { projection: { _id: 1 } }).toArray()).map((doc) => doc._id);
  if (ids.length) {
    await (await collection(COLLECTIONS.applications)).deleteMany({ formId: { $in: ids } });
    await forms.deleteMany({ _id: { $in: ids } });
  }
  await (await collection(COLLECTIONS.admins)).deleteOne({ email });
}
