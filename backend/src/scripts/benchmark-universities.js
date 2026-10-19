// Usage: npm run benchmark:universities --workspace backend [-- --count 20000]
// Loads synthetic institutions into a throwaway database, times import and the public queries, then drops it.
import { randomBytes } from 'node:crypto';

const count = Number(process.argv[process.argv.indexOf('--count') + 1]) || 20_000;
process.env.MONGODB_DATABASE = `nsedu_bench_${randomBytes(4).toString('hex')}`;

const { closeDb, getDb } = await import('../db/collections.js');
const service = await import('../modules/universities/university-service.js');

const states = ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'Uttarakhand', 'Delhi', 'Gujarat', 'Kerala', 'West Bengal', 'Rajasthan', 'Telangana', 'Punjab'];
const cities = ['Pune', 'Bengaluru', 'Chennai', 'Lucknow', 'Dehradun', 'New Delhi', 'Ahmedabad', 'Kochi', 'Kolkata', 'Jaipur', 'Hyderabad', 'Mohali'];
const words = ['Shri', 'National', 'Institute', 'College', 'Technology', 'Science', 'Arts', 'Management', 'Global', 'Saraswati', 'Vidya', 'Gyan', 'Engineering', 'Medical', 'Law', 'Rural', 'Modern', 'Central'];
const streams = ['Engineering', 'Management', 'Medical', 'Law', 'Science', 'Commerce', 'Design', 'Pharmacy'];
const pick = (list, seed) => list[seed % list.length];

const records = Array.from({ length: count }, (_, i) => ({
  name: `${pick(words, i)} ${pick(words, i * 7 + 3)} ${pick(words, i * 13 + 5)} ${i}`,
  city: pick(cities, i), state: pick(states, i),
  website: `https://inst${i}.example.ac.in`,
  type: pick(['university', 'college', 'institute'], i),
  streams: [pick(streams, i), pick(streams, i * 3 + 1)],
  naacGrade: pick(['A++', 'A+', 'A', 'B++', ''], i),
  establishedYear: 1900 + (i % 120),
}));

async function time(label, run, repeat = 1) {
  const started = performance.now();
  let result;
  for (let i = 0; i < repeat; i += 1) result = await run(i);
  console.log(`${label.padEnd(44)} ${((performance.now() - started) / repeat).toFixed(1).padStart(8)} ms`);
  return result;
}

try {
  await getDb();
  const summary = await time(`import ${count} records`, () => service.upsertUniversities(records, { source: { kind: 'import', name: 'benchmark' } }));
  console.log(`  inserted ${summary.inserted}, failed ${summary.failed}`);
  await time(`re-import ${Math.min(count, 2000)} (all unchanged)`, () => service.upsertUniversities(records.slice(0, 2000), { source: { kind: 'import', name: 'benchmark' } }));
  // Cold queries: clear the cache before every run so these are database timings.
  const cold = (fn) => (i) => { service.invalidateUniversityCaches(); return fn(i); };
  await time('list page 1 (no filters)', cold(() => service.listUniversities({})), 5);
  await time('list page 400 (deep page)', cold(() => service.listUniversities({ page: '400' })), 5);
  await time('list q="saraswati vidya"', cold(() => service.listUniversities({ q: 'saraswati vidya' })), 5);
  await time('list state + stream + naac', cold(() => service.listUniversities({ state: 'Kerala', stream: 'Law', naac: 'A+' })), 5);
  await time('suggest "glob tech"', cold(() => service.suggestUniversities('glob tech')), 5);
  await time('facets (whole directory)', cold(() => service.universityFacets({})), 3);
  await time('facets with state cities', cold(() => service.universityFacets({ state: 'Uttarakhand' })), 3);
  await time('detail by slug', cold(() => service.getUniversity(summary.items[0].slug)), 5);
  await time('cached list page 1', () => service.listUniversities({}), 20);
} finally {
  await (await getDb()).dropDatabase();
  await closeDb();
}
