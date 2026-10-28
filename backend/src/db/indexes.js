const specs = {
  admins: [[{ email: 1 }, { unique: true }]],
  students: [
    [{ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } }],
    [{ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }],
    [{ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $type: 'string' } } }],
    [{ createdAt: -1 }],
    [{ lastLoginAt: -1 }],
    [{ assignedEmployeeIds: 1, createdAt: -1 }],
  ],
  reference_students: [[{ createdAt: -1 }], [{ assignedEmployeeIds: 1, createdAt: -1 }], [{ createdById: 1, createdAt: -1 }]],
  student_followups: [[{ studentId: 1, studentKind: 1, createdAt: -1 }]],
  otp_codes: [
    [{ channel: 1, identifier: 1 }, { unique: true }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ],
  courses: [[{ slug: 1 }, { unique: true }], [{ order: 1, name: 1 }]],
  exams: [[{ slug: 1 }, { unique: true }], [{ order: 1, name: 1 }]],
  // Built for 20k+ institutions: prefix search, every public filter and the admin review queue.
  institutions: [
    [{ slug: 1 }, { unique: true }],
    [{ order: 1, name: 1 }],
    [{ order: 1, nameKey: 1, _id: 1 }],
    [{ searchPrefixes: 1, popularity: -1 }],
    [{ popularity: -1, nameKey: 1, _id: 1 }],
    [{ nameKey: 1, _id: 1 }],
    [{ state: 1, city: 1, nameKey: 1 }],
    [{ city: 1, nameKey: 1 }],
    [{ type: 1, popularity: -1 }],
    [{ category: 1, popularity: -1 }],
    [{ ownership: 1, popularity: -1 }],
    [{ streams: 1, popularity: -1 }],
    [{ courseSlugs: 1, popularity: -1 }],
    [{ nirfRank: 1 }, { partialFilterExpression: { nirfRank: { $type: 'number' } } }],
    [{ domain: 1 }],
    [{ verification: 1, updatedAt: -1 }],
  ],
  programmes: [[{ slug: 1 }, { unique: true }], [{ institutionSlug: 1 }], [{ courseSlug: 1 }], [{ order: 1 }]],
  cities: [[{ name: 1 }, { unique: true }]],
  states: [[{ name: 1 }, { unique: true }]],
  scholarships: [[{ slug: 1 }, { unique: true }], [{ order: 1 }]],
  media: [[{ publicId: 1 }, { unique: true }], [{ usage: 1, createdAt: -1 }], [{ createdAt: -1 }]],
  // Leads from every channel. Each list filter is `<field>, createdAt, _id` so the newest-first
  // sort (and keyset paging) is read from the index instead of sorting matches in memory.
  applications: [
    [{ ref: 1 }, { unique: true }],
    [{ studentId: 1, createdAt: -1 }],
    [{ createdAt: -1, _id: -1 }],
    [{ status: 1, createdAt: -1, _id: -1 }],
    [{ channel: 1, createdAt: -1, _id: -1 }],
    [{ formId: 1, createdAt: -1, _id: -1 }, { partialFilterExpression: { formId: { $type: 'objectId' } } }],
    [{ formId: 1, 'applicant.phone': 1 }, { unique: true, partialFilterExpression: { channel: 'school-drive' }, name: 'one_phone_per_form' }],
    [{ 'preference.institutionSlug': 1, createdAt: -1, _id: -1 }],
    [{ 'preference.courseSlug': 1, createdAt: -1, _id: -1 }],
    [{ 'applicant.state': 1, createdAt: -1, _id: -1 }],
    [{ assignedEmployeeIds: 1, createdAt: -1, _id: -1 }],
    [{ 'applicant.phone': 1, createdAt: -1 }],
    [{ 'applicant.email': 1 }],
    [{ nameTokens: 1, createdAt: -1 }],
    [{ cityKey: 1, createdAt: -1, _id: -1 }],
    // Class/stream exist only on drive leads and career field only on callbacks; leadFilter adds the
    // matching channel to those clauses so these smaller partial indexes are chosen.
    [{ 'academics.classLevel': 1, createdAt: -1, _id: -1 }, { partialFilterExpression: { channel: 'school-drive' } }],
    [{ 'academics.schoolStream': 1, createdAt: -1, _id: -1 }, { partialFilterExpression: { channel: 'school-drive' } }],
    [{ 'careerField.slug': 1, createdAt: -1, _id: -1 }, { partialFilterExpression: { channel: 'callback' } }],
  ],
  application_notes: [[{ applicationId: 1, createdAt: -1 }]],
  // School drive registration forms: the public QR link resolves by the immutable short code.
  lead_forms: [[{ shortCode: 1 }, { unique: true }], [{ status: 1, 'school.state': 1, 'school.districtKey': 1 }], [{ createdAt: -1 }]],
  career_fields: [[{ slug: 1 }, { unique: true }], [{ order: 1 }]],
  counsellors: [[{ fieldSlug: 1, order: 1 }]],
  // Scraper queue: partial unique indexes give one open job per source and one running job per domain.
  scrape_sources: [[{ websiteKey: 1 }, { unique: true }], [{ nameKey: 1, _id: 1 }], [{ domain: 1 }], [{ status: 1, lastJobAt: 1 }], [{ seedListName: 1 }]],
  scrape_jobs: [
    [{ sourceId: 1 }, { unique: true, partialFilterExpression: { open: true }, name: 'one_open_job_per_source' }],
    [{ host: 1 }, { unique: true, partialFilterExpression: { status: 'running' }, name: 'one_running_job_per_host' }],
    [{ status: 1, priority: -1, nextRunAt: 1, _id: 1 }],
    [{ status: 1, lockedUntil: 1 }],
    [{ status: 1, updatedAt: -1 }],
    [{ updatedAt: -1, _id: -1 }],
    [{ runId: 1, status: 1 }],
    [{ 'result.slug': 1, finishedAt: -1 }],
  ],
  scrape_runs: [[{ createdAt: -1 }]],
  site_content: [[{ key: 1 }, { unique: true }]],
  // Student search/view activity. The TTL index on `at` deletes raw rows after 180 days;
  // the rest serve the per-viewer recommendation read and the admin reports.
  student_events: [
    [{ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60, name: 'student_events_ttl' }],
    [{ visitorId: 1, at: -1 }],
    [{ studentId: 1, at: -1 }],
    [{ type: 1, at: -1 }],
    [{ type: 1, query: 1, at: -1 }],
    [{ type: 1, institutionSlug: 1, at: -1 }],
  ],
  // One anonymous row per cookie decision (choice + time only). Kept 400 days so a full year of
  // decisions is always available to the admin report, then deleted by the TTL index.
  consent_events: [
    [{ at: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60, name: 'consent_events_ttl' }],
  ],
};

// Superseded indexes, dropped once their replacements exist (missing ones are ignored).
const obsolete = {
  applications: ['status_1_createdAt_-1', 'preference.institutionSlug_1_createdAt_-1', 'assignedEmployeeIds_1_createdAt_-1', 'createdAt_-1'],
};

export async function ensureIndexes(db) {
  await Promise.all(Object.entries(specs).map(([name, indexes]) => db.collection(name).createIndexes(
    indexes.map(([key, options = {}]) => ({ key, ...options })),
  )));
  await Promise.all(Object.entries(obsolete).flatMap(([name, indexNames]) => indexNames.map((index) => db.collection(name).dropIndex(index).catch((error) => {
    if (error?.code !== 27 && error?.codeName !== 'IndexNotFound' && error?.codeName !== 'NamespaceNotFound') throw error;
  }))));
}
