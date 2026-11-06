import { test } from 'node:test';
import assert from 'node:assert/strict';

// Config only, no database. The current account is set before the modules read it.
process.env.CLOUDINARY_URL = 'cloudinary://123456789012345:secret@newcloud';
process.env.CLOUDINARY_FOLDER = 'gyaan-vidhya';
const { isRetiredImage, liveImage, retiredImagePattern } = await import('../src/lib/retired-images.js');

const OLD = 'https://res.cloudinary.com/oldcloud/image/upload/v1793299606/gyaan-vidhya/place/state-maharashtra.jpg';
const NEW = 'https://res.cloudinary.com/newcloud/image/upload/v1800000000/gyaan-vidhya/place/state-maharashtra.jpg';
const UNIVERSITY_OWN = 'https://res.cloudinary.com/m6nlay03/image/upload/v1788333270/mam_college/logo.png';

test('our images on another account are retired; the current account and universities’ own clouds are not', () => {
  assert.equal(isRetiredImage(OLD), true);
  assert.equal(isRetiredImage('https://res.cloudinary.com/oldcloud/image/upload/c_fill,w_400/v12/gyaan-vidhya/site/desk.webp'), true, 'with a transformation');
  assert.equal(isRetiredImage(NEW), false);
  assert.equal(isRetiredImage(UNIVERSITY_OWN), false, 'never touch an institution’s own Cloudinary images');
  assert.equal(isRetiredImage('https://www.iitb.ac.in/logo.png'), false);
  assert.equal(isRetiredImage(''), false);
  assert.equal(isRetiredImage(undefined), false);
});

test('liveImage hides only retired links, and the query pattern agrees', () => {
  assert.equal(liveImage(OLD), '');
  assert.equal(liveImage(NEW), NEW);
  assert.equal(liveImage(null), '');
  const pattern = retiredImagePattern();
  assert.equal(pattern.test(OLD), true);
  assert.equal(pattern.test(NEW), false);
  assert.equal(pattern.test(UNIVERSITY_OWN), false);
});
