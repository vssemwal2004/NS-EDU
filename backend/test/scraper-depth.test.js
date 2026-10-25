import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { aboutDeep, galleryCandidates, periodOf, photoYearOf, placementHistoryFrom, programmeRows, rupeesIn, seasonOf } from '../src/scraper/deep.js';
import { DOCUMENT_RULES, documentPage, pickDocuments, rowsFromItems } from '../src/scraper/documents.js';
import { LINK_CATEGORIES, matchCourseSlugs, parsePage } from '../src/scraper/extract.js';
import { exifYear, photoAge } from '../src/lib/image-pipeline.js';

const SITE = 'https://www.gvu-example.ac.in';
const DOMAIN = 'gvu-example.ac.in';
const NOW = new Date().getFullYear();
const page = (category, html, path = `/${category}`) => ({ ...parsePage(html, `${SITE}${path}`), category });

describe('fees: every amount under the period it was printed for', () => {
  test('bare amounts count only where the column or page says they are fees', () => {
    assert.equal(rupeesIn('1,25,000/-', { bare: true }), 125_000);
    assert.equal(rupeesIn('125000', { bare: true }), 125_000);
    assert.equal(rupeesIn('1.25 lakh', { bare: true }), 125_000);
    assert.equal(rupeesIn('1,25,000/-'), null, 'not without a fee context');
    assert.equal(rupeesIn('2025', { bare: true }), null, 'a year is not money');
    assert.equal(rupeesIn('60 seats', { bare: true }), null);
    assert.equal(rupeesIn('85000%', { bare: true }), null);
  });

  test('period words: semester, year, whole programme and charges that are not tuition', () => {
    assert.equal(periodOf('Fee per semester'), 'semester');
    assert.equal(periodOf('Annual tuition fee'), 'year');
    assert.equal(periodOf('Total fee per annum'), 'year', 'a year\'s total is still per year');
    assert.equal(periodOf('Total course fee'), 'total');
    assert.equal(periodOf('Hostel fee (per annum)'), 'other');
    assert.equal(periodOf('Bachelor of Fine Arts'), '', '"fine arts" is not a fine');
  });

  test('a fee table: columns by year, a semester column, a merged programme cell and a session title', () => {
    const fees = page('fees', `<html><head><title>Fee Structure 2025-26</title></head><body>
<h2>Fee Structure for the session 2025-26</h2><table>
<tr><th>S.No</th><th>Programme</th><th>Branch</th><th>1st Year Fee (Rs.)</th><th>Total Fee (Rs.)</th></tr>
<tr><td>1</td><td>B.Tech</td><td>Computer Science</td><td>1,45,000</td><td>5,80,000</td></tr>
<tr><td>2</td><td>Mechanical Engineering</td><td>1,10,000</td><td>4,40,000</td></tr>
<tr><td>3</td><td>Hostel Fee</td><td>85,000</td><td></td></tr>
<tr><td>4</td><td>MBA</td><td>-</td><td>1,20,000</td><td>2,40,000</td></tr>
</table>
<table><tr><th>Course</th><th>Fee per Semester</th></tr><tr><td>BCA</td><td>40000</td></tr></table>
</body></html>`);
    const rows = programmeRows([fees]);
    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    assert.deepEqual(Object.keys(byName), ['B.Tech (Computer Science)', 'B.Tech (Mechanical Engineering)', 'MBA', 'BCA']);
    assert.equal(byName['B.Tech (Computer Science)'].annualFeeInr, 145_000);
    assert.equal(byName['B.Tech (Computer Science)'].totalFeeInr, 580_000);
    assert.equal(byName['B.Tech (Computer Science)'].feeYear, '2025-26');
    assert.equal(byName['B.Tech (Mechanical Engineering)'].annualFeeInr, 110_000, 'a branch row under a merged cell keeps its programme');
    assert.equal(byName.BCA.semesterFeeInr, 40_000);
    assert.equal(byName.BCA.annualFeeInr, undefined, 'a semester fee is never doubled into an annual one');
    assert.ok(!rows.some((row) => /hostel/i.test(row.name)), 'a hostel charge is not a programme');
  });
});

