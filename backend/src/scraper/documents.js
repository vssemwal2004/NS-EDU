// Fee structures and placement reports are very often published as PDF files, not pages. This
// module picks the few PDFs worth reading from the links of the pages already crawled, and turns a
// downloaded PDF into the same shape `parsePage` gives an HTML page (lines, tables, short texts), so
// every extractor reads both alike. Pure functions apart from the PDF decoder; no network here.
import { isSameSite, resolveUrl } from './urls.js';

const CURRENT_YEAR = new Date().getFullYear();
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const decode = (text) => { try { return decodeURIComponent(text); } catch { return text; } };

const PDF_PATH = /\.pdf$/i;
export const DOCUMENT_RULES = [
  ['fees', /(?<![a-z])fees?(?![a-z])|fee[-_\s]*(structure|details|schedule)|(?<![a-z])tui?tion/i],
  ['placement', /placement|recruit(ment)?[-_\s]*(record|report|statistic|details)|package|campus[-_\s]*selection|\btpo\b|\bt\s*&\s*p\b|training[-_\s]*(and|&)[-_\s]*placement/i],
];
// Documents that carry the word but not the figures: payment instructions, refund rules, notices
// about dates, scholarships, forms and staff vacancy adverts.
const NOT_USEFUL = /payment|challan|refund|receipt|scholarship|concession|waiver|notice|circular|last[-_\s]*date|extension|form\b|application|vacanc|recruitment[-_\s]*(of|for)[-_\s]*(faculty|staff)|advertis|tender|hostel|mess|transport|fine|penalty/i;

// The newest session a file name or link text mentions, so "fee-structure-2025-26.pdf" beats the
// 2019 one sitting next to it.
const yearsIn = (text) => [...String(text).matchAll(/(?<!\d)(20[1-3]\d)(?!\d)/g)].map((match) => Number(match[1])).filter((year) => year <= CURRENT_YEAR + 1);

/**
 * PDF links worth downloading, best first: same site, a fee or placement document by its file name
 * or link text, and not older than the last few sessions when the name carries a year.
 * @param {object[]} pages parsed pages (home first is fine)
 * @param {{ domain: string, want?: Record<string, number>, exclude?: string[] }} options
 */
export function pickDocuments(pages, { domain, want = { fees: 2, placement: 1 }, exclude = [] }) {
  const seen = new Set(exclude);
  const found = [];
  for (const page of pages) {
    for (const link of page.links ?? []) {
      const url = resolveUrl(link.href, page.url);
      if (!url || !isSameSite(url, domain) || !PDF_PATH.test(url.pathname)) continue;
      const href = url.toString();
      if (seen.has(href) || href.length > 500) continue;
      const haystack = `${decode(url.pathname).replace(/[_/=&?.-]+/g, ' ')} ${clean(link.text)}`;
      // A fee page often lists its PDFs as "View" / "Download" beside a row label the link does not
      // carry, so an unnamed PDF on a fee or placement page is taken as that page's document — after
      // any PDF whose own name says what it is.
      const named = DOCUMENT_RULES.find(([, pattern]) => pattern.test(haystack))?.[0];
      const inherited = !named && ['fees', 'placement'].includes(page.category);
      const category = named ?? (inherited ? page.category : undefined);
      if (!category || NOT_USEFUL.test(haystack)) continue;
      const years = yearsIn(haystack);
      const newest = years.length ? Math.max(...years) : null;
      if (newest !== null && newest < CURRENT_YEAR - 3) continue;
      seen.add(href);
      const score = (newest === null ? 0 : 6 - Math.min(6, CURRENT_YEAR + 1 - newest))
        + (/structure|schedule|details|statistic|record|report/i.test(haystack) ? 3 : 0)
        + (page.category === category ? 2 : 0) + (DOCUMENT_RULES.find(([name]) => name === category)[1].test(link.text) ? 1 : 0)
        - (inherited ? 4 : 0);
      found.push({ url: href, category, score, linkText: clean(link.text).slice(0, 160) });
    }
  }
  found.sort((a, b) => b.score - a.score);
  return Object.entries(want).flatMap(([category, count]) => found.filter((item) => item.category === category).slice(0, count));
}

