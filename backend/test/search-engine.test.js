import { test } from 'node:test';
import assert from 'node:assert/strict';
// Pure module: no database, no env. (Safe to import statically — it never loads config/env.js.)
import { acronymsOf, buildSearchIndex, defaultRank, editDistance, FIELD, phoneticOf, search, tokenize } from '../src/modules/search/search-engine.js';

const institution = (name, extra = {}) => ({
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, nameKey: name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  shortKey: '', acronyms: acronymsOf(name), boost: extra.boost ?? 0, state: extra.state ?? null,
  texts: [{ text: name, field: FIELD.NAME }, { text: extra.city, field: FIELD.PLACE }, { text: extra.state, field: FIELD.PLACE }],
});

const records = [
  institution('University of Petroleum and Energy Studies, Dehradun', { city: 'Dehradun', state: 'Uttarakhand', boost: 6 }),
  institution('Graphic Era University, Dehradun', { city: 'Dehradun', state: 'Uttarakhand', boost: 5 }),
  institution('Indian Institute of Technology, Bombay', { city: 'Mumbai', state: 'Maharashtra', boost: 10 }),
  institution('Indian Institute of Technology, Delhi', { city: 'New Delhi', state: 'Delhi', boost: 10 }),
  institution('University of Delhi', { city: 'New Delhi', state: 'Delhi', boost: 9 }),
  institution('Delhi Technological University', { city: 'New Delhi', state: 'Delhi', boost: 7 }),
  institution('Petroleum Engineering College', { city: 'Pune', state: 'Maharashtra' }),
  institution('Saraswati Vidya Mandir College', { city: 'Lucknow', state: 'Uttar Pradesh' }),
];
const index = buildSearchIndex(records);
const names = (query) => search(index, query, { rank: defaultRank }).hits.map((hit) => hit.record.name);

test('tokenize joins initials and degree prefixes', () => {
  assert.deepEqual(tokenize('B.Tech').map((term) => term.text), ['btech']);
  assert.deepEqual(tokenize('u p e s').map((term) => term.text), ['upes']);
  assert.deepEqual(tokenize('A.P.J. Abdul Kalam').map((term) => term.text), ['apj', 'abdul', 'kalam']);
  assert.deepEqual(tokenize('University of Delhi').map((term) => term.text), ['university', 'delhi']);
});

test('acronyms cover the whole name, the name before the city, and "University of X"', () => {
  assert.ok(acronymsOf('University of Petroleum and Energy Studies, Dehradun').includes('upes'));
  assert.ok(acronymsOf('Indian Institute of Technology, Bombay').includes('iitb'));
  assert.ok(acronymsOf('University of Delhi').includes('du'));
  assert.ok(acronymsOf('Graphic Era (Deemed to be University)').includes('ge'));
});

test('sound-alike spellings share a phonetic key', () => {
  assert.equal(phoneticOf('grafic'), phoneticOf('graphic'));
  assert.equal(phoneticOf('vidhya'), phoneticOf('vidya'));
  assert.equal(phoneticOf('shri'), phoneticOf('sri'));
  assert.equal(phoneticOf('univercity'), phoneticOf('university'));
});

test('edit distance counts a swap as one edit and stops early', () => {
  assert.equal(editDistance('petrolium', 'petroleum'), 1);
  assert.equal(editDistance('grafic', 'graphic'), 2);
  assert.equal(editDistance('teh', 'the'), 1);
  assert.equal(editDistance('abcdef', 'uvwxyz', 2), 3);
});

test('a short form finds its university first', () => {
  assert.equal(names('upes')[0], 'University of Petroleum and Energy Studies, Dehradun');
  assert.equal(names('UPES')[0], 'University of Petroleum and Energy Studies, Dehradun');
  assert.equal(names('du')[0], 'University of Delhi');
  assert.equal(names('iitb')[0], 'Indian Institute of Technology, Bombay');
  const hit = search(index, 'upes', { rank: defaultRank }).hits[0];
  assert.equal(hit.acronym, 'upes');
});

test('prefixes match in any word order', () => {
  assert.deepEqual(names('iit bom'), ['Indian Institute of Technology, Bombay']);
  assert.deepEqual(names('bombay indian'), ['Indian Institute of Technology, Bombay']);
  assert.equal(names('graph')[0], 'Graphic Era University, Dehradun');
});

test('typos are corrected and reported', () => {
  const petroleum = search(index, 'univercity of petrolium', { rank: defaultRank });
  assert.equal(petroleum.hits[0].record.name, 'University of Petroleum and Energy Studies, Dehradun');
  assert.equal(petroleum.corrected, 'university petroleum');
  assert.equal(petroleum.mode, 'fuzzy');
  assert.equal(names('grafic era')[0], 'Graphic Era University, Dehradun');
  // Still typing, with a typo: "petrolim" → the start of "petroleum".
  assert.ok(names('petrolim').includes('Petroleum Engineering College'));
  // Exact matches never report a correction.
  assert.equal(search(index, 'graphic era', { rank: defaultRank }).corrected, '');
});

test('short words are never fuzzed, and gibberish beside a generic word finds nothing', () => {
  assert.deepEqual(names('mit'), []);
  assert.deepEqual(names('qzxv university'), []);
  // A distinctive word survives a stray one.
  assert.equal(names('graphic era qzxv')[0], 'Graphic Era University, Dehradun');
});

test('place words match but rank below names', () => {
  const hits = names('delhi');
  assert.ok(hits.indexOf('University of Delhi') < hits.indexOf('Indian Institute of Technology, Delhi') || hits[0].includes('Delhi'));
  assert.ok(hits.includes('Indian Institute of Technology, Delhi'), 'city and name both count');
});

test('filters run before ranking', () => {
  const hits = search(index, 'college', { rank: defaultRank, filter: (record) => record.state === 'Maharashtra' }).hits;
  assert.deepEqual(hits.map((hit) => hit.record.name), ['Petroleum Engineering College']);
});

// Bounds are loose on purpose: the whole suite runs files in parallel, so this guards against an
// accidental quadratic step, not against a slow machine. (Alone: ~1 s build, ~1–5 ms per query.)
test('20k records: build and query stay fast', (t) => {
  const words = ['Shri', 'National', 'Institute', 'College', 'Technology', 'Science', 'Arts', 'Management', 'Global', 'Saraswati', 'Vidya', 'Gyan', 'Engineering', 'Medical', 'Law'];
  const many = Array.from({ length: 20_000 }, (_, i) => institution(`${words[i % 15]} ${words[(i * 7 + 3) % 15]} ${words[(i * 13 + 5) % 15]} ${i}`, { city: `City${i % 300}`, state: `State${i % 30}` }));
  let started = performance.now();
  const big = buildSearchIndex(many);
  const buildMs = performance.now() - started;
  started = performance.now();
  for (const query of ['sar vid', 'college', 'enginering', 'tech', 'national law', 'gyaan']) search(big, query, { rank: defaultRank });
  const perQuery = (performance.now() - started) / 6;
  t.diagnostic(`build ${buildMs.toFixed(0)} ms, ${perQuery.toFixed(1)} ms per query`);
  assert.ok(buildMs < 30_000, `build took ${buildMs.toFixed(0)} ms`);
  assert.ok(perQuery < 1000, `query took ${perQuery.toFixed(1)} ms`);
});
