import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { displayName, parseReview, serializePublic } from '../src/modules/reviews/schema.js';

// Pure validation rules; no database.
const valid = {
  name: '  Priya   Sharma ', stage: 'school', course: 'B.Com (Hons)', institution: '', city: 'Dehradun',
  rating: 5, title: 'Clear fee comparison', text: 'The fee comparison showed annual and semester fees separately, which helped a lot.', consent: true,
};
const fieldsOf = (body) => {
  try { parseReview(body); return {}; } catch (error) { assert.equal(error.status, 400); return error.details.fields; }
};

describe('review form rules', () => {
  test('accepts a complete review and tidies whitespace', () => {
    const review = parseReview(valid);
    assert.equal(review.name, 'Priya Sharma');
    assert.equal(review.course, 'B.Com (Hons)'); // ".Com" in a course name is not a link
    assert.equal(review.rating, 5);
    assert.equal(review.stage, 'school');
    assert.equal('consent' in review, false);
  });

  test('requires rating, stage, consent and enough text', () => {
    const fields = fieldsOf({ ...valid, rating: 6, stage: 'teacher', consent: 'yes', text: 'Too short' });
    assert.deepEqual(Object.keys(fields).sort(), ['consent', 'rating', 'stage', 'text']);
    assert.ok(fieldsOf({ ...valid, rating: 4.5 }).rating);
  });

  test('refuses links, email addresses and phone numbers', () => {
    assert.ok(fieldsOf({ ...valid, text: `${valid.text} Visit https://spam.example now` }).text);
    assert.ok(fieldsOf({ ...valid, text: `${valid.text} see www.spam.example` }).text);
    assert.ok(fieldsOf({ ...valid, text: `${valid.text} mail me at someone@example.com` }).text);
    assert.ok(fieldsOf({ ...valid, title: 'Call 98765 43210' }).title);
  });

  test('keeps paragraph breaks but strips control characters', () => {
    const review = parseReview({ ...valid, text: `First paragraph is long enough here.\r\n\r\n\r\n\u0007Second paragraph.` });
    assert.equal(review.text, 'First paragraph is long enough here.\n\nSecond paragraph.');
  });

  test('public view shows first name and last initial only', () => {
    assert.equal(displayName('priya kumari sharma'), 'priya S.');
    assert.equal(displayName('Arjun'), 'Arjun');
    const shown = serializePublic({ _id: 'a'.repeat(24), studentId: 'secret', name: 'Priya Sharma', stage: 'school', course: 'B.Com', rating: 4, text: 'x', status: 'approved', approvedAt: new Date(0), consent: { ip: '1.2.3.4' } });
    assert.equal(shown.name, 'Priya S.');
    assert.equal(shown.stage, 'Class 11–12 student');
    for (const key of ['studentId', 'status', 'consent']) assert.equal(key in shown, false);
  });
});
