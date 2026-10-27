// Brings existing `applications` (leads) up to the channel-aware shape, then builds the lead indexes.
// Usage: npm run leads:backfill --workspace backend      (safe to re-run: only rows without keysV change)
//
// Run it BEFORE deploying the new admin leads list on a large database: index builds otherwise
// happen on the first API request after deploy (getDb → ensureIndexes) and block it.
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { leadKeys } from '../modules/applications/service.js';

const BATCH = 1000;

async function main() {
  const db = await getDb(); // also creates/updates every index
  const leads = db.collection(COLLECTIONS.applications);
  const pending = await leads.countDocuments({ keysV: { $ne: 1 } });
  console.log(`Leads to backfill: ${pending.toLocaleString('en-IN')}`);
  const cursor = leads.find({ keysV: { $ne: 1 } }, { projection: { applicant: 1, channel: 1, mode: 1 } }).batchSize(BATCH);
  let ops = [];
  let done = 0;
  const flush = async () => {
    if (!ops.length) return;
    await leads.bulkWrite(ops, { ordered: false });
    done += ops.length;
    ops = [];
    console.log(`  ${done.toLocaleString('en-IN')} / ${pending.toLocaleString('en-IN')}`);
  };
  for await (const doc of cursor) {
    const channel = doc.channel ?? 'web-apply';
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            ...leadKeys(doc.applicant),
            channel,
            // Applications from before quick apply existed are detailed; other channels have no form mode.
            mode: channel === 'web-apply' ? (doc.mode === 'quick' ? 'quick' : 'detailed') : null,
          },
        },
      },
    });
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  console.log('Backfill complete.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => closeDb());
