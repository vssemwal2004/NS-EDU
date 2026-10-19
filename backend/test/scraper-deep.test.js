import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aboutDeep, activitiesFrom, admissionNoteFrom, campusFrom, durationIn, entranceExamsFrom,
  facilitiesFrom, galleryCandidates, levelOf, placementsFrom, programmeRows, rupeesIn,
} from '../src/scraper/deep.js';
import { parsePage } from '../src/scraper/extract.js';
import { INSTITUTION_FIELDS, IMPORTABLE_FIELDS, MACHINE_FIELDS } from '../src/modules/universities/schema.js';
import { validate } from '../src/lib/validation.js';

const SITE = 'https://www.gvu-example.ac.in';
const DOMAIN = 'gvu-example.ac.in';

const html = {
  about: `<html><head><title>About</title></head><body>
<p>Cookie notice: we use cookies to improve your experience on this website and for analytics, as described in our policy.</p>
<p>Green Valley University is a state private university established in 2009 by an Act of the Haryana State Legislature.
It is recognised by the University Grants Commission under Section 2(f) and offers programmes in engineering, management and sciences.
The university is the best place to shape a bright future for every aspirant.
The campus covers 25 acres in Sonipat district.</p></body></html>`,
  programmes: `<html><body><h1>Programmes and fees</h1><table>
<tr><th>Programme</th><th>Duration</th><th>Annual Fee</th></tr>
<tr><td>B.Tech Computer Science and Engineering</td><td>4 Years</td><td>₹1,25,000 per year</td></tr>
<tr><td>M.Tech Structural Engineering</td><td>2 Years</td><td>Rs. 90,000</td></tr>
<tr><td>Diploma in Civil Engineering</td><td>3 Years</td><td>Total course fee Rs. 1,50,000</td></tr>
<tr><td>Admission brochure</td><td>-</td><td>-</td></tr>
</table></body></html>`,
  placement: `<html><body><h2>Training and Placement</h2>
<p>Placement highlights for the 2024 batch: the average package was 6.5 LPA and the highest package was 24 LPA.</p>
<p>92% of eligible students were placed.</p>
<h3>Our Recruiters</h3>
<div class="recruiter-logos"><img src="/img/recruiters/infosys.png" alt="Infosys"><img src="/img/recruiters/tcs.png" alt="Tata Consultancy Services logo">
<img src="/img/recruiters/wipro.png" alt="Wipro"><img src="/img/recruiters/r5.png" alt="Green Valley University"><img src="/img/recruiters/r6.png" alt="Call"></div>
<img src="/img/campus-banner.jpg" alt="Deloitte"></body></html>`,
  campus: `<html><body><h1>Campus and Facilities</h1>
<p>The campus is spread over 25 acres and is fully Wi-Fi enabled.</p>
<ul><li>Central library with 40,000 volumes</li><li>Separate hostel accommodation for boys and girls</li>
<li>Computer laboratories</li><li>Sports ground and gymnasium</li><li>Medical room with an ambulance</li>
<li>Bus transport facility</li><li>Auditorium and seminar hall</li><li>Canteen</li></ul>
<p>Students run an NSS unit, an NCC troop, a music club and the annual cultural fest.</p>
<img src="/img/logo.png" alt="University logo" width="200" height="80">
<img src="/images/campus-main-building.jpg" alt="Main academic block" width="1200" height="700">
<img src="/images/library-interior.jpg" alt="Central library">
<img src="/images/dr-rakesh-principal.jpg" alt="Dr. Rakesh, Principal" width="800" height="600">
<img src="https://cdn.other-site.example.com/x.jpg" alt="Campus view" width="1200" height="700">
<img src="/images/icon-arrow.png" alt="">
<img src="/images/sports-ground.jpg" alt="Sports ground" width="1600" height="900">
<img src="/images/thin-banner.jpg" alt="Campus strip" width="1600" height="200"></body></html>`,
  admission: `<html><body><h1>Admissions 2026</h1>
<p>Admission to the B.Tech programme is through JEE Main followed by state counselling; candidates must have passed Class 12 with physics, chemistry and mathematics. Applications open on 1 March and close on 30 June.</p></body></html>`,
};

