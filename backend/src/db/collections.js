import { ObjectId } from 'mongodb';
import { closeDatabase, connectDatabase } from '../config/database.js';
import { ensureIndexes } from './indexes.js';

export const COLLECTIONS = Object.freeze({
  admins: 'admins',
  students: 'students',
  referenceStudents: 'reference_students',
  studentFollowups: 'student_followups',
  otpCodes: 'otp_codes',
  courses: 'courses',
  exams: 'exams',
  institutions: 'institutions',
  programmes: 'programmes',
  cities: 'cities',
  states: 'states',
  scholarships: 'scholarships',
  applications: 'applications',
  applicationNotes: 'application_notes',
  scrapeSources: 'scrape_sources',
  scrapeJobs: 'scrape_jobs',
  scrapeRuns: 'scrape_runs',
  siteContent: 'site_content',
  media: 'media',
  studentEvents: 'student_events',
});

let ready;

// Connects once and creates indexes on first use; a failed attempt is retried on the next call.
export function getDb() {
  ready ??= connectDatabase().then(async (db) => {
    await ensureIndexes(db);
    return db;
  }).catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

export async function closeDb() {
  ready = undefined;
  await closeDatabase();
}

export const collection = async (name) => (await getDb()).collection(name);
export const toObjectId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
export const activeFilter = { active: { $ne: false } };
