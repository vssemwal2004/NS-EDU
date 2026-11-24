// Lead data retention: anonymises leads with no activity for RETENTION_MONTHS (default 24).
// Rules: src/modules/applications/retention-rules.js. Runner: src/modules/applications/retention.js.
//
// Usage (from backend/):
//   npm run retention                         dry run: counts and 10 sample ids, changes nothing
//   npm run retention -- --apply              anonymise (at most --max leads, default 5000)
//   npm run retention -- --apply --batch 200 --max 2000 --months 36
//
// WARNING: backend/.env decides which database this touches. Check MONGODB_URI / MONGODB_DATABASE first;
// --apply cannot be undone (take a backup or a snapshot before the first real run).
import { closeDb } from '../db/collections.js';
import { runRetention } from '../modules/applications/retention.js';
import { retentionMonths } from '../modules/applications/retention-rules.js';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const number = (name, fallback) => {
  const raw = option(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a whole number above 0`);
  return value;
};

async function main() {
  const months = option('months') !== undefined ? retentionMonths(option('months')) : retentionMonths();
  if (option('months') !== undefined && String(months) !== option('months')) throw new Error('--months must be a whole number from 6 to 120');
  await runRetention({ apply: args.includes('--apply'), months, batchSize: number('batch', 200), max: number('max', 5000) });
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
}).finally(() => closeDb());
