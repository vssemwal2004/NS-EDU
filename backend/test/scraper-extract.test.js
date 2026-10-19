import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aboutFrom, addressFrom, admissionUrlFrom, approvalsFrom, buildRecord, cityFromAddress, emailFrom, establishedYearFrom, inferType, matchCourseSlugs, naacGradeFrom,
  nameFrom, nirfFrom, parsePage, phoneFrom, pickLinks, programmesFrom, streamsFrom, summarize,
} from '../src/scraper/extract.js';
import { canonicalState, stateFromPin, statesIn } from '../src/scraper/india.js';
import { csvCell, csvRow, parseCsv, rowsToObjects, unguardCell } from '../src/scraper/csv.js';
import { DOMAIN, fixtures, LONG_ABOUT, SITE } from './scraper-fixtures.js';

const COURSES = [
  { slug: 'btech', name: 'B.Tech', fullName: 'Bachelor of Technology' }, { slug: 'mtech', name: 'M.Tech', fullName: 'Master of Technology' },
  { slug: 'mba', name: 'MBA', fullName: 'Master of Business Administration' }, { slug: 'bba', name: 'BBA', fullName: 'Bachelor of Business Administration' },
  { slug: 'bca', name: 'BCA', fullName: 'Bachelor of Computer Applications' }, { slug: 'bpharm', name: 'B.Pharm', fullName: 'Bachelor of Pharmacy' },
  { slug: 'nursing', name: 'B.Sc Nursing', fullName: '' }, { slug: 'bdes', name: 'B.Des', fullName: 'Bachelor of Design' },
  { slug: 'ba', name: 'BA', fullName: 'Bachelor of Arts' }, { slug: 'mbbs', name: 'MBBS', fullName: 'Bachelor of Medicine and Bachelor of Surgery' },
];

const page = (name, category = name) => ({ ...parsePage(fixtures[name], `${SITE}/${name === 'home' ? '' : name}`), category });