describe('placement record by season', () => {
  test('seasons are named by the year they end', () => {
    assert.deepEqual(seasonOf('Placement 2024-25'), { year: 2025, session: '2024-25' });
    assert.deepEqual(seasonOf('2023–2024'), { year: 2024, session: '2023-24' });
    assert.equal(seasonOf('2019-21'), null, 'not a single season');
  });

  test('a table with seasons as columns', () => {
    const last = NOW - 1;
    const html = `<html><body><h1>Placement Statistics</h1><table>
<tr><th>Particulars</th><th>${last - 2}-${String(last - 1).slice(2)}</th><th>${last - 1}-${String(last).slice(2)}</th></tr>
<tr><td>No. of Companies Visited</td><td>85</td><td>112</td></tr>
<tr><td>No. of Students Placed</td><td>410</td><td>486</td></tr>
<tr><td>Highest Package (LPA)</td><td>18</td><td>24.5</td></tr>
<tr><td>Average Package (LPA)</td><td>4.2</td><td>4.8</td></tr>
</table></body></html>`;
    const history = placementHistoryFrom([page('placement', html)]);
    assert.deepEqual(history.map((row) => row.year), [last, last - 1]);
    assert.equal(history[0].companies, 112);
    assert.equal(history[0].studentsPlaced, 486);
    assert.equal(history[0].highestPackageLpa, 24.5);
    assert.equal(history[0].averagePackageLpa, 4.8);
    assert.equal(history[1].highestPackageLpa, 18);
  });

  test('a table with seasons as rows, packages printed in rupees', () => {
    const html = `<html><body><table>
<tr><th>Batch</th><th>Students Placed</th><th>Highest CTC (Rs.)</th><th>Placement %</th></tr>
<tr><td>${NOW - 1}</td><td>220</td><td>12,00,000</td><td>81%</td></tr>
<tr><td>${NOW - 2}</td><td>190</td><td>9,50,000</td><td>76</td></tr>
</table></body></html>`;
    const [latest, previous] = placementHistoryFrom([page('placement', html)]);
    assert.equal(latest.year, NOW - 1);
    assert.equal(latest.highestPackageLpa, 12);
    assert.equal(latest.placedPercent, 81);
    assert.equal(previous.studentsPlaced, 190);
  });

  test('text sections headed by a season, and archive tabs that are not headings', () => {
    const html = `<html><body>
<p>${NOW - 4}-${String(NOW - 3).slice(2)}</p><p>${NOW - 3}-${String(NOW - 2).slice(2)}</p><p>${NOW - 2}-${String(NOW - 1).slice(2)}</p>
<h2>Placement Highlights ${NOW - 2}-${String(NOW - 1).slice(2)}</h2>
<p>Highest package: 32 LPA</p><p>Average package: 7.2 LPA</p><p>Companies visited: 140</p>
<h2>Placement Highlights ${NOW - 3}-${String(NOW - 2).slice(2)}</h2>
<p>Highest package: 28 LPA</p>
</body></html>`;
    const history = placementHistoryFrom([page('placement', html)]);
    assert.deepEqual(history.map((row) => [row.year, row.highestPackageLpa]), [[NOW - 1, 32], [NOW - 2, 28]]);
    assert.equal(history[0].averagePackageLpa, 7.2);
    assert.equal(history[0].companies, 140);
  });

  test('seasons with no figure, or older than five years, are left out', () => {
    const html = `<html><body><h2>Placement ${NOW - 9}</h2><p>Highest package: 9 LPA</p><h2>Placement ${NOW - 1}</h2><p>Our students did well.</p></body></html>`;
    assert.deepEqual(placementHistoryFrom([page('placement', html)]), []);
  });
});

