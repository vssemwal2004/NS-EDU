import { env } from '../../config/env.js';
import { COLLECTIONS, getDb } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';

/**
 * Cookie consent.
 *
 * Two levels, chosen in the banner on a visitor's first page:
 *   'all'        essential cookies plus personalisation — the `gv_visitor` id and the activity events
 *                that drive "recommended for you" and the admin insights
 *   'essential'  only what the site cannot work without: the login session and this choice itself
 *
 * The choice lives in the `gv_consent` cookie (readable by the page, so the banner knows whether to
 * show). The server enforces it: without 'all' no visitor id is issued and no activity is stored.
 *
 * Each decision is also logged as one anonymous row in `consent_events` — the choice, whether the
 * visitor was changing an earlier one, and the time. No visitor id, IP address or browser details.
 */
export const CONSENT_COOKIE = 'gv_consent';
export const CONSENT_CHOICES = Object.freeze(['all', 'essential']);
export const CONSENT_MAX_AGE_DAYS = 180;
const WINDOWS = [7, 30, 90];
const TIMEZONE = 'Asia/Kolkata';

export const consentOf = (request) => (CONSENT_CHOICES.includes(request.cookies?.[CONSENT_COOKIE]) ? request.cookies[CONSENT_COOKIE] : null);
export const allowsPersonalisation = (request) => consentOf(request) === 'all';

export const consentCookieOptions = () => ({
  httpOnly: false, sameSite: 'lax', secure: env.isProduction, path: '/', maxAge: CONSENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
});

const consentEvents = async () => (await getDb()).collection(COLLECTIONS.consentEvents);

export async function recordConsent(body, { previous = null } = {}) {
  const choice = body?.choice;
  if (!CONSENT_CHOICES.includes(choice)) throw new HttpError(400, 'choice must be "all" or "essential"', { fields: { choice: 'Choose all or essential' } });
  await (await consentEvents()).insertOne({ choice, changed: Boolean(previous), at: new Date() });
  return choice;
}

/**
 * Admin report: how visitors answered, and an estimate of how many visited.
 * Only visitors who accept personalisation can be counted directly (by their distinct `gv_visitor`
 * ids in the activity log). Dividing that by the share who accept gives an estimate for everyone —
 * labelled as an estimate on the page, and left out entirely when nobody has accepted yet.
 */
export async function consentReport(query = {}) {
  const days = WINDOWS.includes(Number(query.days)) ? Number(query.days) : 30;
  const since = new Date(Date.now() - days * 86_400_000);
  const db = await getDb();
  const [[result], counted] = await Promise.all([
    (await consentEvents()).aggregate([
      { $match: { at: { $gte: since } } },
      { $facet: {
        totals: [{ $group: { _id: '$choice', count: { $sum: 1 } } }],
        changed: [{ $match: { changed: true } }, { $count: 'value' }],
        daily: [
          { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: TIMEZONE } }, choice: '$choice' }, count: { $sum: 1 } } },
          { $sort: { '_id.day': 1 } },
        ],
      } },
    ]).toArray(),
    db.collection(COLLECTIONS.studentEvents).aggregate([
      { $match: { at: { $gte: since }, visitorId: { $nin: [null, ''] } } },
      { $group: { _id: '$visitorId' } },
      { $count: 'value' },
    ]).toArray(),
  ]);
  const totals = Object.fromEntries(CONSENT_CHOICES.map((choice) => [choice, result.totals.find((row) => row._id === choice)?.count ?? 0]));
  const decisions = totals.all + totals.essential;
  const acceptanceRate = decisions ? totals.all / decisions : null;
  const trackedVisitors = counted[0]?.value ?? 0;
  const byDay = new Map();
  for (const row of result.daily) {
    const entry = byDay.get(row._id.day) ?? { day: row._id.day, all: 0, essential: 0 };
    entry[row._id.choice] = row.count;
    byDay.set(row._id.day, entry);
  }
  return {
    days,
    totals,
    decisions,
    changed: result.changed[0]?.value ?? 0,
    acceptanceRate,
    trackedVisitors,
    estimatedVisitors: acceptanceRate ? Math.round(trackedVisitors / acceptanceRate) : null,
    daily: [...byDay.values()],
  };
}
