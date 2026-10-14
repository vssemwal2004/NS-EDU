// Usage: npm run seed [-- --force] [-- --reset-admin]
//   default        insert missing catalog records only (admin edits are preserved)
//   --force        overwrite seed fields on existing records
//   --reset-admin  reset the ADMIN_EMAIL account password to ADMIN_PASSWORD
import { env } from '../config/env.js';
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { seedSets } from '../data/seed/index.js';
import { hashPassword } from '../lib/password.js';
import { isEmail } from '../lib/validation.js';

const force = process.argv.includes('--force');
const resetAdmin = process.argv.includes('--reset-admin');

async function seedCatalog(db) {
  const now = new Date();
  const summary = [];
  for (const { collection, key, docs } of seedSets) {
    const operations = docs.map((doc) => ({
      updateOne: {
        filter: { [key]: doc[key] },
        update: force
          ? { $set: { ...doc, updatedAt: now }, $setOnInsert: { createdAt: now } }
          : { $setOnInsert: { ...doc, createdAt: now, updatedAt: now } },
        upsert: true,
      },
    }));
    const result = await db.collection(collection).bulkWrite(operations, { ordered: true });
    const total = await db.collection(collection).countDocuments({});
    summary.push({ collection, seedRecords: docs.length, inserted: result.upsertedCount, updated: force ? result.modifiedCount : 0, totalInDb: total });
  }
  return summary;
}

async function ensureAdmin(db) {
  if (!env.adminEmail || !env.adminPassword) return 'skipped (set ADMIN_EMAIL and ADMIN_PASSWORD)';
  if (!isEmail(env.adminEmail)) throw new Error('ADMIN_EMAIL is not a valid email address.');
  if (env.adminPassword.length < 10) console.warn('Warning: ADMIN_PASSWORD is shorter than 10 characters. Use a strong password outside local development.');
  const admins = db.collection(COLLECTIONS.admins);
  const existing = await admins.findOne({ email: env.adminEmail });
  if (!existing) {
    await admins.insertOne({ email: env.adminEmail, name: env.adminName, passwordHash: await hashPassword(env.adminPassword), role: 'admin', createdAt: new Date(), lastLoginAt: null });
    return 'created';
  }
  if (resetAdmin) {
    await admins.updateOne({ _id: existing._id }, { $set: { passwordHash: await hashPassword(env.adminPassword), name: env.adminName, role: 'admin' } });
    return 'password reset';
  }
  return 'already present (use --reset-admin to reset the password)';
}

try {
  const db = await getDb();
  console.log(`Seeding database "${env.mongodbDatabase}"${force ? ' (force)' : ''}...`);
  console.table(await seedCatalog(db));
  console.log(`Admin ${env.adminEmail ?? '(not configured)'}: ${await ensureAdmin(db)}`);
  console.log(`Admins in database: ${await db.collection(COLLECTIONS.admins).countDocuments({})}`);
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
