// The CRM vocabulary and the lead temperature rules. Pure functions, no database.
//
// Temperature (Hot / Warm / Cold) is a score from 0 to 100 built only from facts about the lead, so a
// counsellor can see *why* a lead is hot. A person can override it ("manual"); the score keeps
// updating underneath but the label stays where they put it until they hand it back to "auto".
import { CLOSED_STATUSES } from '../applications/schema.js';

export const HEATS = ['hot', 'warm', 'cold'];
export const HEAT_LABELS = { hot: 'Hot', warm: 'Warm', cold: 'Cold' };
export const PRIORITIES = ['urgent', 'high', 'normal', 'low'];
export const PRIORITY_LABELS = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };
export const ACTIVITY_KINDS = ['note', 'call', 'whatsapp', 'email', 'meeting', 'visit'];
export const CALL_OUTCOMES = ['connected', 'interested', 'callback-requested', 'no-answer', 'busy', 'wrong-number', 'not-interested'];
export const TASK_KINDS = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'document', 'other'];
export const HOT_AT = 65;
export const WARM_AT = 35;

const DAY = 24 * 60 * 60 * 1000;
const PROGRESS = { new: 0, contacted: 5, 'in-progress': 15, 'applied-to-university': 30 };

export const heatOf = (score) => (score >= HOT_AT ? 'hot' : score >= WARM_AT ? 'warm' : 'cold');

/**
 * @param {object} lead an `applications` document
 * @param {Date} now
 * @returns {{ score: number, heat: string, reasons: { label: string, points: number }[] }}
 */
export function scoreLead(lead, now = new Date()) {
  const reasons = [];
  const add = (label, points) => { if (points) reasons.push({ label, points }); };
  if (lead.status === 'admitted') return { score: 100, heat: 'hot', reasons: [{ label: 'Admitted', points: 100 }] };
  if (CLOSED_STATUSES.includes(lead.status)) return { score: 0, heat: 'cold', reasons: [{ label: lead.status === 'closed' ? 'Closed' : 'Not interested', points: 0 }] };

  const channel = lead.channel ?? 'web-apply';
  if (channel === 'callback') add('Asked for a counsellor call', 30);
  else if (channel === 'web-apply') add(lead.mode === 'detailed' ? 'Filled the full application' : 'Applied online', lead.mode === 'detailed' ? 25 : 18);
  else if (channel === 'manual') add('Enquired by phone, walk-in or referral', 15);
  else add('Registered at a school drive', 10);

  if (lead.preference?.courseSlug || lead.preference?.institutionSlug) add('Chose a course or university', 10);
  if (lead.contactVerified?.phone) add('Phone verified', 8);
  if (lead.contactVerified?.email) add('Email verified', 4);
  if (lead.consent?.contactConsent) add('Agreed to be contacted', 5);
  add(`Stage: ${lead.status}`, PROGRESS[lead.status] ?? 0);

  const last = new Date(lead.crm?.lastActivityAt ?? lead.updatedAt ?? lead.createdAt ?? now);
  const idle = Math.max(0, (now - last) / DAY);
  if (idle <= 1) add('Activity in the last day', 20);
  else if (idle <= 3) add('Activity in the last 3 days', 12);
  else if (idle <= 7) add('Activity this week', 5);
  else if (idle > 30) add('No activity for over a month', -20);
  else if (idle > 14) add('No activity for over two weeks', -10);

  const next = lead.crm?.nextFollowUpAt ? new Date(lead.crm.nextFollowUpAt) : null;
  if (next && next < now) add('Follow-up overdue', -10);
  else if (next) add('Follow-up scheduled', 5);

  const age = (now - new Date(lead.createdAt ?? now)) / DAY;
  if (!lead.crm?.lastContactedAt && lead.status === 'new' && age > 2) add('Not contacted yet', -10);

  const score = Math.max(0, Math.min(100, reasons.reduce((sum, reason) => sum + reason.points, 0)));
  return { score, heat: heatOf(score), reasons };
}

/**
 * The `$set` that keeps a lead's CRM block current. Manual temperatures are kept; everything else is
 * recomputed. `extra` is merged in for the caller's own changes (e.g. a new follow-up date).
 */
export function crmUpdate(lead, now = new Date(), extra = {}) {
  const merged = { ...lead, crm: { ...(lead.crm ?? {}), ...extra } };
  const { score, heat, reasons } = scoreLead(merged, now);
  const manual = merged.crm.heatSource === 'manual' && merged.crm.heat && !CLOSED_STATUSES.includes(lead.status) && lead.status !== 'admitted';
  const set = { 'crm.score': score, 'crm.heat': manual ? merged.crm.heat : heat, 'crm.heatSource': manual ? 'manual' : 'auto', 'crm.reasons': reasons, 'crm.scoredAt': now };
  for (const [key, value] of Object.entries(extra)) set[`crm.${key}`] = value;
  return set;
}
