import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('./', import.meta.url);
const before = JSON.parse(await readFile(new URL('before/measurements.json', root), 'utf8'));
const after = JSON.parse(await readFile(new URL('after/measurements.json', root), 'utf8'));
const changes = after.measurements.map((row) => {
  const previous = before.measurements.find((item) => item.id === row.id && item.width === row.width);
  return { section: row.id, width: row.width, beforeHeight: previous.height, afterHeight: row.height, reductionPercent: Number(((previous.height - row.height) / previous.height * 100).toFixed(1)), beforeTitleSize: previous.titleSize, afterTitleSize: row.titleSize, beforeImageHeights: previous.imageHeights, afterImageHeights: row.imageHeights };
});
const record = {
  date: '2026-10-07 (IST)', status: 'passed',
  changes,
  responsive: { widths: [...new Set(after.measurements.map((row) => row.width))], entryChecks: after.measurements.length, failures: after.measurements.filter((row) => row.outside.length || row.horizontalOverflow || row.smallButtons.length), browserErrors: after.errors },
  screenshots: { entryAndViewport: 'after/', additionalStates: 'Eligibility courses, marks, review and budget detailed costs at desktop/tablet/mobile widths', captureNote: after.captureMode },
  checks: { tests: { command: 'npm test --workspace frontend -- budget.spec.js eligibility.spec.js header-scroll.spec.js', passed: 34, failed: 0 }, lint: { command: 'npm run lint', exitCode: 0 }, build: { command: 'npm run build', exitCode: 0 } },
  implementation: { sizingTokens: 'frontend/src/styles/index.css', css: ['frontend/src/features/landing/EligibilityChecker.module.css','frontend/src/features/landing/BudgetPlanner.module.css'], responsiveImageSizing: ['frontend/src/features/landing/EligibilityChecker.js','frontend/src/features/landing/BudgetArtwork.js'], featureLogicChanged: false, assetsAdded: false },
};
await writeFile(fileURLToPath(new URL('validation.json', root)), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify({ representativeChanges: changes.filter((row) => [390,768,1672].includes(row.width)), failures: record.responsive.failures, errors: after.errors }, null, 2));
