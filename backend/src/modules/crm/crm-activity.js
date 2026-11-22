// The activity log: calls, messages, notes (applicationNotes) and stage changes (each lead's statusHistory),
// newest first, as one feed. Read-only. Who appears follows the viewer's lead scope, the same rule as the
// dashboard's "Recent activity": everyone for company-wide roles, else the viewer and their team (or only the viewer).
// Paging is by time: `before` is the timestamp of the last item already shown.
import { ObjectId } from 'mongodb';
import { HttpError } from '../../lib/http-error.js';
import { leadScopeOf } from '../applications/scope.js';
import { accessFilter, applicationNotes, applications, DAY, istDayStart, staffEmails, statusLabel } from '../applications/service.js';
import { ACTIVITY_KINDS } from './crm-model.js';

const MAX_LIMIT = 100;
const STAGE_WINDOW_DAYS = 90;
const isId = (value) => /^[a-f0-9]{24}$/i.test(String(value ?? ''));
const sameId = (a, b) => String(a) === String(b);

/** The author ids this viewer may see, or null for "anyone". */
function allowedAuthors(staff) {
  const scope = leadScopeOf(staff);
  if (scope === 'all') return null;
  if (scope === 'team') return [staff._id, ...(staff.teamIds ?? [])];
  return [staff._id];
}

function parseDate(value, name, fallback) {
  if (!value) return fallback;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? istDayStart(value) : new Date(value);
  if (!date || Number.isNaN(date.getTime())) throw new HttpError(400, `Invalid ${name}`, { fields: { [name]: 'Use a valid date.' } });
  return date;
}

export async function activityFeed(staff, query = {}) {
  if (leadScopeOf(staff) === 'none') return { items: [], next: null };
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || 40));
  const before = parseDate(query.before, 'before', new Date());
  // `to` is inclusive of its whole day.
  const toDay = query.to ? new Date(parseDate(query.to, 'to').getTime() + DAY) : null;
  const upper = toDay && toDay < before ? toDay : before;
  const from = parseDate(query.from, 'from', null);
  const kind = typeof query.kind === 'string' ? query.kind : '';
  if (kind && kind !== 'stage' && !ACTIVITY_KINDS.includes(kind)) throw new HttpError(400, 'Unknown activity type', { fields: { kind: 'Choose a listed type.' } });

  // Whose activity: the allowed set, narrowed by ?author= or ?mine=1.
  let authors = allowedAuthors(staff);
  const asked = query.mine === '1' ? staff._id : isId(query.author) ? query.author : null;
  if (asked) {
    if (authors && !authors.some((id) => sameId(id, asked))) throw new HttpError(403, 'You can only see your own or your team’s activity');
    authors = [asked];
  }
  const authorIds = authors && authors.filter(Boolean);
  const timeRange = { $lt: upper, ...(from && { $gte: from }) };
  const stageFloor = from ?? new Date(upper.getTime() - STAGE_WINDOW_DAYS * DAY);

  const wantNotes = kind !== 'stage';
  const wantStages = !kind || kind === 'stage';
  const leadsColl = await applications();
  const access = accessFilter(staff);

  const [notes, stages] = await Promise.all([
    wantNotes ? (await applicationNotes()).find({
      createdAt: timeRange,
      // Notes added from the leads screen carry no `kind`; they count as notes.
      ...(kind && { kind: kind === 'note' ? { $in: ['note', null] } : kind }),
      ...(authorIds && { authorId: { $in: authorIds.map(toObjectIdLike) } }),
    }, { projection: { applicationId: 1, kind: 1, outcome: 1, text: 1, authorId: 1, authorEmail: 1, createdAt: 1 } })
      .sort({ createdAt: -1, _id: -1 }).limit(limit * 2).maxTimeMS(5000).toArray() : [],
    wantStages ? leadsColl.aggregate([
      // A lower bound keeps the scan small when no `from` is given.
      { $match: { ...access, 'statusHistory.at': { $gte: stageFloor, $lt: upper } } },
      { $project: { applicant: 1, ref: 1, statusHistory: 1 } },
      { $unwind: '$statusHistory' },
      { $match: {
        'statusHistory.at': { $gte: stageFloor, $lt: upper },
        ...(authorIds && { 'statusHistory.byAdminId': { $in: authorIds.map(toObjectIdLike) } }),
      } },
      { $sort: { 'statusHistory.at': -1 } },
      { $limit: limit },
    ], { maxTimeMS: 5000 }).toArray() : [],
  ]);

  // Lead names for the notes, and only leads this viewer may open.
  const noteLeadIds = [...new Set(notes.map((note) => String(note.applicationId)))];
  const visible = noteLeadIds.length
    ? await leadsColl.find({ _id: { $in: notes.map((note) => note.applicationId) }, ...access }, { projection: { applicant: 1, ref: 1 } }).toArray()
    : [];
  const leadOf = new Map(visible.map((lead) => [lead._id.toString(), lead]));
  const people = await staffEmails([...notes.map((note) => note.authorId), ...stages.map((row) => row.statusHistory.byAdminId)].filter(Boolean));

  const items = [
    ...notes.filter((note) => leadOf.has(String(note.applicationId))).map((note) => {
      const lead = leadOf.get(String(note.applicationId));
      return {
        id: note._id.toString(), type: 'activity', kind: note.kind ?? 'note', outcome: note.outcome ?? '', text: (note.text ?? '').slice(0, 280),
        at: note.createdAt, by: people.get(String(note.authorId)) ?? note.authorEmail ?? '',
        leadId: lead._id.toString(), leadName: lead.applicant?.fullName ?? '', leadRef: lead.ref ?? '',
      };
    }),
    ...stages.map((row, index) => ({
      id: `s-${row._id}-${index}-${new Date(row.statusHistory.at).getTime()}`, type: 'stage', kind: 'stage',
      status: row.statusHistory.status, statusLabel: statusLabel(row.statusHistory.status),
      at: row.statusHistory.at, by: row.statusHistory.byAdminId ? people.get(String(row.statusHistory.byAdminId)) ?? '' : 'System',
      leadId: row._id.toString(), leadName: row.applicant?.fullName ?? '', leadRef: row.ref ?? '',
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);

  const full = notes.length >= limit * 2 || stages.length >= limit || items.length >= limit;
  return { items, next: full && items.length ? new Date(items[items.length - 1].at).toISOString() : null };
}

// Author ids arrive as ObjectIds (from the session) or as strings (from ?author=); the collections store ObjectIds.
function toObjectIdLike(value) {
  if (value instanceof ObjectId) return value;
  return isId(value) ? new ObjectId(String(value)) : value;
}
