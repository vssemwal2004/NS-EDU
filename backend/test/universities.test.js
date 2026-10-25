import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { prefixesOf, queryKeys, derivedFields } from '../src/modules/universities/normalize.js';

const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;

test('search keys cover every word prefix and match queries in any order', () => {
  const keys = new Set(prefixesOf(['Indian Institute of Technology Bombay', 'Mumbai']));
  for (const key of ['in', 'ind', 'indian', 'tech', 'technology', 'bom', 'mumbai']) assert.ok(keys.has(key), key);
  assert.ok(!keys.has('of'));
  assert.deepEqual(queryKeys('  Bombay   IIT '), ['bombay', 'iit']);
  assert.deepEqual(queryKeys('a'), []);
  const derived = derivedFields({ name: 'Indian Institute of Technology Bombay', city: 'Mumbai', website: 'https://www.iitb.ac.in/en' });
  assert.equal(derived.domain, 'iitb.ac.in');
  assert.ok(derived.searchPrefixes.includes('iitb'), 'acronym is searchable');
});

describe('universities service', { skip }, () => {
  let service; let db; let closeDb;

  before(async () => {
    const collections = await import('../src/db/collections.js');
    ({ closeDb } = collections);
    db = await collections.getDb();
    service = await import('../src/modules/universities/university-service.js');
  });
  after(async () => {
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  test('upsert inserts, merges duplicates, matches by domain and respects admin locks', async () => {
    const source = { kind: 'import', name: 'Test list' };
    const first = await service.upsertUniversities([
      { name: 'Alpha University', city: 'Pune', state: 'Maharashtra', website: 'https://alpha.edu.in', streams: 'Engineering, Management' },
      { name: 'Alpha University', city: 'Pune', state: 'Maharashtra', establishedYear: 1990 },
      { name: 'Beta College', city: 'Pune', state: 'Maharashtra' },
      { name: '', city: 'Nowhere' },
    ], { source });
    assert.equal(first.inserted, 2);
    assert.equal(first.failed, 1);
    assert.equal(first.errors[0].errors.name, 'This field is required');
    const alpha = await db.collection('institutions').findOne({ slug: 'alpha-university' });
    assert.equal(alpha.establishedYear, 1990, 'duplicate rows in one file merge');
    assert.deepEqual(alpha.streams, ['Engineering', 'Management']);
    assert.equal(alpha.verification, 'unverified');

    await db.collection('institutions').updateOne({ _id: alpha._id }, { $set: { establishedYear: 1991, lockedFields: ['establishedYear'] } });
    const second = await service.upsertUniversities([
      { name: 'Alpha University (Main Campus)', city: 'Pune', state: 'Maharashtra', website: 'https://www.alpha.edu.in/', establishedYear: 1980, naacGrade: 'A+' },
    ], { source });
    assert.equal(second.updated, 1, 'matched by official domain');
    const after = await db.collection('institutions').findOne({ _id: alpha._id });
    assert.equal(after.establishedYear, 1991, 'locked field kept');
    assert.equal(after.naacGrade, 'A+');

    const dry = await service.upsertUniversities([{ name: 'Gamma Institute', city: 'Delhi' }], { source, dryRun: true });
    assert.equal(dry.inserted, 1);
    assert.equal(await db.collection('institutions').countDocuments({ name: 'Gamma Institute' }), 0, 'dry run writes nothing');

    const hidden = await service.upsertUniversities([{ name: 'Held Back University', city: 'Goa' }], { source, publish: false });
    assert.equal(hidden.inserted, 1);
  });

  test('constituent colleges on one hostname stay separate records', async () => {
    const source = { kind: 'import', name: 'Test list' };
    const group = await service.upsertUniversities([
      { name: 'Delta Institute of Technology', city: 'Anand', state: 'Gujarat', website: 'https://www.delta.ac.in/dit' },
      { name: 'Delta College of Pharmacy', city: 'Anand', state: 'Gujarat', website: 'https://www.delta.ac.in/dcp' },
    ], { source, publish: false }); // kept out of the public facets the next test counts
    assert.equal(group.inserted, 2, 'one hostname, two paths, two institutions');
    const pharmacy = await db.collection('institutions').findOne({ slug: 'delta-college-of-pharmacy' });
    assert.equal(pharmacy.name, 'Delta College of Pharmacy', 'the sibling record keeps its own name');

    // A later pass over the same site (scheme/www/trailing slash drift) still updates that record.
    const again = await service.upsertUniversities([
      { name: 'Delta College of Pharmacy, Anand', city: 'Anand', state: 'Gujarat', website: 'http://delta.ac.in/dcp/', naacGrade: 'B' },
    ], { source: { kind: 'scrape', name: 'Official website' } });
    assert.equal(again.updated, 1);
    assert.equal(again.inserted, 0);
    assert.equal((await db.collection('institutions').findOne({ _id: pharmacy._id })).naacGrade, 'B');

    // A scraper job names its institution, so an extracted name never lands on a sibling college.
    const targeted = await service.upsertUniversities([
      { slug: 'delta-institute-of-technology', name: 'Delta Group of Institutions', city: 'Anand', state: 'Gujarat', website: 'https://www.delta.ac.in/', about: 'Group site.' },
    ], { source: { kind: 'scrape', name: 'Official website' } });
    assert.equal(targeted.updated, 1);
    assert.equal(targeted.inserted, 0);
    const sibling = await db.collection('institutions').findOne({ _id: pharmacy._id });
    assert.match(sibling.name, /College of Pharmacy/, 'the sibling college was not renamed to the group');
    assert.equal(sibling.about, undefined, 'and did not take the group site’s text');
  });

  test('public list, suggest, facets and detail only show visible records', async () => {
    service.invalidateUniversityCaches();
    const list = await service.listUniversities({ q: 'alph uni' });
    assert.equal(list.total, 1);
    assert.equal(list.items[0].id, 'alpha-university');
    assert.equal((await service.listUniversities({ q: 'held back' })).total, 0, 'unpublished records stay hidden');
    assert.equal((await service.listUniversities({ state: 'Maharashtra', stream: 'Engineering' })).total, 1);
    const suggest = await service.suggestUniversities('bet');
    assert.deepEqual(suggest.items.map((item) => item.id), ['beta-college']);
    const facets = await service.universityFacets({ state: 'Maharashtra' });
    assert.equal(facets.total, 2);
    assert.deepEqual(facets.cities, [{ value: 'Pune', count: 2 }]);
    const detail = await service.getUniversity('alpha-university');
    assert.equal(detail.item.naacGrade, 'A+');
    await assert.rejects(service.getUniversity('held-back-university'), { status: 404 });
  });
});
