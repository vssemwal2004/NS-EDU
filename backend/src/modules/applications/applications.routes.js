import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { requireStudent } from '../../middleware/auth.js';
import { CLOSED_STATUSES, CONSENT_TEXT, parseApplication, parseQuickApplication } from './schema.js';
import { applications, clearLeadCounts, DAY, findCourse, findInstitution, leadKeys, nextRef, serializeForStudent } from './service.js';

// A student's own applications; counsellor callbacks they requested are leads but not applications.
const ownApplications = (studentId) => ({ studentId, channel: { $ne: 'callback' } });

const PER_STUDENT_PER_DAY = 10;
const DUPLICATE_WINDOW_DAYS = 30;
// Per-process limiter (see lib/rate-limit.js); the per-student cap is counted in the database.
const submitsPerIp = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30 });

export const applicationsRouter = Router();
applicationsRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

applicationsRouter.post('/', requireStudent, async (request, response) => {
  const ipLimit = submitsPerIp.hit(request.ip);
  if (!ipLimit.allowed) throw new HttpError(429, 'Too many applications from this network. Please try again later.', { retryAfterSeconds: ipLimit.retryAfterSeconds });
  const data = request.body?.mode === 'quick'
    ? parseQuickApplication(request.body, { accountEmail: request.student.email ?? null })
    : parseApplication(request.body);
  const [institution, course] = await Promise.all([
    findInstitution(data.preference.institutionSlug),
    data.preference.courseSlug ? findCourse(data.preference.courseSlug) : null,
  ]);
  const fields = {};
  if (!institution) fields['preference.institutionSlug'] = 'Choose a university from the list';
  if (data.preference.courseSlug && !course) fields['preference.courseSlug'] = 'Choose a course from the list';
  if (Object.keys(fields).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields });

  const now = new Date();
  const studentId = request.student._id;
  const collection = await applications();
  if (await collection.countDocuments({ ...ownApplications(studentId), createdAt: { $gte: new Date(now.getTime() - DAY) } }) >= PER_STUDENT_PER_DAY) {
    throw new HttpError(429, `You can submit up to ${PER_STUDENT_PER_DAY} applications a day. Please try again tomorrow.`, { retryAfterSeconds: 3600 });
  }
  const sameProgramme = course
    ? { 'preference.courseSlug': course.slug }
    : { 'preference.courseSlug': '', 'preference.programmeNameKey': data.preference.programmeName.toLowerCase() };
  const duplicate = await collection.findOne({
    studentId, 'preference.institutionSlug': institution.slug, ...sameProgramme,
    status: { $nin: CLOSED_STATUSES }, createdAt: { $gte: new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * DAY) },
  }, { projection: { ref: 1 } });
  if (duplicate) {
    throw new HttpError(409, `You already applied to ${institution.name} for this programme (reference ${duplicate.ref}). Our team will be in touch, so there is no need to apply again.`, { ref: duplicate.ref });
  }

  const university = institution.name;
  const doc = {
    ref: await nextRef(now),
    channel: 'web-apply',
    mode: data.mode,
    studentId,
    formId: null,
    school: null,
    answers: [],
    careerField: null,
    callback: null,
    ...leadKeys(data.applicant),
    applicant: data.applicant,
    academics: data.academics,
    exams: data.exams,
    preference: {
      ...data.preference,
      institutionName: institution.name, city: institution.city, state: institution.state,
      courseSlug: course?.slug ?? '', courseName: course?.name ?? '',
      programmeNameKey: data.preference.programmeName.toLowerCase(),
    },
    contactVerified: { email: request.student.email === data.applicant.email, phone: request.student.phone === data.applicant.phone },
    consent: {
      contactConsent: true, privacyAccepted: true, version: data.consentVersion, at: now,
      text: { contact: CONSENT_TEXT.contact.replaceAll('{university}', university), privacy: CONSENT_TEXT.privacy.replaceAll('{university}', university) },
      ip: request.ip ?? '', userAgent: String(request.get('user-agent') ?? '').slice(0, 300),
    },
    source: data.source,
    status: 'new',
    statusHistory: [{ status: 'new', at: now, byAdminId: null }],
    assignedEmployeeIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await collection.insertOne(doc);
  clearLeadCounts();
  response.status(201).json({ item: serializeForStudent(doc, { full: true }) });
});

applicationsRouter.get('/prefill', requireStudent, async (request, response) => {
  const { student } = request;
  const latest = await (await applications()).findOne(ownApplications(student._id), { sort: { createdAt: -1 }, projection: { applicant: 1, academics: 1, exams: 1 } });
  response.json({
    applicant: {
      ...(latest?.applicant ?? {}),
      fullName: latest?.applicant.fullName || student.name || '',
      email: student.email || latest?.applicant.email || '',
      phone: student.phone || latest?.applicant.phone || '',
    },
    academics: latest?.academics ?? null,
    exams: latest?.exams ?? [],
    verified: { email: student.email ?? null, phone: student.phone ?? null },
  });
});

applicationsRouter.get('/mine', requireStudent, async (request, response) => {
  const docs = await (await applications()).find(ownApplications(request.student._id), {
    projection: { ref: 1, mode: 1, status: 1, createdAt: 1, updatedAt: 1, preference: 1 },
  }).sort({ createdAt: -1 }).limit(100).toArray();
  response.json({ items: docs.map((doc) => serializeForStudent(doc)) });
});

applicationsRouter.get('/mine/:ref', requireStudent, async (request, response) => {
  const ref = String(request.params.ref).toUpperCase();
  const doc = /^GV-\d{4}-\d{6,}$/.test(ref) && await (await applications()).findOne({ ref, ...ownApplications(request.student._id) });
  if (!doc) throw new HttpError(404, 'Application not found');
  response.json({ item: serializeForStudent(doc, { full: true }) });
});
