// Runs the lead retention rules (retention-rules.js) against the database.
//
// Dry run by default: it only counts and lists a sample of lead ids, and writes nothing (not even the activity log).
// With `apply: true` it anonymises at most `max` leads in batches of `batchSize`, purges the free text of their
// notes and call logs, scrubs the name/phone copies on their follow-ups, anonymises old leads in the bin, and writes
// one activity-log summary.
//
// Nothing schedules this. The server never starts it; an owner runs `npm run retention` (see src/scripts/retention.js)
// or wires `runRetention` into a scheduler after approving it.
import { collection, COLLECTIONS } from '../../db/collections.js';
import { audit } from '../access/access-service.js';
import { clearLeadCounts } from './service.js';
import {
  anonymiseLeadUpdate, anonymiseNoteUpdate, anonymiseTaskUpdate, isDueForRetention, retentionCutoff, retentionMonths, staleLeadFilter,
} from './retention-rules.js';

const PROJECTION = { _id: 1, ref: 1, status: 1, applicant: 1, preference: 1, callback: 1, answers: 1, crm: 1, createdAt: 1, updatedAt: 1, anonymisedAt: 1 };
export const MAX_BATCH = 1000;

/**
 * @param {object} options
 * @param {boolean} [options.apply=false]  write changes; otherwise a read-only dry run
 * @param {number} [options.months]        inactivity period; defaults to RETENTION_MONTHS or 24
 * @param {number} [options.batchSize=200] leads per batch (1 to 1000)
 * @param {number} [options.max=5000]      most leads changed in one run
 * @param {Date}   [options.now]
 * @param {(line: string) => void} [options.log]
 */
export async function runRetention({ apply = false, months = retentionMonths(), batchSize = 200, max = 5000, now = new Date(), log = console.log } = {}) {
  const size = Math.max(1, Math.min(MAX_BATCH, Math.floor(batchSize) || 200));
  const limit = Math.max(1, Math.floor(max) || 5000);
  const cutoff = retentionCutoff(now, months);
  const filter = staleLeadFilter(cutoff, now);
  const leads = await collection(COLLECTIONS.applications);
  const trash = await collection(COLLECTIONS.applicationsTrash);
  const trashFilter = { deletedAt: { $lt: cutoff }, 'lead.anonymisedAt': { $exists: false } };

  const [due, byStatus, sample, binDue] = await Promise.all([
    leads.countDocuments(filter),
    leads.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).toArray(),
    leads.find(filter, { projection: { _id: 1 } }).sort({ _id: 1 }).limit(10).toArray(),
    trash.countDocuments(trashFilter),
  ]);
  const summary = {
    mode: apply ? 'apply' : 'dry-run', months, cutoff, due, binDue,
    byStatus: Object.fromEntries(byStatus.map((row) => [row._id ?? 'unknown', row.count])),
    sampleIds: sample.map((doc) => String(doc._id)),
    anonymised: 0, notesPurged: 0, tasksScrubbed: 0, binAnonymised: 0, skipped: 0,
  };
  log(`Leads inactive since before ${cutoff.toISOString()} (${months} months): ${due} (${JSON.stringify(summary.byStatus)}); in the bin: ${binDue}`);
  log(`Sample ids: ${summary.sampleIds.join(', ') || '(none)'}`);
  if (!apply) {
    log(`Dry run: nothing was changed. Re-run with --apply to anonymise up to ${limit} leads in batches of ${size}.`);
    return summary;
  }

  const notes = await collection(COLLECTIONS.applicationNotes);
  const tasks = await collection(COLLECTIONS.leadTasks);
  let lastId = null;
  while (summary.anonymised < limit) {
    const page = await leads.find(lastId ? { $and: [filter, { _id: { $gt: lastId } }] } : filter, { projection: PROJECTION })
      .sort({ _id: 1 }).limit(Math.min(size, limit - summary.anonymised)).toArray();
    if (!page.length) break;
    lastId = page.at(-1)._id;
    const ready = page.filter((doc) => isDueForRetention(doc, cutoff, now));
    summary.skipped += page.length - ready.length;
    if (ready.length) {
      // The filter is repeated in each write so a lead touched since it was read is left alone.
      const result = await leads.bulkWrite(ready.map((doc) => ({ updateOne: { filter: { _id: doc._id, ...filter }, update: anonymiseLeadUpdate(doc, now) } })), { ordered: false });
      summary.anonymised += result.modifiedCount;
      const ids = ready.map((doc) => doc._id);
      summary.notesPurged += (await notes.updateMany({ applicationId: { $in: ids }, anonymisedAt: { $exists: false } }, anonymiseNoteUpdate(now))).modifiedCount;
      const taskDocs = await tasks.find({ leadId: { $in: ids } }, { projection: { kind: 1 } }).toArray();
      if (taskDocs.length) summary.tasksScrubbed += (await tasks.bulkWrite(taskDocs.map((task) => ({ updateOne: { filter: { _id: task._id }, update: anonymiseTaskUpdate(task) } })), { ordered: false })).modifiedCount;
    }
    log(`  anonymised ${summary.anonymised} / ${Math.min(due, limit)}`);
  }

  // The bin keeps whole copies of deleted leads: those deleted before the cutoff are anonymised the same way.
  const binDocs = await trash.find(trashFilter, { projection: { lead: 1 } }).limit(limit).toArray();
  if (binDocs.length) {
    const result = await trash.bulkWrite(binDocs.filter((doc) => doc.lead?._id).map((doc) => ({ updateOne: { filter: { _id: doc._id }, update: anonymiseLeadUpdate(doc.lead, now, 'lead.') } })), { ordered: false });
    summary.binAnonymised = result.modifiedCount;
  }
  if (summary.anonymised) clearLeadCounts();
  await audit({ email: 'retention-job' }, 'privacy.retention_run', { type: 'system', label: `${summary.anonymised} leads anonymised` }, {
    months, cutoff, due, anonymised: summary.anonymised, notesPurged: summary.notesPurged, tasksScrubbed: summary.tasksScrubbed, binAnonymised: summary.binAnonymised, skipped: summary.skipped,
  });
  log(`Done: ${summary.anonymised} leads anonymised, ${summary.notesPurged} notes purged, ${summary.tasksScrubbed} follow-ups scrubbed, ${summary.binAnonymised} bin entries anonymised.`);
  return summary;
}
