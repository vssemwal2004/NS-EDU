import { summarize } from '@/lib/college-catalog';
import { formatCount, formatInr, formatLpa, hostOf, kindOf, lakhRange, nirfOf, ownershipOf, placeOf, shortDate } from '../labels';

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
    .filter((photo) => /^https?:\/\//i.test(photo.url))
    .slice(0, 30);
  const heroImage = text(item.coverUrl) || photos[0]?.url || '';

  // ---- hero chips: snapshot values, never "verified" -----------------------------------------
  const snapshotSuffix = snapshotOn ? `source-reported, ${snapshotOn}` : 'source-reported';
  const chips = [
    item.naacGrade && { key: 'naac', icon: 'uniMedal', label: `NAAC ${item.naacGrade}${directory.naacCgpa ? ` · CGPA ${directory.naacCgpa}` : ''}`, note: snapshotSuffix },
    item.nirfRank && { key: 'nirf', icon: 'uniRibbon', label: `NIRF ${nirfOf(item)}`, note: snapshotSuffix },
    directory.aicteId && { key: 'aicte', icon: 'uniClipboard', label: `AICTE ${directory.aicteId}`, note: snapshotSuffix },
    ...item.approvals.slice(0, 2).map((approval) => ({ key: `a-${approval}`, icon: 'uniVerified', label: approval, note: snapshotSuffix })),
  ].filter(Boolean).slice(0, 4);

  const ribbon = [
    item.establishedYear && { label: 'Established', value: String(item.establishedYear) },
    item.naacGrade && { label: 'NAAC grade', value: item.naacGrade },
    item.nirfRank && { label: 'NIRF rank', value: nirfOf(item) },
    item.approvals.length && { label: 'Approvals', value: item.approvals.join(', ') },
    item.affiliatedTo && { label: 'Affiliated to', value: item.affiliatedTo },
    item.website && { label: 'Website', value: hostOf(item.website), href: item.website },
  ].filter(Boolean);
  // Too few institutional facts: complete the ribbon with what the record does have.
  const extras = [
    { label: 'Institution', value: kindOf(item) },
    place && { label: 'Location', value: place },
    summary?.feeMin != null && { label: `Annual tuition · ${summary.tuitionYear}`, value: lakhRange(summary.feeMin, summary.feeMax) },
    rows.length && { label: 'Programmes with fees', value: String(rows.length) },
    item.streams.length && { label: 'Streams', value: String(item.streams.length) },
    directory.aisheCode && { label: 'AISHE code', value: directory.aisheCode },
  ].filter(Boolean);
  while (ribbon.length < 4 && extras.length) ribbon.push(extras.shift());

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
    fee: row.annualFeeInr != null ? formatInr(row.annualFeeInr) : '',
    meta: [row.level, row.durationYears ? `${row.durationYears} ${row.durationYears === 1 ? 'year' : 'years'}` : ''].filter(Boolean).join(' · '),
  }));
  const offeredWithFees = offeredRows.filter((row) => row.annualFeeInr != null).length;
  const offeredSource = offeredRows.find((row) => row.sourcePage)?.sourcePage || '';

  // ---- placements ------------------------------------------------------------------------------
  const placements = item.placements && typeof item.placements === 'object' ? item.placements : {};
  const placementStats = [
    num(placements.averagePackageLpa) != null && { key: 'avg', label: 'Average package', value: formatLpa(num(placements.averagePackageLpa)) },
    num(placements.medianPackageLpa) != null && { key: 'median', label: 'Median package', value: formatLpa(num(placements.medianPackageLpa)) },
    num(placements.highestPackageLpa) != null && { key: 'high', label: 'Highest package', value: formatLpa(num(placements.highestPackageLpa)) },
    num(placements.placedPercent) != null && { key: 'placed', label: 'Students placed', value: `${num(placements.placedPercent)}%` },
  ].filter(Boolean);
  const recruiters = list(placements.recruiters).map(text).filter(Boolean).slice(0, 40);
  const placementYear = placements.year ? String(placements.year) : '';
  const hasPlacements = placementStats.length > 0 || recruiters.length > 0 || bestMedian != null;

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

  const highlights = [
    item.naacGrade && { icon: 'uniMedal', title: `NAAC ${item.naacGrade}`, text: `Grade reported by the directory source${snapshotOn ? ` (${snapshotOn})` : ''}, not a current certificate.` },
    item.nirfRank && { icon: 'uniRibbon', title: `NIRF rank #${item.nirfRank}`, text: `Listed in the National Institutional Ranking Framework${item.nirfYear ? ` (${item.nirfYear})` : ''}.` },
    item.establishedYear && { icon: 'uniCalendar', title: `Since ${item.establishedYear}`, text: year > item.establishedYear ? `${year - item.establishedYear} years since the institution was established.` : 'Established this year.' },
    campusFacts[0]?.label === 'Campus size' && { icon: 'uniCampus', title: campusFacts[0].value, text: 'Campus size published by the institution.' },
    placementStats[0] && { icon: 'trend', title: `${placementStats[0].label} ${placementStats[0].value}`, text: `Reported by the institution${placementYear ? ` for ${placementYear}` : ''}.` },
    rows.length && summary.feeMin != null && { icon: 'uniRupee', title: `From ${lakhRange(summary.feeMin, summary.feeMin)} a year`, text: `Lowest annual tuition across ${rows.length === 1 ? 'one programme' : `${rows.length} programmes`} with published fees (${summary.tuitionYear}).` },
    bestMedian != null && { icon: 'trend', title: `Median package up to ${formatLpa(bestMedian)}`, text: `Best median package among listed programmes (${summary.placementYear})${item.isIllustrative ? ', illustrative values' : ''}.` },
    item.streams.length && { icon: 'uniBook', title: `${item.streams.length === 1 ? '1 stream' : `${item.streams.length} streams`}`, text: item.streams.join(', ') },
    offeredRows.length && { icon: 'uniLayers', title: `${formatCount(offeredRows.length)} programmes listed`, text: 'Published by the institution on its own website.' },
  ].filter(Boolean).slice(0, 6);

  // ---- accreditation & approvals: verbatim snapshot values -------------------------------------
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
    (item.nirfRank || list(directory.nirfCategories).length) && {
      key: 'nirf', icon: 'uniRibbon', label: 'NIRF',
      value: item.nirfRank ? `Rank #${item.nirfRank}` : 'Listed',
      facts: [
        item.nirfYear && { label: 'Ranking year', value: String(item.nirfYear) },
        list(directory.nirfCategories).length && { label: 'Categories', value: list(directory.nirfCategories).join(', ') },
        list(directory.nirfRanks).length && { label: 'Ranks', value: list(directory.nirfRanks).join(', ') },
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

  const scrapedAbout = text(item.about);
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
  const sections = [
    { id: 'overview', label: 'Overview' },
    photos.length && { id: 'photos', label: 'Photos' },
    hasCourses && { id: 'courses', label: rows.length || offeredWithFees ? 'Courses & fees' : 'Courses' },
    hasPlacements && { id: 'placements', label: 'Placements' },
    hasCampus && { id: 'campus', label: 'Campus & activities' },
    { id: 'admissions', label: 'Admissions' },
    { id: 'accreditation', label: 'Accreditation' },
    { id: 'contact', label: 'Contact & location' },
    { id: 'similar', label: 'Similar' },
  ].filter(Boolean);

  return {
    item, rows, summary, moreCourses, similar, shortName, place, ribbon, highlights, accreditation, status,
    contacts, address, mapQuery, about, aboutSource, sections, hasCourses,
    directory, snapshotOn, directorySources, sourceUrl, photos, heroImage, chips,
    offeredRows, offeredWithFees, offeredSource,
    placementStats, recruiters, placementYear, placementSource: text(placements.sourcePage), hasPlacements,
    campusFacts, facilities, activities, campusSource: text(campus.sourcePage), hasCampus,
    entranceExams, admissionNote, gaps,
  };
}
