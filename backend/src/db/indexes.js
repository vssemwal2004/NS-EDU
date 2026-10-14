const specs = {
  admins: [[{ email: 1 }, { unique: true }]],
  students: [
    [{ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } }],
    [{ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }],
    [{ createdAt: -1 }],
    [{ lastLoginAt: -1 }],
  ],
  otp_codes: [
    [{ channel: 1, identifier: 1 }, { unique: true }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ],
  courses: [[{ slug: 1 }, { unique: true }], [{ order: 1, name: 1 }]],
  exams: [[{ slug: 1 }, { unique: true }], [{ order: 1, name: 1 }]],
  institutions: [[{ slug: 1 }, { unique: true }], [{ order: 1, name: 1 }]],
  programmes: [[{ slug: 1 }, { unique: true }], [{ institutionSlug: 1 }], [{ courseSlug: 1 }], [{ order: 1 }]],
  cities: [[{ name: 1 }, { unique: true }]],
  states: [[{ name: 1 }, { unique: true }]],
  scholarships: [[{ slug: 1 }, { unique: true }], [{ order: 1 }]],
};

export async function ensureIndexes(db) {
  await Promise.all(Object.entries(specs).map(([name, indexes]) => db.collection(name).createIndexes(
    indexes.map(([key, options = {}]) => ({ key, ...options })),
  )));
}
