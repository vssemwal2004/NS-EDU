import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isR2Url, publicUrlFor, r2Config, r2Selected } from '../src/lib/r2.js';

const KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_IMAGES_BUCKET', 'R2_IMAGES_PUBLIC_URL', 'IMAGE_STORAGE'];
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
const setEnv = (values) => { for (const key of KEYS) delete process.env[key]; Object.assign(process.env, values); };
afterEach(() => { for (const key of KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });

const READY = { R2_ACCOUNT_ID: 'a'.repeat(32), R2_ACCESS_KEY_ID: 'k'.repeat(32), R2_SECRET_ACCESS_KEY: 's'.repeat(64), R2_IMAGES_PUBLIC_URL: 'https://pub-abc.r2.dev' };

describe('r2 config', () => {
  test('is not configured without a public https address, and never falls back to another project bucket', () => {
    setEnv({ ...READY, R2_IMAGES_PUBLIC_URL: '', R2_BUCKET: 'some-other-project' });
    assert.equal(r2Config().configured, false);
    assert.equal(r2Config().hasKeys, true);
    assert.equal(r2Config().bucket, 'gyaan-vidhya');
    assert.equal(r2Selected(), false);
    setEnv({ ...READY, R2_IMAGES_PUBLIC_URL: 'http://pub-abc.r2.dev' });
    assert.equal(r2Config().configured, false);
  });

  test('tolerates quotes, spaces and a trailing slash or backslash pasted into .env', () => {
    setEnv({ ...READY, R2_IMAGES_PUBLIC_URL: ' "https://pub-abc.r2.dev\\" ' });
    assert.equal(r2Config().publicUrl, 'https://pub-abc.r2.dev');
    assert.equal(r2Selected(), true);
    assert.equal(publicUrlFor('universities/iit-delhi/photo-1.webp'), 'https://pub-abc.r2.dev/universities/iit-delhi/photo-1.webp');
    assert.equal(isR2Url('https://pub-abc.r2.dev/universities/x/photo-1.webp'), true);
    assert.equal(isR2Url('https://res.cloudinary.com/x/image/upload/a.webp'), false);
  });

  test('IMAGE_STORAGE=cloudinary switches R2 off', () => {
    setEnv({ ...READY, IMAGE_STORAGE: 'cloudinary' });
    assert.equal(r2Selected(), false);
  });
});