/**
 * Rows of text from positioned PDF text items: items on the same baseline form a row, and a gap
 * wider than a few characters between two items starts a new cell. That is enough to read the
 * ordinary fee table (programme | duration | fee) that most institutions export from a spreadsheet.
 * @param {{ str: string, x: number, y: number, width?: number, fontSize?: number }[][]} pagesOfItems
 */
export function rowsFromItems(pagesOfItems) {
  const rows = [];
  for (const items of pagesOfItems) {
    const usable = items.filter((item) => clean(item.str));
    const byLine = [];
    for (const item of usable.toSorted((a, b) => b.y - a.y || a.x - b.x)) {
      const tolerance = Math.max(2, (item.fontSize || 10) * 0.45);
      const line = byLine.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
      if (line) line.items.push(item);
      else byLine.push({ y: item.y, items: [item] });
    }
    for (const line of byLine.sort((a, b) => b.y - a.y)) {
      const cells = [];
      let end = null;
      for (const item of line.items.toSorted((a, b) => a.x - b.x)) {
        const gap = end === null ? 0 : item.x - end;
        const wide = gap > Math.max(6, (item.fontSize || 10) * 1.2);
        if (!cells.length || wide) cells.push(clean(item.str));
        else cells[cells.length - 1] = clean(`${cells.at(-1)}${gap > 1 ? ' ' : ''}${item.str}`);
        end = item.x + (item.width || clean(item.str).length * (item.fontSize || 10) * 0.5);
      }
      if (cells.some(Boolean)) rows.push(cells.filter(Boolean));
    }
  }
  return rows;
}

/**
 * A downloaded PDF as a page: `lines` for the sentence readers and `tables` (one per run of
 * multi-cell rows) for the table readers. The first line that reads
 * like a title stands in for the page title, which carries the session ("Fee Structure 2025-26").
 */
export function documentPage(rows, { url, category }) {
  const lines = rows.map((cells) => clean(cells.join(' '))).filter(Boolean);
  const tables = [];
  let current = null;
  for (const cells of rows) {
    if (cells.length > 1) {
      current ??= { headers: cells, rows: [], caption: '' };
      current.rows.push(cells);
    } else {
      if (current?.rows.length) tables.push(current);
      current = null;
    }
  }
  if (current?.rows.length) tables.push(current);
  // A title line just above a table names it ("B.Tech Fee Structure 2025-26 (per annum)").
  for (const table of tables) {
    const at = rows.indexOf(table.rows[0]);
    table.caption = rows.slice(Math.max(0, at - 3), at).filter((cells) => cells.length === 1).map((cells) => cells[0]).join(' ').slice(0, 300);
  }
  const title = lines.find((line) => line.length >= 8 && line.length <= 160 && /fee|placement|structure|statistic|record|report|session|20\d\d/i.test(line)) ?? '';
  return {
    url, category, isDocument: true,
    head: { title, siteName: '', description: '', ogImage: '', canonical: '', touchIcon: '' },
    // No shortTexts: a fee row ("B.Tech CSE 4 Years 1,25,000") would read as a programme's name.
    // The programme rows come from the tables and lines instead.
    jsonLd: [], organization: null, links: [], logoImages: [], images: [], tables, lines,
    shortTexts: [], headings: title ? [title] : [], paragraphs: [], embeddedLines: [],
  };
}

let unpdfPromise;
const loadUnpdf = () => {
  unpdfPromise ??= import('unpdf').catch((error) => {
    unpdfPromise = undefined;
    throw new Error(`unpdf is required to read PDF documents: ${error.message}`);
  });
  return unpdfPromise;
};

/** Positioned text from the first `maxPages` pages of a PDF. Scanned PDFs (images only) give no rows. */
export async function readPdf(bytes, { maxPages = 15 } = {}) {
  const { getDocumentProxy } = await loadUnpdf();
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const pages = [];
    for (let number = 1; number <= Math.min(pdf.numPages, maxPages); number += 1) {
      const content = await (await pdf.getPage(number)).getTextContent();
      pages.push(content.items.filter((item) => item.str != null).map((item) => ({
        str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, fontSize: Math.hypot(item.transform[2], item.transform[3]),
      })));
    }
    return rowsFromItems(pages);
  } finally {
    await pdf.destroy?.();
  }
}