describe('photographs no older than five years', () => {
  test('the address dates a picture: camera name, upload folder, a year in the name', () => {
    assert.equal(photoYearOf('/uploads/IMG_20190512_101010.jpg'), 2019);
    assert.equal(photoYearOf('/wp-content/uploads/2017/08/campus.jpg'), 2017);
    assert.equal(photoYearOf('/gallery/convocation-2024.jpg'), 2024);
    assert.equal(photoYearOf('/images/campus-2024x1080.jpg'), null, 'a width is not a year');
    assert.equal(photoYearOf('/images/main-building.jpg'), null);
  });

  test('old pictures are not offered at all; recent ones rank first', () => {
    const html = `<html><body>
<img src="/wp-content/uploads/2016/03/campus-view.jpg" alt="Campus view">
<img src="/images/campus-building.jpg" alt="Academic block">
<img src="/wp-content/uploads/${NOW}/02/campus-aerial.jpg" alt="Aerial view of campus">
</body></html>`;
    const urls = galleryCandidates([page('campus', html)], { domain: DOMAIN }).map((item) => item.url);
    assert.deepEqual(urls, [`${SITE}/wp-content/uploads/${NOW}/02/campus-aerial.jpg`, `${SITE}/images/campus-building.jpg`]);
  });

  test('photographs on the institution\'s own CDN and in <picture> sources are found', () => {
    const html = `<html><body>
<picture><source media="(min-width:769px)" srcset="https://upeswebsitecdn-prod.a02.azurefd.net/drupal-data/2026-09/campus-aerial.jpg" width="1920" height="800">
<img src="/assets/images/blank.gif" data-src="https://upeswebsitecdn-prod.a02.azurefd.net/drupal-data/2026-09/campus-aerial-m.jpg" width="430" height="500" alt="Campus aerial view"></picture>
<img srcset="/img/library-480.jpg 480w, /img/library-1600.jpg 1600w" src="/img/library-480.jpg" alt="Central library building">
<img src="https://randomstock.azurefd.net/campus.jpg" alt="Campus">
</body></html>`;
    const urls = galleryCandidates([page('campus', html)], { domain: 'upes-example.ac.in'.replace('upes-example', 'upeswebsitecdn') }).map((item) => item.url);
    assert.ok(urls.includes('https://upeswebsitecdn-prod.a02.azurefd.net/drupal-data/2026-09/campus-aerial.jpg'), 'the desktop source, on the institution\'s CDN');
    assert.ok(!urls.some((url) => url.includes('campus-aerial-m.jpg')), 'not the portrait mobile crop');
    assert.ok(!urls.some((url) => url.includes('randomstock')), 'a CDN host that does not carry the institution\'s name is not trusted');
    const local = galleryCandidates([page('campus', html)], { domain: DOMAIN }).map((item) => item.url);
    assert.ok(local.includes(`${SITE}/img/library-1600.jpg`), 'the largest srcset candidate');
  });

  test('the file proves its age: camera date or a Last-Modified long ago', () => {
    const exif = Buffer.from(`Exif\0\0....2018:06:01 10:20:30\0....${NOW}:01:05 09:00:00\0`, 'latin1');
    assert.equal(exifYear(exif), 2018, 'the earliest date is when it was taken');
    assert.equal(exifYear(Buffer.from('2008:01:01 00:00:00', 'latin1')), null, 'a camera clock that was never set says nothing');
    assert.equal(photoAge({ exif }).tooOld, true);
    assert.equal(photoAge({ lastModified: 'Tue, 10 Mar 2015 08:00:00 GMT' }).tooOld, true);
    assert.equal(photoAge({ lastModified: new Date().toUTCString() }).tooOld, false);
    assert.deepEqual(photoAge({}), { takenYear: null, tooOld: false, evidence: '' }, 'an undated picture is not refused');
  });
});

