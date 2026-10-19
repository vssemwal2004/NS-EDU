// Usage: npm run seed [-- --force] [-- --reset-admin]
//   default        insert missing catalog records only (admin edits are preserved)
//   --force        overwrite seed fields on existing records
//   --reset-admin  reset the ADMIN_EMAIL account password to ADMIN_PASSWORD
//   --force-content  reset every site_content key to its default (otherwise only missing keys are added)
import { env } from '../config/env.js';
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { seedSets } from '../data/seed/index.js';
import { seedCourses } from '../data/seed/courses.js';
import { seedExams } from '../data/seed/exams.js';
import { hashPassword } from '../lib/password.js';
import { isEmail } from '../lib/validation.js';
import { reindexUniversities } from '../modules/universities/university-service.js';
import { seedContentDefaults } from '../modules/content/content-service.js';

const force = process.argv.includes('--force');
const resetAdmin = process.argv.includes('--reset-admin');
const forceContent = process.argv.includes('--force-content');

// Fields added after the first seed (course level, exam course links/notes) are filled only where missing.
const backfills = [
  { collection: COLLECTIONS.courses, docs: seedCourses, fields: ['level'] },
  { collection: COLLECTIONS.exams, docs: seedExams, fields: ['level', 'courseSlugs', 'note'] },
];
async function backfillSeedFields(db) {
  let updated = 0;
  for (const { collection, docs, fields } of backfills) {
    for (const field of fields) {
      const operations = docs.filter((doc) => doc[field] !== undefined).map((doc) => ({ updateOne: { filter: { slug: doc.slug, [field]: { $exists: false } }, update: { $set: { [field]: doc[field] } } } }));
      if (operations.length) updated += (await db.collection(collection).bulkWrite(operations, { ordered: false })).modifiedCount;
    }
  }
  return updated;
}

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

// Course and stream filters on /universities read `courseSlugs` / `streams`; add the ones implied by curated programmes.
async function linkProgrammeCourses(db) {
  const courses = new Map((await db.collection(COLLECTIONS.courses).find({}, { projection: { slug: 1, field: 1 } }).toArray()).map((course) => [course.slug, course.field]));
  const offered = await db.collection(COLLECTIONS.programmes).aggregate([{ $group: { _id: '$institutionSlug', courseSlugs: { $addToSet: '$courseSlug' } } }]).toArray();
  const operations = offered.map(({ _id, courseSlugs }) => ({ updateOne: {
    filter: { slug: _id },
    update: { $addToSet: { courseSlugs: { $each: courseSlugs }, streams: { $each: [...new Set(courseSlugs.map((slug) => courses.get(slug)).filter(Boolean))] } } },
  } }));
  if (operations.length) await db.collection(COLLECTIONS.institutions).bulkWrite(operations, { ordered: false });
  // Records created before the directory schema existed get its defaults (never overwriting set values).
  await db.collection(COLLECTIONS.institutions).updateMany({ type: { $exists: false } }, [{ $set: {
    type: { $cond: [{ $regexMatch: { input: '$name', regex: 'University' } }, 'university', 'college'] },
    category: { $ifNull: ['$category', 'other'] }, ownership: { $ifNull: ['$ownership', 'unknown'] }, verification: { $ifNull: ['$verification', 'unverified'] },
  } }]);
  return operations.length;
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
  console.log(`Catalogue fields backfilled: ${await backfillSeedFields(db)}`);
  console.log('Site content:', await seedContentDefaults(db, { force: forceContent }));
  // Search keys (nameKey, searchPrefixes, domain) are derived; rebuild them for every institution.
  console.log(`Institution search keys rebuilt: ${(await reindexUniversities()).updated}`);
  console.log(`Institutions linked to their programme courses: ${await linkProgrammeCourses(db)}`);
  console.log(`Admin ${env.adminEmail ?? '(not configured)'}: ${await ensureAdmin(db)}`);
  console.log(`Admins in database: ${await db.collection(COLLECTIONS.admins).countDocuments({})}`);
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
