// Deep extraction: the facts a student needs to judge an institution — a factual summary, campus
// photographs, programme rows with duration and fee, placement figures, facilities, activities and
// admission details. Pure functions over parsed pages; no network, no database.
//
// Rule for every function here: only report what the page actually prints. Nothing is estimated,
// averaged or inferred from "it usually is". When a value is not on the page it is simply absent.
import { DEGREE_PATTERN } from './india.js';
import { isInstitutionCdn, isSameSite, resolveUrl } from './urls.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const CURRENT_YEAR = new Date().getFullYear();
const NEWSY = /notification|corrigendum|notice|tender|circular|walk-?in|advertisement|admit card|merit list|cut-?off|last date|click here|read more|lorem ipsum/i;
// Site chrome that reads like prose: disclaimers about who runs the website were captured as a
// university's "About" (JNU's read "Note: Contents on this website are published and managed by…").
const BOILERPLATE = /cookie|copyright|©|all rights reserved|javascript|privacy policy|terms (of|and) (use|conditions)|designed (and|&) (developed|maintained)|powered by|contents? (on|of) this (web)?site|(published|managed|maintained|hosted) by (the )?(web|it) (team|cell|division)|website (is )?(published|managed|maintained)|best viewed (in|with)|last (updated|modified) on|visitor (count|no)/i;

