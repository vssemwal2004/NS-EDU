import { formatCount, hostOf, kindOf, lakhRange, nirfPairs, ownershipOf, placeOf, shortDate, usableAbout } from '@/features/universities/labels';

// Builds the /compare board from /api/universities/:slug payloads. Rules, in order of importance:
//  1. Nothing is invented. A field the record does not carry renders as "Not published".
//  2. NAAC / NIRF / AICTE / UGC / NBA values come from a dated directory snapshot, never from
//     Gyaan Vidhya, and are always shown with that provenance.
//  3. A champagne "best" mark is only set where the comparison is honest: same metric, same data
//     year, same kind of data (all real or all illustrative), at least two values, and they differ.

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const list = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
const first = (...values) => values.find((value) => value != null && value !== '') ?? null;
const joinMax = (items, max) => (items.length > max ? `${items.slice(0, max).join(' · ')} +${items.length - max} more` : items.join(' · '));
const lpa = (value) => `₹${Number(value.toFixed(2))} LPA`;
const pct = (value) => `${Number(value.toFixed(1))}%`;

const MISSING = { missing: true };
const cell = (value, extra = {}) => (value ? { value, ...extra } : { ...MISSING, ...(extra.note ? { note: extra.note } : {}) });

// ---------------------------------------------------------------------------------------------
// Per-institution readers. Every optional sub-document is read defensively: the directory snapshot
// and the scraped campus/placement blocks land on the record later, and the board lights up then.

const yearLabel = (value) => {
  const year = text(value) || (num(value) ? String(num(value)) : '');
  return year || '';
};

function feeFacts(detail) {
  const offered = (Array.isArray(detail.item?.programmesOffered) ? detail.item.programmesOffered : [])
    // Scraped programme rows carry no fee year; the board then says so instead of guessing one.
    .map((row) => ({ fee: num(row?.annualFeeInr), year: '' }))
    .filter((row) => row.fee != null);
  const curated = (Array.isArray(detail.programmes) ? detail.programmes : [])
    .map((row) => ({ fee: num(row?.annualTuitionInr), year: yearLabel(row?.tuitionYear) }))
    .filter((row) => row.fee != null);
  const rows = offered.length ? offered : curated;
  if (!rows.length) return null;
  const fees = rows.map((row) => row.fee);
  const years = [...new Set(rows.map((row) => row.year).filter(Boolean))];
  return { min: Math.min(...fees), max: Math.max(...fees), count: rows.length, year: years.length === 1 ? years[0] : '', source: offered.length ? 'official' : 'curated' };
}

function placementFacts(detail) {
  const block = detail.item?.placements && typeof detail.item.placements === 'object' ? detail.item.placements : null;
  const curated = Array.isArray(detail.programmes) ? detail.programmes : [];
  const medians = curated.map((row) => num(row?.medianSalaryLpa)).filter((value) => value != null);
  const highest = curated.map((row) => num(row?.highestSalaryLpa)).filter((value) => value != null);
  const curatedYears = [...new Set(curated.map((row) => yearLabel(row?.placementYear)).filter(Boolean))];
  const facts = {
    average: num(block?.averagePackageLpa ?? block?.avgPackageLpa),
    median: first(num(block?.medianPackageLpa), medians.length ? Math.max(...medians) : null),
    highest: first(num(block?.highestPackageLpa), highest.length ? Math.max(...highest) : null),
    placed: num(block?.placedPercent ?? block?.placementPercent),
    recruiters: list(block?.recruiters ?? block?.topRecruiters),
    year: yearLabel(block?.year ?? block?.placementYear) || (curatedYears.length === 1 ? curatedYears[0] : ''),
    perCourse: medians.length > 1 || highest.length > 1,
  };
  return Object.values(facts).some((value) => value != null && value !== '' && !(Array.isArray(value) && !value.length) && value !== false) ? facts : null;
}

const campusOf = (item) => (item?.campus && typeof item.campus === 'object' ? item.campus : {});
const dirOf = (item) => (item?.directory && typeof item.directory === 'object' ? item.directory : {});

