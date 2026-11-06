import { test } from 'node:test';
import assert from 'node:assert/strict';

// No database here: google.js only reads config. PUBLIC_SITE_URL is set before the import.
process.env.PUBLIC_SITE_URL = 'http://127.0.0.1:3000';
const { siteOriginFor, googleRedirectUri } = await import('../src/modules/student-auth/google.js');
const { env } = await import('../src/config/env.js');

const request = (host, protocol = 'http') => ({ host, protocol });

test('Google returns to the address the sign-in started on, when it is one we serve', () => {
  assert.equal(siteOriginFor(request('127.0.0.1:3000')), 'http://127.0.0.1:3000');
  // localhost and 127.0.0.1 are the same machine in development: the cookie stays on the starting host.
  assert.equal(siteOriginFor(request('localhost:3000')), 'http://localhost:3000');
  assert.equal(googleRedirectUri(siteOriginFor(request('localhost:3000'))), 'http://localhost:3000/api/auth/google/callback');
});

test('unknown or forged hosts fall back to PUBLIC_SITE_URL', () => {
  assert.equal(siteOriginFor(request('evil.example')), 'http://127.0.0.1:3000');
  assert.equal(siteOriginFor(request('localhost:4100')), 'http://127.0.0.1:3000', 'another port is another site');
  assert.equal(siteOriginFor(request('bad host')), 'http://127.0.0.1:3000');
});

test('production accepts the domain and its www twin only', () => {
  const saved = { url: env.publicSiteUrl, production: env.isProduction };
  try {
    env.publicSiteUrl = 'https://gyaanvidhya.com';
    env.isProduction = true;
    assert.equal(siteOriginFor(request('www.gyaanvidhya.com', 'https')), 'https://www.gyaanvidhya.com');
    assert.equal(siteOriginFor(request('gyaanvidhya.com', 'https')), 'https://gyaanvidhya.com');
    assert.equal(siteOriginFor(request('gyaanvidhya.com', 'http')), 'https://gyaanvidhya.com', 'never downgrade to http');
    assert.equal(siteOriginFor(request('localhost:3000')), 'https://gyaanvidhya.com', 'no loopback in production');
    assert.equal(siteOriginFor(request('gyaanvidhya.com.evil.io', 'https')), 'https://gyaanvidhya.com');
  } finally {
    env.publicSiteUrl = saved.url;
    env.isProduction = saved.production;
  }
});