describe('fee and placement documents (PDF)', () => {
  test('only fee and placement PDFs on the same site, newest session first, never payment notices', () => {
    const html = `<html><body>
<a href="/docs/fee-structure-2019-20.pdf">Fee Structure 2019-20</a>
<a href="/docs/fee-structure-${NOW}-${String(NOW + 1).slice(2)}.pdf">Fee Structure ${NOW}-${String(NOW + 1).slice(2)}</a>
<a href="/docs/fee-payment-instructions.pdf">How to pay fees</a>
<a href="https://elsewhere.com/fees.pdf">Fees</a>
<a href="/docs/placement-record.pdf">Placement record</a>
<a href="/docs/brochure.pdf">Brochure</a>
</body></html>`;
    const picked = pickDocuments([page('admission', html)], { domain: DOMAIN });
    assert.deepEqual(picked.map((item) => [item.category, new URL(item.url).pathname]), [
      ['fees', `/docs/fee-structure-${NOW}-${String(NOW + 1).slice(2)}.pdf`],
      ['placement', '/docs/placement-record.pdf'],
    ]);
  });

  test('positioned PDF text becomes rows and cells, and a fee table reads like an HTML one', () => {
    const item = (str, x, y) => ({ str, x, y, width: str.length * 5, fontSize: 10 });
    const rows = rowsFromItems([[
      item('Fee Structure 2025-26 (per annum)', 40, 800),
      item('Programme', 40, 760), item('Duration', 250, 760), item('Fee (Rs.)', 400, 760),
      item('B.Tech', 40, 740), item('(CSE)', 75, 740), item('4 Years', 250, 740), item('1,25,000', 400, 740),
      item('MBA', 40, 720), item('2 Years', 250, 720), item('95,000', 400, 720),
    ]]);
    assert.deepEqual(rows[2], ['B.Tech (CSE)', '4 Years', '1,25,000']);
    const document = documentPage(rows, { url: `${SITE}/fees.pdf`, category: 'fees' });
    assert.equal(document.tables[0].caption, 'Fee Structure 2025-26 (per annum)');
    const fees = programmeRows([document]);
    assert.deepEqual(fees.map((row) => [row.name, row.annualFeeInr, row.durationYears, row.feeYear]), [
      ['B.Tech (CSE)', 125_000, 4, '2025-26'],
      ['MBA', 95_000, 2, '2025-26'],
    ]);
  });
});