// The crawler stores `campus.hostelAvailable` (true/false); `hostel` is accepted for records an
// admin has written by hand.
function hostelText(campus) {
  const value = first(campus.hostelAvailable, campus.hostel);
  if (typeof value === 'boolean') return value ? 'Yes' : 'Not available';
  const raw = text(value);
  if (!raw) return '';
  const key = raw.toLowerCase();
  if (key === 'yes' || key === 'true') return 'Yes';
  if (key === 'no' || key === 'false') return 'Not available';
  return raw;
}

function coEdText(campus) {
  const value = first(campus.coEd, campus.coed, campus.gender);
  if (typeof value === 'boolean') return value ? 'Co-educational' : 'Single sex';
  return text(value);
}

/** Everything the board reads from one payload, resolved once. */
export function institutionFacts(detail) {
  const item = detail?.item ?? {};
  const campus = campusOf(item);
  const dir = dirOf(item);
  const offered = Array.isArray(item.programmesOffered) ? item.programmesOffered : [];
  const names = offered.length ? offered.map((row) => text(row?.name)).filter(Boolean) : list(item.coursesOffered);
  const levelled = offered.filter((row) => text(row?.level));
  return {
    id: item.id,
    item,
    campus,
    dir,
    name: item.name || item.id,
    shortName: item.shortName || item.name || item.id,
    place: placeOf(item),
    illustrative: Boolean(item.isIllustrative),
    courses: Array.isArray(detail?.courses) ? detail.courses : [],
    similar: Array.isArray(detail?.similar) ? detail.similar : [],
    programmeNames: names,
    programmeCount: names.length || (Array.isArray(item.courseSlugs) ? item.courseSlugs.length : 0),
    levels: levelled.length
      ? [...levelled.reduce((map, row) => {
        const key = text(row.level);
        map.set(key, [...(map.get(key) ?? []), text(row.name)].filter(Boolean));
        return map;
      }, new Map())].map(([level, items]) => ({ level, items }))
      : [],
    fees: feeFacts(detail ?? {}),
    placements: placementFacts(detail ?? {}),
    hostel: hostelText(campus),
    coEd: coEdText(campus),
    facilities: list(item.facilities),
    activities: list(item.activities),
    campusSize: num(campus.sizeAcres),
    // Entrance exams the institution names on its admissions pages, then the directory's own note.
    admission: [...list(item.entranceExams), text(dir.selectionBasis)].filter(Boolean),
    admissionNote: text(item.admissionNote),
    about: firstSentence(item.about),
    awards: (Array.isArray(item.awards) ? item.awards : []).map((row) => ({ title: text(row?.title), year: num(row?.year) })).filter((row) => row.title),
  };
}

// One sentence of the institution's own description — enough to tell two places apart in a column.
function firstSentence(value) {
  const about = usableAbout(value).replace(/\s+/g, ' ');
  if (!about) return '';
  const stop = about.search(/[.!?](\s|$)/);
  const sentence = stop > 40 ? about.slice(0, stop + 1) : about;
  return sentence.length > 200 ? `${sentence.slice(0, 197).trimEnd()}…` : sentence;
}

// ---------------------------------------------------------------------------------------------
// Honest "best" marking

function markBest(cells, mode) {
  const have = cells.filter((entry) => num(entry.number) != null);
  if (have.length < 2) return null;
  const years = new Set(have.map((entry) => entry.year || ''));
  const trust = new Set(have.map((entry) => (entry.illustrative ? 'illustrative' : 'real')));
  if (years.size > 1) return { blocked: 'Different data years, so no winner is marked.' };
  if (trust.size > 1) return { blocked: 'One column holds illustrative sample figures, so no winner is marked.' };
  const values = have.map((entry) => entry.number);
  const target = mode === 'min' ? Math.min(...values) : Math.max(...values);
  if (values.every((value) => value === target)) return null;
  for (const entry of have) if (entry.number === target) entry.best = true;
  return { mode };
}

// ---------------------------------------------------------------------------------------------
// Rows

