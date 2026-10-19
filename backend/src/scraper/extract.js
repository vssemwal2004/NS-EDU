import { parse } from 'node-html-parser';
import { foldText } from '../modules/universities/normalize.js';
import { INSTITUTION_CATEGORIES, INSTITUTION_TYPES, NAAC_GRADES } from '../modules/universities/schema.js';
import { APPROVAL_RULES, DEGREE_PATTERN, STREAM_RULES, canonicalState, stateFromPin, statesIn } from './india.js';
import { isSameSite, resolveUrl } from './urls.js';

// Pure extraction: HTML string in, facts out. No network, no database.
const CURRENT_YEAR = new Date().getFullYear();
const ORG_TYPES = ['CollegeOrUniversity', 'EducationalOrganization', 'School', 'Organization'];
const SKIP_EXTENSIONS = /\.(pdf|jpe?g|png|gif|svg|webp|ico|zip|rar|7z|docx?|xlsx?|pptx?|csv|mp4|mp3|avi|mov)$/i;
const PRIVATE_SECTIONS = /faculty-?(list|members?|profiles?|directory)|staff|people|our-?team|alumni|login|sign-?in|portal|erp|lms|webmail|tender|careers?|jobs?|recruit|vacanc|news|events?|gallery|blog|notices?|circulars?|results?|download/i;
const PERSONAL_TITLE = /(?:^|[\s,(])(Dr|Prof|Mr|Mrs|Ms|Miss|Shri|Smt|Sh|Er)\.?\s+[A-Z]/;
const GENERIC_MAILBOX = /^(info|information|contact|contactus|enquiry|enquiries|inquiry|inquiries|admissions?|admission\.?cell|admissions?\.?office|registrar|registry|office|mail|helpdesk|reception|academics?|admin|query|queries)\d*$/i;
// 6-digit PIN, also written "400 076"; never a run of digits inside a phone number.
const PIN_RE = /(?<![\d+])(?<![\d+][\s-])([1-9]\d{2})\s?(\d{3})(?![\d-])(?!\s?\d)/;
const NEWS = /notification|corrigendum|notice|regarding|amendment|empanel|circular|tender|dated|seminar|webinar|conference|workshop|last date|extension|extention|registration|walk-?in|advertisement|recruitment|result|merit list|cut-?off|admit card|click here|read more/i;
const pinOf = (text) => { const match = PIN_RE.exec(text); return match ? `${match[1]}${match[2]}` : ''; };
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
// Malformed %-escapes are common in real hrefs and must not abort a crawl.
const decode = (text) => { try { return decodeURIComponent(text); } catch { return text; } };

export const LINK_CATEGORIES = [
  ['contact', /contact|reach-?us|find-?us|how-?to-?reach/i],
  ['about', /about|overview|profile|history|introduction|who-?we-?are|at-?a-?glance/i],
  ['admission', /admission|how-?to-?apply|apply-?now/i],
  ['programmes', /programmes?|programs?|courses?|academics?|degrees?|departments?|schools?|faculty-of|disciplines/i],
  ['accreditation', /naac|nirf|accreditation|approvals?|recognitions?|rankings?|iqac|mandatory-?disclosure|aicte|ugc/i],
];

// ---------------------------------------------------------------------------------------------
// Parsing

function jsonLdNodes(root) {
  const nodes = [];
  const visit = (value) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value['@graph'])) value['@graph'].forEach(visit);
    if (value['@type']) nodes.push(value);
  };
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try { visit(JSON.parse(script.rawText.trim().replace(/^<!\[CDATA\[|\]\]>$/g, ''))); } catch { /* invalid JSON-LD is common; ignore it */ }
  }
  return nodes;
}

const typesOf = (node) => [node['@type']].flat().map(String);
const textOf = (value) => (typeof value === 'string' ? clean(value) : Array.isArray(value) ? textOf(value[0]) : '');
const urlOf = (value) => (typeof value === 'string' ? value : value && typeof value === 'object' ? urlOf(value.url ?? value.contentUrl ?? value['@id']) : '');