describe('fee layouts common on college sites', () => {
  const feesOf = (pages) => programmeRows(pages).map((row) => [row.name, row.annualFeeInr, row.semesterFeeInr, row.totalFeeInr]);

  test('a fee table nested in layout tables, a group column, "I Year" columns and four-digit cells', () => {
    const fees = page('fees', `<html><body><table><tr><td><table><tr><td>COLLEGE FEE</td></tr><tr><td>
<table><tr><th>Course</th><th>Group</th><th>I Year</th><th>II Year</th><th>III Year</th></tr>
<tr><td>B.Sc.</td><td>Maths, Physics, Chemistry</td><td>11500</td><td>5000</td><td>5000</td></tr>
<tr><td>Botany, Zoology, Chemistry</td><td>11500</td><td>5000</td><td>5000</td></tr>
<tr><td>B.A.</td><td>History, Economics, Politics</td><td>8000</td><td>3500</td><td>3500</td></tr>
</table></td></tr></table></td></tr></table></body></html>`);
    assert.equal(fees.tables.length, 1, 'only the innermost table is read');
    assert.deepEqual(feesOf([fees]), [
      ['B.Sc. (Maths, Physics, Chemistry)', 11_500, undefined, undefined],
      ['B.Sc. (Botany, Zoology, Chemistry)', 11_500, undefined, undefined],
      ['B.A. (History, Economics, Politics)', 8000, undefined, undefined],
    ]);
  });

  test('a four-digit charge beside a five-digit fee is not the fee', () => {
    const fees = page('fees', `<table><tr><th>Programme</th><th>Registration (per semester)</th><th>Tuition per semester</th></tr>
<tr><td>B.Sc. MLT</td><td>1500</td><td>48,500</td></tr></table>`);
    assert.deepEqual(feesOf([fees]), [['B.Sc. MLT', undefined, 48_500, undefined]]);
  });

  test('the programme named above the table, semester columns and a total', () => {
    const fees = page('fees', `<html><head><title>Fee Structure – A College</title></head><body>
<h3>B.C.A. Fee Structure</h3><figure class="wp-block-table"><table>
<tr><th>1st Semester</th><th>2nd Semester</th><th>3rd Semester</th><th>Total</th></tr>
<tr><td>9,500.00</td><td>9,500.00</td><td>9,500.00</td><td>57,000.00</td></tr></table></figure></body></html>`);
    assert.deepEqual(feesOf([fees]), [['B.C.A.', undefined, 9500, 57_000]]);
  });

  test('a fee authority approval: the year\'s total for the programme the page is about; district lists skipped', () => {
    const approval = page('fees', `<html><head><title>Welcome to HKCP » B.Pharm Fee Structure</title></head><body>
<p>Fee Approved by Fees Regulating Authority, Maharashtra for Academic Year 2024–25</p><table>
<tr><th>Sr. No.</th><th>Inst ID</th><th>Inst Name</th><th>Tuition Fee</th><th>Development Fee</th><th>Total Fee</th></tr>
<tr><td>1</td><td>PH3234</td><td>H.K. College of Pharmacy, Mumbai</td><td>119643</td><td>14357</td><td>134000</td></tr></table></body></html>`);
    assert.deepEqual(feesOf([approval]), [['B.Pharm', 134_000, undefined, undefined]]);
    const district = page('fees', `<html><head><title>B.Pharm Fee Structure</title></head><body>
<p>Fee Approved by Fees Regulating Authority for Academic Year 2026-27</p><table>
<tr><th>Sr.</th><th>Inst Name</th><th>Tuition Fee</th><th>Total Fee</th></tr>
<tr><td>1</td><td>Royal College of Pharmacy</td><td>78139</td><td>86500</td></tr>
<tr><td>2</td><td>Wankhede Institute of Pharmacy</td><td>49456</td><td>54500</td></tr></table></body></html>`);
    assert.deepEqual(feesOf([district]), [], 'which row is this institution is unknown');
  });

  test('programmes as columns: the tuition row gives each programme\'s fee for the period it states', () => {
    const fees = page('fees', `<table>
<tr><th>Sl. No.</th><th>Particulars</th><th>BA (GEN) AMT. RS.</th><th>B.Sc (HONS) AMT. RS.</th></tr>
<tr><td>1</td><td>Admission Fee (p.a.)</td><td>2,000</td><td>2,500</td></tr>
<tr><td>2</td><td>Tuition Fee (per annum)</td><td>12,000</td><td>18,000</td></tr>
<tr><td>3</td><td>Total</td><td>14,000</td><td>20,500</td></tr></table>`);
    assert.deepEqual(feesOf([fees]), [['BA (GEN)', 12_000, undefined, undefined], ['B.Sc (HONS)', 18_000, undefined, undefined]]);
  });

  test('a titled table of branches, "per-Annum" and a two-row quota header', () => {
    const fees = page('fees', `<html><head><title>Fee Structure - A College</title></head><body>
<h3>Fee Structure - B.Tech</h3><table>
<tr><th>S.no</th><th>Course</th><th colspan="3">Tuition Fee (INR)(per-Annum )</th></tr>
<tr><th>Category - A (Convenor Quota )</th><th>Category - B (Management Quota )</th><th>Lateral Entry</th></tr>
<tr><td>1</td><td>Computer Science and Engineering</td><td>80,800</td><td>2,00,000</td><td>80,800</td></tr>
<tr><td>2</td><td>Civil Engineering</td><td>80,800</td><td>1,00,000</td><td>80,800</td></tr></table>
<h3>Fee Structure - M.Tech</h3><table>
<tr><th>S.No</th><th>Course</th><th>Tuition Fee (INR) (per-Annum )</th></tr>
<tr><td>01</td><td>CAD-CAM</td><td>50,000</td></tr><tr><td>02</td><td>Machine Design</td><td>50,000</td></tr></table></body></html>`);
    assert.deepEqual(feesOf([fees]), [
      ['B.Tech (Computer Science and Engineering)', 80_800, undefined, undefined],
      ['B.Tech (Civil Engineering)', 80_800, undefined, undefined],
      ['M.Tech (CAD-CAM)', 50_000, undefined, undefined],
      ['M.Tech (Machine Design)', 50_000, undefined, undefined],
    ]);
    const categories = page('fees', `<h3>B.Ed. Fee Structure</h3><table><tr><th>Category</th><th>Fee per annum</th></tr>
<tr><td>General</td><td>45,000</td></tr><tr><td>SC / ST</td><td>12,000</td></tr></table>`);
    assert.deepEqual(feesOf([categories]).filter((row) => row[0] !== 'B.Ed.'), [], 'seat categories are not branches');
  });

  test('a fee PDF is named by its own title; the link text that led to it is only a fallback', () => {
    const rows = [['PROPOSED BE 1ST YEAR FEE STRUCTURE – 2024-25'], ['Types of Fee', 'CSE', 'ECE'], ['Tuition Fee', 'Rs.186111', 'Rs.140000']];
    const document = { ...documentPage(rows, { url: `${SITE}/fee.pdf`, category: 'fees' }), linkText: 'MBA Fee Structure' };
    assert.deepEqual(feesOf([document]).map(([name]) => name), ['BE'], 'not the MBA the link names');
    const unnamed = { ...documentPage([['Tuition Fee (per annum)', 'Rs. 52,000']], { url: `${SITE}/f.pdf`, category: 'fees' }), linkText: 'B.Com Fee Structure 2026-27' };
    assert.deepEqual(feesOf([unnamed]), [['B.Com', 52_000, undefined, undefined]]);
  });

  test('an unnamed PDF linked as "View" from a fee page is read, after any PDF named as fees', () => {
    const hub = page('fees', `<table><tr><td>College Fees Structure 2026-2027</td><td><a href="/uploads/a1b2.pdf">View</a></td></tr></table>
<a href="/uploads/Fee-Structure-2026-27.pdf">Fee structure</a>`);
    assert.deepEqual(pickDocuments([hub], { domain: 'gvu-example.ac.in' }).map((item) => item.url), [`${SITE}/uploads/Fee-Structure-2026-27.pdf`, `${SITE}/uploads/a1b2.pdf`]);
    const about = page('about', '<a href="/uploads/c3d4.pdf">View</a>');
    assert.deepEqual(pickDocuments([about], { domain: 'gvu-example.ac.in' }), []);
  });

  test('fee links: "feedback", "institution" and "constitution" are not fee pages', () => {
    const fees = LINK_CATEGORIES.find(([name]) => name === 'fees')[1];
    for (const text of ['/fees-structure/', '/fee_structure.php', '/FeeStructure2025-26', '/content.php?page=COLLEGE+FEE', 'Tuition Fee', '/admissionfees']) assert.ok(fees.test(text), text);
    for (const text of ['/employer-feedback/', '/institutional-distinctiveness/', '/constitution-of-gb/', '/coffee-club']) assert.ok(!fees.test(text), text);
    const documents = DOCUMENT_RULES.find(([name]) => name === 'fees')[1];
    assert.ok(documents.test('Fee Structure 2026-27') && documents.test('TUTION-FEES'));
    assert.ok(!documents.test('Students Feedback Analysis') && !documents.test('Institutional Ethics Committee'));
  });
});

