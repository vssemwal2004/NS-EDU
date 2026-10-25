import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, robotsPolicy } from '../src/scraper/robots.js';
import { isSameSite, normalizeWebsite, registrableDomain, websiteKey } from '../src/scraper/urls.js';

const policy = (text, token = 'GyaanVidhyaBot') => robotsPolicy(parseRobots(text), token);

describe('robots.txt parser', () => {
  test('uses the group naming the bot, otherwise *', () => {
    const text = `
User-agent: *
Disallow: /

User-agent: GyaanVidhyaBot/1.0
Disallow: /private
Crawl-delay: 5
`;
    const own = policy(text);
    assert.equal(own.isAllowed('/about'), true);
    assert.equal(own.isAllowed('/private/x'), false);
    assert.equal(own.crawlDelayMs, 5000);
    const other = policy(text, 'OtherBot');
    assert.equal(other.isAllowed('/about'), false);
    assert.equal(other.crawlDelayMs, 0);
  });

  test('longest match wins and Allow wins ties', () => {
    const rules = policy(`User-agent: *\nDisallow: /admissions\nAllow: /admissions/apply\nDisallow: /page\nAllow: /page\n`);
    assert.equal(rules.isAllowed('/admissions/fees'), false);
    assert.equal(rules.isAllowed('/admissions/apply-now'), true);
    assert.equal(rules.isAllowed('/page'), true);
    assert.equal(rules.isAllowed('/robots.txt'), true);
  });

  test('supports * and $ wildcards, comments, empty Disallow and merged groups', () => {
    const rules = policy(`# comment
User-agent: a
User-agent: *   # shared group
Disallow: /*.pdf$
Disallow: /search?
Disallow:
Allow: /files/*.pdf$
`);
    assert.equal(rules.isAllowed('/brochure.pdf'), false);
    assert.equal(rules.isAllowed('/brochure.pdf?x=1'), true);
    assert.equal(rules.isAllowed('/files/brochure.pdf'), true);
    assert.equal(rules.isAllowed('/search?q=mba'), false);
    assert.equal(rules.isAllowed('/'), true);
    const merged = policy('User-agent: gyaanvidhyabot\nDisallow: /a\n\nUser-agent: GyaanVidhyaBot\nDisallow: /b\n');
    assert.deepEqual([merged.isAllowed('/a'), merged.isAllowed('/b'), merged.isAllowed('/c')], [false, false, true]);
  });

  test('a rule line before any user-agent and garbage lines are ignored', () => {
    const rules = policy('Disallow: /\n<html>not robots</html>\nUser-agent: *\nDisallow: /x\n');
    assert.equal(rules.isAllowed('/'), true);
    assert.equal(rules.isAllowed('/x'), false);
  });
});

describe('scraper URL helpers', () => {
  test('registrable domains understand Indian academic suffixes', () => {
    assert.equal(registrableDomain('www.iitb.ac.in'), 'iitb.ac.in');
    assert.equal(registrableDomain('admissions.geu.ac.in'), 'geu.ac.in');
    assert.equal(registrableDomain('www.example.edu.in'), 'example.edu.in');
    assert.equal(registrableDomain('portal.amity.edu'), 'amity.edu');
    assert.equal(registrableDomain('du.ac.in'), 'du.ac.in');
  });

  test('normalizes seed websites and keys them without scheme or www', () => {
    assert.equal(normalizeWebsite('www.xyz.ac.in'), 'https://www.xyz.ac.in/');
    assert.equal(normalizeWebsite('http://xyz.ac.in/home?x=1#top'), 'http://xyz.ac.in/home');
    assert.equal(normalizeWebsite('ftp://xyz.ac.in'), '');
    assert.equal(normalizeWebsite('not a site'), '');
    assert.equal(normalizeWebsite('www.https//rlbcau.ac.in'), 'https://rlbcau.ac.in/');
    assert.equal(normalizeWebsite('https://www.http//example.ac.in/path'), 'http://example.ac.in/path');
    assert.equal(normalizeWebsite('https://0.0.0.58/university'), '');
    assert.equal(normalizeWebsite('https://127.0.0.1'), '');
    assert.equal(normalizeWebsite('https://[::1]/university'), '');
    assert.equal(websiteKey('https://www.XYZ.ac.in/'), websiteKey('http://xyz.ac.in'));
    assert.equal(isSameSite('https://admissions.xyz.ac.in/apply', 'xyz.ac.in'), true);
    assert.equal(isSameSite('https://xyz.ac.in.evil.com/', 'xyz.ac.in'), false);
    assert.equal(isSameSite('https://notxyz.ac.in/', 'xyz.ac.in'), false);
  });
});