function organizationOf(nodes) {
  for (const type of ORG_TYPES) {
    const match = nodes.find((node) => typesOf(node).includes(type) && textOf(node.name));
    if (match) return match;
  }
  return null;
}

function postalAddressOf(org) {
  const address = [org?.address].flat()[0];
  if (!address) return null;
  if (typeof address === 'string') return { text: clean(address) };
  return {
    street: textOf(address.streetAddress), locality: textOf(address.addressLocality), region: textOf(address.addressRegion),
    postalCode: textOf(address.postalCode).replace(/\s/g, ''),
  };
}

export function parsePage(html, pageUrl) {
  const root = parse(String(html ?? ''), { comment: false });
  const jsonLd = jsonLdNodes(root);
  const meta = (selector) => clean(root.querySelector(selector)?.getAttribute('content'));
  const head = {
    title: clean(root.querySelector('title')?.text),
    siteName: meta('meta[property="og:site_name"]'),
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    ogImage: meta('meta[property="og:image"]'),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
    touchIcon: root.querySelector('link[rel~="apple-touch-icon"]')?.getAttribute('href') ?? root.querySelector('link[rel="apple-touch-icon-precomposed"]')?.getAttribute('href') ?? '',
  };
  const links = root.querySelectorAll('a[href]').map((anchor) => ({ href: anchor.getAttribute('href'), text: clean(anchor.text) || clean(anchor.getAttribute('title')), node: anchor }));
  const logoImages = root.querySelectorAll('img').filter((img) => !/naac|nirf|ugc|aicte|partner|accredit|award|sponsor|recruit/i.test(`${img.getAttribute('src') ?? ''} ${img.getAttribute('alt') ?? ''}`) && /logo/i.test(`${img.getAttribute('src') ?? ''} ${img.getAttribute('alt') ?? ''} ${img.getAttribute('class') ?? ''} ${img.getAttribute('id') ?? ''}`))
    .map((img) => img.getAttribute('src') || img.getAttribute('data-src') || '').filter(Boolean);
  for (const node of root.querySelectorAll('script, style, noscript, template, svg, iframe')) node.remove();
  const body = root.querySelector('body') ?? root;
  const lines = body.structuredText.split('\n').map(clean).filter(Boolean);
  const shortTexts = body.querySelectorAll('li, td, th, a, option, h2, h3, h4, h5, h6, strong, dt, dd, p, span')
    .map((node) => clean(node.text)).filter((text) => text.length >= 2 && text.length <= 140);
  const headings = body.querySelectorAll('h1, h2, h3, h4, nav a, header a').map((node) => clean(node.text)).filter((text) => text.length <= 120);
  const paragraphs = body.querySelectorAll('p').map((node) => clean(node.text));
  return { url: pageUrl, jsonLd, organization: organizationOf(jsonLd), head, links, logoImages, lines, shortTexts, headings, paragraphs };
}

// ---------------------------------------------------------------------------------------------
// Links