describe('placement lists: the institution\'s own list of placed students, counted', () => {
  test('a NAAC 5.2.1 table: students, distinct employers and the highest package, per season', () => {
    const list = page('placement', `<h3>5.2.1 Placement of outgoing students</h3><table>
<tr><th>Year</th><th>Name of the student</th><th>Programme</th><th>Name of the employer</th><th>Pay package (Rs.)</th></tr>
<tr><td>${NOW - 1}-${String(NOW).slice(2)}</td><td>Archa P</td><td>MCOM</td><td>Meitra Hospital, Calicut</td><td>265000</td></tr>
<tr><td>${NOW - 1}-${String(NOW).slice(2)}</td><td>Ardra M</td><td>MCOM</td><td>TCS, Kozhikode</td><td>3,60,000</td></tr>
<tr><td>${NOW - 1}-${String(NOW).slice(2)}</td><td>Jisna N</td><td>BBA</td><td>TCS, Kochi</td><td>2,40,000</td></tr>
<tr><td>${NOW - 2}-${String(NOW - 1).slice(2)}</td><td>Moncy</td><td>BBA</td><td>Pratham</td><td>2,61,756</td></tr>
</table>`);
    const history = placementHistoryFrom([list]);
    assert.equal(history.length, 1, 'a season with fewer than three students is left out');
    assert.deepEqual(history[0], { year: NOW, session: `${NOW - 1}-${String(NOW).slice(2)}`, studentsPlaced: 3, basis: 'student-list', sourcePage: list.url, companies: 2, highestPackageLpa: 3.6 });
  });

  test('a PDF list with its header split over lines, seasoned by its title; internships are not jobs', () => {
    const season = `${NOW - 1}-${String(NOW).slice(2)}`;
    const rows = [[`PLACEMENT ${season}`], ['S.NO. STUDENT GRADUA', 'YEAR OF', 'NAME OF THE COMPANY'], ['NAME', 'TED', 'GRADUATI'],
      ...['Sonu', 'Naveen', 'Payal', 'Gautam'].map((name, index) => [String(index + 1), name, 'GGCP', String(NOW - 1), 'Care Health Insurance, GGN'])];
    const document = documentPage(rows, { url: `${SITE}/placements.pdf`, category: 'placement' });
    assert.deepEqual(placementHistoryFrom([document]).map((row) => [row.session, row.studentsPlaced, row.basis]), [[season, 4, 'student-list']]);
    const internships = page('placement', `<h3>Internships ${season}</h3><table><tr><th>Name of the student</th><th>Company</th><th>Stipend</th></tr>
${['A', 'B', 'C', 'D'].map((name) => `<tr><td>${name}</td><td>Infosys</td><td>10000</td></tr>`).join('')}</table>`);
    assert.deepEqual(placementHistoryFrom([internships]), []);
  });

  test('a season the page sums up itself is kept as printed, not recounted from its list', () => {
    const season = `${NOW - 1}-${String(NOW).slice(2)}`;
    const pageWithBoth = page('placement', `<h2>Placement Statistics ${season}</h2><p>Students placed: 120</p><p>Highest package: 12 LPA</p>
<h3>Placement record ${season}</h3><table><tr><th>Name of the student</th><th>Company</th></tr>
${['A', 'B', 'C', 'D'].map((name) => `<tr><td>${name}</td><td>Infosys</td><td>B.Tech</td></tr>`).join('')}</table>`);
    const [row] = placementHistoryFrom([pageWithBoth]);
    assert.equal(row.studentsPlaced, 120);
    assert.equal(row.basis, undefined);
  });
});

