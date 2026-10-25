import { summarize } from '@/lib/college-catalog';
import { formatCount, formatInr, formatLpa, hostOf, kindOf, lakhRange, nirfOf, nirfPairs, ownershipOf, placeOf, shortDate, shortInr, usableAbout } from '../labels';

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const list = (value) => (Array.isArray(value) ? value.filter((row) => row && (typeof row !== 'string' || row.trim())) : []);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
// Snapshot dates arrive as ISO strings or as whatever the spreadsheet held ("Jan 2023"): keep the raw text.
const dateish = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : shortDate(parsed);
};
const sourceLink = (value) => {
  if (typeof value === 'string') return /^https?:/i.test(value) ? { label: hostOf(value), url: value } : { label: value, url: '' };
  const url = text(value?.url || value?.href);
  const label = text(value?.label || value?.name || value?.title) || (url ? hostOf(url) : '');
  return label ? { label, url } : null;
};

// Columns of the season-by-season placement table; only the ones some season reports are shown.
const HISTORY_COLUMNS = [
  ['highestPackageLpa', 'Highest package', formatLpa],
  ['averagePackageLpa', 'Average package', formatLpa],
  ['medianPackageLpa', 'Median package', formatLpa],
  ['placedPercent', 'Students placed', (value) => `${value}%`],
  ['studentsPlaced', 'Placed (students)', formatCount],
  ['offers', 'Offers', formatCount],
  ['companies', 'Companies', formatCount],
];

