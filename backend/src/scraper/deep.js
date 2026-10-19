// Deep extraction: the facts a student needs to judge an institution — a factual summary, campus
// photographs, programme rows with duration and fee, placement figures, facilities, activities and
// admission details. Pure functions over parsed pages; no network, no database.
//
// Rule for every function here: only report what the page actually prints. Nothing is estimated,
// averaged or inferred from "it usually is". When a value is not on the page it is simply absent.
import { DEGREE_PATTERN } from './india.js';
import { isSameSite, resolveUrl } from './urls.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const CURRENT_YEAR = new Date().getFullYear();
const NEWSY = /notification|corrigendum|notice|tender|circular|walk-?in|advertisement|admit card|merit list|cut-?off|last date|click here|read more|lorem ipsum/i;
const BOILERPLATE = /cookie|copyright|©|all rights reserved|javascript|privacy policy|terms (of|and) (use|conditions)|designed (and|&) (developed|maintained)|powered by/i;

function clip(text, max) {
  const value = clean(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const stop = cut.lastIndexOf('. ');
  return stop > max * 0.4 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

const sentences = (text) => clean(text).split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map(clean).filter(Boolean);

// ---------------------------------------------------------------------------------------------
// About

// A sentence that only sells ("a premier institute with world-class infrastructure") carries no
// fact a student can check, so it is dropped unless it also states something concrete.
const MARKETING = /\b(best|premier|leading|world[\s-]?class|state[\s-]?of[\s-]?the[\s-]?art|renowned|prestigious|dream|bright future|holistic|nurtur\w+|empower\w+|vibrant|excellence|excel|vision|mission|dedicat\w+|commitment|striv\w+|aspir\w+|passion\w*|journey|tomorrow|shaping|transform\w+|ethos|endeavour|quality education|cutting[\s-]?edge)\b/i;
// Deliberately narrow: a bare "established" or "students" appears in any amount of sales copy, so
// only a checkable statement rescues a sentence that is otherwise selling.
const CONCRETE = /\d|\bestablished\s+(in|by|under|as|on)\b|\baffiliated\b|\baccredited\b|\bapproved\b|\brecogni[sz]ed\b|\boffers\b|\bdepartments\b|\bgrant\b|\bfaculty of\b|\bsection\s*\d/i;
const DESCRIBES = /universit|college|institut|campus|establish|found|accredit|affiliat|vidyalaya|vidyapeeth|vidyapith|academy/i;

/**
 * A factual 2–4 sentence summary built from the institution's own about/overview page.
 * @returns {{ about: string, aboutSource: string }} empty strings when nothing usable was found
 */
export function aboutDeep(pages, { maxChars = 1200 } = {}) {
  for (const page of pages) {
    const paragraphs = (page.paragraphs ?? []).filter((text) => text.length >= 80 && !BOILERPLATE.test(text) && !NEWSY.test(text));
    const picked = [];
    for (const paragraph of paragraphs) {
      if (!picked.length && !DESCRIBES.test(paragraph)) continue;
      for (const sentence of sentences(paragraph)) {
        if (sentence.length < 30 || sentence.length > 400) continue;
        if (MARKETING.test(sentence) && !CONCRETE.test(sentence)) continue;
        picked.push(sentence);
        if (picked.length >= 4) break;
      }
      if (picked.length >= 2) break;
    }
    if (picked.length) return { about: clip(picked.join(' '), maxChars), aboutSource: page.url };
    const description = clean(page.head?.description);
    if (description.length >= 80 && !BOILERPLATE.test(description) && DESCRIBES.test(description)) {
      return { about: clip(description, maxChars), aboutSource: page.url };
    }
  }
  return { about: '', aboutSource: '' };
}

// ---------------------------------------------------------------------------------------------
// Campus photographs

const IMAGE_EXT = /\.(jpe?g|png|webp)(\?|$)/i;
const NOT_A_PHOTO = /logo|favicon|icon|sprite|placeholder|avatar|profile|signature|emblem|badge|banner-?ad|advert|\bads?\b|whatsapp|facebook|twitter|instagram|youtube|linkedin|qr[-_]?code|arrow|bullet|spinner|loader|naac|nirf|aicte|\bugc\b|\bnba\b|\biso\b|flag|captcha|swachh|azadi|g20/i;
const PEOPLE = /faculty|staff|principal|chairman|chancellor|director|founder|dean|portrait|headshot|\bteam\b|\bhod\b|\bdr[-_. ]|\bprof[-_. ]|message|speech/i;
const CAMPUS_WORDS = /campus|building|infrastructur|library|laborator|\blabs?\b|hostel|sports|convocation|campus-?life|auditorium|ground|playground|block|academic|facilit|aerial|view|entrance|gate|amphitheat|canteen|cafeteria|workshop|classroom/i;

// Template alt text ("Responsive thumbnail", "image1") describes nothing and must not become a caption.
const EMPTY_ALT = /^(responsive(\s+\w+)?|thumbnail|thumb|image|images?\s*\d*|img\s*\d*|photo\s*\d*|picture|pic\s*\d*|slide\s*\d*|slider|banner|gallery|no[\s-]?image|placeholder|untitled|dsc[\s_-]?\d+|\d+)$/i;
const captionOf = (alt) => (EMPTY_ALT.test(clean(alt)) ? '' : clean(alt));

/**
 * Campus/building/facility images on the institution's own domain, best first, for the image
 * pipeline to download and verify. Dimensions printed in the markup are used to reject small or
 * banner-shaped images early; the real pixels are checked again after download.
 */
export function galleryCandidates(pages, { domain, limit = 24, minWidth = 480, minHeight = 320 } = {}) {
  const seen = new Set();
  const found = [];
  for (const page of pages) {
    for (const image of page.images ?? []) {
      const url = resolveUrl(image.src, page.url);
      if (!url || !isSameSite(url, domain)) continue;
      const href = url.toString();
      if (href.length > 500 || seen.has(href)) continue;
      const path = decodeURIComponent(url.pathname);
      if (!IMAGE_EXT.test(path) && !IMAGE_EXT.test(href)) continue;
      const haystack = `${path} ${image.alt} ${image.hint}`;
      if (NOT_A_PHOTO.test(haystack) || PEOPLE.test(haystack)) continue;
      // Only trust the markup when it gives both dimensions.
      if (image.width && image.height) {
        const ratio = image.width / image.height;
        if (image.width < minWidth || image.height < minHeight || ratio < 1.2 || ratio > 2.4) continue;
      }
      seen.add(href);
      const score = (CAMPUS_WORDS.test(haystack) ? 5 : 0) + (/gallery|photos?|media/i.test(path) ? 3 : 0)
        + (page.category === 'campus' ? 4 : page.category === 'about' ? 2 : 0) + (image.alt ? 1 : 0);
      found.push({ url: href, caption: clip(captionOf(image.alt), 160), sourcePage: page.url, score });
    }
  }
  return found.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Programmes, duration and fees

const LEVEL_RULES = [
  ['PhD', /\b(ph\.?\s?d|d\.?\s?phil|doctor(al|ate))\b/i],
  ['Diploma', /\b(diploma|certificate|polytechnic)\b/i],
  ['PG', /\b(m\.?\s?(tech|e|sc|a|com|ba|ca|s|d|phil|pharm|des|ed|lib)|master|mba|mca|mbbs\s*\+|post[\s-]?graduate|\bpg\b|ll\.?\s?m|m\.?s\.?\s?w)\b/i],
  ['UG', /\b(b\.?\s?(tech|e|sc|a|com|ba|ca|arch|des|ed|pharm|pt|ds|hm|lib)|bachelor|bba|bca|mbbs|bds|bams|bhms|ll\.?\s?b|under[\s-]?graduate|\bug\b|integrated)\b/i],
];
export const levelOf = (name) => LEVEL_RULES.find(([, pattern]) => pattern.test(name))?.[0] ?? '';

const MONEY = /(?:₹|rs\.?|inr)\s*([\d][\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k)?\b/i;
const PER_YEAR = /per\s*(year|annum|an\b)|\bp\.?\s?a\.?\b|annual|yearly|\/\s*(year|yr|annum)|1st\s*year|first\s*year/i;
const NOT_PER_YEAR = /semester|month|\bterm\b|total\s*(course\s*)?fee|entire\s*(course|programme|program)|hostel|mess|caution|security|refundable|one[\s-]?time|registration|application\s*fee|exam(ination)?\s*fee/i;

/** Rupees from "₹1,25,000", "Rs. 1.25 Lakh", "INR 2.5 L". Returns null when the text has no amount. */
export function rupeesIn(text) {
  const match = MONEY.exec(String(text ?? ''));
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (match[2] ?? '').toLowerCase();
  const scale = /^(lakh|lac)/.test(unit) ? 100_000 : /^(crore|cr)/.test(unit) ? 10_000_000 : unit === 'k' ? 1000 : 1;
  const value = Math.round(amount * scale);
  return value >= 1000 && value <= 10_000_000 ? value : null;
}

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

/**
 * Programme rows from fee/course tables, falling back to the plain programme names found by
 * `programmesFrom`. A fee is kept only when the same row prints an unambiguous per-year rupee
 * amount; anything else is copied into `feeNote` verbatim so a reviewer can read what the page said.
 */
export function programmeRows(pages, fallbackNames = [], { limit = 60 } = {}) {
  const byKey = new Map();
  const add = (row) => {
    const name = clip(row.name, 160);
    const key = fold(name);
    if (!key || key.length < 2 || byKey.size >= limit) return;
    const existing = byKey.get(key);
    if (existing) {
      for (const field of ['level', 'durationYears', 'annualFeeInr', 'feeNote']) if (existing[field] === undefined && row[field] !== undefined) existing[field] = row[field];
      return;
    }
    byKey.set(key, { ...row, name });
  };

  for (const page of pages) {
    for (const table of page.tables ?? []) {
      const headers = table.headers.map((cell) => cell.toLowerCase());
      const headerSaysYear = headers.some((cell) => PER_YEAR.test(cell));
      const headerSaysOther = headers.some((cell) => NOT_PER_YEAR.test(cell) && !PER_YEAR.test(cell));
      for (const cells of table.rows) {
        const nameCell = cells.find((cell) => cell.length >= 2 && cell.length <= 160 && DEGREE_PATTERN.test(cell) && !NOT_A_PROGRAMME.test(cell));
        if (!nameCell) continue;
        const rest = cells.filter((cell) => cell !== nameCell);
        const row = { name: nameCell, sourcePage: page.url };
        const level = levelOf(nameCell);
        if (level) row.level = level;
        const duration = rest.map(durationIn).find((value) => value !== null) ?? durationIn(nameCell);
        if (duration !== null && duration !== undefined) row.durationYears = duration;
        for (const [column, cell] of rest.entries()) {
          const amount = rupeesIn(cell);
          if (amount === null) continue;
          const context = `${cell} ${headers[cells.indexOf(cell)] ?? ''} ${headers[column] ?? ''}`;
          const perYear = PER_YEAR.test(context) || (headerSaysYear && !NOT_PER_YEAR.test(cell));
          if (perYear && !(NOT_PER_YEAR.test(cell) && !PER_YEAR.test(cell)) && !headerSaysOther) row.annualFeeInr = amount;
          else row.feeNote = clip(cell, 160);
          break;
        }
        add(row);
      }
    }
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

const LPA = /(\d{1,3}(?:\.\d{1,2})?)\s*(lpa|lakhs?\s*(?:per\s*annum|p\.?a\.?)?|lacs?|crores?|cr\b|l\.?p\.?a)/i;
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
const NOT_A_COMPANY = /\b(drive|session|programme|program|visit|training|workshop|seminar|ceremony|celebration|day|week|year|batch|gif|jpe?g|png|photo|image|picture|slide|students?|campus|college|university|institute|school|department)\b/i;

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
  for (const line of lines) {
    if (result.averagePackageLpa === undefined) {
      const value = packageIn(line, /\b(average|avg\.?|mean)\s*(ctc|package|salary|pay)?/i);
      if (value !== null) result.averagePackageLpa = value;
    }
    if (result.highestPackageLpa === undefined) {
      const value = packageIn(line, /\b(highest|maximum|max\.?|top)\s*(ctc|package|salary|pay|offer)?/i);
      if (value !== null) result.highestPackageLpa = value;
    }
    if (result.medianPackageLpa === undefined) {
      const value = packageIn(line, /\bmedian\s*(ctc|package|salary|pay)?/i);
      if (value !== null) result.medianPackageLpa = value;
    }
    if (result.placedPercent === undefined) {
      const match = /(\d{1,3}(?:\.\d)?)\s*%\s*(?:of\s*(?:the\s*)?(?:eligible\s*)?students\s*)?(?:were\s*|got\s*|are\s*)?(?:placed|placement)/i.exec(line)
        ?? /\bplace(?:d|ment)\b[^.\n%]{0,40}?(\d{1,3}(?:\.\d)?)\s*%/i.exec(line);
      const percent = match && Number(match[1]);
      if (percent !== null && percent !== undefined && percent > 0 && percent <= 100) result.placedPercent = percent;
    }
    if (result.year === undefined) {
      const match = /(?:placement|batch|session|academic\s*year|drive|year)[^.\n]{0,30}?\b(20[12]\d)\b(?:\s*[-–/]\s*(?:20)?\d{2})?/i.exec(line)
        ?? /\b(20[12]\d)\s*[-–]\s*(?:20)?\d{2}\b[^.\n]{0,30}(?:placement|batch)/i.exec(line);
      const year = match && Number(match[1]);
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
const AWARD_CUE = /\b(award(ed|s)?|honou?red|recogni[sz]ed|accredited with|conferred|felicitated|rank(ed|ing)?|ranked\s+\d|certificate of|gold medal|best (college|institute|university|teacher)|excellence|laureate|patent granted|trophy|winner|first prize|category\s+i\b)\b/i;
const AWARD_NOISE = /apply|admission|download|brochure|click|login|register|enquiry|contact|notice|tender|recruitment|vacanc|result|time ?table|syllabus|fee structure|hostel fee/i;
const AWARD_YEAR = /\b(19[5-9]\d|20[0-4]\d)\b/;

export function awardsFrom(pages, limit = 12) {
  const relevant = pages.filter((page) => ['about', 'home', 'accreditation', 'placement'].includes(page.category));
  const seen = new Set();
  const awards = [];
  for (const line of relevant.flatMap((page) => page.lines ?? [])) {
    const text = clean(line);
    if (text.length < 25 || text.length > 300) continue;
    if (!AWARD_CUE.test(text) || AWARD_NOISE.test(text) || NEWSY.test(text) || BOILERPLATE.test(text)) continue;
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
