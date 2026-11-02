// Scores leads for the CRM: temperature, score and the activity dates the dashboards read.
// Usage: npm run crm:backfill            leads that have never been scored
//        npm run crm:backfill -- --rescore   also re-score open leads not scored in the last 12 hours
//                                            (run daily: temperatures cool as leads go quiet)
//        node ... backfill-crm.js --limit 5000
// First contact is derived from the status history already stored (the first move away from "New");
// a lead with no history stays "not contacted". Idempotent; manual temperatures are kept.
import { COLLECTIONS, closeDb, getDb } from '../db/collections.js';
import { CLOSED_STATUSES } from '../modules/applications/schema.js';
import { crmUpdate } from '../modules/crm/crm-model.js';

const args = process.argv.slice(2);
const rescore = args.includes('--rescore');
const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const BATCH = 1000;

const db = await getDb();
const leads = db.collection(COLLECTIONS.applications);
const notes = db.collection(COLLECTIONS.applicationNotes);
const now = new Date();
const stale = new Date(now.getTime() - 12 * 60 * 60 * 1000);

const filter = rescore
  ? { $or: [{ 'crm.scoredAt': { $exists: false } }, { status: { $nin: [...CLOSED_STATUSES, 'admitted'] }, 'crm.scoredAt': { $lt: stale } }] }
  : { 'crm.scoredAt': { $exists: false } };

let done = 0;
let batch = [];
const flush = async () => {
  if (!batch.length) return;
  const last = new Map((await notes.aggregate([{ $match: { applicationId: { $in: batch.map((lead) => lead._id) } } }, { $group: { _id: '$applicationId', at: { $max: '$createdAt' } } }]).toArray()).map((row) => [row._id.toString(), row.at]));
  const operations = batch.map((lead) => {
    const moved = (lead.statusHistory ?? []).filter((entry) => entry.status !== 'new');
    const extras = {
      lastActivityAt: lead.crm?.lastActivityAt ?? [last.get(lead._id.toString()), moved.at(-1)?.at, lead.updatedAt, lead.createdAt].filter(Boolean).sort((a, b) => b - a)[0] ?? now,
      ...(moved.length && !lead.crm?.firstContactedAt ? { firstContactedAt: moved[0].at, lastContactedAt: lead.crm?.lastContactedAt ?? moved.at(-1).at } : {}),
      ...(lead.crm?.priority ? {} : { priority: 'normal' }),
      ...(lead.crm?.tags ? {} : { tags: [] }),
    };
    return { updateOne: { filter: { _id: lead._id }, update: { $set: crmUpdate(lead, now, extras) } } };
  });
  await leads.bulkWrite(operations, { ordered: false });
  done += batch.length;
  batch = [];
  if (done % 10_000 === 0) console.log(`${done.toLocaleString('en-IN')} leads scored…`);
};

try {
  for await (const lead of leads.find(filter).batchSize(BATCH)) {
    batch.push(lead);
    if (batch.length === BATCH) await flush();
    if (done + batch.length >= limit) break;
  }
  await flush();
  console.log(`Scored ${done.toLocaleString('en-IN')} leads${rescore ? ' (including a re-score of open leads)' : ''} in "${db.databaseName}".`);
} finally {
  await closeDb();
}