export function pickLinks(page, { domain, maxLinks, exclude = [] }) {
  const keyOf = (url) => url.toString().replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  const seen = new Set(exclude.map(keyOf));
  const candidates = [];
  for (const link of page.links) {
    const url = resolveUrl(link.href, page.url);
    if (!url || !isSameSite(url, domain) || SKIP_EXTENSIONS.test(url.pathname)) continue;
    // Query strings route pages on many CMS sites (index.php?page=contact); tracking parameters do not.
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|lang$)/i.test(key)) url.searchParams.delete(key);
    if (url.search.length > 120) continue;
    const key = keyOf(url);
    if (seen.has(key)) continue;
    const haystack = `${decode(url.pathname + url.search).replace(/[_/=&?]+/g, '-')} ${link.text}`;
    if (PRIVATE_SECTIONS.test(haystack)) continue;
    const category = LINK_CATEGORIES.find(([, pattern]) => pattern.test(haystack))?.[0];
    if (!category) continue;
    seen.add(key);
    const depth = url.pathname.split('/').filter(Boolean).length;
    const score = 10 - Math.min(depth, 6) + (LINK_CATEGORIES.find(([name]) => name === category)[1].test(link.text) ? 3 : 0);
    candidates.push({ url: url.toString(), category, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  const chosen = [];
  for (const [category] of LINK_CATEGORIES) {
    const best = candidates.find((candidate) => candidate.category === category);
    if (best) chosen.push(best);
  }
  for (const candidate of candidates) if (!chosen.includes(candidate)) chosen.push(candidate);
  return chosen.slice(0, maxLinks);
}

// ---------------------------------------------------------------------------------------------
// Facts

export function nameFrom(page) {
  const org = textOf(page.organization?.name);
  if (org) return org;
  if (page.head.siteName && page.head.siteName.length >= 4) return page.head.siteName;
  const parts = page.head.title.replace(/^welcome\s+to\s+(the\s+)?/i, '').split(/\s[|–—:-]\s|\s\|\s?|\s?\|\s/).map(clean)
    .filter((part) => part && !/^(home|homepage|official website|welcome)$/i.test(part));
  return parts.find((part) => /universit|college|institut|vidyalaya|vidyapeeth|vidyapith|academy|school|iit|nit|iiit|aiims/i.test(part)) ?? parts[0] ?? '';
}

export function inferType(name) {
  const text = String(name);
  const category = /deemed[\s-]+(to[\s-]+be[\s-]+)?universit/i.test(text) ? 'deemed-university'
    : /central\s+universit/i.test(text) ? 'central-university'
      : /indian institute of (technology|management|science)|all india institute of medical/i.test(text) ? 'institute-of-national-importance' : '';
  const type = /universit|vishwavidyalaya|vishwavidyalay|vidyapeeth|vidyapith/i.test(text) ? 'university'
    : /college|mahavidyalaya/i.test(text) ? 'college' : /institut|academy|school/i.test(text) ? 'institute' : '';
  return { type: INSTITUTION_TYPES.includes(type) ? type : '', category: INSTITUTION_CATEGORIES.includes(category) ? category : '' };
}

export function establishedYearFrom(lines) {
  for (const line of lines) {
    const match = /\b(?:established|estd|est|founded|inception|set up)\b\.?[^.\d]{0,32}?\b(1[89]\d{2}|20[0-2]\d)\b/i.exec(line);
    const year = match && Number(match[1]);
    if (year && year >= 1800 && year <= CURRENT_YEAR) return year;
  }
  return null;
}

export function naacGradeFrom(lines) {
  for (const line of lines) {
    for (const hit of line.matchAll(/NAAC/gi)) {
      const window = line.slice(Math.max(0, hit.index - 80), hit.index + 120);
      const grade = /(?<![\w+])(A\+\+|A\+|B\+\+|B\+)(?![\w+])/.exec(window)?.[1]
        ?? /[Gg]rad(?:e|ing)\s*(?:of\s*)?[:\-–]?\s*["'‘’“”(]?\s*(A|B|C)(?![\w+])/.exec(window)?.[1]
        ?? /["'‘“(]\s*(A|B|C)\s*["'’”)]/.exec(window)?.[1]
        ?? /(?<![\w+])(A|B|C)\s+[Gg]rade/.exec(window)?.[1];
      if (grade && NAAC_GRADES.includes(grade)) return grade;
    }
  }
  return '';
}

export function nirfFrom(lines) {
  for (const line of lines) {
    if (!/NIRF/i.test(line)) continue;
    const match = /NIRF[^.;\n]{0,80}?(?:\brank(?:ed|ing)?\b|#|\bno\.)\s*(?:of\s*)?#?\s*(\d{1,4})(?:st|nd|rd|th)?\b/i.exec(line)
      ?? /(?:\brank(?:ed)?\b|#)\s*#?\s*(\d{1,4})(?:st|nd|rd|th)?\b[^.;\n]{0,60}?NIRF/i.exec(line);
    const rank = match && Number(match[1]);
    if (!rank || rank < 1 || rank > 1000) continue;
    const window = line.slice(Math.max(0, match.index - 30), match.index + match[0].length + 40);
    const years = [...window.matchAll(/\b(20(?:1[6-9]|[2-9]\d))\b/g)].map((item) => Number(item[1])).filter((year) => year <= CURRENT_YEAR);
    return { nirfRank: rank, nirfYear: years.length ? Math.max(...years) : null };
  }
  return { nirfRank: null, nirfYear: null };
}

export function approvalsFrom(lines) {
  const found = new Set();
  for (const line of lines) {
    for (const sentence of line.split(/(?<=\.)\s+/)) {
      if (sentence.length > 400 || !/approv|recogni[sz]|accredit|affiliat|2\s*\(\s*f\s*\)|12\s*\(\s*b\s*\)|statutory|member of/i.test(sentence)) continue;
      for (const [body, pattern] of APPROVAL_RULES) if (pattern.test(sentence)) found.add(body);
    }
  }
  return APPROVAL_RULES.map(([body]) => body).filter((body) => found.has(body));
}

const NOT_A_PROGRAMME = /admission|fee|syllabus|result|notice|brochure|apply|download|scholarship|time ?table|exam|calendar|eligibility|placement|alumni|seats?\b|merit|list\b|counsel|cut-?off|schedule|notification|\blast date|form\b|prospectus|guideline|ranking|news|life cycle/i;
export function programmesFrom(texts, limit = 200) {
  const seen = new Set();
  const programmes = [];
  for (const raw of texts) {
    const text = clean(raw).replace(/(?<=[a-z)])New$/, '').replace(/[\s:–—-]+$/, '');
    if (text.length < 2 || text.length > 140 || !DEGREE_PATTERN.test(text) || NOT_A_PROGRAMME.test(text)) continue;
    const key = foldText(text);
    if (seen.has(key)) continue;
    seen.add(key);
    programmes.push(text.slice(0, 160));
    if (programmes.length >= limit) break;
  }
  return programmes;
}

export function streamsFrom(texts) {
  const found = new Set();
  for (const text of texts) {
    for (const [stream, patterns] of STREAM_RULES) if (!found.has(stream) && patterns.some((pattern) => pattern.test(text))) found.add(stream);
  }
  return STREAM_RULES.map(([stream]) => stream).filter((stream) => found.has(stream));
}

// A catalogue course matches when the programme name starts with its name or full name, ignoring
// dots and spacing: "B. Tech (CSE)" and "Bachelor of Technology" both match B.Tech.
const tokens = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
export function matchCourseSlugs(programmes, courses, limit = 60) {
  const keys = courses.flatMap((course) => [course.name, course.fullName].map((text) => tokens(text).join('')).filter((key) => key.length >= 2).map((key) => ({ slug: course.slug, key })));
  const slugs = new Set();
  for (const programme of programmes) {
    const words = tokens(programme);
    for (const { slug, key } of keys) {
      let prefix = '';
      for (const word of words) {
        prefix += word;
        if (prefix === key) { slugs.add(slug); break; }
        if (prefix.length >= key.length) break;
      }
    }
  }
  return [...slugs].slice(0, limit);
}

// Postal address: the block around a PIN code that names a state/UT. With `pinState` (contact and
// about pages) the state may instead come from the PIN's postal circle. News items never qualify.
export function addressFrom(lines, { pinState = false } = {}) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length > 220 || !PIN_RE.test(line) || NEWS.test(line) || /["“”]|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(line)
      || /@|https?:|\b(tel|phone|mobile|fax)\b/i.test(line.replace(PIN_RE, ''))) continue;
    const parts = [line];
    for (let back = index - 1; back >= Math.max(0, index - 3); back -= 1) {
      const previous = lines[back];
      if (previous.length > 90 || NEWS.test(previous) || /@|https?:|\d{7,}|^(contact|address|reach us|get in touch|contact us|location)\b|\b(map|directions)\b/i.test(previous) || PERSONAL_TITLE.test(previous)) break;
      if (/:$/.test(previous)) break;
      parts.unshift(previous);
    }
    const next = lines[index + 1];
    if (next && next.length < 40 && statesIn(next).length && !statesIn(parts.join(' ')).length) parts.push(next);
    const text = clean(parts.join(', ').replace(/,\s*,/g, ',').replace(/^.*\b(?:mailing |postal |campus |correspondence )?address\s*[:-]\s*/i, ''));
    const pincode = pinOf(text);
    const state = statesIn(text)[0] || (pinState ? stateFromPin(pincode) : '');
    if (!state || PERSONAL_TITLE.test(text)) continue;
    return { address: text.slice(0, 400), pincode, state };
  }
  return null;
}

const ADDRESS_WORDS = /\b(road|rd|marg|street|st|lane|sector|phase|near|opp|opposite|post|p\.?\s?o|campus|block|floor|building|highway|nh|colony|village|vill|tehsil|teh|plot|survey|no|bypass|chowk|gate)\b/i;
const CITY_STATES = new Set(['Delhi', 'Chandigarh', 'Puducherry']);
export function cityFromAddress(address, state) {
  // The part carrying the PIN usually names the city: "Dehradun - 248001", "Mumbai 400 076".
  const pinPart = String(address).split(',').find((part) => PIN_RE.test(part));
  const nearPin = clean((pinPart ?? '').replace(PIN_RE, ' ').replace(/\bIndia\b|\b(pin|pin\s?code|pincode)\b/gi, ' ').replace(/[^A-Za-z .()]/g, ' ')).replace(/\.$/, '');
  const named = canonicalState(nearPin);
  if (nearPin.length >= 3 && nearPin.length <= 40 && !ADDRESS_WORDS.test(nearPin) && (!named || CITY_STATES.has(named))) return named || nearPin;
  let text = ` ${address} `.replace(new RegExp(PIN_RE.source, 'g'), ' ').replace(/\bIndia\b/gi, ' ').replace(/\b(pin|pin\s?code|pincode)\b\s*[:.-]?/gi, ' ');
  for (const name of [state, ...statesIn(address)].filter(Boolean)) text = text.replace(new RegExp(name.replace(/\s+/g, '\\s+'), 'gi'), ' ');
  const parts = text.split(/,|\n|\s[-–]\s|\s[-–]|[-–]\s/).map((part) => part.replace(/[^A-Za-z .()]/g, ' ').replace(/\s+/g, ' ').trim())
    .map((part) => part.replace(/^(dist|distt|district)\.?\s+/i, '').replace(/\.$/, ''))
    .filter((part) => part.length >= 3 && part.length <= 40);
  const city = parts.at(-1) ?? '';
  return city && !ADDRESS_WORDS.test(city) ? city : '';
}

export function emailFrom(page, domain) {
  const candidates = [
    ...page.links.filter((link) => /^mailto:/i.test(link.href)).map((link) => ({ email: decode(link.href.slice(7).split('?')[0]), context: clean(link.node.parentNode?.text) })),
    ...page.lines.flatMap((line) => [...line.matchAll(/[A-Z0-9._%+-]+(?:\s?(?:@|\[at\]|\(at\))\s?)[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => ({ email: match[0].replace(/\s?(\[at\]|\(at\))\s?/i, '@').replace(/\s/g, ''), context: line }))),
  ];
  // Mailboxes on the main domain beat those of departments on sub-domains.
  let fallback = '';
  for (const { email, context } of candidates) {
    const [local, host] = email.trim().toLowerCase().split('@');
    if (!local || !host || PERSONAL_TITLE.test(context ?? '') || !GENERIC_MAILBOX.test(local)) continue;
    if (host === domain || host === `www.${domain}`) return `${local}@${host}`;
    if (host.endsWith(`.${domain}`)) fallback ||= `${local}@${host}`;
  }
  return fallback;
}

const PHONE_RE = /(?:\+?91[\s-]?)?(?:\(?0?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}|1800[\s-]?\d{3}[\s-]?\d{3,4}/;
const tidyPhone = (value) => {
  const text = clean(value).replace(/[^\d+()\s-]/g, '').trim();
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 ? text.slice(0, 40) : '';
};
export function phoneFrom(page) {
  const fromOrg = tidyPhone(textOf(page.organization?.telephone));
  if (fromOrg) return fromOrg;
  for (const link of page.links) {
    if (!/^tel:/i.test(link.href)) continue;
    const context = clean(link.node.parentNode?.text);
    if (PERSONAL_TITLE.test(context)) continue;
    const phone = tidyPhone(decode(link.href.slice(4)));
    if (phone) return phone;
  }
  for (const line of page.lines) {
    if (line.length > 160 || !/\b(phone|tel|telephone|call|helpline|toll[\s-]?free|landline|enquiry)\b/i.test(line) || PERSONAL_TITLE.test(line)) continue;
    const phone = tidyPhone(PHONE_RE.exec(line.replace(/^.*?(phone|tel|telephone|call|helpline|toll[\s-]?free|landline|enquiry)\b\s*(no\.?|number)?\s*[:.-]?/i, ''))?.[0]);
    if (phone) return phone;
  }
  return '';
}

export function logoFrom(page) {
  const candidates = [urlOf(page.organization?.logo), ...page.logoImages, page.head.touchIcon, page.head.ogImage];
  for (const candidate of candidates) {
    const url = candidate && resolveUrl(candidate, page.url);
    if (url && url.toString().length <= 500) return url.toString();
  }
  return '';
}

export function summarize(text, max = 600) {
  const value = clean(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const sentenceEnd = cut.lastIndexOf('. ');
  return sentenceEnd > max * 0.5 ? cut.slice(0, sentenceEnd + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

const BOILERPLATE = /cookie|copyright|©|all rights reserved|javascript|lorem ipsum|click here/i;
const DESCRIBES_INSTITUTION = /universit|college|institut|establish|found|accredit|campus|vidyalaya|vidyapeeth/i;
// Home pages are mostly news and banners, so only their meta description is used.
export function aboutFrom(page, { paragraphs = true } = {}) {
  const paragraph = paragraphs && page.paragraphs.find((text) => text.length >= 150 && DESCRIBES_INSTITUTION.test(text) && !BOILERPLATE.test(text) && !NEWS.test(text));
  const description = page.head.description.length >= 60 && !BOILERPLATE.test(page.head.description) ? page.head.description : '';
  return summarize(description || paragraph || '');
}

export function admissionUrlFrom(pages, domain) {
  let best = null;
  for (const page of pages) {
    for (const link of page.links) {
      const url = resolveUrl(link.href, page.url);
      if (!url || !isSameSite(url, domain) || SKIP_EXTENSIONS.test(url.pathname)) continue;
      const inPath = /admission/i.test(url.pathname) || /admission/i.test(url.hostname.split('.')[0]);
      if ((!inPath && !/admission/i.test(link.text)) || (url.pathname === '/' && !inPath) || NEWS.test(link.text)) continue;
      const score = (inPath ? 5 : 0) + (/admission/i.test(link.text) ? 2 : 0) + (/admissions?\/?$/i.test(url.pathname) ? 3 : 0)
        - (url.search ? 4 : 0) - (/news|detail|article|notice/i.test(url.toString()) ? 5 : 0) - (/login|sign-?in|exam|result|form/i.test(url.pathname) ? 6 : 0)
        - (/\s|list|schedule|merit/i.test(decode(url.pathname)) ? 6 : 0) - (/\bold|archive|covid/i.test(url.hostname + url.pathname) ? 5 : 0) - url.pathname.split('/').length;
      if (score > 0 && (!best || score > best.score)) best = { url: url.toString(), score };
    }
  }
  return best?.url ?? '';
}

// ---------------------------------------------------------------------------------------------
// Merge

/**
 * Builds one institution record from the crawled pages of a source.
 * Seed values (name, state, city, type, category) win over guesses from the page; `fields`
 * lists what the crawl itself contributed.
 * @param {{ home: object, pages: object[], source: object, domain: string, website: string, courses?: object[] }} input
 */
export function buildRecord({ home, pages, source, domain, website, courses = [] }) {
  const all = [home, ...pages];
  const byCategory = (category) => pages.filter((page) => page.category === category);
  const prefer = (categories) => [...categories.flatMap(byCategory), home, ...pages];
  const lines = (categories) => prefer(categories).flatMap((page) => page.lines);
  const facts = {};

  const siteName = nameFrom(home);
  facts.name = siteName;
  const org = all.map((page) => page.organization).find(Boolean);
  const postal = postalAddressOf(org);
  const pageLines = (category) => byCategory(category).flatMap((page) => page.lines);
  const address = addressFrom(pageLines('contact'), { pinState: true }) ?? addressFrom(pageLines('about'), { pinState: true }) ?? addressFrom(home.lines);
  facts.state = canonicalState(postal?.region) || address?.state || '';
  facts.address = postal?.street ? clean([postal.street, postal.locality, postal.region, postal.postalCode].filter(Boolean).join(', ')) : address?.address ?? '';
  facts.pincode = /^\d{6}$/.test(postal?.postalCode ?? '') ? postal.postalCode : address?.pincode ?? '';
  facts.city = postal?.locality || (facts.address ? cityFromAddress(facts.address, facts.state) : '');
  facts.establishedYear = establishedYearFrom(lines(['about']));
  facts.naacGrade = naacGradeFrom(lines(['accreditation', 'about']));
  Object.assign(facts, nirfFrom(lines(['accreditation', 'about'])));
  facts.approvals = approvalsFrom(lines(['accreditation', 'about']));
  facts.coursesOffered = programmesFrom(prefer(['programmes', 'admission']).flatMap((page) => page.shortTexts));
  facts.streams = streamsFrom([...facts.coursesOffered, ...all.flatMap((page) => page.headings)]);
  facts.courseSlugs = matchCourseSlugs(facts.coursesOffered, courses);
  facts.logoUrl = logoFrom(home);
  const aboutPage = byCategory('about')[0];
  facts.about = (aboutPage && aboutFrom(aboutPage)) || aboutFrom(home, { paragraphs: false });
  facts.admissionUrl = admissionUrlFrom(all, domain);
  facts.email = prefer(['contact', 'admission']).map((page) => emailFrom(page, domain)).find(Boolean) ?? '';
  facts.phone = prefer(['contact', 'admission']).map(phoneFrom).find(Boolean) ?? '';
  const fromSeed = inferType(source.name);
  const fromSite = inferType(siteName);
  const inferred = { type: fromSeed.type || fromSite.type, category: fromSeed.category || fromSite.category };

  const record = {
    name: clean(source.name) || siteName,
    website,
    type: source.type || inferred.type,
    category: source.category || inferred.category,
    state: canonicalState(source.state) || facts.state,
    city: clean(source.city) || facts.city,
  };
  if (siteName && source.name && foldText(siteName) !== foldText(source.name) && siteName.length <= 200) record.aliases = [siteName];
  for (const key of ['address', 'pincode', 'establishedYear', 'naacGrade', 'nirfRank', 'nirfYear', 'approvals', 'streams', 'courseSlugs', 'coursesOffered', 'logoUrl', 'about', 'admissionUrl', 'email', 'phone']) {
    record[key] = facts[key];
  }
  const filled = (value) => !(value === '' || value === null || value === undefined || (Array.isArray(value) && !value.length));
  const fields = Object.keys(facts).filter((key) => filled(facts[key]) && (key !== 'name' || !source.name) && (key !== 'state' || !canonicalState(source.state)) && (key !== 'city' || !clean(source.city)));
  for (const key of Object.keys(record)) if (!filled(record[key])) delete record[key];
  return { record, fields: ['website', ...fields], siteName };
}
