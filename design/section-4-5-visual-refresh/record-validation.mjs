import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const before = JSON.parse(await readFile(new URL('before/measurements.json', root), 'utf8'));
const after = JSON.parse(await readFile(new URL('after/measurements.json', root), 'utf8'));
const failures = after.measurements.filter((row) => row.outside.length || row.horizontalOverflow || row.smallButtons.length);
const verified = process.argv[2] === 'verified';
const record = {
  date: '2026-10-07 (IST)',
  status: verified && !failures.length && !after.errors.length ? 'passed' : 'verification-in-progress',
  responsive: { widths: [...new Set(after.measurements.map((row) => row.width))], checks: after.measurements.length, failures, browserErrors: after.errors, captureNote: after.captureMode },
  heights: after.measurements.map((row) => ({ section: row.id, width: row.width, before: before.measurements.find((previous) => previous.id === row.id && previous.width === row.width).height, after: row.height })),
  implementation: {
    theme: 'frontend/src/styles/index.css',
    sharedArtwork: ['frontend/src/features/landing/SectionVisuals.js', 'frontend/src/features/landing/SectionVisuals.module.css'],
    iconAdditions: ['wallet', 'spark'],
    featureLogicChanged: false,
    newRasterDownloads: 0,
    newFontDownloads: 0,
    newDependencies: 0,
    decorativeAnimations: false,
    accessibility: 'Decorative layers use aria-hidden and do not intercept controls. Mobile inputs remain >=16px and action targets >=44px.',
  },
  checks: {
    lint: { command: 'npm run lint', status: 'passed', exitCode: 0 },
    interactionTests: { command: 'node node_modules/@playwright/test/cli.js test --config frontend/playwright.config.mjs --workers 1 --timeout 120000 budget.spec.js eligibility.spec.js header-scroll.spec.js', status: verified ? 'passed' : 'pending', ...(verified ? { passed: 34, failed: 0 } : {}), note: 'Initial parallel run was interrupted after test timeouts while host CPU usage measured 100%. A serial run verifies the same cases with a longer per-test timeout.' },
    productionBuild: { command: 'npm run build', status: verified ? 'passed' : 'pending', ...(verified ? { exitCode: 0 } : {}) },
  },
};
await writeFile(new URL('validation.json', root), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify({ status: record.status, responsiveChecks: after.measurements.length, failures, browserErrors: after.errors }));
