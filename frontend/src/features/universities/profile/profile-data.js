import { summarize } from '@/lib/college-catalog';
import { formatCount, formatLpa, hostOf, kindOf, lakhRange, nirfOf, ownershipOf, placeOf } from '../labels';

// Everything shown on a profile is derived here from real record fields; nothing is filled in.
export function profileModel({ item, programmes, courses, similar }, catalogCourses) {
  const byId = new Map([...catalogCourses, ...courses].map((course) => [course.id, course]));
  const rows = programmes.map((row) => ({ ...row, course: byId.get(row.courseId) || { id: row.courseId, name: row.courseId } }));
  const summary = rows.length ? summarize(rows) : null;
  const listed = new Set(rows.map((row) => row.courseId));
  const moreCourses = courses.filter((course) => !listed.has(course.id));
  const shortName = item.shortName || item.name;
  const place = placeOf(item);

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
  ].filter(Boolean);
  while (ribbon.length < 4 && extras.length) ribbon.push(extras.shift());

  const year = new Date().getFullYear();
  const bestMedian = summary?.medianMax;
  const highlights = [
    item.naacGrade && { icon: 'uniMedal', title: `NAAC ${item.naacGrade}`, text: 'Accreditation grade from the National Assessment and Accreditation Council.' },
    item.nirfRank && { icon: 'uniRibbon', title: `NIRF rank #${item.nirfRank}`, text: `Listed in the National Institutional Ranking Framework${item.nirfYear ? ` (${item.nirfYear})` : ''}.` },
    item.establishedYear && { icon: 'uniCalendar', title: `Since ${item.establishedYear}`, text: year > item.establishedYear ? `${year - item.establishedYear} years since the institution was established.` : 'Established this year.' },
    item.approvals.length && { icon: 'uniVerified', title: `Approved by ${item.approvals.slice(0, 3).join(', ')}`, text: 'Regulatory approvals listed for this institution.' },
    rows.length && summary.feeMin != null && { icon: 'uniRupee', title: `From ${lakhRange(summary.feeMin, summary.feeMin)} a year`, text: `Lowest annual tuition across ${rows.length === 1 ? 'one programme' : `${rows.length} programmes`} with published fees (${summary.tuitionYear}).` },
    bestMedian != null && { icon: 'trend', title: `Median package up to ${formatLpa(bestMedian)}`, text: `Best median package among listed programmes (${summary.placementYear})${item.isIllustrative ? ', illustrative values' : ''}.` },
    item.streams.length && { icon: 'uniBook', title: `${item.streams.length === 1 ? '1 stream' : `${item.streams.length} streams`}`, text: item.streams.join(', ') },
    item.coursesOffered.length && { icon: 'uniLayers', title: `${formatCount(item.coursesOffered.length)} programmes listed`, text: 'Published by the institution on its own website.' },
  ].filter(Boolean).slice(0, 6);

  const accreditation = [
    item.naacGrade && { key: 'naac', icon: 'uniMedal', label: 'NAAC grade', value: item.naacGrade },
    item.nirfRank && { key: 'nirf', icon: 'uniRibbon', label: `NIRF rank${item.nirfYear ? ` · ${item.nirfYear}` : ''}`, value: `#${item.nirfRank}` },
    ...item.approvals.map((approval) => ({ key: `a-${approval}`, icon: 'uniVerified', label: 'Approval', value: approval })),
    item.affiliatedTo && { key: 'aff', icon: 'uniColumns', label: 'Affiliated to', value: item.affiliatedTo },
  ].filter(Boolean);
  const status = [
    { label: 'Institution type', value: kindOf(item) },
    ownershipOf(item) && { label: 'Ownership', value: ownershipOf(item) },
  ].filter(Boolean);

  const contacts = [
    item.website && { key: 'website', icon: 'uniGlobe', label: 'Website', value: hostOf(item.website), href: item.website, external: true },
    item.admissionUrl && { key: 'admissions', icon: 'uniClipboard', label: 'Admissions page', value: hostOf(item.admissionUrl), href: item.admissionUrl, external: true },
    item.email && { key: 'email', icon: 'uniMail', label: 'Email', value: item.email, href: `mailto:${item.email}` },
    item.phone && { key: 'phone', icon: 'uniPhone', label: 'Phone', value: item.phone, href: `tel:${item.phone.replace(/[^\d+]/g, '')}` },
  ].filter(Boolean);
  const address = [item.address, item.district && !item.address?.includes(item.district) ? item.district : '', place, item.pincode].filter(Boolean).join(', ');
  const mapQuery = [item.name, item.address, item.city, item.state, item.pincode].filter(Boolean).join(', ');

  const about = item.about || `${item.name} is ${/^(?:[aeio]|u(?!ni))/i.test(kindOf(item)) ? 'an' : 'a'} ${kindOf(item).toLowerCase()}${place ? ` in ${place}` : ''}${item.establishedYear ? `, established in ${item.establishedYear}` : ''}.${item.streams.length ? ` It offers programmes in ${item.streams.slice(0, 5).join(', ').toLowerCase()}.` : ''}`;

  const hasCourses = rows.length > 0 || moreCourses.length > 0 || item.coursesOffered.length > 0;
  const sections = [
    { id: 'overview', label: 'Overview' },
    hasCourses && { id: 'courses', label: rows.length ? 'Courses & fees' : 'Courses' },
    { id: 'admissions', label: 'Admissions' },
    { id: 'accreditation', label: 'Accreditation' },
    { id: 'contact', label: 'Contact & location' },
    { id: 'similar', label: 'Similar' },
  ].filter(Boolean);

  return { item, rows, summary, moreCourses, similar, shortName, place, ribbon, highlights, accreditation, status, contacts, address, mapQuery, about, sections, hasCourses };
}