function naacCell(facts) {
  const { item, dir } = facts;
  const grade = text(item.naacGrade);
  const cgpa = num(dir.naacCgpa);
  const headline = [grade && `Grade ${grade}`, cgpa != null && `CGPA ${cgpa}`].filter(Boolean).join(' · ');
  if (!headline) return { ...MISSING };
  const declared = text(dir.naacDeclaredOn) ? shortDate(dir.naacDeclaredOn) : '';
  return {
    value: headline,
    sub: [text(dir.naacCycle) && `Cycle ${text(dir.naacCycle)}`, declared && `Declared ${declared}`].filter(Boolean).join(' · '),
    foot: text(dir.naacNote),
    tag: 'Source-reported',
  };
}

// NIRF publishes a separate table per subject, so a rank is only meaningful with its list.
// The directory stores them either as parallel arrays or as the source's own text
// ("Engineering: 1; Overall: 1; Research: 2"); read both, and never print a bare "#1".
function nirfCell(facts) {
  const { item, dir } = facts;
  const pairs = nirfPairs(dir);
  if (pairs.length) return { value: joinMax(pairs, 4), sub: item.nirfYear ? `NIRF ${item.nirfYear}` : '', tag: 'Source-reported' };
  if (item.nirfRank == null) return { ...MISSING };
  return {
    value: `${item.nirfCategory ? `${item.nirfCategory} ` : ''}#${item.nirfRank}`,
    sub: [item.nirfYear && `NIRF ${item.nirfYear}`, !item.nirfCategory && 'List not recorded'].filter(Boolean).join(' · '),
    tag: 'Source-reported',
  };
}

function approvalCell(facts) {
  const { item, dir } = facts;
  const approvals = list(item.approvals);
  const notes = [text(dir.aicteNote), text(dir.ugcNote), text(dir.nbaNote)].filter(Boolean);
  if (!approvals.length && !notes.length) return { ...MISSING };
  return { value: approvals.length ? approvals.join(' · ') : 'Listed in the source directory', sub: notes.join(' · '), tag: 'Source-reported' };
}

function feeCell(facts) {
  const { fees } = facts;
  if (!fees) return { ...MISSING };
  return {
    value: lakhRange(fees.min, fees.max),
    number: fees.min,
    year: fees.year,
    illustrative: facts.illustrative,
    sub: [fees.year && `Tuition ${fees.year}`, `${fees.count === 1 ? '1 programme' : `${fees.count} programmes`} with published fees`].filter(Boolean).join(' · '),
    foot: fees.source === 'curated' ? 'From the Gyaan Vidhya course catalogue, not the institution’s own fee notice.' : '',
    tag: facts.illustrative ? 'Illustrative' : '',
  };
}

function packageCell(facts, key, label) {
  const { placements } = facts;
  const value = placements?.[key];
  if (value == null) return { ...MISSING };
  return {
    value: lpa(value),
    number: value,
    year: placements.year,
    illustrative: facts.illustrative,
    sub: [placements.year && `Class of ${placements.year}`, placements.perCourse && key !== 'average' ? `Best ${label} across listed programmes` : ''].filter(Boolean).join(' · '),
    tag: facts.illustrative ? 'Illustrative' : '',
  };
}