describe('page extraction', () => {
  test('name comes from JSON-LD, then og:site_name, then the title', () => {
    assert.equal(nameFrom(page('home')), 'Doon Valley Institute of Technology');
    assert.equal(nameFrom(parsePage('<head><meta property="og:site_name" content="Riverbank College"><title>Home</title></head>', SITE)), 'Riverbank College');
    assert.equal(nameFrom(parsePage('<head><title>Welcome to Riverbank College of Arts | Home</title></head>', SITE)), 'Riverbank College of Arts');
    assert.equal(nameFrom(parsePage('<head><title>Home - Sunrise University, Jaipur</title></head>', SITE)), 'Sunrise University, Jaipur');
  });

  test('scripts never leak into text and only keyword links on the same site are followed', () => {
    const home = page('home');
    assert.ok(!home.lines.some((line) => line.includes('Hacking')));
    const links = pickLinks(home, { domain: DOMAIN, maxLinks: 7, exclude: [`${SITE}/`] });
    assert.deepEqual(links.map((link) => [new URL(link.url).pathname, link.category]), [
      ['/contact', 'contact'], ['/about-us', 'about'], ['/admissions', 'admission'], ['/academics/programmes', 'programmes'], ['/naac', 'accreditation'],
    ]);
    assert.equal(pickLinks(home, { domain: DOMAIN, maxLinks: 2 }).length, 2);
  });

  test('facts: established year, NAAC grade, NIRF rank and approvals in context', () => {
    const lines = [...page('about').lines, ...page('home').lines];
    assert.equal(establishedYearFrom(lines), 1998);
    assert.equal(establishedYearFrom(['Established under Section 3 of the UGC Act, 1956']), null);
    assert.equal(establishedYearFrom(['Estd. 1965']), 1965);
    assert.equal(naacGradeFrom(lines), 'A+');
    assert.equal(naacGradeFrom(['Accredited by NAAC with Grade "A"']), 'A');
    assert.equal(naacGradeFrom(['NAAC A++ accredited university']), 'A++');
    assert.equal(naacGradeFrom(['Re-accredited B++ by NAAC (3rd cycle)']), 'B++');
    assert.equal(naacGradeFrom(['NAAC peer team visit scheduled']), '');
    assert.deepEqual(nirfFrom(lines), { nirfRank: 87, nirfYear: 2024 });
    assert.deepEqual(nirfFrom(['NIRF 2023: Rank 45 in University category']), { nirfRank: 45, nirfYear: 2023 });
    assert.deepEqual(nirfFrom(['NIRF 2023 ranked in the 151-200 band']), { nirfRank: null, nirfYear: null });
    assert.deepEqual(approvalsFrom(lines), ['UGC', 'AICTE', 'PCI']);
    assert.deepEqual(approvalsFrom(['UGC NET coaching classes start soon.']), []);
  });

  test('programmes, streams and catalogue courses', () => {
    const programmes = programmesFrom(page('programmes').shortTexts);
    assert.deepEqual(programmes, [
      'B.Tech in Computer Science and Engineering', 'B.Tech in Mechanical Engineering', 'M.Tech (Structural Engineering)', 'MBA', 'BBA', 'BCA',
      'B.Pharm', 'B.Sc. Nursing', 'Bachelor of Design (B.Des)', 'MCA',
    ]);
    assert.deepEqual(streamsFrom([...programmes, 'School of Law']), ['Engineering', 'Management', 'Pharmacy', 'Nursing', 'Law', 'Design', 'Computer Applications']);
    assert.deepEqual(streamsFrom(['B.Sc Physics', 'BA LLB', 'BAMS']), ['Medical', 'Law', 'Science', 'Arts & Humanities']);
    assert.deepEqual(matchCourseSlugs([...programmes, 'B. Tech (AI)', 'BAMS', 'BA LLB'], COURSES), ['btech', 'mtech', 'mba', 'bba', 'bca', 'bpharm', 'nursing', 'bdes', 'ba']);
    assert.equal(programmesFrom(Array.from({ length: 300 }, (_, index) => `MBA Batch ${index}`)).length, 200);
  });

  test('address, PIN, state and city from a contact block', () => {
    const found = addressFrom(page('contact').lines);
    assert.deepEqual(found, { address: 'Doon Valley Institute of Technology, 12 Rajpur Road, Dehradun - 248001, Uttarakhand, India', pincode: '248001', state: 'Uttarakhand' });
    assert.equal(cityFromAddress(found.address, found.state), 'Dehradun');
    assert.equal(cityFromAddress('Plot 4, Sector 125, Noida, Uttar Pradesh 201313', 'Uttar Pradesh'), 'Noida');
    assert.equal(cityFromAddress('Village Kalujhanda, Distt. Solan, Himachal Pradesh 173229', 'Himachal Pradesh'), 'Solan');
    assert.equal(addressFrom(['Call +91 135 264 3421 for details', 'Phone: 0135-2643421']), null);
    // Lessons from real sites: spaced PINs, addresses without a state, and news items that mention one.
    assert.deepEqual(addressFrom(['Contact', 'Example Institute of Technology, Powai, Mumbai 400 076'], { pinState: true }),
      { address: 'Example Institute of Technology, Powai, Mumbai 400 076', pincode: '400076', state: 'Maharashtra' });
    assert.equal(addressFrom(['Example Institute of Technology, Powai, Mumbai 400 076']), null, 'PIN-derived state only on contact/about pages');
    assert.equal(addressFrom(['Corrigendum: "Clinic, Plot 30, Rohini, Delhi-110085" dated 20-8-2026']), null);
    assert.equal(cityFromAddress('Example Institute of Technology, Powai, Mumbai 400 076', 'Maharashtra'), 'Mumbai');
    assert.equal(cityFromAddress('Example University, North Campus, Delhi - 110007', 'Delhi'), 'Delhi');
    assert.deepEqual(['110007', '400076', '248001', '160014', '403001', '796001', '560001'].map(stateFromPin), ['Delhi', 'Maharashtra', 'Uttarakhand', '', 'Goa', 'Mizoram', 'Karnataka']);
    assert.equal(canonicalState('Orissa'), 'Odisha');
    assert.equal(canonicalState('NCT of Delhi'), 'Delhi');
    assert.equal(canonicalState('Atlantis'), '');
    assert.deepEqual(statesIn('Kolkata, West Bengal 700001'), ['West Bengal']);
  });

  test('contact data is institutional only: generic mailboxes on the own domain, no personal lines', () => {
    const contact = page('contact');
    assert.equal(emailFrom(contact, DOMAIN), 'info@dvit-example.ac.in');
    assert.equal(phoneFrom(contact), '01352000000');
    const personal = parsePage('<p>Dr. Asha Rao, Dean — <a href="mailto:info@dvit-example.ac.in">info@dvit-example.ac.in</a> <a href="tel:+919812345678">call</a></p><p>Write to asha.rao@dvit-example.ac.in or info@gmail.com</p>', SITE);
    assert.equal(emailFrom(personal, DOMAIN), '');
    assert.equal(phoneFrom(personal), '');
    assert.equal(emailFrom(parsePage('<p>Admissions: admissions [at] dvit-example.ac.in</p>', SITE), DOMAIN), 'admissions@dvit-example.ac.in');
  });

  test('admission links and about text skip news items', () => {
    const news = parsePage(`<a href="/index.php?mact=News&id=1">Admission merit list notice</a><a href="/">Admissions</a><a href="/admissions/ug">UG Admissions</a>
<p>Extension of last date for registration to the national seminar on education policy, pedagogy and practice, organised by the department this month for all scholars.</p>
<p>Example University was established in 1922 as a residential university and today has more than ninety affiliated colleges and several research centres across the city.</p>`, SITE);
    assert.equal(admissionUrlFrom([news], DOMAIN), `${SITE}/admissions/ug`);
    assert.ok(aboutFrom(news).startsWith('Example University was established in 1922'));
    assert.deepEqual(programmesFrom(['MBA, M.A. & M.Com Merit List 2026-27', 'B.Sc (Hons) - Computer ScienceNew']), ['B.Sc (Hons) - Computer Science']);
  });

  test('type inference and summaries', () => {
    assert.deepEqual(inferType('Example Institute of Science (Deemed to be University)'), { type: 'university', category: 'deemed-university' });
    assert.deepEqual(inferType('Riverbank Mahavidyalaya'), { type: 'college', category: '' });
    const summary = summarize(LONG_ABOUT);
    assert.ok(summary.length <= 600 && summary.endsWith('.'));
    assert.equal(summarize('Short text.'), 'Short text.');
  });

  test('buildRecord merges seed values with crawled facts and lists what the crawl contributed', () => {
    const pages = [page('about'), page('contact'), page('programmes'), { ...page('about'), category: 'accreditation' }];
    const { record, fields } = buildRecord({ home: page('home'), pages, source: { name: 'DVIT Dehradun', state: '', city: '' }, domain: DOMAIN, website: `${SITE}/`, courses: COURSES });
    assert.equal(record.name, 'DVIT Dehradun');
    assert.deepEqual(record.aliases, ['Doon Valley Institute of Technology']);
    assert.equal(record.website, `${SITE}/`);
    assert.equal(record.state, 'Uttarakhand');
    assert.equal(record.city, 'Dehradun');
    assert.equal(record.pincode, '248001');
    assert.equal(record.address, '12 Rajpur Road, Dehradun, Uttarakhand, 248001');
    assert.equal(record.type, 'institute');
    assert.equal(record.establishedYear, 1998);
    assert.equal(record.naacGrade, 'A+');
    assert.deepEqual([record.nirfRank, record.nirfYear], [87, 2024]);
    assert.equal(record.logoUrl, `${SITE}/img/logo.png`);
    assert.equal(record.admissionUrl, `${SITE}/admissions`);
    assert.equal(record.email, 'info@dvit-example.ac.in');
    assert.ok(record.about.startsWith('Doon Valley Institute of Technology (DVIT) was established in 1998') && record.about.length <= 600);
    assert.ok(record.courseSlugs.includes('btech') && record.coursesOffered.length === 10);
    for (const key of ['website', 'state', 'city', 'naacGrade', 'coursesOffered', 'email']) assert.ok(fields.includes(key), key);
    assert.ok(!fields.includes('name'));
    const seeded = buildRecord({ home: page('home'), pages: [], source: { name: 'DVIT', state: 'uttarakhand', city: 'Doon' }, domain: DOMAIN, website: `${SITE}/` });
    assert.deepEqual([seeded.record.state, seeded.record.city], ['Uttarakhand', 'Doon']);
    assert.ok(!seeded.fields.includes('state') && !seeded.fields.includes('city'));
  });
});

