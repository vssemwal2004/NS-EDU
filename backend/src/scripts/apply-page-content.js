// Copies the rewritten About and legal pages (including privacy-request and grievance-redressal), the one
// help answer and the related footer links from the content defaults into the database, leaving every other
// admin-edited page untouched.
//
//   node --env-file-if-exists=.env src/scripts/apply-page-content.js            dry run: shows what would change
//   node --env-file-if-exists=.env src/scripts/apply-page-content.js --apply    writes it
//
// Writes go through setContentEntry, so the previous version stays in the entry's history and can be
// restored from the admin "Site content" screen.
import { closeDb, getDb } from '../db/collections.js';
import { getContentDetail, setContentEntry } from '../modules/content/content-service.js';
import pagesDefaults from '../modules/content/defaults/pages.js';

const apply = process.argv.includes('--apply');
const PAGE_SLUGS = ['about', 'legal', 'terms-and-conditions', 'privacy-policy', 'cookie-policy', 'disclaimer', 'privacy-request', 'grievance-redressal'];
const HELP_QUESTION = 'Can I apply through Gyaan Vidhya?';
const REVIEWS_LINK = { label: 'Student reviews', href: '/reviews' };
// Appended, in this order, to the footer group that holds the Privacy policy link. A page must be in that group
// to get the Legal breadcrumb and "More in Legal & privacy" list (see frontend/src/app/(site)/[slug]/page.js).
const LEGAL_LINKS = [
  { label: 'Privacy requests', href: '/privacy-request' },
  { label: 'Grievance redressal', href: '/grievance-redressal' },
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  await getDb();
  const changes = [];

  // 1. pages: the six rewritten pages, and the one help answer that is no longer true.
  const pagesEntry = await getContentDetail('pages');
  const pages = structuredClone(pagesEntry.data);
  for (const slug of PAGE_SLUGS) {
    if (!same(pages.pages[slug], pagesDefaults.pages[slug])) {
      changes.push(`pages.${slug}: ${pages.pages[slug] ? 'replace' : 'add'} (${pagesDefaults.pages[slug].sections.length} sections${pagesDefaults.pages[slug].gallery ? `, ${pagesDefaults.pages[slug].gallery.photos.length} photos` : ''})`);
      pages.pages[slug] = structuredClone(pagesDefaults.pages[slug]);
    }
  }
  const helpSections = pages.pages.help?.sections ?? [];
  const helpIndex = helpSections.findIndex((section) => section.title === HELP_QUESTION);
  const newHelp = pagesDefaults.pages.help.sections.find((section) => section.title === HELP_QUESTION);
  if (helpIndex >= 0 && !same(helpSections[helpIndex], newHelp)) {
    changes.push(`pages.help: update the answer to "${HELP_QUESTION}"`);
    helpSections[helpIndex] = structuredClone(newHelp);
  }

  // 2. site: a "Student reviews" footer link after "About Gyaan Vidhya".
  const siteEntry = await getContentDetail('site');
  const site = structuredClone(siteEntry.data);
  const group = site.footerGroups.find((item) => item.links.some((link) => link.href === '/about'));
  if (group && !group.links.some((link) => link.href === REVIEWS_LINK.href)) {
    group.links.splice(group.links.findIndex((link) => link.href === '/about') + 1, 0, REVIEWS_LINK);
    changes.push(`site.footerGroups["${group.title}"]: add "${REVIEWS_LINK.label}" link`);
  }

  // 3. site: the privacy-request and grievance-redressal links at the end of the "Legal & privacy" group.
  const legalGroup = site.footerGroups.find((item) => item.links.some((link) => link.href === '/privacy-policy'));
  for (const link of LEGAL_LINKS) {
    if (legalGroup && !legalGroup.links.some((item) => item.href === link.href)) {
      legalGroup.links.push(link);
      changes.push(`site.footerGroups["${legalGroup.title}"]: add "${link.label}" link`);
    }
  }

  if (!changes.length) { console.log('Nothing to change: the database already matches.'); return; }
  console.log(`${apply ? 'Applying' : 'Dry run — would apply'} ${changes.length} change(s):\n  - ${changes.join('\n  - ')}`);
  if (!apply) { console.log('\nRun again with --apply to write. The previous versions stay in each entry\'s history.'); return; }

  const by = { updatedBy: 'script:apply-page-content' };
  if (changes.some((line) => line.startsWith('pages'))) await setContentEntry('pages', pages, { ...by, expectedUpdatedAt: pagesEntry.updatedAt });
  if (changes.some((line) => line.startsWith('site'))) await setContentEntry('site', site, { ...by, expectedUpdatedAt: siteEntry.updatedAt });
  console.log('Done. API servers pick the new content up within a minute (content cache).');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeDb());