function clip(text, max) {
  const value = clean(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const stop = cut.lastIndexOf('. ');
  return stop > max * 0.4 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

// A full stop after a title or a common abbreviation ("Dr. Ashok", "Pvt. Ltd.", "No. 5") does not
// end the sentence.
const ABBREVIATION = /(?:^|\s)(?:dr|mr|mrs|ms|prof|st|no|pvt|ltd|govt|sh|smt|shri|jr|sr|co|inc|vs|etc|i\.e|e\.g|approx|dept|est|hon|u\.p|m\.p|a\.p|h\.p)\.$|(?:^|[\s.])[a-z]\.$/i;
function sentences(text) {
  const parts = clean(text).split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
  const out = [];
  for (const part of parts) {
    if (out.length && ABBREVIATION.test(out.at(-1))) out[out.length - 1] = `${out.at(-1)} ${part}`;
    else out.push(part);
  }
  return out.map(clean).filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
// About

// A sentence that only sells ("a premier institute with world-class infrastructure") carries no
// fact a student can check, so it is dropped unless it also states something concrete.
const MARKETING = /\b(best|premier|leading|world[\s-]?class|state[\s-]?of[\s-]?the[\s-]?art|renowned|prestigious|dream|bright future|holistic|nurtur\w+|empower\w+|vibrant|excellence|excel|vision|mission|dedicat\w+|commitment|striv\w+|aspir\w+|passion\w*|journey|tomorrow|shaping|transform\w+|ethos|endeavour|quality education|cutting[\s-]?edge)\b/i;
// Deliberately narrow: a bare "established" or "students" appears in any amount of sales copy, so
// only a checkable statement rescues a sentence that is otherwise selling.
const CONCRETE = /\d|\bestablished\s+(in|by|under|as|on)\b|\baffiliated\b|\baccredited\b|\bapproved\b|\brecogni[sz]ed\b|\boffer(s|ing)\b|\bdepartments\b|\bgrant\b|\bfaculty of\b|\bsection\s*\d|\b(b\.?\s?tech|b\.?\s?des|b\.?\s?arch|mba|bba|bca|mca|ph\.?\s?d|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|ug and pg|undergraduate|postgraduate)\b/i;
const DESCRIBES = /universit|college|institut|campus|establish|found|accredit|affiliat|vidyalaya|vidyapeeth|vidyapith|academy/i;
// A sentence that says what the institution is: "X is a private university", "established in 1993".
const INTRODUCES = /\b(is|was)\s+(?:\w+\s+){0,2}?(an?|the|one of)\b[^.]{0,80}\b(universit\w*|college|institut\w*|school|vidyalaya|vidyapeeth|vidyapith|academy)\b|\b(established|founded|set up|came into existence|incorporated)\b[^.]{0,60}\b(in|by|under|as)\b\s+(\d{4}|the|an?)\b/i;
// A sentence about a person — a chancellor's profile, a founder's legacy — never opens the summary.
const PERSON_TITLE = /\b(Dr|Prof|Shri|Smt|Mr|Mrs|Ms)\.?\s+[A-Z]/;
const PERSON_ROLE = /\b(vice[\s-]?|pro[\s-]?)?chancellor\b|\bfounder\b|\bchair(man|person)\b|\bpresident\b|\bdirector\b|\bdean\b|\bregistrar\b|\beducationist\b|\bvisionary\b|\b(his|her)\s+(values|vision|ideals|legacy|leadership)\b/i;
// Only how the sentence begins counts: "… founded in 1947 by Dr. RM. Alagappa Chettiar" is about the
// college; "An eminent educationist, Dr. Rashmi Mittal is …" is about a person.
const ABOUT_A_PERSON = { test: (text) => { const opening = String(text).slice(0, 70); return PERSON_TITLE.test(opening) || PERSON_ROLE.test(opening); } };
// An address printed as a paragraph ("… Campus, Tularampur, Bareilly Road, Haldwani-263139").
const ADDRESS_BLOCK = /^[^.]{0,220}\b[1-9]\d{2}\s?\d{3}\b[^.]{0,40}$/;

/**
 * A factual summary of up to three paragraphs, built from the institution's own about/overview
 * pages. Paragraphs keep the page's own breaks and are separated by a blank line. A page that
 * yields only a line or two is topped up from the next about page.
 * @returns {{ about: string, aboutSource: string }} empty strings when nothing usable was found
 */
export function aboutDeep(pages, { maxChars = 2400, maxParagraphs = 3, perParagraph = 5, name = '' } = {}) {
  const picked = [];
  const seen = new Set();
  let aboutSource = '';
  let length = 0;
  const nameWords = fold(name).split(' ').filter((word) => word.length >= 4 && !/^(university|college|institute|institution|school|academy|campus)$/.test(word));
  // The summary opens with a paragraph about the institution itself — not its library, its
  // international office or its chancellor — so the first paragraph must name it or say what it is.
  const introduces = (text) => {
    if (ABOUT_A_PERSON.test(text)) return false;
    const folded = ` ${fold(text)} `;
    const named = nameWords.length > 0 && nameWords.filter((word) => folded.includes(` ${word} `)).length >= Math.min(2, nameWords.length);
    return (named && DESCRIBES.test(text)) || INTRODUCES.test(text);
  };
  for (const page of pages) {
    if (length >= 400 || picked.length >= maxParagraphs) break;
    const paragraphs = (page.paragraphs ?? []).filter((text) => text.length >= 80 && !BOILERPLATE.test(text) && !NEWSY.test(text) && !ADDRESS_BLOCK.test(text));
    for (const paragraph of paragraphs) {
      // The opening paragraph starts at the sentence that introduces the institution; a paragraph
      // that opens on a founder's legacy or a slogan only counts from that sentence on.
      let parts = sentences(paragraph);
      if (!picked.length) {
        const start = parts.findIndex(introduces);
        if (start === -1) continue;
        parts = parts.slice(start);
      }
      const kept = [];
      for (const sentence of parts) {
        if (sentence.length < 30 || sentence.length > 400) continue;
        if (MARKETING.test(sentence) && !CONCRETE.test(sentence)) continue;
        const key = fold(sentence);
        if (seen.has(key)) continue;
        seen.add(key);
        kept.push(sentence);
        if (kept.length >= perParagraph) break;
      }
      if (!kept.length) continue;
      const text = clip(kept.join(' '), Math.max(200, maxChars - length));
      picked.push(text);
      length += text.length;
      aboutSource ||= page.url;
      if (picked.length >= maxParagraphs || length >= maxChars - 200) break;
    }
  }
  if (picked.length) return { about: picked.join('\n\n'), aboutSource };
  // The meta description is the fallback, held to the same rule: sales copy ("the best university
  // in the state, shaping tomorrow") is dropped sentence by sentence, and what is left must still
  // say what the institution is.
  for (const page of pages) {
    const description = clean(page.head?.description);
    if (description.length < 80 || BOILERPLATE.test(description) || !DESCRIBES.test(description)) continue;
    const factual = sentences(description).filter((sentence) => !(MARKETING.test(sentence) && !CONCRETE.test(sentence))).join(' ');
    if (factual.length >= 80 && DESCRIBES.test(factual)) return { about: clip(factual, maxChars), aboutSource: page.url };
  }
  return { about: '', aboutSource: '' };
}

/**
 * The same rules applied to a summary already stored, for records crawled before the rules were
 * tightened: sales-only sentences go, and the summary has to open on a sentence that introduces the
 * institution (not a person, not an address). Returns '' when nothing usable is left.
 */
export function tidyStoredAbout(text, { name = '' } = {}) {
  const value = String(text ?? '').trim();
  if (!value || BOILERPLATE.test(value)) return '';
  const paragraphs = value.split(/\n{2,}/).map((paragraph) => clean(paragraph)).filter(Boolean);
  // Re-run the extractor over the stored paragraphs as if they were the about page.
  const { about } = aboutDeep([{ url: '', paragraphs, head: {} }], { name });
  return about.length >= 80 ? about : '';
}

// ---------------------------------------------------------------------------------------------
// Campus photographs

const IMAGE_EXT = /\.(jpe?g|png|webp)(\?|$)/i;
// Posters and scanned notices are images of text: in a results row they read as clutter, not as a
// campus. A real run put a "congratulations to our toppers" poster where the campus photo belongs.
const NOT_A_PHOTO = /logo|favicon|icon|sprite|placeholder|avatar|profile|signature|emblem|badge|banner-?ad|advert|\bads?\b|whatsapp|facebook|twitter|instagram|youtube|linkedin|qr[-_]?code|arrow|bullet|spinner|loader|naac|nirf|aicte|\bugc\b|\bnba\b|\biso\b|flag|captcha|swachh|azadi|g20|notice|circular|congratulat|topper|merit[-_ ]?list|poster|invit(e|ation)|brochure|certificate|tender|result[-_ ]?\d|admission[-_ ]?open|scholarship/i;
const PEOPLE = /faculty|staff|principal|chairman|chancellor|director|founder|dean|portrait|headshot|\bteam\b|\bhod\b|\bdr[-_. ]|\bprof[-_. ]|message|speech/i;
const CAMPUS_WORDS = /campus|building|infrastructur|library|laborator|\blabs?\b|hostel|sports|convocation|campus-?life|auditorium|ground|playground|block|academic|facilit|aerial|view|entrance|gate|amphitheat|canteen|cafeteria|workshop|classroom/i;

// Template alt text ("Responsive thumbnail", "image1") describes nothing and must not become a caption.
const EMPTY_ALT = /^(responsive(\s+\w+)?|thumbnail|thumb|image|images?\s*\d*|img\s*\d*|photo\s*\d*|picture|pic\s*\d*|slide\s*\d*|slider|banner|gallery|no[\s-]?image|placeholder|untitled|dsc[\s_-]?\d+|\d+)$/i;
const captionOf = (alt) => (EMPTY_ALT.test(clean(alt)) ? '' : clean(alt));

// Photographs older than this are not shown: a campus changes, and a 2014 picture misleads.
export const MAX_PHOTO_AGE_YEARS = 5;
export const oldestPhotoYear = (now = CURRENT_YEAR) => now - MAX_PHOTO_AGE_YEARS;
// A camera or phone names the file after the moment it was taken (IMG_20230514_…, PXL_2024…).
const CAMERA_NAME = /(?:^|[/_-])(?:img|dsc|dscn|pxl|photo|image|wa|vid|dji|mvimg)[-_]?(20[0-3]\d)(0[1-9]|1[0-2])([0-2]\d|3[01])/i;
// WordPress and most CMSs file uploads under /uploads/2019/05/: the picture is no newer than that.
const DATED_FOLDER = /\/(?:wp-content\/)?(?:uploads?|images?|media|files|photos?|gallery|assets)\/(20[0-3]\d|199\d)\/(0?[1-9]|1[0-2])\//i;
const LOOSE_YEAR = /(?<![\d.])(20[0-3]\d)(?![\d.]*\s*(?:px|x\d))(?!\d)/g;

/**
 * The year a picture's own address gives, strongest evidence first: the camera's file name, the
 * dated upload folder, then a year written in the file name or the alt text ("convocation-2018").
 * Returns null when nothing dates it; a width such as "2048x1365" is not read as a year.
 */
export function photoYearOf(path, alt = '', now = CURRENT_YEAR) {
  const camera = CAMERA_NAME.exec(path);
  if (camera) return Number(camera[1]);
  const folder = DATED_FOLDER.exec(path);
  if (folder) return Number(folder[1]);
  const file = `${path.split('/').pop() ?? ''} ${alt}`;
  const years = [...file.matchAll(LOOSE_YEAR)].map((match) => Number(match[1])).filter((value) => value >= 2000 && value <= now);
  return years.length ? Math.max(...years) : null;
}

/**
 * Campus/building/facility images on the institution's own domain, best first, for the image
 * pipeline to download and verify. Dimensions printed in the markup are used to reject small or
 * banner-shaped images early; the real pixels are checked again after download. Pictures the
 * address dates to more than five years ago are left out, and recent ones rank first.
 */
export function galleryCandidates(pages, { domain, limit = 40, minWidth = 480, minHeight = 320, now = CURRENT_YEAR } = {}) {
  const seen = new Set();
  const found = [];
  for (const page of pages) {
    for (const image of page.images ?? []) {
      const url = resolveUrl(image.src, page.url);
      if (!url || !(isSameSite(url, domain) || isInstitutionCdn(url, domain))) continue;
      const href = url.toString();
      if (href.length > 500 || seen.has(href)) continue;
      const path = decodeURIComponent(url.pathname);
      if (!IMAGE_EXT.test(path) && !IMAGE_EXT.test(href)) continue;
      const haystack = `${path} ${image.alt} ${image.hint}`;
      if (NOT_A_PHOTO.test(haystack) || PEOPLE.test(haystack)) continue;
      // Only trust the markup when it gives both dimensions.
      if (image.width && image.height) {
        const ratio = image.width / image.height;
        if (image.width < minWidth || image.height < minHeight || ratio < 1.2 || ratio > 2.7) continue;
      }
      seen.add(href);
      const year = photoYearOf(path, image.alt, now);
      if (year !== null && year < oldestPhotoYear(now)) continue;
      const score = (CAMPUS_WORDS.test(haystack) ? 5 : 0) + (/gallery|photos?|media/i.test(path) ? 3 : 0)
        + (page.category === 'campus' ? 4 : page.category === 'about' ? 2 : 0) + (image.alt ? 1 : 0)
        + (year === null ? 0 : year >= now - 2 ? 3 : 1);
      found.push({ url: href, caption: clip(captionOf(image.alt), 160), sourcePage: page.url, score, ...(year ? { year } : {}) });
    }
  }
  return found.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Programmes, duration and fees

const LEVEL_RULES = [
  ['PhD', /\b(ph\.?\s?d|d\.?\s?phil|doctor(al|ate))\b/i],
  ['Diploma', /\b(diploma|certificate|polytechnic)\b/i],
  ['PG', /\b(m\.?\s?(tech|e|sc|a|com|ba|ca|s|d|phil|pharm(?:acy)?|des|ed|lib)|master|mba|mca|mbbs\s*\+|post[\s-]?graduate|\bpg\b|ll\.?\s?m|m\.?s\.?\s?w)\b/i],
  ['UG', /\b(b\.?\s?(tech|e|sc|a|com|ba|ca|arch|des|ed|pharm(?:acy)?|pt|ds|hm|lib)|bachelor|bba|bca|mbbs|bds|bams|bhms|ll\.?\s?b|under[\s-]?graduate|\bug\b|integrated)\b/i],
];
// The degree named first decides: "B.Tech ME (Hons.)" is a B.Tech in mechanical engineering, not an M.E.
export function levelOf(name) {
  let best = null;
  for (const [level, pattern] of LEVEL_RULES) {
    const at = pattern.exec(String(name ?? ''))?.index;
    if (at !== undefined && (best === null || at < best.at)) best = { level, at };
  }
  return best?.level ?? '';
}

// "Rs" must start a word: "4 Years 1,25,000" is not "Rs 1,25,000".
const MONEY = /(?:₹|\brs\.?|\binr)\s*([\d][\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k)?\b/i;
const PER_YEAR = /per[\s-]*(year|annum|an\b)|\bp\.?\s?a\.?\b|annual|yearly|\/\s*(year|yr|annum)|1st\s*year|first\s*year|\b(i|ist)\s*(year|yr)\b|\byear[\s-]*(i|1)\b(?![\s-]*(i|v|x|\d))/i;
// An instalment is a part payment of the year's fee, so printing it as the annual fee understates
// what a student pays. It is kept as a note instead.
const NOT_PER_YEAR = /semester|month|\bterm\b|instal?lments?|total\s*(course\s*)?fee|entire\s*(course|programme|program)|hostel|mess|caution|security|refundable|one[\s-]?time|registration|application\s*fee|exam(ination)?\s*fee/i;
// In a fee column ("Fee (Rs.)") or a fee document the amounts are printed bare: 1,25,000 / 125000/-
// / 1.25 lakh. Indian and western grouping both occur; a bare run must have five or more digits, so
// years, seat counts and durations never read as money. Percentages are refused.
const BARE_MONEY = /(?<![\d.,])(\d{1,2}(?:,\d{2})*,\d{3}|\d{1,3}(?:,\d{3})+|\d{5,8}|\d{1,3}(?:\.\d{1,2})?(?=\s*(?:lakhs?|lacs?)\b))(?:\.\d{1,2})?\s*(lakhs?|lacs?)?(?:\s*\/-)?(?![\d,]*\s*%)(?!\d)/i;

/**
 * Rupees from "₹1,25,000", "Rs. 1.25 Lakh", "INR 2.5 L" — and, with `bare`, from an unlabelled
 * "1,25,000/-" where the column or document already says the figures are fees. Returns null when
 * the text has no amount in range.
 */
export function rupeesIn(text, { bare = false, cell = false, max = 10_000_000 } = {}) {
  const value = String(text ?? '');
  // A table cell holding nothing but "8000" or "8000.00/-" under a fee column is an amount too; in
  // running text four bare digits are far more often a year, a seat count or a phone fragment.
  const match = MONEY.exec(value) ?? (bare ? BARE_MONEY.exec(value) ?? (cell ? /^\s*(\d{4})(?:\.\d{1,2})?\s*(?:\/-)?\s*$/.exec(value) : null) : null);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (match[2] ?? '').toLowerCase();
  // "Rs. 2008" next to a session is a year that followed a currency label, not two thousand rupees.
  if (!unit && /^(19[89]\d|20[0-3]\d)$/.test(match[1])) return null;
  const scale = /^(lakh|lac)/.test(unit) ? 100_000 : /^(crore|cr)/.test(unit) ? 10_000_000 : unit === 'k' ? 1000 : 1;
  const rupees = Math.round(amount * scale);
  return rupees >= 1000 && rupees <= max ? rupees : null;
}

// What an amount pays for, read from the cell, then its column, then the table or page title.
// 'other' is a charge that is not tuition (hostel, mess, deposits, application) and is never shown
// as the programme's fee.
const SEMESTER = /per[\s-]*sem(ester)?\b|\/\s*sem(ester)?\b|semester[\s-]*(wise|fee)|\bsem(ester)?[\s-]*(i|1|one|1st|first)\b|\b(1st|first|i|ist)\s*sem(ester)?\b|\bodd\s*sem/i;
const WHOLE_COURSE = /total\s*(course\s*|programme\s*|program\s*|tuition\s*)?fees?|\btotal\b|entire\s*(course|programme|program|duration)|whole\s*(course|programme|program)|full\s*course|for\s*(the\s*)?(entire|whole|complete)\s*(course|programme|program|duration)|course\s*fee\s*\(total\)/i;
const NOT_TUITION = /hostel|mess|caution|security\s*deposit|refundable|registration|application\s*(form\s*)?fee|exam(ination)?\s*fee|transport|bus\s*fee|uniform|alumni|convocation|enrol?ment\s*fee|prospectus|late\s*fee|\bfine\b(?!\s*arts?)|month|instal?lment|\bterm\b/i;
const EXPLICITLY_WHOLE = /entire|whole|complete|full\s*course/i;
export function periodOf(text) {
  const value = String(text ?? '');
  if (!value) return '';
  if (NOT_TUITION.test(value)) return 'other';
  if (SEMESTER.test(value)) return 'semester';
  // "Total fee per annum" is a year's total; only an explicit "entire course" overrides "per annum".
  if (PER_YEAR.test(value) && !EXPLICITLY_WHOLE.test(value)) return 'year';
  if (WHOLE_COURSE.test(value)) return 'total';
  return '';
}

// The session a fee table is for ("Fee structure 2025-26"), as printed.
const FEE_SESSION = /\b(20[1-3]\d)\s*[-–/]\s*((?:20)?[1-3]\d)\b/;
const sessionIn = (text) => {
  const match = FEE_SESSION.exec(String(text ?? ''));
  if (!match) return '';
  const start = Number(match[1]);
  const end = Number(match[2].length === 2 ? `${match[1].slice(0, 2)}${match[2]}` : match[2]);
  return end === start + 1 ? `${start}-${String(end).slice(2)}` : '';
};

const FEE_HEADER = /\bfees?\b|tuition|amount|charges|₹|\brs\.?\b|\binr\b|\bcost\b|rupees/i;
const BRANCH_HEADER = /branch|speciali[sz]ation|discipline|stream|subject|department|course\s*name|programme\s*name|program\s*name|major|group|combination/i;
const SERIAL = /^(s\.?\s?no\.?|sr\.?\s?no\.?|sl\.?\s?no\.?|#|\d{1,3}\.?)$/i;
// Rows of a fee table that are charges or sums, not programmes, when the programme is carried
// down from a merged cell above.
const NOT_A_BRANCH = /fee|hostel|mess|total|grand|caution|deposit|charges?|amount|establishment|electricity|water\b|facilit|services?\b|other|misc|sub-?total|gst|tax|rupees|note|remarks?|fund|development|magazine|union|identity|welfare|maintenance|insurance|library|sports|seats?\b|intake/i;

export function durationIn(text) {
  const value = String(text ?? '');
  const years = /(\d{1,2}(?:\.\d)?)\s*(?:-|\s)?(?:years?|yrs?|वर्ष)\b/i.exec(value);
  if (years) { const number = Number(years[1]); if (number >= 0.5 && number <= 10) return number; }
  const semesters = /(\d{1,2})\s*semesters?\b/i.exec(value);
  if (semesters) { const number = Number(semesters[1]) / 2; if (number >= 0.5 && number <= 10) return number; }
  const months = /(\d{1,2})\s*months?\b/i.exec(value);
  if (months) { const number = Math.round((Number(months[1]) / 12) * 10) / 10; if (number >= 0.5 && number <= 10) return number; }
  return null;
}

const NOT_A_PROGRAMME = /admission|syllabus|result|notice|brochure|apply|download|scholarship|time ?table|calendar|eligibility|placement|alumni|\bseats?\b|merit|counsel|cut-?off|schedule|notification|\blast date|prospectus|guideline|ranking|news|total|^fee/i;
const fold = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const programmeName = (value) => clean(value).replace(/\s+(?:course\s+)?duration\s*[:\-]\s*\d+(?:\.\d+)?\s*(?:years?|yrs?|semesters?|months?)\b.*$/i, '').trim();

/**
 * The degree inside a fee sentence. `DEGREE_PATTERN` is anchored, but sites write the amount into a
 * sentence ("Annual fee for B.Tech (CSE): ₹1,25,000"), so the lead-in words are dropped one at a
 * time until what is left starts with a degree. Returns '' when the text names no programme.
 */
function degreeNameIn(text) {
  const trimmed = clean(text)
    .replace(/\b(course\s*)?fees?\b\s*$/i, '')
    // "B.Ed.): 1st Year" — the year marker belongs to the fee column, not to the programme's name.
    .replace(/[(),:;–—-]*\s*(1st|first|i{1,3}|2nd|second|3rd|third|4th|fourth)\s*year\s*$/i, '')
    // A fee document's row reads "B.Tech CSE 4 Years 1,25,000": the duration is its own column.
    .replace(/\s+\d{1,2}(?:\.\d)?\s*(?:years?|yrs?|semesters?)\s*$/i, '')
    .replace(/^[\s:–—(-]+|[\s:–—,-]+$/g, '')
    // A closing bracket stays when it closes one ("B.Tech CSE (RQ)"); a stray one goes.
    .replace(/\)+$/, (closing, at, text) => (text.slice(0, at).split('(').length - 1 >= text.slice(0, at).split(')').length - 1 + closing.length ? closing : ''));
  const words = trimmed.split(/\s+/);
  for (let start = 0; start < Math.min(words.length, 7); start += 1) {
    const candidate = words.slice(start).join(' ').replace(/^[^A-Za-z]+/, '').trim();
    if (candidate.length >= 2 && candidate.length <= 160 && DEGREE_PATTERN.test(candidate)) return clip(candidate, 160);
  }
  return '';
}

/**
 * Programme rows from fee/course tables, falling back to the plain programme names found by
 * `programmesFrom`. A fee is kept only when the same row prints an unambiguous per-year rupee
 * amount; anything else is copied into `feeNote` verbatim so a reviewer can read what the page said.
 */
// A line that only lays out columns ("Semester I | Semester II", "1st Year | 2nd Year") and so
// tells what period the amounts beneath it are for.
const PERIOD_HEADER = /\b(semester|sem|year|yr|annual|per annum)\b/i;
const FEE_LABEL = /\b(fees?|tuition|charges|amount|payable)\b/i;
const ONLY_AMOUNTS = /^[\s|:₹rs.,/\-\d]*$/i;
const CONNECTOR_END = /\b(in|of|for|with|and|&)\s*[:\-–]?\s*$/i;
// Acronyms that stay in capitals when a shouted heading is put into title case.
const KEEP_CAPS = /^(bfsi|hr|ai|ml|it|ds|cse|ece|eee|me|ce|vlsi|iot|ui|ux|ar|vr|nri|rq|mq|pcm|pcb|hons\.?)$/;
// "MBA PROGRAM IN MARKETING" reads better as "MBA Program in Marketing"; degree acronyms keep caps.
function tidyHeading(text) {
  const value = clean(text).replace(/\s*\|\s*/g, ', ').replace(/[*#]+/g, '').replace(/[,:\s–-]+$/, '');
  if (/[a-z]/.test(value)) return value;
  return value.toLowerCase().replace(/\b[a-z][a-z'&.]*/g, (word, at) => (/^(in|of|for|and|with|the|&)$/.test(word) && at ? word
    : (DEGREE_PATTERN.test(word.toUpperCase()) && word.length <= 6) || KEEP_CAPS.test(word) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)));
}

/**
 * Programme rows from a fee page read as sections: a heading naming a degree opens a section, the
 * nearest period header ("Semester I | …") or label ("Tuition Fee Per Semester") says what an amount
 * is for, and the first amount for each period is kept. Only amounts on a fee-labelled line, on a
 * line of amounts alone, or on the value line right after a fee label count — so an application-form
 * price in the same document ("on payment of Rs. 1100") is never read as tuition.
 */
function feeSections(page) {
  const lines = [...(page.lines ?? []), ...(page.embeddedLines ?? [])].map(clean).filter(Boolean);
  const pageContext = contextOf(page);
  const session = sessionIn(pageContext) || sessionIn(lines.slice(0, 20).join(' '));
  const pagePeriod = periodOf(pageContext) === 'other' ? '' : periodOf(pageContext);
  const FIELD = { year: 'annualFeeInr', semester: 'semesterFeeInr', total: 'totalFeeInr' };
  const rows = [];
  let current = null;
  let header = '';
  // The last line that was not an amount: a fee label ("Tuition Fee Per Semester") makes the bare
  // amounts after it fees for that period; any other label ("Scholarship") makes them not fees.
  let lastText = '';
  for (const [index, line] of lines.entries()) {
    const amount = line.length <= 220 ? rupeesIn(line, { bare: true }) : null;
    if (amount === null) {
      lastText = line;
      if (line.length > 160) continue;
      const name = degreeNameIn(line);
      if (name && !NOT_A_PROGRAMME.test(name) && !FEE_LABEL.test(name)) {
        // A heading that stops at "… PROGRAM IN" continues on the next line with the specialisations.
        const next = lines[index + 1] ?? '';
        const full = CONNECTOR_END.test(line) && next.length <= 160 && rupeesIn(next, { bare: true }) === null && !PERIOD_HEADER.test(next) ? `${name} ${next}` : name;
        current = { name: tidyHeading(full), sourcePage: page.url };
        const level = levelOf(full);
        if (level) current.level = level;
        if (session) current.feeYear = session;
        rows.push(current);
        header = '';
        continue;
      }
      if (PERIOD_HEADER.test(line) && line.length <= 120 && !FEE_LABEL.test(line)) header = line;
      continue;
    }
    if (!current) continue;
    const underFeeLabel = FEE_LABEL.test(lastText) && lastText.length <= 80;
    const amountsOnly = ONLY_AMOUNTS.test(line.replace(MONEY, ''));
    if (!FEE_LABEL.test(line) && !(amountsOnly && (underFeeLabel || lastText === header))) continue;
    const period = periodOf(line) || (underFeeLabel ? periodOf(lastText) : '') || periodOf(header) || pagePeriod;
    if (period === 'other') continue;
    const field = FIELD[period];
    if (field && current[field] === undefined && (field === 'totalFeeInr' || amount <= 10_000_000)) current[field] = amount;
  }
  return rows.filter((row) => Object.values(FIELD).some((field) => row[field] !== undefined));
}

const isDegree = (cell) => cell.length >= 2 && cell.length <= 160 && DEGREE_PATTERN.test(cell) && !NOT_A_PROGRAMME.test(cell);

/**
 * A table's column labels and its title. Header rows are the leading rows before the first one
 * that names a programme or prints an amount (two at most); the row whose width matches the data
 * gives the column labels, and every header row, the caption and any one-cell title row give the
 * context ("Fee structure 2025-26, per annum").
 */
function tableShape(table) {
  const rows = table.rows ?? [];
  const isData = (row) => row.some((cell) => isDegree(cell) || rupeesIn(cell, { bare: true }) !== null);
  const firstData = rows.findIndex(isData);
  const headRows = firstData > 0 ? rows.slice(Math.max(0, firstData - 2), firstData) : [];
  const width = rows[firstData]?.length ?? 0;
  let heads = headRows.findLast((row) => row.length === width);
  // "S.No | Course | Tuition Fee (per annum)" over "Category A | Category B | Lateral Entry": the
  // last cell of the first row spans the second, so the second row's labels sit under it.
  const [top, sub] = headRows;
  if (!heads && sub && top.length + sub.length - 1 === width) heads = [...top.slice(0, -1), ...sub.map((cell) => `${top.at(-1)} ${cell}`)];
  heads ??= headRows.at(-1) ?? [];
  const context = [table.caption, table.title, ...(table.headers?.length === 1 ? table.headers : []), ...headRows.flat()].filter(Boolean).join(' ');
  return { heads, labels: heads.map((cell) => cell.toLowerCase()), context, data: firstData < 0 ? [] : rows.slice(firstData) };
}

// Fee regulating bodies (Maharashtra's FRA, the state fee committees) approve one fee per academic
// year and print it as Tuition | Development | Total, where "Total" is that year's sum.
const FEE_AUTHORITY = /fees?\s+regulat\w*\s+(authority|committee)|\bFRA\b|fee\s+fixation\s+committee|admission\s+and\s+fee\s+regulatory/i;
// The one row of a fee-heads table (Admission fee / Tuition fee / Library fee / Total) that is the
// programme's fee: tuition, or the total of the heads.
const TUITION_ROW = /^(?:\d{1,2}[.)]?\s*)?(grand\s*total|total|tuition|tution|course\s*fees?|programme\s*fees?|program\s*fees?|academic\s*fees?|annual\s*fees?|net\s*payable)\b/i;
// Seat categories and quotas, which fee tables list as rows just like branches.
const SEAT_CATEGORY = /\b(general|open|obc|sc|st|ews|sebc|nt|vjnt|sbc|category|quota|minority|nri|management|merit|convenor|free\s*seat|payment\s*seat|boys|girls|male|female|day\s*scholar|hostel(l)?er)\b/i;
const BRANCH_COLUMN = /course|branch|programme|program|speciali[sz]ation|discipline|stream|subject|department|trade|name/i;
const EXPLICIT_COURSE_TOTAL = /total\s*(course|programme|program)\s*fees?|entire|whole|complete|full\s*course/i;
// A fee-heads table's "Total" sums the heads above it for whatever period the table covers, not the
// whole programme, so only a period the label itself states counts.
const headPeriod = (label) => (EXPLICIT_COURSE_TOTAL.test(label) ? 'total' : periodOf(String(label).replace(/\b(grand\s*)?total\b/gi, '')));
// "B.C.A. Fee Structure", "Welcome to HKCP » B.Pharm Fee Structure 2025-26", "Fee Structure for B.Ed."
// The fee words split a title into the pieces that can name the programme: "Fee Structure PROPOSED BE
// 1ST YEAR FEE STRUCTURE" leaves "PROPOSED BE 1ST YEAR".
const FEE_WORDS = /\b(?:approved\s+)?(?:academic\s+|tuition\s+|course\s+)?fees?\b(?:\s+(?:structure|details|schedule|particulars))?(?:\s+(?:for|of))?/i;
function programmeInTitle(text) {
  for (const part of clean(text).split(/\s+[»|–—:-]\s+|\s*[»|]\s*/).reverse()) {
    for (const piece of part.split(FEE_WORDS)) {
      const name = degreeNameIn(piece);
      if (name && !NOT_A_PROGRAMME.test(name) && !/\bfees?\b/i.test(name)) return name;
    }
  }
  return '';
}
// A fee document's own title, then the text of the link that led to it (kept apart by the crawler).
const contextOf = (page) => `${page.head?.title ?? ''} ${page.linkText ?? ''} ${(page.headings ?? []).slice(0, 12).join(' ')}`;

/**
 * Programme rows from fee/course tables, falling back to the plain programme names found by
 * `programmesFrom`. An amount is stored under the period the page prints it for — per year, per
 * semester or for the whole programme — and never converted from one to another; an amount whose
 * period the page does not state is copied into `feeNote` verbatim so a reader sees what it said.
 */
export function programmeRows(pages, fallbackNames = [], { limit = 500 } = {}) {
  const byKey = new Map();
  const add = (row) => {
    const name = clip(programmeName(row.name), 160);
    const key = fold(name);
    if (!key || key.length < 2 || byKey.size >= limit) return;
    const existing = byKey.get(key);
    if (existing) {
      for (const field of ['level', 'durationYears', 'annualFeeInr', 'semesterFeeInr', 'totalFeeInr', 'feeYear', 'feeNote']) if (existing[field] === undefined && row[field] !== undefined) existing[field] = row[field];
      // A real amount found later replaces an earlier "period not stated" note.
      if (existing.feeNote && (existing.annualFeeInr ?? existing.semesterFeeInr ?? existing.totalFeeInr) !== undefined && row.feeNote === undefined) delete existing.feeNote;
      return;
    }
    byKey.set(key, { ...row, name });
  };
  const FEE_FIELD = { year: 'annualFeeInr', semester: 'semesterFeeInr', total: 'totalFeeInr' };

  const amountIn = (cell, max = 50_000_000) => rupeesIn(cell, { bare: true, cell: true, max });
  const textCellsOf = (cells) => cells.filter((cell) => cell && !SERIAL.test(cell) && /[a-z]{2}/i.test(cell) && amountIn(cell) === null);
  for (const page of pages) {
    const feePage = page.category === 'fees';
    const pageContext = contextOf(page);
    const pageProgramme = feePage ? programmeInTitle(page.head?.title ?? '') || programmeInTitle(page.linkText ?? '') : '';
    const authorityPage = feePage && (page.lines ?? []).slice(0, 600).some((line) => line.length <= 200 && FEE_AUTHORITY.test(line));
    for (const table of page.tables ?? []) {
      let { heads, labels, context, data } = tableShape(table);
      // A header of programme names ("BA (Gen) Amt. Rs. | B.Sc (Hons) Amt. Rs.") looks like data to
      // tableShape; it is the header when it prints no amount and the rows below name no programme.
      const [first = [], ...rest] = data;
      if (first.filter(isDegree).length >= 2 && !first.some((cell) => amountIn(cell) !== null)
        && rest.some((cells) => cells.some((cell) => amountIn(cell) !== null)) && !rest.some((cells) => cells.some(isDegree))) {
        heads = first;
        labels = first.map((cell) => cell.toLowerCase());
        data = rest;
      }
      const tablePeriod = periodOf(context) === 'other' ? '' : periodOf(context) || (feePage ? periodOf(pageContext) : '');
      const session = sessionIn(context) || (feePage ? sessionIn(pageContext) : '');
      const tableIsFees = feePage || FEE_HEADER.test(context) || labels.some((label) => FEE_HEADER.test(label));
      const namesProgrammes = data.some((cells) => cells.some(isDegree));

      // Programmes as columns, fee heads as rows ("Particulars | BA (Gen) Amt. Rs. | B.Sc (Hons) Amt.
      // Rs."): the tuition or total row gives each column's fee, for the period that row states.
      const degreeColumns = heads.map((head, column) => (isDegree(head) ? column : -1)).filter((column) => column >= 0);
      if (tableIsFees && !namesProgrammes && degreeColumns.length >= 2) {
        for (const cells of data) {
          const rowLabel = textCellsOf(cells)[0] ?? '';
          if (!TUITION_ROW.test(rowLabel)) continue;
          const rowPeriod = headPeriod(rowLabel);
          if (rowPeriod === 'other') continue;
          for (const column of degreeColumns) {
            const amount = amountIn(cells[column]);
            if (amount === null) continue;
            const label = clean(heads[column].replace(/\b(amt|amount|fees?|rs|inr|in)\b\.?|₹/gi, ' ').replace(/\(\s*[.)]*\s*\)/g, ' ')).replace(/[\s.,:(-]+$/, '');
            const name = degreeNameIn(label) || label;
            const field = FEE_FIELD[rowPeriod || headPeriod(heads[column]) || tablePeriod];
            const level = levelOf(name);
            add({ name, sourcePage: page.url, ...(level ? { level } : {}), ...(field ? { [field]: amount } : { feeNote: clip(`${rowLabel}: ${cells[column]}`, 160) }), ...(session ? { feeYear: session } : {}) });
          }
        }
        continue;
      }

      // The programme is named above the table ("B.C.A. Fee Structure") — or, on a fee page about one
      // programme, in the page title — and the rows only print amounts: one row of semester or year
      // columns, a fee-heads table, or a fee authority's approval (Tuition | Development | Total).
      const titled = tableIsFees && !namesProgrammes ? programmeInTitle(`${table.caption ?? ''} | ${table.title ?? ''}`) || pageProgramme : '';
      if (titled) {
        const authority = authorityPage || FEE_AUTHORITY.test(context);
        const priced = data.filter((cells) => cells.some((cell) => amountIn(cell) !== null));
        // An authority's list covers every institution in the district; without knowing which row
        // is this one, none is taken.
        if (authority && priced.length > 1 && priced.some((cells) => textCellsOf(cells).length)) continue;
        const totalColumn = labels.findIndex((label) => /\btotal\b/.test(label));
        const level = levelOf(titled);
        const pricedAs = (cells, row) => {
          let unlabelled = '';
          for (const [column, cell] of cells.entries()) {
            const amount = amountIn(cell);
            if (amount === null) continue;
            const period = periodOf(cell) || periodOf(labels[column] ?? '') || tablePeriod;
            if (period === 'other') continue;
            const field = FEE_FIELD[period];
            if (field) { if (row[field] === undefined) row[field] = amount; } else unlabelled ||= clip(`${heads[column] ? `${heads[column]}: ` : ''}${cell}`, 160);
          }
          return unlabelled;
        };
        // "Fee Structure – M.Tech" over "CAD-CAM | 50,000", "Machine Design | 50,000": one row per
        // branch of the titled programme. Every priced row must name a branch, under a course-like
        // column, so a fee-heads table (Tuition / Exam / Library) or a category list (General / SC)
        // is never read as branches.
        const branchOf = (cells) => {
          const texts = textCellsOf(cells);
          const [branch = ''] = texts;
          return texts.length === 1 && branch.length <= 80 && !TUITION_ROW.test(branch) && !NOT_A_BRANCH.test(branch)
            && !NOT_A_PROGRAMME.test(branch) && !NOT_TUITION.test(branch) && !SEAT_CATEGORY.test(branch) ? branch : '';
        };
        if (!authority && priced.length >= 2 && priced.every(branchOf) && (!labels.length || labels.some((label) => BRANCH_COLUMN.test(label)))) {
          for (const cells of priced) {
            const row = { name: `${titled} (${branchOf(cells)})`, sourcePage: page.url, ...(level ? { level } : {}) };
            const unlabelled = pricedAs(cells, row);
            const found = ['annualFeeInr', 'semesterFeeInr', 'totalFeeInr'].some((field) => row[field] !== undefined);
            if (!found && unlabelled) row.feeNote = unlabelled;
            if (found || unlabelled) add({ ...row, ...(session ? { feeYear: session } : {}) });
          }
          continue;
        }
        const row = { name: titled, sourcePage: page.url };
        if (level) row.level = level;
        let unlabelled = '';
        for (const cells of priced) {
          const texts = textCellsOf(cells);
          const rowLabel = texts.length === 1 && TUITION_ROW.test(texts[0]) ? texts[0] : '';
          if (!authority && texts.length && !rowLabel) continue;
          const rowPeriod = rowLabel ? headPeriod(rowLabel) : '';
          if (rowPeriod === 'other') continue;
          for (const [column, cell] of cells.entries()) {
            if (authority && totalColumn >= 0 && column !== totalColumn) continue;
            const amount = amountIn(cell);
            if (amount === null) continue;
            const period = authority ? 'year' : periodOf(cell) || rowPeriod || periodOf(labels[column] ?? '') || tablePeriod;
            if (period === 'other') continue;
            const field = FEE_FIELD[period];
            if (field) { if (row[field] === undefined) row[field] = amount; } else unlabelled ||= clip(`${heads[column] ? `${heads[column]}: ` : ''}${cell}`, 160);
          }
        }
        const found = ['annualFeeInr', 'semesterFeeInr', 'totalFeeInr'].some((field) => row[field] !== undefined);
        if (!found && unlabelled) row.feeNote = unlabelled;
        if (found || unlabelled) add({ ...row, ...(session ? { feeYear: session } : {}) });
        continue;
      }
      let carried = '';
      for (const cells of data) {
        let nameIndex = cells.findIndex(isDegree);
        let name = nameIndex >= 0 ? cells[nameIndex] : '';
        if (nameIndex >= 0) {
          carried = name;
          // "B.Tech | Computer Science | 1,25,000": the branch has its own column.
          const next = cells[nameIndex + 1];
          if (next && BRANCH_HEADER.test(labels[nameIndex + 1] ?? '') && /[a-z]{3}/i.test(next) && rupeesIn(next, { bare: true }) === null && !NOT_A_BRANCH.test(next)) {
            name = `${name} (${next})`;
            nameIndex += 1;
          }
        } else if (carried && tableIsFees) {
          // A merged "B.Tech" cell spans the branch rows below it, which then start with the branch.
          const branchIndex = cells.findIndex((cell) => !SERIAL.test(cell) && /[a-z]{3}/i.test(cell) && cell.length <= 80 && rupeesIn(cell, { bare: true }) === null);
          if (branchIndex < 0 || NOT_A_BRANCH.test(cells[branchIndex]) || NOT_A_PROGRAMME.test(cells[branchIndex])) continue;
          nameIndex = branchIndex;
          name = `${carried} (${cells[branchIndex]})`;
        }
        if (nameIndex < 0) continue;
        const row = { name, sourcePage: page.url };
        const level = levelOf(name);
        if (level) row.level = level;
        const others = cells.filter((_, column) => column !== nameIndex);
        const duration = others.map(durationIn).find((value) => value !== null) ?? durationIn(name);
        if (duration !== null && duration !== undefined) row.durationYears = duration;
        let unlabelled = '';
        const largeAmounts = cells.some((cell, column) => column !== nameIndex && rupeesIn(cell, { bare: true }) !== null);
        for (const [column, cell] of cells.entries()) {
          if (column === nameIndex) continue;
          const label = labels[column] ?? '';
          // Four-digit cells count only in a row of small fees: next to "48,500" a "1500" is a
          // registration or exam charge, not the tuition.
          const amount = rupeesIn(cell, { bare: tableIsFees && (FEE_HEADER.test(label) || feePage || periodOf(label) !== ''), cell: !largeAmounts, max: 50_000_000 });
          if (amount === null) continue;
          const period = periodOf(cell) || periodOf(label) || tablePeriod;
          if (period === 'other') continue;
          const field = FEE_FIELD[period];
          if (field) {
            if (row[field] === undefined && (field === 'totalFeeInr' || amount <= 10_000_000)) row[field] = amount;
          } else {
            unlabelled ||= clip(`${label && !/^\d/.test(label) ? `${label}: ` : ''}${cell}`, 160);
          }
        }
        const priced = ['annualFeeInr', 'semesterFeeInr', 'totalFeeInr'].some((field) => row[field] !== undefined);
        if (!priced && unlabelled) row.feeNote = unlabelled;
        if ((priced || unlabelled) && session) row.feeYear = session;
        // A row carried down from a merged cell is only a programme when it is priced.
        if (cells[nameIndex] !== carried && !cells.some(isDegree) && !priced) continue;
        add(row);
      }
    }
  }
  // Many sites print fees as sentences rather than tables ("B.Tech (CSE) – Rs. 1,25,000 per annum"),
  // so scan the fee and admission pages line by line for a degree name paired with an amount. On a
  // fee page or fee document a bare "1,25,000" counts, since the whole page is about fees.
  for (const page of pages) {
    if (!['fees', 'admission', 'programmes'].includes(page.category)) continue;
    const bare = page.category === 'fees';
    const pagePeriod = bare ? periodOf(contextOf(page)) : '';
    const session = bare ? sessionIn(contextOf(page)) : '';
    for (const raw of page.lines ?? []) {
      const line = clean(raw);
      if (line.length < 6 || line.length > 220) continue;
      const amount = rupeesIn(line, { bare });
      if (amount === null) continue;
      // The programme name is the part before the money, and must look like a degree.
      const name = degreeNameIn(line.split(MONEY)[0].split(bare ? BARE_MONEY : /$^/)[0]);
      if (!name || NOT_A_PROGRAMME.test(name)) continue;
      const period = periodOf(line) || (pagePeriod === 'other' ? '' : pagePeriod);
      if (period === 'other') continue;
      const level = levelOf(name);
      const field = FEE_FIELD[period];
      add({ name, sourcePage: page.url, ...(level ? { level } : {}), ...(field ? { [field]: amount } : { feeNote: clip(line, 160) }), ...(session ? { feeYear: session } : {}) });
    }
  }

  // Fee documents and app-style fee pages put the programme in a heading and the amounts in rows
  // under it ("TOTAL FEES FOR MBA PROGRAM IN MARKETING" / "Semester I | Semester II" / "Program
  // Fee | Rs. 1,75,000/-"). Read them section by section.
  for (const page of pages) {
    if (page.category !== 'fees') continue;
    for (const row of feeSections(page)) add(row);
  }

  const sourcePage = pages.find((page) => ['programmes', 'admission'].includes(page.category))?.url ?? pages[0]?.url ?? '';
  for (const name of fallbackNames) {
    const level = levelOf(name);
    add({ name, sourcePage, ...(level ? { level } : {}) });
  }
  return [...byKey.values()].slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Placements

// Placement dashboards often abbreviate a package as just "72 L". This matcher is only used next
// to an explicit average/highest/median CTC label, so accepting bare L here does not turn arbitrary
// counts elsewhere on the page into salary figures.
const LPA = /(?:₹|rs\.?\s*)?(\d{1,3}(?:\.\d{1,2})?)\s*(lpa|lakhs?\s*(?:per\s*annum|p\.?a\.?)?|lacs?|crores?|cr\b|l\.?p\.?a|l\b)/i;
const toLpa = (match) => {
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2].toLowerCase();
  const lpa = /^(crore|cr)/.test(unit) ? value * 100 : value;
  return lpa > 0 && lpa <= 1000 ? Math.round(lpa * 100) / 100 : null;
};

function packageIn(line, pattern) {
  const hit = pattern.exec(line);
  if (!hit) return null;
  // The figure must sit next to the label it belongs to, not elsewhere in the sentence.
  const window = line.slice(hit.index, hit.index + hit[0].length + 60);
  const match = LPA.exec(window) ?? LPA.exec(line.slice(Math.max(0, hit.index - 40), hit.index));
  return match ? toLpa(match) : null;
}

function packageAt(lines, index, pattern) {
  const direct = packageIn(lines[index], pattern);
  if (direct !== null) return direct;
  if (!pattern.test(lines[index])) return null;
  // Responsive stat cards commonly put the value in one element and its label in the next. Only a
  // short, amount-shaped adjacent line is accepted; prose and unrelated dashboard counts are not.
  for (const adjacent of [lines[index - 1], lines[index + 1]]) {
    if (!adjacent || adjacent.length > 40) continue;
    const match = LPA.exec(adjacent);
    if (match && adjacent.replace(match[0], '').replace(/[₹:()\-–—\s]/g, '').length === 0) return toLpa(match);
  }
  return null;
}

const AVERAGE_PACKAGE = /\b(?:average|avg\.?|mean)\s*(?:ctc|package|salary|pay)\b|\b(?:ctc|package|salary|pay)\s*(?:average|avg\.?|mean)\b/i;
const HIGHEST_PACKAGE = /\b(?:highest|maximum|max\.?|top)\s*(?:international\s*|domestic\s*)?(?:ctc|package|salary|pay|offer)\b|\b(?:ctc|package|salary|pay)\s*(?:highest|maximum|max\.?|top)\b/i;
const MEDIAN_PACKAGE = /\bmedian\s*(?:ctc|package|salary|pay)\b|\b(?:ctc|package|salary|pay)\s*median\b/i;

function placementYearIn(line) {
  const range = /(?:placement|batch|session|academic\s*year|drive|year)[^.\n]{0,30}?\b(20[12]\d)\b\s*[-–/]\s*((?:20)?\d{2})\b/i.exec(line);
  if (range) return Number(range[2].length === 2 ? `${String(range[1]).slice(0, 2)}${range[2]}` : range[2]);
  const match = /(?:placement|batch|session|academic\s*year|drive|year)[^.\n]{0,30}?\b(20[12]\d)\b/i.exec(line)
    ?? /\b(20[12]\d)\b[^.\n]{0,30}(?:placement|batch)/i.exec(line);
  return match ? Number(match[1]) : null;
}

// Everything a site's chrome puts next to a recruiter wall: menu items, contact buttons, social
// icons and the institution's own name. A real run produced "Call", "Mail", "Whatsapp" without this.
const GENERIC_RECRUITER = /^(more|others?|etc|and|view all|top recruiters?|our recruiters?|recruiters?|companies|placements?|home|about|contact|read more|click here|next|previous|apply|login|register|download|call|mail|email|phone|enquiry|enquire|whatsapp|instagram|facebook|twitter|linkedin|youtube|telegram|share|search|menu|sidebar|header|footer|top|bottom|news|events?|gallery|admission|courses?|faculty|alumni|blog|naac|nirf|aicte|ugc|nba|iso|iqac|nptel|swayam|\d+)$/i;
// The markup has to say "recruiter wall" and nothing weaker. "placement" is the topic of the whole
// page, and "logo" is on every site's own header, so neither marks anything. Real runs showed both
// pulling in the institution's own banners, social icons and photo captions.
const RECRUITER_IMAGE = /recruit|compan(y|ies)|client|partner/i;
// Image filenames and page titles that slipped through as company names on real sites.
const NOT_A_NAME = /[|»›]|::|\blogo\b|^(fb|facebook|twitter|insta\w*|gplus|google|yt|youtube|wa|whatsapp|linkedin|telegram)[\s_-]|^[a-z0-9]+(?:[_-][a-z0-9]+)+$|[_-]\s*\d+$|\d{3,}|[-–]\s*$|^[^A-Za-z]/;
// An alt that describes an event or a picture is a caption, not a company name.
const NOT_A_COMPANY = /\b(drive|session|programme|program|visit|training|workshop|seminar|ceremony|celebration|day|week|year|batch|gif|jpe?g|png|photo|image|picture|slide|icon|partner|sponsor|students?|campus|college|university|institute|school|department)\b/i;
// A headline reads as a sentence about the recruiter ("X Recruits Our Talent"); a logo's alt is the
// company name on its own. Real runs stored whole news headlines as recruiter names without this.
const READS_AS_A_SENTENCE = /\b(recruit(s|ed|ing)|hire[sd]?|hiring|visit(s|ed)|select(s|ed)|offer(s|ed)|partner(ed|ship)|join(s|ed)|conduct(s|ed)|organi[sz]e[sd]?|bag(s|ged)|placed)\b/i;
// A percentage about money, seats or attendance is not a placement rate, and neither is a slice of
// the batch: "top 25% placed students" is the band a package belongs to, not the share placed.
const NOT_A_PLACEMENT_RATE = /\b(fee|fees|scholarship|concession|discount|refund|gst|interest|attendance|reservation|quota|seats?|growth|increase|hike|marks?|aggregate|cut-?off|eligib)\b|\b(top|best|bottom|highest|lowest)\s+\d{1,3}(\.\d)?\s*%/i;

/**
 * Placement figures, each only when the official placement page prints it. Returns null when the
 * page shows no numbers and names no recruiters.
 * @param {object[]} pages
 * @param {{ institutionName?: string }} options the institution's own name, so its own banners
 *   and taglines are not mistaken for the companies that recruited from it
 */
export function placementsFrom(pages, { institutionName = '' } = {}) {
  const placement = pages.filter((page) => page.category === 'placement');
  if (!placement.length) return null;
  const result = { sourcePage: placement[0].url };
  const lines = placement.flatMap((page) => page.lines ?? []).filter((line) => line.length <= 300 && !NEWSY.test(line));
  // A combined industry page often lists summer internships first. Salary figures below belong to
  // the final-placement heading, not to that first summer batch, so take the explicit final year.
  const finalYear = placementYearIn(lines.find((line) => /\bfinal\s+placements?\b/i.test(line)) ?? '');
  if (finalYear && finalYear >= 2000 && finalYear <= CURRENT_YEAR) result.year = finalYear;
  for (const [index, line] of lines.entries()) {
    if (result.averagePackageLpa === undefined) {
      const value = packageAt(lines, index, AVERAGE_PACKAGE);
      if (value !== null) result.averagePackageLpa = value;
    }
    if (result.highestPackageLpa === undefined) {
      const value = packageAt(lines, index, HIGHEST_PACKAGE);
      if (value !== null) result.highestPackageLpa = value;
    }
    if (result.medianPackageLpa === undefined) {
      const value = packageAt(lines, index, MEDIAN_PACKAGE);
      if (value !== null) result.medianPackageLpa = value;
    }
    if (result.placedPercent === undefined && !NOT_A_PLACEMENT_RATE.test(line)) {
      // "92% placed", "92% of eligible students were placed", and "92% students placed in 2024-25".
      const match = /(\d{1,3}(?:\.\d)?)\s*%\s*(?:of\s*)?(?:the\s*)?(?:eligible\s*)?(?:students?|candidates?|batch)?\s*(?:were\s*|got\s*|are\s*|have\s*been\s*)?(?:placed|placement)/i.exec(line)
        ?? /\bplace(?:d|ment)\b[^.\n%]{0,40}?(\d{1,3}(?:\.\d)?)\s*%/i.exec(line);
      const percent = match && Number(match[1]);
      if (percent !== null && percent !== undefined && percent > 0 && percent <= 100) result.placedPercent = percent;
    }
    if (result.year === undefined) {
      const year = placementYearIn(line);
      if (year && year >= 2000 && year <= CURRENT_YEAR) result.year = year;
    }
  }
  // Recruiter names come only from the alt text of images that the markup itself labels as a
  // recruiter/company/partner logo. Reading them out of the page's text picks up the navigation.
  const recruiters = [];
  const names = new Set();
  const ownWords = new Set(fold(institutionName).split(' ').filter((word) => word.length >= 4));
  const isOwnName = (value) => {
    const words = fold(value).split(' ').filter((word) => word.length >= 4);
    return words.length > 0 && words.every((word) => ownWords.has(word));
  };
  for (const page of placement) {
    for (const image of page.images ?? []) {
      if (!RECRUITER_IMAGE.test(`${image.src} ${image.hint} ${image.alt}`)) continue;
      const alt = clean(image.alt).replace(/\s*logo\s*$/i, '').replace(/[.,;]+$/, '').trim();
      if (alt.length < 2 || alt.length > 60 || GENERIC_RECRUITER.test(alt) || isOwnName(alt)) continue;
      if (/banner|slider|placeholder/i.test(alt) || NOT_A_COMPANY.test(alt) || NOT_A_NAME.test(alt) || DEGREE_PATTERN.test(alt)) continue;
      if (READS_AS_A_SENTENCE.test(alt) || alt.split(/\s+/).length > 5) continue;
      const key = fold(alt);
      // Numbered image files ("campus -1", "campus -3", …) repeat their first word; companies do not.
      const stem = key.split(' ')[0];
      if (!key || names.has(key) || names.has(`stem:${stem}`)) continue;
      names.add(key);
      names.add(`stem:${stem}`);
      recruiters.push(alt);
      if (recruiters.length >= 20) break;
    }
  }
  if (recruiters.length) result.recruiters = recruiters;
  // A list of logo alt texts on its own is weak evidence, so it has to be a real list, not one
  // stray image; any printed figure is enough on its own.
  const hasNumbers = ['year', 'averagePackageLpa', 'highestPackageLpa', 'medianPackageLpa', 'placedPercent'].some((key) => result[key] !== undefined);
  return hasNumbers || recruiters.length >= 3 ? result : null;
}

// ---------------------------------------------------------------------------------------------
// Placement record, season by season

// "2024-25", "2024–2025", "2024/25" or a lone "2025". The season is named by the year it ends,
// which is when the batch graduates and the offers are counted.
const SEASON = /\b(20[0-3]\d)\s*[-–/]\s*((?:20)?[0-3]\d)\b|\b(20[0-3]\d)\b/;
export function seasonOf(text, now = CURRENT_YEAR) {
  const match = SEASON.exec(String(text ?? ''));
  if (!match) return null;
  let year;
  let session;
  if (match[1]) {
    const start = Number(match[1]);
    const end = Number(match[2].length === 2 ? `${match[1].slice(0, 2)}${match[2]}` : match[2]);
    if (end !== start + 1) return null;
    year = end;
    session = `${start}-${String(end).slice(2)}`;
  } else {
    year = Number(match[3]);
    session = String(year);
  }
  return year >= now - 8 && year <= now + 1 ? { year, session } : null;
}

const PLACED_RATE = /placement\s*(%|percent(age)?|rate|record)|placed\s*(%|percent(age)?)|%\s*(of\s*)?(students?\s*)?placed|percentage\s*(of\s*)?(students?\s*)?placed/i;
const STUDENTS_PLACED = /(no\.?|number)\s*(of\s*)?(students?\s*)?(placed|selections?|selected)|students?\s*(placed|selected)|total\s*(placed|selections?)|\bselections\b/i;
const OFFERS = /(no\.?|number)\s*(of\s*)?(job\s*)?offers|total\s*offers|offers?\s*(made|received|rolled)|job\s*offers|\boffers\b/i;
const COMPANIES = /(no\.?|number)\s*(of\s*)?(companies|recruiters|organi[sz]ations|employers)|compan(y|ies)\s*(visited|participated|registered|came)|recruiters?\s*(visited|participated)|total\s*(companies|recruiters)|companies\s*$/i;
// Order matters: a "median package" label must not be read by the average rule first.
const METRICS = [
  ['medianPackageLpa', MEDIAN_PACKAGE, 'lpa'],
  ['averagePackageLpa', AVERAGE_PACKAGE, 'lpa'],
  ['highestPackageLpa', HIGHEST_PACKAGE, 'lpa'],
  ['placedPercent', PLACED_RATE, 'percent'],
  ['companies', COMPANIES, 'count'],
  ['offers', OFFERS, 'count'],
  ['studentsPlaced', STUDENTS_PLACED, 'count'],
];
const metricOf = (label) => METRICS.find(([, pattern]) => pattern.test(label)) ?? null;

/**
 * One cell's value for a metric. A package may be printed "8.5 LPA", bare as "8.5" under a "(LPA)"
 * label, or in rupees ("8,50,000") under a "CTC (Rs.)" label; a count must be a whole number.
 */
function metricValue(kind, cell, label = '') {
  const text = clean(cell);
  if (!text || /^[-–—]$|n\/?a/i.test(text)) return null;
  if (kind === 'lpa') {
    const match = LPA.exec(text);
    if (match) return toLpa(match);
    const bare = /^(?:₹|rs\.?\s*)?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{4,8}(?:\.\d{1,2})?)\s*(?:\/-)?$/i.exec(text);
    if (!bare) return null;
    const value = Number(bare[1].replace(/,/g, ''));
    if (value >= 10_000) return Math.round((value / 100_000) * 100) / 100 <= 1000 ? Math.round((value / 100_000) * 100) / 100 : null;
    return /lpa|lakh|lac|\bl\b|ctc|package|salary/i.test(label) && value > 0 && value <= 1000 ? value : null;
  }
  if (kind === 'percent') {
    const match = /^(\d{1,3}(?:\.\d{1,2})?)\s*%?$/.exec(text);
    const value = match && Number(match[1]);
    return value && value > 0 && value <= 100 ? value : null;
  }
  const match = /^(\d{1,3}(?:,\d{3})*|\d{1,6})\s*\+?$/.exec(text);
  const value = match && Number(match[1].replace(/,/g, ''));
  return value && value >= 1 && value <= 100_000 ? value : null;
}

/** "Highest package: 44 LPA", "Companies visited – 120", "92% placed" inside a line of prose. */
function metricsInLine(line, lines, index) {
  const found = {};
  for (const [key, pattern, kind] of METRICS) {
    if (found[key] !== undefined || !pattern.test(line)) continue;
    if (kind === 'lpa') {
      const value = packageAt(lines, index, pattern);
      if (value !== null) found[key] = value;
    } else if (kind === 'percent') {
      if (NOT_A_PLACEMENT_RATE.test(line)) continue;
      const match = /(\d{1,3}(?:\.\d)?)\s*%/.exec(line);
      const value = match && Number(match[1]);
      if (value && value <= 100) found[key] = value;
    } else {
      const hit = pattern.exec(line);
      const after = /^[^\d]{0,20}?(\d{1,3}(?:,\d{3})*|\d{1,6})\s*\+?(?![\d.%]|\s*(?:lpa|lakh|lac|l\b|cr|%|years?))/i.exec(line.slice(hit.index + hit[0].length));
      const before = /(?<![\d.])(\d{1,3}(?:,\d{3})*|\d{1,6})\s*\+?\s*$/.exec(line.slice(0, hit.index));
      const raw = after?.[1] ?? before?.[1];
      const value = raw && Number(raw.replace(/,/g, ''));
      // A season ("2024") next to the label is a year, not a count.
      if (value && value <= 100_000 && !(value >= 2000 && value <= CURRENT_YEAR + 1)) found[key] = value;
    }
  }
  return found;
}

// Most colleges publish placements as the NAAC 5.2.1 list: one row per placed student with the
// programme, the employer and often the pay package. Counting that list is what the institution
// published, so a season gets the number of students listed, the number of distinct employers and
// the highest package printed — marked `basis: 'student-list'` so the profile can say so.
const STUDENT_COLUMN = /name\s*of\s*(the\s*)?(students?|candidates?)|students?'?s?\s*name|candidate'?s?\s*name/i;
const EMPLOYER_COLUMN = /employer|compan(y|ies)|organi[sz]ation|concern|recruiter|placed\s*(in|at|with)|\bfirm\b/i;
const PAY_COLUMN = /package|salary|\bctc\b|\bpay\b|\blpa\b|remuneration|annual\s*income/i;
const YEAR_COLUMN = /\byear\b|session|batch/i;
const NOT_JOBS = /internship|\bintern\b|stipend|higher\s*(education|studies)|progression|admitted\s*to|competitive\s*exam|qualif(ied|ying)|net\s*\/?\s*set|gate\b|entrepreneur/i;
const PLACEMENT_CONTEXT = /placement|placed|outgoing|recruit|campus\s*(drive|selection)|batch/i;
const companyKey = (text) => clean(text).toLowerCase().split(/[,(]/)[0].replace(/\b(pvt|private|ltd|limited|llp|inc|india|co|corporation|technologies|services)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function studentListSeasons(pages, now = CURRENT_YEAR) {
  const bySeason = new Map();
  for (const page of pages) {
    // The season a page's list belongs to when its tables do not say: only when the page names one.
    const pageSeasons = new Set((page.lines ?? []).slice(0, 400)
      .filter((line) => line.length <= 160 && PLACEMENT_CONTEXT.test(line)).map((line) => seasonOf(line, now)?.session).filter(Boolean));
    const pageSeason = pageSeasons.size === 1 ? seasonOf([...pageSeasons][0], now) : null;
    // A PDF's rows break into many small tables wherever a name wraps onto its own line, and its
    // header is often split across lines ("STUDENT" / "NAME"), so when its tables give no list a
    // document is read again as one list headed by its opening lines.
    const count = (found) => [...found.values()].reduce((sum, entry) => sum + entry.students, 0);
    let found = listSeasonsIn(page, page.tables ?? [], { now, pageSeason, whole: false });
    if (page.isDocument && count(found) < 3) {
      const whole = [{ rows: [[(page.lines ?? []).slice(0, 15).join(' ')], ...(page.tables ?? []).flatMap((table) => table.rows ?? [])] }];
      found = listSeasonsIn(page, whole, { now, pageSeason, whole: true });
    }
    for (const entry of found.values()) {
      const existing = bySeason.get(entry.season.year);
      if (!existing) { bySeason.set(entry.season.year, entry); continue; }
      existing.students += entry.students;
      for (const company of entry.companies) existing.companies.add(company);
      existing.packages.push(...entry.packages);
    }
  }
  const out = [];
  for (const { season, students, companies, packages, sourcePage } of bySeason.values()) {
    if (students < 3) continue;
    const row = { year: season.year, session: season.session, studentsPlaced: students, basis: 'student-list', sourcePage };
    if (companies.size) row.companies = companies.size;
    if (packages.length >= 3) row.highestPackageLpa = Math.max(...packages);
    if (packages.length >= 5 && packages.length >= students * 0.6) {
      const sorted = packages.toSorted((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      row.medianPackageLpa = Math.round((sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
    }
    out.push(row);
  }
  return out;
}

// Seasons of one page's student lists: Map of year → { season, students, companies, packages }.
function listSeasonsIn(page, tables, { now, pageSeason, whole }) {
  const bySeason = new Map();
  {
    for (const table of tables) {
      const rows = table.rows ?? [];
      const headIndex = whole ? -1 : rows.slice(0, 6).findIndex((row) => STUDENT_COLUMN.test(row.join(' ')));
      // Header text split across several PDF rows still names the columns somewhere in the first rows.
      const headText = rows.slice(0, Math.max(headIndex + 1, 6)).flat().join(' ');
      const namesStudents = STUDENT_COLUMN.test(headText) || (whole && /\bstudents?\b/i.test(headText) && /\bname\b/i.test(headText));
      if (headIndex < 0 && !(namesStudents && EMPLOYER_COLUMN.test(headText))) continue;
      const context = `${table.caption ?? ''} ${table.title ?? ''} ${headText}`;
      if (!EMPLOYER_COLUMN.test(headText) || NOT_JOBS.test(context)) continue;
      const head = headIndex >= 0 ? rows[headIndex] : [];
      const find = (pattern) => head.findIndex((cell) => pattern.test(cell));
      const employerAt = find(EMPLOYER_COLUMN);
      const payAt = find(PAY_COLUMN);
      const yearAt = find(YEAR_COLUMN);
      const tableSeason = seasonOf(`${table.caption ?? ''} ${table.title ?? ''}`, now) ?? pageSeason;
      for (const cells of rows.slice(headIndex >= 0 ? headIndex + 1 : 1)) {
        const filled = cells.filter((cell) => clean(cell));
        if (filled.length < 3 || STUDENT_COLUMN.test(cells.join(' ')) || /^(total|grand total)$/i.test(clean(filled[0]))) continue;
        const aligned = head.length === cells.length;
        const lead = /^(20[0-3]\d\s*[-–/]\s*(?:20)?[0-3]\d)\b/.exec(clean(cells[0]))?.[1];
        // Header fragments of a PDF ("NAME | TED | GRADUATI") are not students: a document's data row
        // starts with a serial number or a session, or ends with a pay figure.
        if (whole && !lead && !/^\d{1,4}[.)]?$/.test(clean(filled[0])) && metricValue('lpa', filled.at(-1), 'package') === null) continue;
        const season = (aligned && yearAt >= 0 ? seasonOf(cells[yearAt], now) : null) ?? (lead ? seasonOf(lead, now) : null) ?? tableSeason;
        if (!season) continue;
        const entry = bySeason.get(season.year) ?? { season, students: 0, companies: new Set(), packages: [], sourcePage: page.url };
        entry.students += 1;
        if (aligned && employerAt >= 0 && companyKey(cells[employerAt])) entry.companies.add(companyKey(cells[employerAt]));
        const payCell = aligned && payAt >= 0 ? cells[payAt] : payAt >= 0 || PAY_COLUMN.test(headText) ? filled.at(-1) : '';
        const lpa = payCell ? metricValue('lpa', payCell, 'package') : null;
        if (lpa !== null && lpa >= 0.5 && lpa <= 200) entry.packages.push(lpa);
        bySeason.set(season.year, entry);
      }
    }
  }
  return bySeason;
}

/**
 * The placement record for each season the placement page or report prints, newest first. Reads
 * three layouts: a table with seasons as columns, a table with seasons as rows, and sections of
 * text headed by a season ("Placement Statistics 2024-25"). Only figures the page prints are kept,
 * and a season with no figure is left out.
 */
export function placementHistoryFrom(pages, { now = CURRENT_YEAR, keep = 4 } = {}) {
  const placement = pages.filter((page) => page.category === 'placement');
  const seasons = new Map();
  const put = (season, key, value, sourcePage) => {
    if (!season || value === null || value === undefined) return;
    const row = seasons.get(season.year) ?? { year: season.year, session: season.session, sourcePage };
    if (row[key] === undefined) row[key] = value;
    seasons.set(season.year, row);
  };

  for (const page of placement) {
    for (const table of page.tables ?? []) {
      const rows = table.rows ?? [];
      // Seasons across the top: | Particulars | 2022-23 | 2023-24 | 2024-25 |
      const headIndex = rows.findIndex((row) => row.filter((cell) => cell.length <= 24 && seasonOf(cell, now)).length >= 2);
      if (headIndex >= 0 && headIndex < 3) {
        const columns = rows[headIndex].map((cell) => (cell.length <= 24 ? seasonOf(cell, now) : null));
        for (const row of rows.slice(headIndex + 1)) {
          const metric = metricOf(row[0] ?? '') ?? metricOf(row[1] ?? '');
          if (!metric) continue;
          const [key, , kind] = metric;
          // Rows can be one cell shorter than the header when the label column is merged.
          const shift = row.length === columns.length ? 0 : row.length === columns.length - 1 ? -1 : 0;
          for (const [column, season] of columns.entries()) {
            if (season && row[column + shift] !== undefined) put(season, key, metricValue(kind, row[column + shift], row[0]), page.url);
          }
        }
        continue;
      }
      // Seasons down the side: | Year | Companies | Students placed | Highest (LPA) |
      const labels = (rows[0] ?? []).map((cell) => metricOf(cell));
      if (labels.some(Boolean)) {
        for (const row of rows.slice(1)) {
          const seasonCell = row.find((cell) => cell.length <= 24 && seasonOf(cell, now));
          const season = seasonCell && seasonOf(seasonCell, now);
          if (!season) continue;
          for (const [column, metric] of labels.entries()) if (metric) put(season, metric[0], metricValue(metric[2], row[column] ?? '', rows[0][column]), page.url);
        }
        continue;
      }
      // One table for one season, branch by branch: only its printed "Total"/"Overall" row is used.
      const season = seasonOf(`${table.caption ?? ''} ${table.title ?? ''} ${(table.headers?.length === 1 ? table.headers[0] : '')}`, now);
      const header = rows[0] ?? [];
      const totals = rows.find((row) => /^(total|overall|grand total|all branches)$/i.test(clean(row[0] ?? row[1] ?? '')));
      if (season && totals) {
        for (const [column, label] of header.entries()) {
          const metric = metricOf(label);
          if (metric) put(season, metric[0], metricValue(metric[2], totals[column] ?? '', label), page.url);
        }
      }
    }

    // Text sections. A short line naming a season opens a section; figures until the next season
    // heading belong to it. A line that names a season and a figure together counts on its own.
    const lines = (page.lines ?? []).filter((line) => line.length <= 300 && !NEWSY.test(line));
    let current = null;
    // A run of bare seasons is a set of tabs or archive links, not a heading for what follows.
    const bareSeason = (line) => Boolean(line) && clean(line).length <= 24 && seasonOf(line, now) !== null;
    for (const [index, line] of lines.entries()) {
      const season = seasonOf(line, now);
      const isHeading = season && line.length <= 90
        && (/placement|batch|session|statistic|record|recruitment|drive|highlights?|year|report/i.test(line)
          || (clean(line).length <= 12 && !bareSeason(lines[index - 1]) && !bareSeason(lines[index + 1])));
      if (isHeading) current = season;
      const found = metricsInLine(line, lines, index);
      const target = season && Object.keys(found).length && !isHeading ? season : current;
      for (const [key, value] of Object.entries(found)) put(target, key, value, page.url);
    }
  }

  // A season the page sums up itself is taken as printed; the institution's list of placed students
  // fills only the seasons it does not sum up.
  for (const row of studentListSeasons(placement, now)) if (!seasons.has(row.year)) seasons.set(row.year, row);

  const metricKeys = METRICS.map(([key]) => key);
  return [...seasons.values()]
    .map((row) => {
      // A median or average above the highest package is a misread column; drop the misread value.
      if (row.highestPackageLpa !== undefined) {
        for (const key of ['averagePackageLpa', 'medianPackageLpa']) if (row[key] !== undefined && row[key] > row.highestPackageLpa) delete row[key];
      }
      return row;
    })
    .filter((row) => row.year >= now - 5 && row.year <= now + 1 && metricKeys.some((key) => row[key] !== undefined))
    .sort((a, b) => b.year - a.year)
    .slice(0, keep);
}

// ---------------------------------------------------------------------------------------------
// Facilities, activities and the campus itself

const FACILITY_RULES = [
  ['Hostel', /\bhostels?\b|residential (facility|accommodation)|boys'? hostel|girls'? hostel/i],
  ['Library', /\blibrar(y|ies)\b/i],
  ['Laboratories', /\blaborator(y|ies)\b|\blabs?\b/i],
  ['Sports facilities', /\bsports\b|playground|stadium|athletic|basketball court|cricket ground/i],
  ['Gymnasium', /\bgymnasium\b|\bgym\b|fitness cent(re|er)/i],
  ['Medical centre', /medical (cent(re|er)|facility|room)|health cent(re|er)|dispensar|ambulance|first[\s-]?aid/i],
  ['Transport', /\btransport(ation)?\b|bus (service|facility)|college buses/i],
  ['Wi-Fi campus', /\bwi-?fi\b|wifi[\s-]?enabled|internet facility/i],
  ['Auditorium', /\bauditorium\b|seminar hall|convention cent(re|er)|conference hall/i],
  ['Cafeteria', /\bcanteen\b|cafeteria|food court|mess facility/i],
  ['Computer centre', /computer cent(re|er)|computing facility|\bict\b lab/i],
  ['Smart classrooms', /smart class|digital classroom|e-?classroom/i],
  ['Research centre', /research cent(re|er)|centre of excellence|center of excellence/i],
  ['Incubation centre', /incubat(ion|or)/i],
  ['Placement cell', /placement cell|training (and|&) placement/i],
  ['Hospital', /teaching hospital|attached hospital|\bhospital\b/i],
  ['ATM', /\batm\b/i],
  ['Guest house', /guest house/i],
  ['Bank', /\bbank branch\b|\bbank\b facility/i],
  ['Girls hostel', /girls'? hostel|ladies hostel|women'?s hostel/i],
];

const ACTIVITY_RULES = [
  ['NSS', /\bnss\b|national service scheme/i],
  ['NCC', /\bncc\b|national cadet corps/i],
  ['Cultural fest', /cultural (fest|festival)|annual fest|youth festival/i],
  ['Technical fest', /tech(nical)? fest|techfest|hackathon/i],
  ['Sports meet', /sports (meet|day|festival)|annual athletic|inter[\s-]?college (sports|tournament)/i],
  ['Student clubs', /\bclubs?\b|student chapter|\bsociet(y|ies)\b/i],
  ['Entrepreneurship cell', /\be-?cell\b|entrepreneurship (cell|development)|startup cell/i],
  ['Literary society', /literary (club|society)|debate|quiz club|elocution/i],
  ['Music and dance', /music (club|society)|dance (club|troupe)|choir/i],
  ['Drama', /\bdrama\b|theatre (club|group)|natak/i],
  ['Student council', /student (council|union|government)|students'? council/i],
  ['Yoga and wellness', /\byoga\b|meditation (cent|club)|wellness (club|programme)/i],
  ['Community outreach', /community (outreach|service)|social service|village adoption|swachh/i],
  ['Alumni association', /alumni association|alumni meet/i],
  ['Industry visits', /industrial visit|industry visit|field trip/i],
  ['Rotaract', /rotaract|\bnsc\b club|lions club/i],
];

function namedIn(rules, lines, limit) {
  const found = new Set();
  for (const line of lines) {
    if (line.length > 400 || NEWSY.test(line)) continue;
    for (const [label, pattern] of rules) if (!found.has(label) && pattern.test(line)) found.add(label);
    if (found.size >= limit) break;
  }
  return rules.map(([label]) => label).filter((label) => found.has(label)).slice(0, limit);
}

const CAMPUS_PAGES = ['campus', 'about', 'home'];
const campusLines = (pages) => pages.filter((page) => CAMPUS_PAGES.includes(page.category)).flatMap((page) => page.lines ?? []);

export const facilitiesFrom = (pages, limit = 20) => namedIn(FACILITY_RULES, campusLines(pages), limit);
export const activitiesFrom = (pages, limit = 20) => namedIn(ACTIVITY_RULES, campusLines(pages), limit);

/** Campus size, hostel and co-ed status — each only when the site prints it. */
export function campusFrom(pages) {
  const relevant = pages.filter((page) => CAMPUS_PAGES.includes(page.category));
  const result = {};
  for (const page of relevant) {
    for (const line of page.lines ?? []) {
      if (line.length > 300 || NEWSY.test(line)) continue;
      if (result.sizeAcres === undefined) {
        const match = /\b(\d{1,5}(?:\.\d{1,2})?)\s*(?:\+\s*)?acres?\b/i.exec(line);
        const size = match && Number(match[1]);
        if (size && size >= 0.1 && size <= 50_000 && /campus|spread|sprawl|area|land|premises/i.test(line)) {
          result.sizeAcres = size;
          result.sourcePage ??= page.url;
        }
      }
      if (result.coEd === undefined) {
        if (/\bco-?ed(ucational)?\b/i.test(line)) { result.coEd = true; result.sourcePage ??= page.url; }
        else if (/\b(exclusively|only)\s+for\s+(women|girls)\b|\bwomen'?s\s+(college|university|institute)\b|\bgirls'?\s+(college|degree college)\b/i.test(line)) { result.coEd = false; result.sourcePage ??= page.url; }
      }
      // Absence of a hostel is never evidence that there is none, so only `true` is ever recorded.
      if (result.hostelAvailable === undefined && /\bhostels?\b/i.test(line) && /(available|facility|accommodation|separate|boys|girls|rooms|capacity|block)/i.test(line)) {
        result.hostelAvailable = true;
        result.sourcePage ??= page.url;
      }
    }
  }
  return Object.keys(result).filter((key) => key !== 'sourcePage').length ? result : null;
}

// ---------------------------------------------------------------------------------------------
// Admissions

const ADMISSION_SENTENCE = /admission|eligibilit|apply|application|selection|entrance|counsel|merit|qualif/i;

export function admissionNoteFrom(pages, { maxChars = 400 } = {}) {
  for (const page of pages.filter((item) => item.category === 'admission')) {
    for (const paragraph of page.paragraphs ?? []) {
      if (paragraph.length < 60 || paragraph.length > 1200 || BOILERPLATE.test(paragraph) || NEWSY.test(paragraph)) continue;
      const picked = sentences(paragraph).filter((sentence) => sentence.length >= 30 && ADMISSION_SENTENCE.test(sentence)
        && !(MARKETING.test(sentence) && !CONCRETE.test(sentence)));
      if (picked.length) return { admissionNote: clip(picked.slice(0, 3).join(' '), maxChars), sourcePage: page.url };
    }
  }
  return null;
}

// Named national and state entrance tests. Matching is on the printed name only.
const EXAM_RULES = [
  ['JEE Advanced', /\bjee[\s-]*advanced?\b/i], ['JEE Main', /\bjee[\s-]*(main|mains)\b/i],
  ['NEET UG', /\bneet[\s-]*(ug|u\.g)\b|\bneet\b(?![\s-]*pg)/i], ['NEET PG', /\bneet[\s-]*pg\b/i],
  ['GATE', /\bgate\b\s*(score|exam|qualified|20\d\d)|\bgate\b(?=[\s,)])/i], ['CAT', /\bcat\b\s*(score|exam|20\d\d)|common admission test/i],
  ['MAT', /\bmat\b\s*(score|exam)|management aptitude test/i], ['XAT', /\bxat\b/i], ['CMAT', /\bcmat\b/i], ['NMAT', /\bnmat\b/i],
  ['GMAT', /\bgmat\b/i], ['GRE', /\bgre\b\s*(score|exam)/i], ['CLAT', /\bclat\b/i], ['AILET', /\bailet\b/i],
  ['NATA', /\bnata\b/i], ['UCEED', /\buceed\b/i], ['CEED', /\bceed\b/i], ['NIFT Entrance', /\bnift\b\s*(entrance|exam|test)/i],
  ['NID DAT', /\bnid\b\s*(dat|entrance)/i], ['CUET UG', /\bcuet[\s-]*(ug)?\b(?![\s-]*pg)/i], ['CUET PG', /\bcuet[\s-]*pg\b/i],
  ['UGC NET', /\bugc[\s-]*net\b/i], ['CSIR NET', /\bcsir[\s-]*net\b/i], ['ICAR AIEEA', /\bicar\b\s*aieea|\baieea\b/i],
  ['BITSAT', /\bbitsat\b/i], ['VITEEE', /\bviteee\b/i], ['SRMJEEE', /\bsrmjeee\b/i], ['COMEDK', /\bcomedk\b/i],
  ['MHT CET', /\bmht[\s-]*cet\b/i], ['KCET', /\bkcet\b/i], ['WBJEE', /\bwbjee\b/i], ['KEAM', /\bkeam\b/i],
  ['AP EAMCET', /\bap[\s-]*eamcet\b/i], ['TS EAMCET', /\bts[\s-]*eamcet\b/i], ['GUJCET', /\bgujcet\b/i],
  ['UPSEE', /\bupsee\b|\bjeecup\b/i], ['AIAPGET', /\baiapget\b/i], ['IPU CET', /\bipu[\s-]*cet\b/i],
];

export function entranceExamsFrom(pages, limit = 12) {
  const relevant = pages.filter((page) => ['admission', 'programmes', 'home'].includes(page.category));
  const found = new Set();
  for (const line of relevant.flatMap((page) => page.lines ?? [])) {
    if (line.length > 400) continue;
    for (const [label, pattern] of EXAM_RULES) if (!found.has(label) && pattern.test(line)) found.add(label);
    if (found.size >= limit) break;
  }
  return EXAM_RULES.map(([label]) => label).filter((label) => found.has(label)).slice(0, limit);
}

// Awards, rankings and recognitions the institution states about itself. Each entry keeps the
// sentence as printed (clipped), so a reader can judge it, and a year when one is given.
// The line must name an award, a rank or an accreditation outright. "Excellence", "honoured" or a
// bare "ranking" alone matched mission statements, welcome notes and faculty bios on real sites.
const AWARD_CUE = /\b(award(ed|s)?|recogni[sz]ed (as|by)|accredited with|conferred|ranked\s+(#|no\.?\s*)?\d|rank(ed)?\s+\d|nirf|naac\s+(a|b)|certificate of (merit|excellence|recognition)|gold medal|best (college|institute|university) award|laureate|patent granted|trophy|winner|first prize|category\s+i\b)\b/i;
const AWARD_NOISE = /apply|admission|download|brochure|click|login|register|enquiry|contact|notice|tender|recruitment|vacanc|result|time ?table|syllabus|fee structure|hostel fee/i;
// Prose that mentions an award in passing: event reports, welcome notes, visions and people's bios.
export const AWARD_PROSE = /\b(i welcome|we welcome|welcome you|our (vision|mission)|to become|aims? to|strives?|striving|celebrat|hosted|conducted|organi[sz]ed|workshop|seminar|webinar|conference|she is|he is|editor|reviewer|dear students)\b/i;
/** The same test the crawler applies, for awards stored before it was tightened. */
export const isCredibleAward = (title) => AWARD_CUE.test(title) && !AWARD_NOISE.test(title) && !AWARD_PROSE.test(title);
const AWARD_YEAR = /\b(19[5-9]\d|20[0-4]\d)\b/;

export function awardsFrom(pages, limit = 12) {
  const relevant = pages.filter((page) => ['about', 'home', 'accreditation', 'placement'].includes(page.category));
  const seen = new Set();
  const awards = [];
  for (const line of relevant.flatMap((page) => page.lines ?? [])) {
    const text = clean(line);
    if (text.length < 25 || text.length > 300) continue;
    if (!AWARD_CUE.test(text) || AWARD_NOISE.test(text) || AWARD_PROSE.test(text) || NEWSY.test(text) || BOILERPLATE.test(text)) continue;
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    const year = Number(AWARD_YEAR.exec(text)?.[1]);
    awards.push({ title: clip(text, 220), year: Number.isInteger(year) && year <= CURRENT_YEAR ? year : null });
    if (awards.length >= limit) break;
  }
  // Most recent first when a year is given; undated entries keep their page order at the end.
  return awards.toSorted((a, b) => (b.year ?? 0) - (a.year ?? 0));
}