describe('fee sections: a heading names the programme, rows below carry the amounts', () => {
  const section = (lines, embeddedLines = []) => ({ url: `${SITE}/fees.pdf`, category: 'fees', head: { title: '' }, headings: [], tables: [], lines, embeddedLines });

  test('a fee document: shouted headings, semester and year columns, extras not read as tuition', () => {
    const rows = programmeRows([section([
      'FEE STRUCTURE FOR THE', 'ACADEMIC YEAR 2026',
      'TOTAL FEES FOR MBA PROGRAM IN', 'MARKETING | FINANCE | BFSI*',
      'Semester I | Semester II | Semester III | Semester IV',
      'Program Fee | Rs. 1,75,000/- | Rs. 1,75,000/- | Rs. 2,25,000/- | Rs. 2,25,000/-',
      'CAS/ETS | Rs. 50,000/- | Rs. 50,000/-',
      'TOTAL FEES FOR BBA PROGRAM',
      'Year I | Year II | Year III',
      'Program Fee | Rs. 1,15,000/- | Rs. 1,25,000/-',
      'APPLICATION PROCEDURE',
      'Obtain the form on payment of Rs.1100/-in cash.',
    ])]);
    assert.deepEqual(rows.map((row) => [row.name, row.semesterFeeInr, row.annualFeeInr]), [
      ['MBA Program in Marketing, Finance, BFSI', 175_000, undefined],
      ['BBA Program', undefined, 115_000],
    ]);
  });

  test('a page that ships its fee table as data: label then bare amounts, scholarships ignored', () => {
    const rows = programmeRows([section([], [
      'Select a course to view fee details', 'B.Tech Computer Science and Engineering (RQ)', '1st Year', 'Payment Options',
      'Tuition Fee Per Semester', '213800', '213800', 'Scholarship', '75000', '50000',
      'B.Tech Biotech', '1st Year', 'Scholarship', '40000', 'Tuition Fee Per Semester', '150800',
    ])]);
    assert.deepEqual(rows.map((row) => [row.name, row.semesterFeeInr, row.annualFeeInr]), [
      ['B.Tech Computer Science and Engineering (RQ)', 213_800, undefined],
      ['B.Tech Biotech', 150_800, undefined],
    ]);
  });
});

