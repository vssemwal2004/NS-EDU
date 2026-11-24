// Switch city and state photos from the deactivated Cloudinary account to local copies of their
// existing credited Wikimedia sources. Deploy frontend/public/images/places before --apply.
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { readFile } from 'node:fs/promises';

const apply = process.argv.includes('--apply');
const retired = /^https:\/\/res\.cloudinary\.com\/xxpqokrj\/image\/upload\//;
const restoredFiles = new Set(JSON.parse(await readFile(new URL('./restored-place-photos.json', import.meta.url), 'utf8')));

try {
  const db = await getDb();
  let changed = 0;
  for (const [kind, collection] of [['city', COLLECTIONS.cities], ['state', COLLECTIONS.states]]) {
    const records = db.collection(collection);
    const places = await records.find({ imageUrl: retired }).toArray();
    for (const place of places) {
      const file = new URL(place.imageUrl).pathname.split('/').at(-1);
      if (!restoredFiles.has(file) || !new RegExp(`^${kind}-[a-z0-9-]+\\.jpg$`).test(file) || !place.imageSource?.startsWith('https://commons.wikimedia.org/wiki/File:')) {
        console.log(`skip ${kind}:${place.name} — source or file name is unexpected`);
        continue;
      }
      const replacement = `/images/places/${file}`;
      console.log(`${kind}:${place.name}: ${place.imageUrl} -> ${replacement}`);
      if (apply) {
        const result = await records.updateOne({ _id: place._id, imageUrl: place.imageUrl }, { $set: { imageUrl: replacement, updatedAt: new Date() } });
        if (!result.matchedCount) throw new Error(`${kind}:${place.name} changed while restoring; rerun`);
      }
      changed += 1;
    }
  }
  console.log(`${apply ? 'Restored' : 'Would restore'} ${changed} place photos. ${apply ? 'The catalogue cache expires within one minute.' : 'Deploy the image files before rerunning with --apply.'}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
