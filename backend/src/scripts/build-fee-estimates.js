// Rebuilds the approximate fee ranges shown for programmes whose institution publishes no fee.
// Usage: npm run fees:estimate   (re-run after fees are added or the catalogue is relinked)
// The ranges come only from published fees; see modules/universities/fee-estimates.js.
import { closeDb, getDb } from '../db/collections.js';
import { ensureIndexes } from '../db/indexes.js';
import { rebuildFeeEstimates } from '../modules/universities/fee-estimates.js';

try {
  await ensureIndexes(await getDb());
  const result = await rebuildFeeEstimates({ log: (line) => console.log(line) });
  console.log(`Done: ${result.groups} groups.`);
} catch (error) {
  console.error('fees:estimate failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
