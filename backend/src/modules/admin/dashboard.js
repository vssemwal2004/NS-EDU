import { getDb, COLLECTIONS } from '../../db/collections.js';
import { serializeStudentForAdmin } from './students.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CATALOG = ['institutions', 'programmes', 'courses', 'exams', 'cities', 'states', 'scholarships'];

export async function getDashboard(now = new Date()) {
  const db = await getDb();
  const students = db.collection(COLLECTIONS.students);
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const since = new Date(todayUtc - 13 * DAY_MS);
  const [studentCounts, catalogCounts, recent, byDay, byCourse, courses] = await Promise.all([
    Promise.all([
      students.countDocuments({}),
      students.countDocuments({ status: { $ne: 'blocked' } }),
      students.countDocuments({ status: 'blocked' }),
      students.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } }),
    ]),
    Promise.all(CATALOG.map((name) => db.collection(name).countDocuments({}))),
    students.find({}).sort({ lastLoginAt: -1, _id: -1 }).limit(5).toArray(),
    students.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
    ]).toArray(),
    db.collection(COLLECTIONS.programmes).aggregate([{ $group: { _id: '$courseSlug', count: { $sum: 1 } } }]).toArray(),
    db.collection(COLLECTIONS.courses).find({}, { projection: { slug: 1, name: 1 } }).toArray(),
  ]);
  const [total, active, blocked, new7d] = studentCounts;
  const perDay = new Map(byDay.map((row) => [row._id, row.count]));
  const courseNames = new Map(courses.map((course) => [course.slug, course.name]));
  return {
    counts: {
      students: total, activeStudents: active, blockedStudents: blocked, newStudents7d: new7d,
      ...Object.fromEntries(CATALOG.map((name, index) => [name, catalogCounts[index]])),
    },
    recentStudents: recent.map(serializeStudentForAdmin),
    studentsByDay: Array.from({ length: 14 }, (_, index) => {
      const date = new Date(since.getTime() + index * DAY_MS).toISOString().slice(0, 10);
      return { date, count: perDay.get(date) ?? 0 };
    }),
    programmesByCourse: byCourse
      .map((row) => ({ courseId: row._id, courseName: courseNames.get(row._id) ?? row._id, count: row.count }))
      .sort((a, b) => b.count - a.count || String(a.courseName).localeCompare(String(b.courseName))),
  };
}
