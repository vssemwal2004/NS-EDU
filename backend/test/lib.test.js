import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIdentifier } from '../src/modules/student-auth/otp.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { createRateLimiter } from '../src/lib/rate-limit.js';
import { escapeRegex, slugify, validate } from '../src/lib/validation.js';

test('phone and email identifiers normalise to one canonical form', () => {
  for (const raw of ['9876543210', '+91 98765 43210', '91-98765-43210', '09876543210']) {
    assert.deepEqual(normalizeIdentifier('phone', raw), { value: '+919876543210' });
  }
  for (const raw of ['5876543210', '98765', '+1 9876543210', '98765432101', 'abc']) {
    assert.ok(normalizeIdentifier('phone', raw).error, raw);
  }
  assert.deepEqual(normalizeIdentifier('email', '  Student@Example.COM '), { value: 'student@example.com' });
  assert.ok(normalizeIdentifier('email', 'not-an-email').error);
  assert.ok(normalizeIdentifier('email', `${'a'.repeat(250)}@x.io`).error);
});

test('scrypt password hashes verify only the original password', async () => {
  const stored = await hashPassword('s3cret-pass');
  assert.match(stored, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPassword('s3cret-pass', stored), true);
  assert.equal(await verifyPassword('wrong', stored), false);
  assert.equal(await verifyPassword('s3cret-pass', 'garbage'), false);
});

test('validator trims, coerces, applies defaults and strips unknown fields', () => {
  const fields = [
    { name: 'name', type: 'string', required: true, maxLength: 10 },
    { name: 'count', type: 'integer', min: 0, default: 0 },
    { name: 'state', type: 'string', nullable: true },
    { name: 'crop', type: 'numberArray4', nullable: true },
  ];
  assert.deepEqual(validate(fields, { name: '  Hi  there ', count: '3', state: '', extra: 'x', crop: ['1', 2, 3, 4] }), {
    value: { name: 'Hi there', count: 3, state: null, crop: [1, 2, 3, 4] }, errors: {},
  });
  assert.deepEqual(validate(fields, {}).errors, { name: 'This field is required' });
  assert.deepEqual(Object.keys(validate(fields, { name: 'x'.repeat(11), count: 1.5, crop: [1] }).errors), ['name', 'count', 'crop']);
  assert.deepEqual(validate(fields, { count: 2 }, { partial: true }), { value: { count: 2 }, errors: {} });
  assert.equal(escapeRegex('a.b*(c)'), 'a\\.b\\*\\(c\\)');
  assert.equal(slugify('  B.Sc Nursing & Care! '), 'b-sc-nursing-care');
});

test('fixed-window limiter blocks after the limit and resets with the window', () => {
  let now = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, clock: () => now });
  assert.equal(limiter.hit('k').allowed, true);
  assert.equal(limiter.hit('k').allowed, true);
  assert.deepEqual(limiter.hit('k'), { allowed: false, retryAfterSeconds: 1 });
  assert.equal(limiter.hit('other').allowed, true);
  now = 1000;
  assert.equal(limiter.hit('k').allowed, true);
  limiter.reset();
  assert.equal(limiter.hit('k').allowed, true);
});