const page = (name, category = name) => ({ ...parsePage(html[name], `${SITE}/${name}`), category });

describe('deep extraction', () => {
  test('about keeps factual sentences, drops marketing and records the page it came from', () => {
    const { about, aboutSource } = aboutDeep([page('about')]);
    assert.ok(about.startsWith('Green Valley University is a state private university established in 2009'));
    assert.ok(about.includes('Section 2(f)'), about);
    assert.ok(about.includes('25 acres'), about);
    assert.ok(!about.includes('bright future'), 'marketing sentence kept');
    assert.ok(!about.includes('Cookie notice'), 'boilerplate kept');
    assert.ok(about.length <= 1200);
    assert.equal(aboutSource, `${SITE}/about`);
    assert.deepEqual(aboutDeep([]), { about: '', aboutSource: '' });
  });

  test('a page that is only sales copy produces no about text', () => {
    // Verbatim shape of a real college page the first crawl produced marketing-only "facts" from.
    const fluff = parsePage(`<html><body><p>Established with a vision to provide quality management education, AJIM has consistently
strived for excellence in the field of business and management studies. The institute is known for its commitment to fostering
leadership skills, nurturing innovation, and preparing students to excel in the business world. This introduction encapsulates the
institute's dedication to shaping the leaders of tomorrow through a contemporary approach to management education.</p></body></html>`, `${SITE}/about`);
    assert.deepEqual(aboutDeep([{ ...fluff, category: 'about' }]), { about: '', aboutSource: '' });
  });

  test('money and duration are only read when the page prints them', () => {
    assert.equal(rupeesIn('₹1,25,000 per year'), 125_000);
    assert.equal(rupeesIn('Rs. 1.25 Lakh'), 125_000);
    assert.equal(rupeesIn('INR 1 Crore'), 10_000_000);
    assert.equal(rupeesIn('Fee structure will be announced'), null);
    assert.equal(rupeesIn('Rs. 100'), null, 'implausibly small amounts are ignored');
    assert.equal(rupeesIn('INR 2 Crore'), null, 'implausibly large amounts are ignored');
    assert.equal(durationIn('4 Years'), 4);
    assert.equal(durationIn('8 semesters'), 4);
    assert.equal(durationIn('18 months'), 1.5);
    assert.equal(durationIn('full time'), null);
    assert.deepEqual(['B.Tech CSE', 'M.Tech', 'Ph.D in Physics', 'Diploma in Civil'].map(levelOf), ['UG', 'PG', 'PhD', 'Diploma']);
  });

  test('programme rows carry level, duration and only unambiguous per-year fees', () => {
    const rows = programmeRows([page('programmes')], ['MBA']);
    assert.deepEqual(rows.map((row) => row.name), ['B.Tech Computer Science and Engineering', 'M.Tech Structural Engineering', 'Diploma in Civil Engineering', 'MBA']);
    assert.deepEqual(rows[0], { name: 'B.Tech Computer Science and Engineering', sourcePage: `${SITE}/programmes`, level: 'UG', durationYears: 4, annualFeeInr: 125_000 });
    assert.equal(rows[1].annualFeeInr, 90_000, 'an "Annual Fee" column makes the amount per year');
    assert.equal(rows[2].annualFeeInr, undefined, 'a total course fee is never stored as an annual fee');
    assert.equal(rows[2].feeNote, 'Total course fee Rs. 1,50,000');
    assert.deepEqual(rows[3], { name: 'MBA', sourcePage: `${SITE}/programmes`, level: 'PG' });
    assert.equal(programmeRows([page('programmes')], Array.from({ length: 200 }, (_, index) => `MBA ${index}`)).length, 60);
  });

  test('placement figures come from the placement page only, with the year they belong to', () => {
    const placements = placementsFrom([page('placement'), page('about')], { institutionName: 'Green Valley University' });
    assert.equal(placements.year, 2024);
    assert.equal(placements.averagePackageLpa, 6.5);
    assert.equal(placements.highestPackageLpa, 24);
    assert.equal(placements.medianPackageLpa, undefined, 'a median that is not printed is never inferred');
    assert.equal(placements.placedPercent, 92);
    assert.deepEqual(placements.recruiters, ['Infosys', 'Tata Consultancy Services', 'Wipro'],
      'only images the markup labels as recruiter logos, never the institution\'s own name or a contact button');
    assert.equal(placements.sourcePage, `${SITE}/placement`);
    assert.equal(placementsFrom([page('about')]), null, 'no placement page means no placement data');
    assert.equal(placementsFrom([{ ...parsePage('<p>Placement cell</p>', SITE), category: 'placement' }]), null);
    const logosOnly = `<div class="recruiters"><img src="/r/a.png" alt="Infosys"><img src="/r/b.png" alt="Wipro"></div>`;
    assert.equal(placementsFrom([{ ...parsePage(logosOnly, SITE), category: 'placement' }]), null, 'two stray logos are not a placement record');
    // Filenames, social icons and page titles that real logo walls produced as "recruiters".
    const noisy = `<div class="recruiters"><img src="/r/a.png" alt="fb_messenger"><img src="/r/b.png" alt="logo -1">
<img src="/r/c.png" alt="ABBS | Acharya Bangalore B-School"><img src="/r/d.png" alt="AAACET33-1024x768"><img src="/r/e.png" alt="Infosys"></div>`;
    assert.equal(placementsFrom([{ ...parsePage(noisy, SITE), category: 'placement' }]), null);
    const chrome = `<div class="recruiters"><img src="/r/a.png" alt="Footer"><img src="/r/b.png" alt="NAAC"><img src="/r/c.png" alt="Header"><img src="/r/d.png" alt="Infosys"></div>`;
    assert.equal(placementsFrom([{ ...parsePage(chrome, SITE), category: 'placement' }]), null, 'page chrome and accreditation marks are not recruiters');
    const header = `<p>Average package 5 LPA.</p><img src="/img/site-logo.png" alt="Wipro">`;
    assert.equal(placementsFrom([{ ...parsePage(header, SITE), category: 'placement' }]).recruiters, undefined,
      'a header logo is not a recruiter wall, whatever its alt text says');
  });

  test('facilities, activities and campus details are only what the site names', () => {
    const pages = [page('campus')];
    assert.deepEqual(facilitiesFrom(pages), ['Hostel', 'Library', 'Laboratories', 'Sports facilities', 'Gymnasium', 'Medical centre', 'Transport', 'Wi-Fi campus', 'Auditorium', 'Cafeteria']);
    assert.deepEqual(activitiesFrom(pages), ['NSS', 'NCC', 'Cultural fest', 'Student clubs', 'Music and dance']);
    const campus = campusFrom(pages);
    assert.equal(campus.sizeAcres, 25);
    assert.equal(campus.hostelAvailable, true);
    assert.equal(campus.coEd, undefined, 'co-ed status is only stored when it is printed');
    assert.equal(campus.sourcePage, `${SITE}/campus`);
    assert.equal(campusFrom([page('admission')]), null);
    assert.deepEqual(facilitiesFrom([page('admission')]), []);
  });

  test('gallery candidates: own domain, photo-shaped, no logos, icons or people', () => {
    const found = galleryCandidates([page('campus')], { domain: DOMAIN });
    assert.deepEqual(found.map((item) => item.url), [
      `${SITE}/images/campus-main-building.jpg`, `${SITE}/images/library-interior.jpg`, `${SITE}/images/sports-ground.jpg`,
    ]);
    assert.equal(found[0].caption, 'Main academic block');
    assert.equal(found[1].caption, 'Central library');
    assert.equal(found[2].caption, 'Sports ground');
    // Template alt text describes nothing; a real crawl captioned six photographs "Responsive thumbnail".
    const boilerplate = parsePage('<img src="/images/campus-view.jpg" alt="Responsive thumbnail" width="1200" height="700">', `${SITE}/campus`);
    assert.equal(galleryCandidates([{ ...boilerplate, category: 'campus' }], { domain: DOMAIN })[0].caption, '');
    assert.equal(found[0].sourcePage, `${SITE}/campus`);
    assert.equal(galleryCandidates([page('campus')], { domain: DOMAIN, limit: 2 }).length, 2);
  });

  test('admission note and named entrance exams', () => {
    const note = admissionNoteFrom([page('admission')]);
    assert.ok(note.admissionNote.startsWith('Admission to the B.Tech programme is through JEE Main'));
    assert.ok(note.admissionNote.length <= 400);
    assert.equal(note.sourcePage, `${SITE}/admission`);
    assert.deepEqual(entranceExamsFrom([page('admission')]), ['JEE Main']);
    assert.deepEqual(entranceExamsFrom([page('campus')]), []);
    assert.equal(admissionNoteFrom([page('campus')]), null);
  });
});