describe('CSV helpers', () => {
  test('parses quotes, embedded newlines, BOM and semicolon or tab delimiters', () => {
    assert.deepEqual(parseCsv('﻿name,streams\r\n"Doon, Valley","Engineering; Law"\n\n"Multi\nline",x\n'), [['name', 'streams'], ['Doon, Valley', 'Engineering; Law'], ['Multi\nline', 'x']]);
    assert.deepEqual(parseCsv('name;state\nA;Goa'), [['name', 'state'], ['A', 'Goa']]);
    assert.deepEqual(parseCsv('name\tstate\nA\tGoa'), [['name', 'state'], ['A', 'Goa']]);
    assert.throws(() => parseCsv('a\n"open'), /unclosed/);
    assert.throws(() => parseCsv('a\n1\n2\n3', { maxRows: 3 }), /at most 2 rows/);
    assert.deepEqual(rowsToObjects([['Name', 'Junk'], ['A', 'x'], ['', 'y']], (header) => (header === 'Name' ? 'name' : '')), [{ name: 'A' }, {}]);
  });

  test('cells are quoted and guarded against spreadsheet formulas', () => {
    assert.equal(csvRow(['a', 'b,c', 'say "hi"', null, ['x', 'y'], 3]), 'a,"b,c","say ""hi""",,"x; y",3\r\n');
    assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(csvCell('+91 135 2000000'), '+91 135 2000000');
    assert.equal(csvCell('-cmd'), "'-cmd");
    assert.equal(unguardCell("'=1+1"), '=1+1');
    assert.equal(unguardCell("'plain"), "'plain");
  });
});