// Everything shown on a profile is derived here from real record fields; nothing is filled in.
// Every scraped field is optional — most records carry only the imported directory snapshot.
export function profileModel({ item, programmes, courses, similar }, catalogCourses) {
  const byId = new Map([...catalogCourses, ...courses].map((course) => [course.id, course]));
  const rows = programmes.map((row) => ({ ...row, course: byId.get(row.courseId) || { id: row.courseId, name: row.courseId } }));
  const summary = rows.length ? summarize(rows) : null;
  const listed = new Set(rows.map((row) => row.courseId));
  const moreCourses = courses.filter((course) => !listed.has(course.id));
  const shortName = item.shortName || item.name;
  const place = placeOf(item);
  const directory = item.directory && typeof item.directory === 'object' ? item.directory : {};
  const snapshotOn = dateish(directory.compiledOn || item.source?.fetchedAt);
  const directorySources = list(directory.sources).map(sourceLink).filter(Boolean);
  const sourceUrl = text(item.source?.url) || directorySources.find((row) => row.url)?.url || '';

  // ---- photos -------------------------------------------------------------------------------
  const photos = list(item.gallery)
    .map((photo, index) => ({
      id: `p${index}`,
      url: text(photo.url),
      caption: text(photo.caption),
      credit: text(photo.credit) || 'Official website',
      sourcePage: text(photo.sourcePage),
    }))
    .filter((photo) => /^https?:\/\//i.test(photo.url));
  const heroImage = text(item.coverUrl) || photos[0]?.url || '';
  // The cover already fills the header, so the gallery starts with the next picture (schema max 12).
  const galleryPhotos = photos.filter((photo) => photo.url !== heroImage).slice(0, 12);

  // ---- hero badges: at most three, each a real value -----------------------------------------
  // The "source-reported" caveat is said once under the badges and in full in Accreditation, not
  // repeated on every chip. A directory AICTE cell that only says "not matched" is not a badge.
  const aicteId = /\d/.test(text(directory.aicteId)) && !/\bnot\b/i.test(text(directory.aicteId)) ? text(directory.aicteId) : '';
  const chips = [
    item.nirfRank && { key: 'nirf', icon: 'uniRibbon', label: `NIRF ${nirfOf(item)}` },
    item.naacGrade && { key: 'naac', icon: 'uniMedal', label: `NAAC ${item.naacGrade}${directory.naacCgpa ? ` · CGPA ${directory.naacCgpa}` : ''}` },
    aicteId && { key: 'aicte', icon: 'uniClipboard', label: `AICTE ${aicteId}` },
    ...item.approvals.slice(0, 2).map((approval) => ({ key: `a-${approval}`, icon: 'uniVerified', label: `${approval} approved` })),
  ].filter(Boolean).slice(0, 3);
  const chipsNote = chips.length ? `Source-reported${snapshotOn ? ` · ${snapshotOn}` : ''}` : '';

  const year = new Date().getFullYear();
  const bestMedian = summary?.medianMax;

  // ---- programmes published by the institution ------------------------------------------------
  const seen = new Set();
  const offeredRows = [
    ...list(item.programmesOffered).map((row) => (typeof row === 'string' ? { name: row } : row)),
    ...list(item.coursesOffered).map((name) => ({ name })),
  ].map((row) => ({
    name: text(row?.name),
    level: text(row?.level),
    durationYears: num(row?.durationYears),
    annualFeeInr: num(row?.annualFeeInr),
    semesterFeeInr: num(row?.semesterFeeInr),
    totalFeeInr: num(row?.totalFeeInr),
    feeYear: text(row?.feeYear),
    feeNote: text(row?.feeNote),
    sourcePage: text(row?.sourcePage),
  })).filter((row) => {
    const key = row.name.toLowerCase();
    if (!row.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((row, index) => ({
    ...row,
    id: `o${index}`,
    // Every fee the institution prints for the programme, each with its own period; none is
    // converted into another, so "₹60,000 a semester" never turns into an annual figure.
    fees: [
      row.annualFeeInr != null && { label: 'a year', value: formatInr(row.annualFeeInr) },
      row.semesterFeeInr != null && { label: 'a semester', value: formatInr(row.semesterFeeInr) },
      row.totalFeeInr != null && { label: 'whole programme', value: formatInr(row.totalFeeInr) },
    ].filter(Boolean),
    meta: [row.level, row.durationYears ? `${row.durationYears} ${row.durationYears === 1 ? 'year' : 'years'}` : '', row.feeYear && `fees ${row.feeYear}`].filter(Boolean).join(' · '),
  }));
  const offeredWithFees = offeredRows.filter((row) => row.fees.length).length;
  const offeredSource = offeredRows.find((row) => row.sourcePage)?.sourcePage || '';

  // ---- placements ------------------------------------------------------------------------------
  const placements = item.placements && typeof item.placements === 'object' ? item.placements : {};
  const statsOf = (source) => [
    num(source.averagePackageLpa) != null && { key: 'avg', label: 'Average package', value: formatLpa(num(source.averagePackageLpa)) },
    num(source.medianPackageLpa) != null && { key: 'median', label: 'Median package', value: formatLpa(num(source.medianPackageLpa)) },
    num(source.highestPackageLpa) != null && { key: 'high', label: 'Highest package', value: formatLpa(num(source.highestPackageLpa)) },
    num(source.placedPercent) != null && { key: 'placed', label: 'Students placed', value: `${num(source.placedPercent)}%` },
  ].filter(Boolean);
  // Season by season, newest first, as the institution reports it.
  const placementHistory = list(item.placementHistory)
    // `counted`: tallied from the institution's published list of placed students, not a summary it printed.
    .map((row) => ({ ...row, year: num(row?.year), session: text(row?.session) || String(row?.year ?? ''), counted: row?.basis === 'student-list' }))
    .filter((row) => row.year)
    .toSorted((a, b) => b.year - a.year)
    .slice(0, 4);
  const historyColumns = HISTORY_COLUMNS.filter(([key]) => placementHistory.some((row) => num(row[key]) != null));
  // The single-season snapshot when it has figures; otherwise the newest season of the record, so
  // the headline tiles and the year they belong to always come from one place.
  const snapshotStats = statsOf(placements);
  const latestSeason = placementHistory.find((row) => statsOf(row).length);
  const placementStats = snapshotStats.length ? snapshotStats : latestSeason ? statsOf(latestSeason) : [];
  const recruiters = list(placements.recruiters).map(text).filter(Boolean).slice(0, 40);
  const placementYear = snapshotStats.length ? (placements.year ? String(placements.year) : '') : latestSeason?.session ?? (placements.year ? String(placements.year) : '');
  const placementNote = text(placements.note);
  const hasPlacements = placementStats.length > 0 || recruiters.length > 0 || bestMedian != null || historyColumns.length > 0;

  // ---- campus ----------------------------------------------------------------------------------
  const campus = item.campus && typeof item.campus === 'object' ? item.campus : {};
  const campusFacts = [
    num(campus.sizeAcres) != null && { label: 'Campus size', value: `${num(campus.sizeAcres)} acres` },
    typeof campus.hostelAvailable === 'boolean' && { label: 'Hostel', value: campus.hostelAvailable ? 'Available' : 'Not available' },
    typeof campus.coEd === 'boolean' && { label: 'Co-educational', value: campus.coEd ? 'Yes' : 'No' },
    text(directory.area) && { label: 'Area', value: text(directory.area) },
  ].filter(Boolean);
  const facilities = list(item.facilities).map(text).filter(Boolean).slice(0, 40);
  const activities = list(item.activities).map(text).filter(Boolean).slice(0, 40);
  const hasCampus = campusFacts.length > 0 || facilities.length > 0 || activities.length > 0;

  // ---- at a glance: the four figures a student weighs first, in that order of importance -------
  // Each tile appears only when the record holds the figure; the rest of the row is filled from the
  // next facts down the list, so a thin record still gets a full, honest row.
  const lowest = (field) => {
    const values = offeredRows.map((row) => row[field]).filter((value) => value != null && value > 0);
    return values.length ? Math.min(...values) : null;
  };
  const scrapedFee = [['annualFeeInr', 'a year'], ['semesterFeeInr', 'a semester'], ['totalFeeInr', 'whole programme']]
    .map(([field, period]) => ({ value: lowest(field), period })).find((fee) => fee.value != null);
  const firstStat = placementStats[0];
  const glance = [
    summary?.feeMin != null ? { key: 'fees', icon: 'uniRupee', label: 'Annual tuition', value: lakhRange(summary.feeMin, summary.feeMax), note: summary.tuitionYear || 'published fees' }
      : scrapedFee ? { key: 'fees', icon: 'uniRupee', label: 'Fees from', value: shortInr(scrapedFee.value), note: `${scrapedFee.period}, lowest published` } : null,
    firstStat ? { key: 'placement', icon: 'trend', label: firstStat.label, value: firstStat.value, note: placementYear ? `reported for ${placementYear}` : 'reported by the institution' }
      : bestMedian != null ? { key: 'placement', icon: 'trend', label: 'Median package', value: `up to ${formatLpa(bestMedian)}`, note: summary.placementYear } : null,
    offeredRows.length ? { key: 'programmes', icon: 'uniLayers', label: 'Programmes', value: formatCount(offeredRows.length), note: 'listed by the institution' }
      : rows.length ? { key: 'programmes', icon: 'uniLayers', label: 'Programmes', value: String(rows.length), note: 'with published fees' } : null,
    num(campus.sizeAcres) != null && { key: 'campus', icon: 'uniCampus', label: 'Campus', value: `${num(campus.sizeAcres)} acres`, note: campus.hostelAvailable ? 'hostel available' : 'stated by the institution' },
    item.establishedYear && { key: 'established', icon: 'uniCalendar', label: 'Established', value: String(item.establishedYear), note: year > item.establishedYear ? `${year - item.establishedYear} years ago` : 'this year' },
    item.streams.length && { key: 'streams', icon: 'uniBook', label: 'Streams', value: String(item.streams.length), note: item.streams.slice(0, 2).join(', ') },
    { key: 'type', icon: 'building', label: 'Institution', value: kindOf(item), note: ownershipOf(item) || place },
  ].filter(Boolean).slice(0, 4);
  const shown = new Set(glance.map((tile) => tile.key));

  // Highlights add what the hero and the glance row have not already said.
  const highlights = [
    !shown.has('established') && item.establishedYear && { key: 'established', icon: 'uniCalendar', title: `Since ${item.establishedYear}`, text: year > item.establishedYear ? `${year - item.establishedYear} years since the institution was established.` : 'Established this year.' },
    campusFacts.find((fact) => fact.label === 'Hostel') && { key: 'hostel', icon: 'bed', title: `Hostel ${campusFacts.find((fact) => fact.label === 'Hostel').value.toLowerCase()}`, text: 'As stated on the institution’s website.' },
    !shown.has('campus') && num(campus.sizeAcres) != null && { key: 'campus', icon: 'uniCampus', title: `${num(campus.sizeAcres)} acre campus`, text: 'Campus size published by the institution.' },
    placementStats[1] && { key: 'placement2', icon: 'trend', title: `${placementStats[1].label} ${placementStats[1].value}`, text: `Reported by the institution${placementYear ? ` for ${placementYear}` : ''}.` },
    facilities.length > 0 && { key: 'facilities', icon: 'uniCampus', title: `${facilities.length} facilities`, text: facilities.slice(0, 3).join(', ') },
    activities.length > 0 && { key: 'activities', icon: 'uniSpark', title: `${activities.length} clubs & activities`, text: activities.slice(0, 3).join(', ') },
    !shown.has('streams') && item.streams.length && { key: 'streams', icon: 'uniBook', title: `${item.streams.length === 1 ? '1 stream' : `${item.streams.length} streams`}`, text: item.streams.join(', ') },
    item.affiliatedTo && { key: 'affiliation', icon: 'uniColumns', title: 'Affiliated university', text: item.affiliatedTo },
  ].filter(Boolean).slice(0, 6);

  // ---- accreditation & approvals: verbatim snapshot values -------------------------------------
  const nirfLists = nirfPairs(directory);
  const accreditation = [
    (item.naacGrade || directory.naacCgpa || directory.naacNote) && {
      key: 'naac', icon: 'uniMedal', label: 'NAAC',
      value: item.naacGrade ? `Grade ${item.naacGrade}` : directory.naacCgpa ? `CGPA ${directory.naacCgpa}` : 'Listed',
      facts: [
        directory.naacCgpa && { label: 'CGPA', value: String(directory.naacCgpa) },
        directory.naacCycle && { label: 'Cycle', value: String(directory.naacCycle) },
        directory.naacDeclaredOn && { label: 'Declared on', value: dateish(directory.naacDeclaredOn) },
      ].filter(Boolean),
      note: text(directory.naacNote), href: 'https://www.naac.gov.in/',
    },
    (item.nirfRank || nirfLists.length) && {
      key: 'nirf', icon: 'uniRibbon', label: 'NIRF',
      // The rank belongs to a list ("University #2"), so it is never shown bare.
      value: item.nirfRank ? nirfOf(item).replace(/ · \d{4}$/, '') : 'Listed',
      facts: [
        item.nirfYear && { label: 'Ranking year', value: String(item.nirfYear) },
        nirfLists.length > 0 && { label: nirfLists.length === 1 ? 'List' : 'All lists', value: nirfLists.join(' · ') },
      ].filter(Boolean),
      note: '', href: 'https://www.nirfindia.org/',
    },
    (directory.aicteId || directory.aicteNote) && {
      key: 'aicte', icon: 'uniClipboard', label: 'AICTE',
      value: directory.aicteId ? String(directory.aicteId) : 'Listed',
      facts: [], note: text(directory.aicteNote), href: 'https://www.aicte-india.org/',
    },
    directory.ugcNote && { key: 'ugc', icon: 'uniColumns', label: 'UGC', value: 'Listed', facts: [], note: text(directory.ugcNote), href: 'https://www.ugc.gov.in/' },
    directory.nbaNote && { key: 'nba', icon: 'uniVerified', label: 'NBA', value: 'Listed', facts: [], note: text(directory.nbaNote), href: 'https://www.nbaind.org/' },
    ...item.approvals.map((approval) => ({ key: `a-${approval}`, icon: 'uniVerified', label: 'Approval listed', value: approval, facts: [], note: '', href: '' })),
  ].filter(Boolean);
  const status = [
    { label: 'Institution type', value: kindOf(item) },
    ownershipOf(item) && { label: 'Ownership', value: ownershipOf(item) },
    text(directory.managementLabel) && { label: 'Management', value: text(directory.managementLabel) },
    text(directory.institutionType) && { label: 'Directory type', value: text(directory.institutionType) },
    item.affiliatedTo && { label: 'Affiliated to', value: item.affiliatedTo },
    text(directory.affiliatingAishe) && { label: 'Affiliating AISHE code', value: text(directory.affiliatingAishe) },
    text(directory.aisheCode) && { label: 'AISHE code', value: text(directory.aisheCode) },
    text(directory.selectionBasis) && { label: 'Selection basis', value: text(directory.selectionBasis) },
  ].filter(Boolean);

  // ---- admissions --------------------------------------------------------------------------------
  const entranceExams = list(item.entranceExams).map(text).filter(Boolean).slice(0, 20);
  const admissionNote = text(item.admissionNote);

  const contacts = [
    item.website && { key: 'website', icon: 'uniGlobe', label: 'Website', value: hostOf(item.website), href: item.website, external: true },
    item.admissionUrl && { key: 'admissions', icon: 'uniClipboard', label: 'Admissions page', value: hostOf(item.admissionUrl), href: item.admissionUrl, external: true },
    item.email && { key: 'email', icon: 'uniMail', label: 'Email', value: item.email, href: `mailto:${item.email}` },
    item.phone && { key: 'phone', icon: 'uniPhone', label: 'Phone', value: item.phone, href: `tel:${item.phone.replace(/[^\d+]/g, '')}` },
  ].filter(Boolean);
  const address = [item.address, item.district && !item.address?.includes(item.district) ? item.district : '', place, item.pincode].filter(Boolean).join(', ');
  const mapQuery = [item.name, item.address, item.city, item.state, item.pincode].filter(Boolean).join(', ');

  // A scraped "about" that is really site chrome (a disclaimer about who runs the website) or too
  // short to describe anything is not shown; the sentence built from the directory record stands in.
  const scrapedAbout = usableAbout(item.about);

  // ---- awards: quoted as the institution prints them, newest first ------------------------------
  const awards = list(item.awards)
    .map((row) => ({ title: text(row?.title), year: num(row?.year) }))
    .filter((row) => row.title)
    .toSorted((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 12);
  const about = scrapedAbout || `${item.name} is ${/^(?:[aeio]|u(?!ni))/i.test(kindOf(item)) ? 'an' : 'a'} ${kindOf(item).toLowerCase()}${place ? ` in ${place}` : ''}${item.establishedYear ? `, established in ${item.establishedYear}` : ''}.${item.streams.length ? ` It offers programmes in ${item.streams.slice(0, 5).join(', ').toLowerCase()}.` : ''}`;
  const aboutSource = scrapedAbout ? text(item.aboutSource) || text(item.website) : '';

  // What this profile does not have yet, named plainly rather than left as empty sections.
  const gaps = [
    !photos.length && !heroImage && 'photos',
    !scrapedAbout && 'a description from the institution',
    !rows.length && !offeredRows.length && 'courses',
    !offeredWithFees && summary?.feeMin == null && 'fees',
    !hasPlacements && 'placements',
    !hasCampus && 'campus facilities',
  ].filter(Boolean);

  const hasCourses = rows.length > 0 || moreCourses.length > 0 || offeredRows.length > 0;
  // A section with nothing to show is left out, and so is its tab — no empty boxes.
  const sections = [
    { id: 'overview', label: 'Overview' },
    galleryPhotos.length && { id: 'photos', label: 'Photos' },
    hasCourses && { id: 'courses', label: rows.length || offeredWithFees ? 'Courses & fees' : 'Courses' },
    hasPlacements && { id: 'placements', label: 'Placements' },
    hasCampus && { id: 'campus', label: 'Campus life' },
    awards.length && { id: 'awards', label: 'Awards' },
    { id: 'admissions', label: 'Admissions' },
    { id: 'accreditation', label: 'Accreditation' },
    { id: 'contact', label: 'Contact' },
    similar.length && { id: 'similar', label: 'Similar' },
  ].filter(Boolean);

  return {
    item, rows, summary, moreCourses, similar, shortName, place, glance, highlights, accreditation, status,
    contacts, address, mapQuery, about, aboutSource, sections, hasCourses, awards,
    directory, snapshotOn, directorySources, sourceUrl, photos: galleryPhotos, heroImage, chips, chipsNote,
    offeredRows, offeredWithFees, offeredSource,
    placementStats, recruiters, placementYear, placementNote, placementSource: text(placements.sourcePage) || text(latestSeason?.sourcePage), hasPlacements,
    placementHistory, historyColumns,
    campusFacts, facilities, activities, campusSource: text(campus.sourcePage), hasCampus,
    entranceExams, admissionNote, gaps,
  };
}