const SECTION_DEFS = [
  {
    id: 'compare-identity',
    label: 'Institution',
    rows: [
      { key: 'about', label: 'About', cell: (f) => cell(f.about, { sub: f.about ? 'From the institution’s website' : '' }) },
      { key: 'location', label: 'Location', cell: (f) => cell(f.place, { sub: [text(f.item.district) && `${text(f.item.district)} district`, text(f.item.pincode)].filter(Boolean).join(' · ') }) },
      { key: 'kind', label: 'Type & ownership', cell: (f) => cell(kindOf(f.item), { sub: ownershipOf(f.item) }) },
      { key: 'established', label: 'Established', cell: (f) => (f.item.establishedYear ? { value: String(f.item.establishedYear), sub: `${new Date().getFullYear() - f.item.establishedYear} years` } : { ...MISSING }) },
      { key: 'affiliation', label: 'Affiliated to', cell: (f) => cell(text(f.item.affiliatedTo), { sub: text(f.dir.affiliatingAishe) }) },
      { key: 'aishe', label: 'AISHE code', cell: (f) => cell(text(f.dir.aisheCode) || list(f.item.aliases).find((alias) => /^[CU]-\d+$/i.test(alias)) || '') },
    ],
  },
  {
    id: 'compare-recognition',
    label: 'Accreditation & ranking',
    note: 'Dated snapshots from the source directory, not proof an approval is current.',
    rows: [
      { key: 'naac', label: 'NAAC', cell: naacCell },
      { key: 'nirf', label: 'NIRF rank', cell: nirfCell },
      { key: 'approvals', label: 'Approvals', cell: approvalCell },
      { key: 'awards', label: 'Awards listed', cell: (f) => (f.awards.length
        ? { value: `${f.awards.length} ${f.awards.length === 1 ? 'award' : 'awards'}`, sub: f.awards.map((award) => award.year).filter(Boolean).length ? `Latest ${Math.max(...f.awards.map((award) => award.year ?? 0))}` : '', foot: f.awards[0].title }
        : { ...MISSING }) },
    ],
  },
  {
    id: 'compare-academics',
    label: 'Academics',
    rows: [
      { key: 'programmeCount', label: 'Programmes offered', cell: (f) => (f.programmeCount ? { value: formatCount(f.programmeCount), sub: f.programmeNames.length ? 'Published by the institution' : 'Courses mapped in the catalogue' } : { ...MISSING }) },
      { key: 'levels', label: 'Programmes by level', cell: (f) => (f.levels.length ? { value: f.levels.map((group) => `${group.level}: ${group.items.length}`).join(' · '), sub: f.levels.map((group) => joinMax(group.items, 3)).join(' | ') } : { ...MISSING }) },
      { key: 'examples', label: 'Example programmes', cell: (f) => cell(joinMax(f.programmeNames, 6) || f.courses.map((course) => course.name).join(' · ')) },
      { key: 'streams', label: 'Streams', cell: (f) => cell(joinMax(list(f.item.streams), 6)) },
      { key: 'admission', label: 'Entrance exams', cell: (f) => cell(joinMax(f.admission, 4), { sub: f.item.admissionUrl ? 'Admissions page linked below' : '', foot: f.admissionNote }) },
    ],
  },
  {
    id: 'compare-campus',
    label: 'Campus & student life',
    rows: [
      { key: 'campusSize', label: 'Campus size', cell: (f) => (f.campusSize != null ? { value: `${f.campusSize} acres` } : { ...MISSING }) },
      { key: 'setting', label: 'Setting', cell: (f) => cell(text(f.dir.area)) },
      { key: 'hostel', label: 'Hostel', cell: (f) => cell(f.hostel) },
      { key: 'coEd', label: 'Co-ed / single sex', cell: (f) => cell(f.coEd) },
      { key: 'facilities', label: 'Facilities', cell: (f) => (f.facilities.length ? { value: joinMax(f.facilities, 8), sub: `${f.facilities.length} listed` } : { ...MISSING }) },
      { key: 'activities', label: 'Clubs & activities', cell: (f) => (f.activities.length ? { value: joinMax(f.activities, 8), sub: `${f.activities.length} listed` } : { ...MISSING }) },
    ],
  },
  {
    id: 'compare-fees',
    label: 'Fees',
    best: { feeRange: 'min' },
    rows: [{ key: 'feeRange', label: 'Annual tuition', win: 'Lowest starting tuition', note: 'Cheapest programme at each; the programme mix differs.', cell: feeCell }],
  },
  {
    id: 'compare-placements',
    label: 'Placements',
    best: { avgPackage: 'max', medianPackage: 'max', highestPackage: 'max', placed: 'max' },
    rows: [
      { key: 'avgPackage', label: 'Average package', win: 'Highest average package', cell: (f) => packageCell(f, 'average', 'average') },
      { key: 'medianPackage', label: 'Median package', win: 'Highest median package', cell: (f) => packageCell(f, 'median', 'median') },
      { key: 'highestPackage', label: 'Highest package', win: 'Biggest single offer', cell: (f) => packageCell(f, 'highest', 'highest') },
      { key: 'placed', label: 'Students placed', win: 'Most students placed', cell: (f) => (f.placements?.placed != null ? { value: pct(f.placements.placed), number: f.placements.placed, year: f.placements.year, illustrative: f.illustrative, sub: f.placements.year ? `Class of ${f.placements.year}` : '' } : { ...MISSING }) },
      { key: 'recruiters', label: 'Top recruiters', cell: (f) => (f.placements?.recruiters.length ? { value: joinMax(f.placements.recruiters, 8), sub: `${f.placements.recruiters.length} listed` } : { ...MISSING }) },
    ],
  },
  {
    id: 'compare-contact',
    label: 'Official links & provenance',
    rows: [
      { key: 'website', label: 'Official website', cell: (f) => (text(f.item.website) ? { value: hostOf(f.item.website), href: f.item.website } : { ...MISSING }) },
      { key: 'admissionUrl', label: 'Admissions page', cell: (f) => (text(f.item.admissionUrl) ? { value: hostOf(f.item.admissionUrl), href: f.item.admissionUrl } : { ...MISSING }) },
      { key: 'contact', label: 'Enquiries', cell: (f) => cell([text(f.item.email), text(f.item.phone)].filter(Boolean).join(' · ')) },
      {
        key: 'provenance',
        label: 'Where this came from',
        cell: (f) => {
          if (f.illustrative) return { value: 'Illustrative sample record', sub: 'Fictional example used to demonstrate the platform.' };
          const source = f.item.source;
          if (!source?.kind) return { ...MISSING };
          const kind = source.kind === 'scrape' ? 'Official website' : source.kind === 'import' ? text(source.name) || 'Directory import' : text(source.name) || source.kind;
          const compiled = text(f.dir.compiledOn) ? `Compiled ${shortDate(f.dir.compiledOn)}` : '';
          return { value: kind, sub: [source.fetchedAt && `Read ${shortDate(source.fetchedAt)}`, compiled].filter(Boolean).join(' · '), href: text(source.url) || '' };
        },
      },
    ],
  },
];