describe('institution schema: structured fields', () => {
  const fields = INSTITUTION_FIELDS.filter((field) => IMPORTABLE_FIELDS.includes(field.name));
  const run = (input) => validate(fields, input, { partial: true });

  test('every new field is importable, optional and safe when absent', () => {
    for (const name of ['aboutSource', 'gallery', 'programmesOffered', 'placements', 'facilities', 'activities', 'campus', 'admissionNote', 'entranceExams']) {
      assert.ok(IMPORTABLE_FIELDS.includes(name), `${name} is not importable`);
    }
    // Other agents add structured fields here too, so check ours are listed rather than the whole set.
    for (const name of ['gallery', 'programmesOffered', 'placements', 'campus']) assert.ok(MACHINE_FIELDS.includes(name), `${name} is not a machine field`);
    const { value, errors } = run({ name: 'X', city: 'Y' });
    assert.deepEqual(errors, {});
    assert.deepEqual(Object.keys(value), ['name', 'city']);
  });

  test('gallery rows validate, fill the credit and drop broken rows', () => {
    const { value, errors } = run({ gallery: [
      { url: 'https://res.cloudinary.com/demo/a.webp', caption: 'Library', sourcePage: `${SITE}/campus`, width: 1600, height: 900 },
      { caption: 'No URL at all' },
      { url: 'not-a-url' },
      { url: 'https://res.cloudinary.com/demo/b.webp' },
    ] });
    assert.deepEqual(errors, {});
    assert.equal(value.gallery.length, 2);
    assert.deepEqual(value.gallery[0], { url: 'https://res.cloudinary.com/demo/a.webp', caption: 'Library', credit: 'official website', sourcePage: `${SITE}/campus`, width: 1600, height: 900 });
    assert.equal(value.gallery[1].credit, 'official website');
  });

  test('placements and campus keep only the values that were given', () => {
    const { value } = run({ placements: { year: 2024, averagePackageLpa: 6.5, recruiters: ['Infosys'], sourcePage: `${SITE}/placement` }, campus: { sizeAcres: 25, hostelAvailable: true } });
    assert.deepEqual(value.placements, { year: 2024, averagePackageLpa: 6.5, recruiters: ['Infosys'], sourcePage: `${SITE}/placement` });
    assert.deepEqual(value.campus, { sizeAcres: 25, hostelAvailable: true });
    assert.equal(run({ placements: { averagePackageLpa: 5000 } }).value.placements, undefined, 'an out-of-range figure is dropped, not stored');
  });

  test('JSON text round-trips, and a form that cannot edit a structured field never blanks it', () => {
    const json = JSON.stringify([{ name: 'MBA', level: 'PG', annualFeeInr: 200000 }]);
    assert.deepEqual(run({ programmesOffered: json }).value.programmesOffered, [{ name: 'MBA', level: 'PG', annualFeeInr: 200000 }]);
    for (const input of ['[object Object]', '', 'anything else']) {
      const { value, errors } = run({ gallery: input, placements: input, campus: input, programmesOffered: input });
      assert.deepEqual(errors, {});
      assert.deepEqual(value, {}, `"${input}" should leave the stored value untouched`);
    }
  });
});
