// Copies collections between two MongoDB deployments (used to move off Atlas onto the local server).
// Usage: npm run db:copy --workspace backend -- --to "mongodb://127.0.0.1:27018/?directConnection=true" [--only a,b] [--skip institutions,programmes] [--wipe]
// Source is MONGODB_URI from backend/.env; the target database name matches MONGODB_DATABASE.
import { MongoClient } from 'mongodb';

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(`--${name}`); return index === -1 ? fallback : args[index + 1]; };
const list = (name) => (option(name, '') ? option(name, '').split(',').map((value) => value.trim()).filter(Boolean) : []);

const sourceUri = process.env.MONGODB_URI;
const targetUri = option('to', '');
const dbName = process.env.MONGODB_DATABASE || 'nsedu';
const only = list('only');
const skip = new Set(list('skip'));
const wipe = args.includes('--wipe');

if (!sourceUri) throw new Error('MONGODB_URI is not set (source).');
if (!targetUri) throw new Error('Pass the target: -- --to "mongodb://127.0.0.1:27018/?directConnection=true"');

const source = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 15_000 });
const target = new MongoClient(targetUri, { serverSelectionTimeoutMS: 15_000 });

try {
  await Promise.all([source.connect(), target.connect()]);
  const from = source.db(dbName);
  const to = target.db(dbName);
  const names = (await from.listCollections().toArray()).map((item) => item.name)
    .filter((name) => (only.length ? only.includes(name) : true) && !skip.has(name));
  console.log(`Copying ${names.length} collection(s) into ${dbName} on the target: ${names.join(', ')}`);

  for (const name of names) {
    if (wipe) await to.collection(name).deleteMany({});
    let batch = [];
    let copied = 0;
    for await (const doc of from.collection(name).find({})) {
      batch.push({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } });
      if (batch.length === 500) { await to.collection(name).bulkWrite(batch, { ordered: false }); copied += batch.length; batch = []; }
    }
    if (batch.length) { await to.collection(name).bulkWrite(batch, { ordered: false }); copied += batch.length; }
    console.log(`  ${name.padEnd(22)} ${copied} document(s)`);
  }
  console.log('Done. Run `npm run seed --workspace backend` against the target to build its indexes.');
} catch (error) {
  console.error('Copy failed:', error.message);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([source.close(), target.close()]);
}