/**
 * @param {Array<object>} details payloads from /api/universities/:slug, in column order
 * @returns {{ facts: object[], sections: object[], hidden: string[], caveats: string[] }}
 */
export function buildBoard(details) {
  const facts = details.map(institutionFacts);
  const hidden = [];
  const caveats = [];
  const sections = SECTION_DEFS.map((section) => {
    const rows = section.rows.map((row) => {
      const cells = facts.map((entry) => ({ key: entry.id, ...row.cell(entry) }));
      if (cells.every((entry) => entry.missing)) return null;
      const mode = section.best?.[row.key];
      const best = mode ? markBest(cells, mode) : null;
      if (best?.blocked && !caveats.includes(best.blocked)) caveats.push(best.blocked);
      // The "what is actually being compared" note only earns its space once two columns hold a figure.
      const compared = Boolean(best?.mode || best?.blocked);
      return { key: row.key, label: row.label, win: row.win ?? '', note: [compared ? row.note : '', best?.blocked].filter(Boolean).join(' '), cells, mode: best?.mode ?? '' };
    }).filter(Boolean);
    if (!rows.length) { hidden.push(section.label); return null; }
    return { ...section, rows };
  }).filter(Boolean);
  return { facts, sections, hidden, caveats };
}

/** Headline wins, only where markBest allowed one. Used by the verdict strip. */
export function boardWins(board) {
  const wins = [];
  for (const section of board.sections) {
    for (const row of section.rows) {
      if (!row.mode) continue;
      const winners = row.cells.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.best);
      if (winners.length !== 1) continue;
      const { entry, index } = winners[0];
      wins.push({ key: row.key, label: row.win || row.label, name: board.facts[index].shortName, value: entry.value, sub: entry.sub });
    }
  }
  return wins;
}

export const joinInstitutionNames = (facts) => {
  const names = facts.map((entry) => entry.shortName);
  return names.length > 2 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names.join(' vs ');
};
