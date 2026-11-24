// Restore the original site artwork after the old Cloudinary account stopped serving it.
// The matching files must be deployed in frontend/public/images before --apply is used.
import mediaDefaults from '../modules/content/defaults/media.js';
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';

const apply = process.argv.includes('--apply');
const fields = ['hero', 'campusArt', 'destinationsArt', 'eligibility', 'budgetDesk'];

try {
  const db = await getDb();
  const content = db.collection(COLLECTIONS.siteContent);
  const entry = await content.findOne({ key: 'media' });
  if (!entry) throw new Error('No media content entry exists. Load the site once, then retry.');

  const next = { ...entry.data, ...Object.fromEntries(fields.map((key) => [key, mediaDefaults[key]])) };
  for (const key of fields) {
    const before = entry.data?.[key];
    console.log(`${key}: ${JSON.stringify(before)} -> ${JSON.stringify(next[key])}`);
  }

  if (!apply) {
    console.log('Preview only. Deploy the restored image files, then rerun with --apply.');
  } else {
    const now = new Date();
    const result = await content.updateOne({ _id: entry._id, updatedAt: entry.updatedAt }, {
      $set: { data: next, updatedAt: now, updatedBy: 'restore-site-artwork' },
      $push: { history: { $each: [{ data: entry.data, updatedAt: entry.updatedAt, updatedBy: entry.updatedBy ?? null }], $slice: -5 } },
    });
    if (!result.matchedCount) throw new Error('Media content changed while restoring it. Rerun the command.');
    console.log('Site artwork restored. The API content cache expires within one minute.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