test('about: the first paragraph introduces the institution; addresses and abbreviations handled', () => {
  const html = `<html><body>
<p>The campus houses a well-stocked library that provides access to a wide range of academic resources.</p>
<p>Graphic Era Hill University Campus, Tularampur, Bareilly Road, Beriparao, Haldwani-263139 (Nainital)</p>
<p>Founded in 2011, Graphic Era Hill University is a private university in Dehradun. It is led by Chancellor Dr. Kamal Ghanshala and recognised by the UGC.</p>
</body></html>`;
  const { about } = aboutDeep([page('about', html)], { name: 'Graphic Era Hill University' });
  assert.match(about, /^Founded in 2011, Graphic Era Hill University is a private university/);
  assert.match(about, /Chancellor Dr\. Kamal Ghanshala and recognised/, 'no split after "Dr."');
  assert.doesNotMatch(about, /library|263139/);
});

test('about: up to three factual paragraphs, separated by a blank line', () => {
  const html = `<html><body>
<p>Green Valley University was established in 2009 by an Act of the Haryana State Legislature. It is recognised by the UGC under Section 2(f).</p>
<p>The university offers 42 programmes through seven schools, from engineering to law. Admissions to B.Tech are through JEE Main scores.</p>
<p>The campus covers 25 acres in Sonipat district, with separate hostels for 1,800 students.</p>
<p>We are a premier university with a vision of excellence for a bright future.</p></body></html>`;
  const { about } = aboutDeep([page('about', html)]);
  const paragraphs = about.split('\n\n');
  assert.equal(paragraphs.length, 3);
  assert.match(paragraphs[1], /42 programmes/);
  assert.doesNotMatch(about, /premier/);
});

test('catalogue match: the longest name wins, aliases count', () => {
  const courses = [
    { slug: 'bsc', name: 'B.Sc', fullName: 'Bachelor of Science' },
    { slug: 'nursing', name: 'B.Sc Nursing', fullName: '' },
    { slug: 'ba-llb', name: 'BA LLB', fullName: '', aliases: ['B.A. LL.B. (Hons.)'] },
    { slug: 'ba', name: 'BA', fullName: 'Bachelor of Arts' },
  ];
  assert.deepEqual(matchCourseSlugs(['B.Sc. Nursing (4 years)'], courses), ['nursing']);
  assert.deepEqual(matchCourseSlugs(['B.Sc (Hons) Physics', 'Bachelor of Science in Chemistry'], courses), ['bsc']);
  assert.deepEqual(matchCourseSlugs(['B.A. LL.B (Hons)', 'B.A. English'], courses), ['ba-llb', 'ba']);
  assert.deepEqual(matchCourseSlugs(['BAMS'], courses), [], 'BAMS is not BA');
});
