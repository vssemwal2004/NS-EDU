// Repairs official profiles that the generic crawler cannot complete because of broken TLS, a 403,
// robots exclusions, or programme data hidden behind a dynamic endpoint. Every value comes from an
// official domain. Live pages are fetched only where robots permits it; otherwise the script uses
// previously verified official indexed material and leaves unsupported fields empty.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { parse } from 'node-html-parser';
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { upsertUniversities } from '../modules/universities/university-service.js';

const execFileAsync = promisify(execFile);
const dryRun = process.argv.includes('--dry-run');

const AMU_GUIDE = 'https://www.amucontrollerexams.com/uploads/files/e97cf6112508c8e79149275de5ae1cb3.pdf';
const BODOLAND_PROGRAMMES = 'https://buniv.edu.in/page/academics/academic-programs';
const BODOLAND_ABOUT = 'https://buniv.edu.in/page/about-us/overview';
const CVV_BROCHURE = 'https://www.cvv.ac.in/wp-content/uploads/2024/05/CvvDeemedUniversityBrochure2024.pdf';
const CVV_HANDBOOK = 'https://lms.cvv.ac.in/learning/pluginfile.php/16996/block_html/content/Student%20Handbook%202024.pdf?time=1747202891873';
const CGC_HOME = 'https://www.cgcuniversity.in/';
const CGC_ACADEMICS = 'https://www.cgcuniversity.in/academics-overview';
const CGC_ADMISSIONS = 'https://www.cgcuniversity.in/admissions';
const MICA_HOME = 'https://www.mica.ac.in/';
const MICA_ABOUT = 'https://www.mica.ac.in/about-mica/';
const MICA_PLACEMENT_REPORT = 'https://mica.ac.in/resources/placements-reports/Final-Placement-Brochure-2026.pdf';
const BRAINWARE_HOME = 'https://www.brainwareuniversity.ac.in/';
const BRAINWARE_PROGRAMMES = 'https://www.brainwareuniversity.ac.in/degree-programmes/';
const BRAINWARE_PLACEMENTS = 'https://www.brainwareuniversity.ac.in/placement-overview.php';
const SIU_CALENDAR = 'https://apps.siu.edu.in/acadcal/webview/2026-2027';
const SIU_ABOUT = 'https://sie.siu.edu.in/about-siu';
const NFSU_PROGRAMMES = 'https://www.nfsu.ac.in/programs';
const NFSU_PLACEMENTS = 'https://www.nfsu.ac.in/placements';
const SRIHER_UG = 'https://admissions.sriramachandra.edu.in/index.php';
const SRIHER_PG = 'https://admissions.sriramachandra.edu.in/pg/';
const CHITKARA_HP_ADMISSIONS = 'https://demo.chitkarauniversity.edu.in/admissions/';
const CHITKARA_HP_ABOUT = 'https://demo.chitkarauniversity.edu.in/accreditations/';
const CHITKARA_HP_FACILITIES = 'https://iqac.chitkarauniversity.edu.in/pdf/HPUNGN11244.pdf';
const TIFR_GS_2026 = 'https://www.tifr.res.in/academics/docs/GS-2026_Eligibility_Table_Final.pdf';
const TIFR_ABOUT = 'https://www.tifr.res.in/portal/study_at_tifr.php';
const TIFR_FACILITIES = 'https://www.tifr.res.in/maincampus/campusresources.php';
const SCTIMST_PROGRAMMES = 'https://www.sctimst.ac.in/Academic%20and%20Research/Academic/Admissions/resources/PROSPECTUS-January-2026.pdf';
const SCTIMST_ABOUT = 'https://www.sctimst.ac.in/About%20SCTIMST/History/';
const AIIMS_RBL_COURSES = 'https://aiimsrbl.edu.in/courses';
const AIIMS_RBL_ABOUT = 'https://aiimsrbl.edu.in/about-us';
const AIIMS_RBL_MPH = 'https://www.recruitment.aiimsrbl.edu.in/';
const IIMB_PROGRAMMES = 'https://www.iimb.ac.in/programmes';
const IIMB_PLACEMENT_REPORT = 'https://www.iimb.ac.in/sites/default/files/inline-files/Placement-Report-2026.pdf';
const IIMB_PLACEMENTS = 'https://www.iimb.ac.in/index.php/iimb-pgp-pgpba-placements-2026';
const IIMB_FACILITIES = 'https://www.iimb.ac.in/exchange/info-exchange-program';
const IIMB_CAMPUS = 'https://www.iimb.ac.in/sites/default/files/inline-files/IIMB-Brochure.pdf';
const JIPMER_ADMISSIONS = 'https://jipmer.edu.in/announcement/entrance-examinations-admissions';
const JIPMER_ABOUT = 'https://jipmer.edu.in/about-us/general-information/jipmer-info';
const JIPMER_INFRASTRUCTURE = 'https://jipmer.edu.in/academics/academic-infrastructure';
const JIPMER_BSC_2026 = 'https://academic.jipmer.edu.in/bsc/admission/docs/bsc_pros_2026_27_academic_year.pdf';
const JIPMER_MSC_2026 = 'https://jipmer.edu.in/sites/default/files/Admission%20to%20MSc%20MPH%20PBD%20PGD%20PGF%20Courses%20%26%20Medical%20Physics%20%20Prospectus%20-%202026.pdf';
const JIPMER_MD_2026 = 'https://jipmer.edu.in/sites/default/files/3.%20%20Prospectus%20Part%20-%20B%20%28JIPMER%29.pdf';
const JIPMER_DM_2026 = 'https://jipmer.edu.in/sites/default/files/JIPMER%20Part%20B%20Prospectus%20July%202026.pdf';
const JIPMER_PDF_PDCC_2026 = 'https://jipmer.edu.in/sites/default/files/PDF%20PDCC%20Prospectus%20July%202026%20session%20%281%29.pdf';
const JIPMER_PHD_2026 = 'https://jipmer.edu.in/sites/default/files/2026%2006%20PhD%20Prospectus%20Inst%20Stream%20and%20Part%20Time%20Final.pdf';
const IIITT_PROGRAMMES = 'https://phdadmission.iiitt.ac.in/programs';
const IIITT_FACILITIES = 'https://phdadmission.iiitt.ac.in/facilities';
const IIITT_PLACEMENT_REPORT = 'https://store.iiitt.ac.in/placement_images/docs/Placement%20Brochure%20IIIT%20Trichy%202026.pdf';
const IIMR_PROGRAMMES = 'https://www.iimrohtak.ac.in/index.php/programmes/ipl/about-ipl';
const IIMR_ABOUT = 'https://www.iimrohtak.ac.in/';
const IIMR_PLACEMENT_REPORT = 'https://www.iimrohtak.ac.in/panel/assets/images/placement/Final%20Placement%20Report%202024-26.pdf';
const IIMR_LIBRARY = 'https://www.iimrohtak.ac.in/library.php';
const IIMN_PROGRAMMES = 'https://www.iimnagpur.ac.in/programmes/education-verification-degree-granting-programmes/';
const IIMN_ABOUT = 'https://www.iimnagpur.ac.in/about-iimn-2/about-iim-nagpur/';
const IIMN_CAMPUS = 'https://www.iimnagpur.ac.in/campuses/main-campus/';
const IIMN_PLACEMENT_REPORT = 'https://www.iimnagpur.ac.in/wp-content/uploads/2026/10/Final-Placement-Report_.pdf';
const IIMBG_PROGRAMMES = 'https://iimbg.ac.in/programs/';
const IIMBG_ABOUT = 'https://iimbg.ac.in/about/';
const IIMBG_CAMPUS = 'https://iimbg.ac.in/campus-sustainability/';
const IIMBG_PLACEMENT_REPORT = 'https://iimbg.ac.in/wp-content/uploads/2026/06/Final-Placement-Report-2024-2026.pdf';
const IIMBG_COMMONS_PHOTO = 'https://commons.wikimedia.org/wiki/File:Main_Gate_IIM_Bodh_Gaya.jpg';
const IITJ_PROGRAMMES = 'https://www.iitj.ac.in/office-of-academics/en/list-of-academic-programs';
const IITJ_ABOUT = 'https://www.iitj.ac.in/main/en/introduction';
const IITJ_CAMPUS = 'https://www.iitj.ac.in/main/en/campus-infrastructure';
const IITJ_FACILITIES = 'https://www.iitj.ac.in/PageImages/Gallery/02-2025/Facilities-IIT-Jodhpur-638753865381039081.pdf';
const IITJ_PLACEMENT_REPORT = 'https://spc.iitj.ac.in/media/files/PlacementBrochureIIT_JodhpurSept2024.pdf';
const PGIMER_HOME = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/home.jsp';
const PGIMER_ABOUT = 'https://www.pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=3';
const PGIMER_MD = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=41';
const PGIMER_MS = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=42';
const PGIMER_DM = 'https://www.pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=43';
const PGIMER_MCH = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=44';
const PGIMER_MDS = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=45';
const PGIMER_PHD = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=46';
const PGIMER_CERTIFICATE = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=47';
const PGIMER_PARAMEDICAL = 'https://www.pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=48';
const PGIMER_MSC = 'https://www.pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=49';
const PGIMER_NURSING = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=332';
const PGIMER_COURSE_INDEX = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=388';
const PGIMER_FACILITIES = 'https://pgimer.edu.in/PGIMER_PORTAL/PGIMERPORTAL/GlobalPages/JSP/Page_Data.jsp?dep_id=5598';
const PGIMER_NIRF_2025 = 'https://pgimer.edu.in/PGIMER_PORTAL/AbstractFilePath?FileName=NIRF+OVERALL+2025+DATA.pdf&FileType=E&PathKey=EDITORREPOSITORY_PATH';

function levelOf(name) {
  if (/^(?:Ph\.?D\b|Doctoral Programmes|Doctor of Philosophy)/i.test(name)) return 'PhD';
  if (/^(?:P\.?G\.?\s|Post(?:\s|-)?Graduate|Advanced?\s|Diploma\s|Certificate\s|Bridge Course)/i.test(name)) return 'Diploma';
  if (/^(?:B\.|B(?:BA|CA|Com|Sc|Tech|Arch|Pharm|Ed|Lib|Voc)\b|Bachelor|M\.B\.B\.S|Kamil-e-Tib|Pre-Tib)/i.test(name)) return 'UG';
  if (/^(?:D\.?M\b|M\.?Ch\b|M\.?D\b|M\.|M(?:BA|CA|Com|Sc|Tech|Arch|Plan|Ed|Lib|Pharm|PA)\b|LL\.M\.|Master|Doctor of Medicine|Magister|Unani Mahire|Post Doctoral)/i.test(name)) return 'PG';
  return '';
}

const unique = (rows) => [...new Map(rows.map((row) => [row.name.toLowerCase(), row])).values()];
const programmeRows = (names, sourcePage) => unique(names.map((name) => ({ name, level: levelOf(name), sourcePage })));

function parseAmuProgrammeIndex(text) {
  const start = text.indexOf('UNDER-GRADUATE PROGRAMMES');
  const end = text.indexOf('GENERAL INFORMATION', start);
  if (start < 0 || end < 0 || end <= start) throw new Error('AMU guide programme index was not found');
  const pageCode = /\s+[A-J]\d+(?:\s*[-–]\s*(?:[A-J])?\d+)?\s*$/;
  const rows = [];
  let base = '';
  let specialisations = [];
  const flush = () => {
    if (!base) return;
    if (specialisations.length) {
      for (const item of specialisations) rows.push(`${base} — ${item}`);
    } else rows.push(base);
    base = '';
    specialisations = [];
  };
  for (const rawLine of text.slice(start, end).split(/\r?\n/)) {
    const line = rawLine.replace(/\f/g, '').trim().replace(/\s+/g, ' ');
    if (!line) continue;
    const bullet = line.match(/^[•]\s*(.+)$/);
    if (bullet && base) {
      const item = bullet[1].replace(pageCode, '').trim();
      if (item) specialisations.push(item);
      continue;
    }
    if (!pageCode.test(line)) continue;
    const candidate = line.replace(pageCode, '').trim();
    if (!candidate || candidate === 'Particulars') continue;
    flush();
    base = candidate;
  }
  flush();
  const programmes = [...new Set(rows)].filter((name) => !/^Appendix\b/i.test(name)
    && !/^Senior Secondary School Certificate\b/i.test(name)
    && name !== 'Bridge Course - Senior Secondary School Certificate'
    && name !== 'Certificate Courses');
  const tooLong = programmes.filter((name) => name.length > 160);
  if (tooLong.length) throw new Error(`AMU guide yielded overlong programme names: ${tooLong.join('; ')}`);
  if (programmes.length < 150 || programmes.length > 500) {
    throw new Error(`AMU guide yielded unsafe programme count ${programmes.length}`);
  }
  return programmeRows(programmes, AMU_GUIDE);
}

async function fetchAmuProgrammes() {
  const response = await fetch(AMU_GUIDE, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`AMU guide returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100_000) throw new Error(`AMU guide download was unexpectedly small (${bytes.length} bytes)`);
  const directory = await mkdtemp(join(tmpdir(), 'nsedu-official-fallback-'));
  const pdf = join(directory, 'guide.pdf');
  const txt = join(directory, 'guide.txt');
  try {
    await writeFile(pdf, bytes);
    await execFileAsync('pdftotext', ['-layout', pdf, txt], { timeout: 30_000, windowsHide: true });
    return parseAmuProgrammeIndex(await readFile(txt, 'utf8'));
  } finally {
    const tempRoot = `${resolve(tmpdir()).toLowerCase()}${sep}`;
    const target = resolve(directory).toLowerCase();
    if (!target.startsWith(tempRoot)) throw new Error(`Refusing to remove unexpected temporary path ${directory}`);
    await rm(directory, { recursive: true, force: true });
  }
}

async function fetchOfficialHtml(url, minimumBytes = 1000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const html = await response.text();
  if (Buffer.byteLength(html) < minimumBytes) throw new Error(`${url} returned unexpectedly little HTML`);
  return html;
}

async function fetchSiuProgrammes() {
  const root = parse(await fetchOfficialHtml(SIU_CALENDAR, 10_000));
  const names = root.querySelectorAll('.view-content .field-content a')
    .map((node) => node.text.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  const rows = programmeRows(names, SIU_CALENDAR);
  if (names.length < 120 || names.length > 200 || rows.length < 90 || rows.length > 160) {
    throw new Error(`SIU calendar yielded unsafe counts ${names.length} rows / ${rows.length} unique names`);
  }
  return rows;
}

const nfsuLevel = (type, name) => ({
  Graduate: 'UG',
  'Post Graduate': 'PG',
  '5 Years Integrated Courses': 'UG',
  'Diploma Courses': 'Diploma',
  'Certificate Courses': 'Diploma',
  'Doctoral Courses': 'PhD',
}[type] ?? levelOf(name));

async function fetchNfsuProgrammes(branchId, campus, expectedMinimum, expectedMaximum) {
  const sourcePage = `${NFSU_PROGRAMMES}/_program?branchid=${branchId}&duration=&levelid=&discid=`;
  const root = parse(await fetchOfficialHtml(sourcePage, 10_000));
  const rows = root.querySelectorAll('.searchtext .item').map((node) => {
    const publishedName = node.querySelector('h5 strong')?.text.trim().replace(/\s+/g, ' ') ?? '';
    const name = publishedName === 'BBA-MBA (With Specialization in Forensic Accounting and Fraud Investigation / Financial Management / Business Analytics and Intelligence / Hospital & Healthcare Management)'
      ? 'BBA-MBA (Forensic Accounting & Fraud Investigation / Financial Management / Business Analytics & Intelligence / Hospital & Healthcare Management)'
      : publishedName;
    const details = node.querySelectorAll('.info p').map((item) => item.text.trim().replace(/\s+/g, ' '));
    const type = details.find((item) => item.startsWith('Program type:'))?.slice(13).trim() ?? '';
    const duration = details.find((item) => item.startsWith('Duration:'))?.slice(9).trim() ?? '';
    const years = duration.match(/^(\d+(?:\.\d+)?)\s+Year/i)?.[1];
    const months = duration.match(/^(\d+(?:\.\d+)?)\s+Month/i)?.[1];
    const durationYears = years ? Number(years) : months && Number(months) >= 6 ? Number(months) / 12 : null;
    return {
      name, level: nfsuLevel(type, name), ...(durationYears ? { durationYears } : {}), sourcePage,
    };
  }).filter((row) => row.name && !/\bdiscontinued\b/i.test(row.name));
  const clean = unique(rows);
  const overlong = clean.filter((row) => row.name.length > 160);
  if (overlong.length) throw new Error(`NFSU ${campus} yielded overlong programme names`);
  if (clean.length < expectedMinimum || clean.length > expectedMaximum) {
    throw new Error(`NFSU ${campus} endpoint yielded unsafe current programme count ${clean.length}`);
  }
  return clean;
}

async function fetchSriherProgrammes() {
  const [ugRoot, pgRoot] = (await Promise.all([
    fetchOfficialHtml(SRIHER_UG, 20_000), fetchOfficialHtml(SRIHER_PG, 20_000),
  ])).map(parse);
  const undergraduate = ugRoot.querySelectorAll('.pre-course-details-content')
    .map((node) => node.text.trim().replace(/\s+/g, ' ')).filter(Boolean)
    .map((name) => ({ name, level: /^MBBS, MD\/MS, DM\/M\.Ch$/i.test(name) ? '' : 'UG', sourcePage: SRIHER_UG }));
  const postgraduate = [];
  for (const node of pgRoot.querySelectorAll('#faq .card-body')) {
    const lines = parse(node.innerHTML.replace(/<br\s*\/?\s*>/gi, '\n')).text.split(/\r?\n/)
      .map((name) => name.trim().replace(/\s+/g, ' ')).filter(Boolean);
    for (const name of lines) postgraduate.push({
      name, level: /^Post Graduate Diploma\b/i.test(name) ? 'Diploma' : 'PG', sourcePage: SRIHER_PG,
    });
  }
  const rows = unique([...undergraduate, ...postgraduate]);
  if (undergraduate.length < 30 || postgraduate.length < 55 || rows.length < 90 || rows.length > 130) {
    throw new Error(`SRIHER admissions pages yielded unsafe counts ${undergraduate.length} UG / ${postgraduate.length} PG / ${rows.length} unique`);
  }
  if (rows.some((row) => row.name.length > 160)) throw new Error('SRIHER yielded overlong programme names');
  return rows;
}

function chitkaraHpProgrammes() {
  return programmeRows([
    'B.E. Computer Science and Engineering', 'B.Sc. Nursing', 'B.Pharm',
    'M.Pharm (Pharmaceutics / Pharmaceutical Chemistry)', 'Doctor of Philosophy (PhD)',
  ], CHITKARA_HP_ADMISSIONS);
}

function tifrMumbaiProgrammes() {
  const subjects = [
    'Biology', 'Chemistry', 'Computer Science & Learning, Information and Data Science',
    'Mathematics', 'Physics',
  ];
  return subjects.flatMap((subject) => [
    { name: `Ph.D. in ${subject}`, level: 'PhD', durationYears: 5, sourcePage: TIFR_GS_2026 },
    { name: `Integrated M.Sc.-Ph.D. in ${subject}`, level: 'PhD', durationYears: 6, sourcePage: TIFR_GS_2026 },
  ]);
}

function sctimstProgrammes() {
  const threeYearPg = [
    'DM Cardiology', 'DM Paediatric Cardiology', 'DM Neurology',
    'DM Neuroimaging and Interventional Neuroradiology',
    'DM Cardiovascular Imaging and Vascular Interventional Radiology',
    'DM Cardiothoracic & Vascular Anaesthesia', 'DM Neuroanaesthesia',
    'MCh Cardiovascular & Thoracic Surgery', 'MCh Neurosurgery (After MS)', 'MCh Vascular Surgery',
    'MD Transfusion Medicine',
  ].map((name) => ({ name, level: 'PG', durationYears: 3, sourcePage: SCTIMST_PROGRAMMES }));
  const integrated = ['Integrated MD-PhD', 'Integrated DM-PhD', 'Integrated MCh-PhD']
    .map((name) => ({ name, level: 'PhD', durationYears: 5, sourcePage: SCTIMST_PROGRAMMES }));
  const postdoctoral = [
    'Post Doctoral Fellowship (Post DM/MCh/DNB)',
    'Post Doctoral Certificate Course in Transfusion Transmitted Disease Testing',
    'Post Doctoral Certificate Course in Hospital Infection Control',
    'Post Doctoral Certificate Course in Neuropathology',
  ].map((name) => ({ name, level: name.includes('Certificate') ? 'Diploma' : 'PhD', durationYears: 1, sourcePage: SCTIMST_PROGRAMMES }));
  const postgraduate = [
    { name: 'Master of Public Health (MPH)', level: 'PG', durationYears: 2 },
    { name: 'Master of Technology (MTech) in Biomedical Engineering', level: 'PG', durationYears: 2 },
    { name: 'Ph.D.', level: 'PhD' },
    { name: 'Master of Technology (MTech) in Clinical Engineering', level: 'PG' },
    { name: 'Ph.D. in Biomedical Devices and Technology', level: 'PhD' },
  ].map((row) => ({ ...row, sourcePage: SCTIMST_PROGRAMMES }));
  const diplomaNames = [
    'Diploma in Public Health (DPH)',
    'Post Basic Diploma in Cardio-Thoracic Nursing (PBDCTN)',
    'Post Basic Diploma in Neuro Science Nursing (PBDNN)',
    'Diploma in Advanced Medical Imaging Technology (DAMIT)',
    'Diploma in Operation Theatre & Anaesthesia Technology (DOTAT)',
    'PG Diploma in Cardiac Laboratory Technology (PGDCLT)',
    'PG Diploma in Neuro Technology (PGDNT)',
    'PG Diploma in Medical Records Science (PGDMRS)',
    'PG Diploma in Clinical Perfusion (PGDCP)',
    'PG Diploma in Blood Banking Technology (PGDBBT)',
    'Advanced Certificate Program in Physiotherapy in Neurological Sciences (ACP-PN)',
    'Advanced Certificate Program in Physiotherapy in Cardiovascular Sciences (ACP-PC)',
  ];
  const diplomas = diplomaNames.map((name) => ({
    name, level: 'Diploma', durationYears: /Advanced Certificate/i.test(name) ? 1 : 2,
    sourcePage: SCTIMST_PROGRAMMES,
  }));
  return unique([...threeYearPg, ...integrated, ...postdoctoral, ...postgraduate, ...diplomas]);
}

function aiimsRaebareliProgrammes() {
  const undergraduate = [
    'M.B.B.S.', 'B.Sc. (Hons) Nursing', 'B.Sc. Anaesthesia Technology',
    'B.Sc. Cardiac Technology', 'B.Sc. Dialysis Therapy', 'B.Sc. Medical Lab Technology',
    'B.Sc. O.T. Technology', 'B.Sc. Optometry', 'B.Sc. Radiology Technology',
  ].map((name) => ({ name, level: 'UG', sourcePage: AIIMS_RBL_COURSES }));
  const postgraduate = [
    'MD in Anaesthesiology', 'MD in Anatomy', 'MD in Biochemistry', 'MD in Community Medicine',
    'MD in Dermatology', 'MS in ENT', 'MD in Forensic Medicine', 'MD in General Medicine',
    'MS in General Surgery', 'MD in Microbiology', 'DM in Neurology (6 Years)',
    'MCh in Neurosurgery (6 Years)', 'MD in Obstetrics & Gynaecology', 'MD in Ophthalmology',
    'MD in Orthopedics', 'MCh in Paediatric Surgery', 'MD in Paediatrics',
    'MD in Pathology & Lab Medicine', 'MD in Pharmacology', 'MD in Physiology',
    'MD in Physical Medicine and Rehabilitation', 'MD in Psychiatry', 'MD in Transfusion Medicine',
  ].map((name) => ({ name, level: 'PG', sourcePage: AIIMS_RBL_COURSES }));
  return [...undergraduate, ...postgraduate, {
    name: 'Master of Public Health (MPH)', level: 'PG', sourcePage: AIIMS_RBL_MPH,
  }];
}

function iimbProgrammes() {
  return [
    { name: 'Doctor of Philosophy (Ph.D.)', level: 'PhD', durationYears: 5 },
    { name: 'Master of Business Administration (MBA) — Post Graduate Programme in Management (PGP)', level: 'PG', durationYears: 2 },
    { name: 'Master of Business Administration (Business Analytics) — PGPBA', level: 'PG', durationYears: 2 },
    { name: 'Master of Business Administration (MBA) — Executive Post Graduate Programme in Management (EPGP)', level: 'PG', durationYears: 1 },
    { name: 'Master of Business Administration (MBA) — Post Graduate Programme in Enterprise Management (PGPEM)', level: 'PG', durationYears: 2 },
    { name: 'Master of Management Studies (Public Policy) — PGPPM', level: 'PG' },
    { name: 'BBA in Digital Business and Entrepreneurship', level: 'UG', durationYears: 4 },
    { name: 'B.Sc. (Honours) in Economics', level: 'UG', durationYears: 4 },
    { name: 'B.Sc. (Honours) in Data Sciences', level: 'UG', durationYears: 4 },
    { name: 'N. S. Ramaswamy Pre-doctoral Fellowship', level: 'Diploma', durationYears: 1 },
  ].map((row) => ({ ...row, sourcePage: IIMB_PROGRAMMES }));
}

function jipmerProgrammes() {
  const rows = [{
    name: 'Bachelor of Medicine and Bachelor of Surgery (MBBS)', level: 'UG', durationYears: 5.5,
    sourcePage: JIPMER_ADMISSIONS,
  }];
  const bsc = [
    'B.Sc. Nursing', 'Bachelor of Medical Laboratory Sciences (BMLS)',
    'B.Sc. Anaesthesia Technology', 'Bachelor of Emergency Medical Technologist (B.EMT)',
    'Bachelor of Optometry (B. Optom.)', 'B.Sc. Cardiac Laboratory Technology',
    'B.Sc. Dialysis Therapy Technology', 'B.Sc. Medical Laboratory Technology in Blood Banking',
    'B.Sc. Medical Radiology and Imaging Technology', 'B.Sc. Neurotechnology',
    'B.Sc. Nuclear Medicine Technology', 'B.Sc. Perfusion Technology',
    'B.Sc. Radiotherapy Technology',
  ].map((name) => ({ name, level: 'UG', durationYears: 4, sourcePage: JIPMER_BSC_2026 }));
  const md = [
    'Anaesthesiology', 'Anatomy', 'Biochemistry', 'Community Medicine',
    'Dermatology, Venereology & Leprology', 'Emergency Medicine', 'Forensic Medicine',
    'General Medicine', 'Geriatric Medicine', 'Immuno Haematology & Blood Transfusion',
    'Microbiology', 'Nuclear Medicine', 'Pathology', 'Pediatrics', 'Pharmacology',
    'Physiology', 'Physical Medicine and Rehabilitation', 'Psychiatry', 'Pulmonary Medicine',
    'Radio-Diagnosis', 'Radiation Oncology',
  ].map((speciality) => ({
    name: `MD in ${speciality}`, level: 'PG', durationYears: 3, sourcePage: JIPMER_MD_2026,
  }));
  const ms = [
    'General Surgery', 'Obstetrics & Gynaecology', 'Ophthalmology',
    'Orthopaedics Surgery', 'Oto-Rhino Laryngology (ENT)',
  ].map((speciality) => ({
    name: `MS in ${speciality}`, level: 'PG', durationYears: 3, sourcePage: JIPMER_MD_2026,
  }));
  const integratedMch = ['Neurosurgery', 'Paediatric Surgery', 'CTVS'].map((speciality) => ({
    name: `Integrated 6-year MCh in ${speciality}`, level: 'PG', durationYears: 6, sourcePage: JIPMER_MD_2026,
  }));
  const mds = ['Orthodontics and Dentofacial Orthopedics', 'Oral and Maxillofacial Surgery']
    .map((speciality) => ({
      name: `MDS in ${speciality}`, level: 'PG', durationYears: 3, sourcePage: JIPMER_MD_2026,
    }));
  const dm = [
    'Critical Care', 'Neuroanaesthesiology and Neurocritical Care', 'Cardiac Anaesthesia',
    'Cardiology', 'Clinical Immunology & Rheumatology', 'Clinical Pharmacology',
    'Endocrinology', 'Medical Gastroenterology', 'Medical Oncology', 'Neonatology',
    'Nephrology', 'Neurology', 'Paediatric Critical Care', 'Haematopathology',
    'Neuroimaging and Interventions',
  ].map((speciality) => ({
    name: `DM in ${speciality}`, level: 'PG', durationYears: 3, sourcePage: JIPMER_DM_2026,
  }));
  const mch = [
    'CTVS', 'Neurosurgery', 'Plastic Surgery', 'Paediatric Surgery',
    'Surgical Gastroenterology', 'Surgical Oncology', 'Urology', 'Gynaecological Oncology',
  ].map((speciality) => ({
    name: `MCh in ${speciality}`, level: 'PG', durationYears: 3, sourcePage: JIPMER_DM_2026,
  }));
  const alliedMsc = [
    ['M.Sc. Medical Biochemistry', 3], ['M.Sc. MLT – Microbiology', 2],
    ['M.Sc. MLT – Pathology', 2], ['M.Sc. Medical Physiology', 3], ['M.Sc. Biostatistics', 2],
  ].map(([name, durationYears]) => ({ name, level: 'PG', durationYears, sourcePage: JIPMER_MSC_2026 }));
  const nursingMsc = [
    'Child Health (Paediatric) Nursing', 'Community Health Nursing',
    'Medical-Surgical Nursing (Critical Care Nursing)',
    'Medical-Surgical Nursing (Cardio Vascular and Thoracic Nursing)',
    'Medical-Surgical Nursing (Nephro and Urology Nursing)',
    'Mental Health (Psychiatric) Nursing', 'Obstetric & Gynaecological Nursing',
  ].map((speciality) => ({
    name: `M.Sc. Nursing in ${speciality}`, level: 'PG', durationYears: 2, sourcePage: JIPMER_MSC_2026,
  }));
  const otherPg = [
    { name: 'Master of Public Health (MPH)', level: 'PG', durationYears: 2 },
    { name: 'Post Basic Diploma in Critical Care Nursing', level: 'Diploma', durationYears: 1 },
    { name: 'Post Basic Diploma in Cardio-Thoracic Nursing', level: 'Diploma', durationYears: 1 },
    { name: 'Post Basic Diploma in Operation Room Nursing', level: 'Diploma', durationYears: 1 },
    { name: 'Postgraduate Diploma in Genetic Counseling', level: 'Diploma', durationYears: 1 },
    { name: 'Postgraduate Fellowship in Family Planning', level: 'Diploma', durationYears: 1 },
    { name: 'Medical Physics Internship Program', level: 'Diploma', durationYears: 1 },
  ].map((row) => ({ ...row, sourcePage: JIPMER_MSC_2026 }));
  const pdf = [
    ['Cardiac Electrophysiology and Pacing', 2], ['Infectious Diseases', 2],
    ['Hospital Infection Control', 2], ['Stroke Intervention and Advanced Rehabilitation', 1],
    ['Comprehensive Epilepsy Care', 1], ['Obstetric Medicine', 2],
    ['Hepato-Pancreatic-Biliary Surgery', 1], ['Glaucoma', 2],
    ['Interventional Cardiology', 1], ['Head & Neck Radiation Oncology', 1],
    ['Pelvic Radiation Oncology', 1], ['Fetal Medicine', 2],
    ['Paediatric Nephrology', 2], ['Head and Neck Surgery', 2], ['Spine Surgery', 2],
  ].map(([speciality, durationYears]) => ({
    name: `Post-Doctoral Fellowship in ${speciality}`, level: 'PhD', durationYears,
    sourcePage: JIPMER_PDF_PDCC_2026,
  }));
  const pdcc = [
    'Paediatric Dermatology', 'Lasers and Dermatosurgery', 'Diabetology', 'Nephro-Pathology',
    'Child & Adolescent Psychiatry', 'Advanced Imaging', 'Apheresis',
    'Hernia and Abdominal Wall Reconstruction', 'Breast Surgery',
  ].map((speciality) => ({
    name: `Post-Doctoral Certificate Course in ${speciality}`, level: 'Diploma', durationYears: 1,
    sourcePage: JIPMER_PDF_PDCC_2026,
  }));
  return unique([
    ...rows, ...bsc, ...md, ...ms, ...integratedMch, ...mds, ...dm, ...mch,
    ...alliedMsc, ...nursingMsc, ...otherPg,
    { name: 'Doctor of Philosophy (Ph.D.)', level: 'PhD', sourcePage: JIPMER_PHD_2026 },
    ...pdf, ...pdcc,
  ]);
}

function iiittProgrammes() {
  const undergraduate = [
    'B.Tech. in Computer Science and Engineering',
    'B.Tech. in Computer Science and Engineering (Artificial Intelligence and Data Science)',
    'B.Tech. in Electronics and Communication Engineering',
    'B.Tech. in Electronics and Communication Engineering (VLSI Design)',
  ].map((name) => ({ name, level: 'UG', durationYears: 4, sourcePage: IIITT_PROGRAMMES }));
  const postgraduate = [
    'M.Tech. in Computer Science and Engineering', 'M.Tech. in VLSI Systems',
  ].map((name) => ({ name, level: 'PG', durationYears: 2, sourcePage: IIITT_PROGRAMMES }));
  const doctoral = [
    'Computer Science and Engineering', 'Electronics and Communication Engineering',
    'Mechanical Engineering', 'Physics', 'Mathematics', 'Economics', 'English',
  ].map((speciality) => ({
    name: `Ph.D. in ${speciality}`, level: 'PhD', sourcePage: IIITT_PROGRAMMES,
  }));
  return [...undergraduate, ...postgraduate, ...doctoral];
}

function iimRohtakProgrammes() {
  return [
    { name: 'Master of Business Administration (MBA) — Post Graduate Programme in Management (PGP)', level: 'PG', durationYears: 2 },
    { name: 'Doctoral Programme in Management (DPM / Ph.D.)', level: 'PhD' },
    { name: 'Integrated Programme in Management (BBA + MBA)', level: 'UG', durationYears: 5 },
    { name: 'Integrated Programme in Law (BBA-LL.B.)', level: 'UG', durationYears: 5 },
    { name: 'Post Graduate Diploma in Sports Management for Executives', level: 'Diploma', durationYears: 16 / 12 },
    { name: 'Post Graduate Programme in Management for Executives (PGPx)', level: 'PG', durationYears: 1 },
    { name: 'Management Development Programmes (MDP)', level: 'Diploma' },
  ].map((row) => ({ ...row, sourcePage: IIMR_PROGRAMMES }));
}

function iimNagpurProgrammes() {
  return [
    { name: 'Master of Business Administration (MBA)', level: 'PG', durationYears: 2 },
    { name: 'Doctor of Philosophy (Ph.D.) in Management', level: 'PhD' },
    { name: 'Executive Ph.D. in Management', level: 'PhD' },
    { name: 'Executive MBA (Hybrid)', level: 'PG', durationYears: 2 },
    { name: 'Blended MBA for Working Professionals', level: 'PG', durationYears: 2 },
    { name: 'Blended MBA in Data Science & Management', level: 'PG', durationYears: 2 },
    { name: 'Executive MBA in Energy Management', level: 'PG', durationYears: 2 },
  ].map((row) => ({ ...row, sourcePage: IIMN_PROGRAMMES }));
}

function iimBodhGayaProgrammes() {
  return [
    { name: 'Master of Business Administration (MBA)', level: 'PG', durationYears: 2 },
    { name: 'MBA in Digital Business and AI', level: 'PG', durationYears: 2 },
    { name: 'MBA in Hospital & Healthcare Management', level: 'PG', durationYears: 2 },
    { name: 'Executive MBA', level: 'PG', durationYears: 2 },
    { name: 'Ph.D. in Management', level: 'PhD' },
    { name: 'Executive Ph.D. in Management', level: 'PhD', durationYears: 4 },
    { name: 'Integrated Programme in Management (BBA + MBA)', level: 'UG', durationYears: 5 },
    { name: 'Post Graduate Certificate in Public Policy and Good Governance', level: 'Diploma', durationYears: 2 },
  ].map((row) => ({ ...row, sourcePage: IIMBG_PROGRAMMES }));
}

function iitJodhpurProgrammes() {
  const undergraduate = [
    'B.Tech. in Computer Science and Engineering',
    'B.Tech. in Electrical Engineering',
    'B.Tech. in Mechanical Engineering',
    'B.Tech. in Bioscience and Bioengineering',
    'B.Tech. in Artificial Intelligence and Data Science',
    'B.Tech. in Materials Engineering',
    'B.Tech. in Civil and Infrastructure Engineering',
    'B.Tech. in Chemical Engineering',
    'B.Tech. in Electronics Engineering',
    'B.Tech. in Aerospace Engineering',
    'B.S. in Engineering Chemistry',
    'B.S. in Engineering Physics',
    'B.S. in Mathematics and Computing',
    'B.Sc.-B.Ed. with majors in Physics, Chemistry and Mathematics',
  ].map((name) => ({ name, level: 'UG', durationYears: 4, sourcePage: IITJ_PROGRAMMES }));
  const postgraduate = [
    'M.Sc. in Chemistry',
    'M.Sc. in Physics',
    'M.Sc. in Mathematics',
    'M.Sc. in Digital Humanities',
    'M.Sc. in Computational Social Science',
    'M.Tech. in Bioscience and Bioengineering',
    'M.Tech. in Computer Science and Engineering',
    'M.Tech. in Materials Engineering',
    'M.Tech. in Artificial Intelligence',
    'M.Tech. in Cyber Physical Systems',
    'M.Tech. in Thermofluids',
    'M.Tech. in Data and Computational Sciences',
    'M.Tech. in Environmental Engineering',
    'M.Tech. in Energy Infrastructure',
    'M.Tech. in Chemical Engineering',
    'M.Tech. in Communication Systems',
    'M.Tech. in Robotics',
    'M.Tech. in Augmented Reality and Virtual Reality',
    'M.Tech. in Microelectronics and VLSI',
    'M.Tech. in Quantum Technologies',
    'M.Tech. in Drone and Anti-Drone Technologies',
    'M.Tech. in Bridge Engineering',
    'M.Tech. in Microwave and Photonic Technologies',
    'M.Tech. in Power System and Power Electronics',
    'M.Tech. in Advanced Manufacturing Engineering',
    'M.Tech. in Engineering Design',
    'M.Tech. in Composite Materials Technology',
    'M.Tech. in Battery Materials and Technology',
    'M.Tech. in Environmental and Sustainability Engineering',
    'M.Tech. in Energy Engineering',
    'Master of Business Administration (MBA)',
    'Master in Medical Technologies',
    'M.Des. in XR Design',
    'M.Des. in Smart Product Design',
  ].map((name) => ({ name, level: 'PG', durationYears: 2, sourcePage: IITJ_PROGRAMMES }));
  const doctoral = [
    'Bioscience and Bioengineering',
    'Computer Science and Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Chemistry',
    'Physics',
    'Mathematics',
    'Liberal Arts',
    'Materials Engineering',
    'Civil and Infrastructure Engineering',
    'Chemical Engineering',
    'Management and Entrepreneurship',
    'Medical Technologies',
    'Artificial Intelligence and Data Science',
    'Mathematical and Computational Economics',
    'Education Technology',
    'Design',
    'Clean Energy',
    'Aerospace Engineering',
    'Environmental and Sustainability Engineering',
    'Energy and Automotive Engineering',
    'Economics',
    'Electronics Engineering',
  ].map((subject) => ({ name: `Ph.D. in ${subject}`, level: 'PhD', sourcePage: IITJ_PROGRAMMES }));
  return [...undergraduate, ...postgraduate, ...doctoral];
}

function pgimerProgrammes() {
  const rows = (names, level, durationYears, sourcePage) => names.map((name) => ({
    name, level, ...(durationYears ? { durationYears } : {}), sourcePage,
  }));
  const md = rows([
    'M.D. in Anaesthesia', 'M.D. in Biochemistry', 'M.D. in Community Medicine',
    'M.D. in Dermatology, Venereology and Leprology', 'M.D. in Medicine', 'M.D. in Microbiology',
    'M.D. in Nuclear Medicine', 'M.D. in Obstetrics and Gynaecology', 'M.D. in Paediatrics',
    'M.D. in Psychiatry', 'M.D. in Radio-diagnosis', 'M.D. in Pathology', 'M.D. in Pharmacology',
    'M.D. in Radiotherapy', 'M.D. in Transfusion Medicine', 'M.D. in Forensic Medicine',
  ], 'PG', 3, PGIMER_MD);
  const otherMedical = [
    { name: 'M.D. in Hospital Administration', level: 'PG', durationYears: 3, sourcePage: PGIMER_MD },
    { name: 'Master in Public Health (MPH)', level: 'PG', durationYears: 2, sourcePage: PGIMER_MD },
  ];
  const ms = rows(['M.S. in Surgery', 'M.S. in Orthopaedics', 'M.S. in Otolaryngology', 'M.S. in Ophthalmology'], 'PG', 3, PGIMER_MS);
  const dm = rows([
    'D.M. in Addiction Psychiatry', 'D.M. in Cardiac Anaesthesia', 'D.M. in Cardiology',
    'D.M. in Child and Adolescent Psychiatry', 'D.M. in Clinical Haematology',
    'D.M. in Clinical Immunology and Rheumatology', 'D.M. in Clinical Pharmacology',
    'D.M. in Endocrinology', 'D.M. in Gastroenterology', 'D.M. in Haematopathology',
    'D.M. in Hepatology', 'D.M. in Histopathology', 'D.M. in Intensive Care',
    'D.M. in Interventional Radiology', 'D.M. in Medical Genetics', 'D.M. in Neonatology',
    'D.M. in Nephrology', 'D.M. in Neuro-anaesthesia',
    'D.M. in Neuro-imaging and Interventional Neuroradiology', 'D.M. in Neurology',
    'D.M. in Paediatric Anaesthesia and Intensive Care',
    'D.M. in Paediatric Clinical Immunology and Rheumatology', 'D.M. in Paediatric Endocrinology',
    'D.M. in Paediatric Gastroenterology', 'D.M. in Paediatric Haematology-Oncology',
    'D.M. in Paediatric Neurology', 'D.M. in Paediatric Pulmonology',
    'D.M. in Paediatric Critical Care', 'D.M. in Pulmonary and Critical Care Medicine',
    'D.M. in Trauma Anaesthesia and Acute Care',
  ], 'PG', 3, PGIMER_DM);
  const mch = rows([
    'M.Ch. in Cardiovascular and Thoracic Surgery', 'M.Ch. in Cornea, Cataract and Refractive Surgery',
    'M.Ch. in Head and Neck Surgery', 'M.Ch. in Neurosurgery', 'M.Ch. in Paediatric Surgery',
    'M.Ch. in Plastic Surgery', 'M.Ch. in Renal Transplant Surgery',
    'M.Ch. in Surgical Gastroenterology', 'M.Ch. in Urology', 'M.Ch. in Vitreo-retinal Surgery',
  ], 'PG', 3, PGIMER_MCH);
  const mds = rows(['M.D.S. in Orthodontics', 'M.D.S. in Pedodontics', 'M.D.S. in Oral and Maxillofacial Surgery'], 'PG', 3, PGIMER_MDS);
  const doctoral = rows(['Ph.D. in Medical Disciplines', 'Ph.D. in Non-Medical Disciplines'], 'PhD', 3, PGIMER_PHD);
  const certificates = rows([
    'Post-M.D. Certificate Course in Cytopathology', 'Post-M.D. Certificate Course in Biotechnology',
    'Post-M.D. Certificate Course in Immunopathology',
  ], 'Diploma', 1, PGIMER_CERTIFICATE);
  const undergraduate = [
    ['Bachelor of Physiotherapy (B.Ph.T.)', 4.5], ['Bachelor in Medical Laboratory Science', 4],
    ['B.Sc. Medical Radiology and Imaging Technology', 4], ['B.Sc. Radiotherapy Technology', 3.5],
    ['B.Sc. Medical Technology in Operation Theatre', 4], ['B.Sc. Medical Technology in Perfusion', 3],
    ['B.Sc. in Embalming and Mortuary Science', 3], ['Bachelor of Audiology and Speech Language Pathology', 4],
    ['B.Sc. Medical Technology in Dialysis Therapy Technology', 4], ['Bachelor of Optometry', 4],
    ['Bachelor of Public Health', 4], ['B.Sc. in Medical Animation and Audio-Visual Creation', 3],
  ].map(([name, durationYears]) => ({ name, level: 'UG', durationYears, sourcePage: PGIMER_PARAMEDICAL }));
  const masters = rows([
    'M.Sc. in Biochemistry', 'M.Sc. in Medical Biotechnology', 'M.Sc. in Pharmacology',
    'M.Sc. in Respiratory Care', 'M.Sc. in Anatomy', 'M.Sc. in Medical Biophysics',
    'Master of Audiology and Speech Language Pathology', 'M.Sc. in Transfusion Medicine',
    'M.Sc. in Anaesthesia', 'M.Sc. Medical Laboratory Technology in Cytopathology',
    'M.Sc. Medical Laboratory Technology in Immunopathology',
    'M.Sc. Medical Laboratory Technology in Biochemistry',
    'M.Sc. Medical Laboratory Technology in Bacteriology and Mycology',
    'M.Sc. Medical Laboratory Technology in Virology',
    'M.Sc. Medical Laboratory Technology in Biotechnology',
    'M.Sc. Medical Laboratory Technology in Histopathology',
    'M.Sc. Medical Laboratory Technology in Haematology',
    'M.Sc. Medical Laboratory Technology in Parasitology',
    'M.Sc. Medical Laboratory Technology in Pharmacology',
    'M.Sc. Medical Laboratory Technology in Transfusion Medicine',
    'M.Sc. Medical Technology in Radiotherapy', 'M.Sc. Medical Technology in Radiodiagnosis',
    'M.Sc. in Stem Cell and Translational Medicine',
  ], 'PG', 2, PGIMER_MSC);
  const nursing = [
    { name: 'B.Sc. Nursing', level: 'UG', durationYears: 4, sourcePage: PGIMER_NURSING },
    { name: 'B.Sc. Nursing (Post Basic)', level: 'UG', durationYears: 2, sourcePage: PGIMER_NURSING },
    { name: 'M.Sc. Nursing', level: 'PG', durationYears: 2, sourcePage: PGIMER_NURSING },
  ];
  const fellowships = rows([
    'PGI Fellowship in Immunopathology', 'PGI Fellowship in Cytopathology',
    'PGI Fellowship in Breast Surgery', 'PGI Fellowship in Medical Parasitology',
    'PGI Fellowship in Head and Neck Onco-surgery',
    'PGI Fellowship in Paediatric Anaesthesia and Pre-operative Critical Care',
    'PGI Fellowship in PET Imaging', 'PGI Fellowship in Paediatric Radiology',
  ], 'Diploma', null, PGIMER_COURSE_INDEX);
  return [...md, ...otherMedical, ...ms, ...dm, ...mch, ...mds, ...doctoral, ...certificates,
    ...undergraduate, ...masters, ...nursing, ...fellowships];
}

function bodolandProgrammes() {
  const undergraduate = [
    'Bachelor of Arts', 'Bachelor of Science', 'Bachelor of Commerce', 'Bachelor of Computer Applications',
    'Bachelor of Business Administration', 'Bachelor of Physiotherapy', 'Bachelor of Fine Arts', 'Bachelor of Music',
  ];
  const integrated = [
    'Five-Year Integrated Degree in Commerce', 'Five-Year Integrated M.A.', 'Five-Year Integrated M.Sc.',
  ];
  const shortCourses = [
    'Certificate Course in Translation Studies', 'Certificate Course in Communicative Sanskrit',
    'Certificate Course in Communicative English', 'Post Graduate Diploma in Wildlife Science',
    'Certificate Course in Wildlife Tourism', 'Certificate Course in Bamboo Studies',
    'Certificate Course in Rural Technology', 'Diploma in Rural Technology and Bioentrepreneurship',
    'Post Graduate Diploma in Rural Technology and Bioentrepreneurship', 'Diploma in Human Rights',
    'Certificate Course in Peace and Conflict Studies', 'Diploma in Japanese Language',
  ];
  const masters = [
    'Master of Arts in Assamese', 'Master of Arts in Bodo', 'Master of Arts in English',
    'Master of Arts in Economics', 'Master of Arts in Education', 'Master of Arts/Science in Geography',
    'Master of Arts in History', 'Master of Arts in Political Science', 'Master of Science in Physics',
    'Master of Science in Chemistry', 'Master of Science in Botany', 'Master of Science in Zoology',
    'Master of Science in Biotechnology', 'Master of Science in Mathematics',
    'Master of Science in Computer Science & Technology', 'Master of Computer Applications',
    'Master of Business Administration', 'Master of Commerce', 'Diploma in Bamboo Technology',
    'Post Graduate Diploma in Human Rights Education',
  ];
  const doctoralSubjects = [
    'Assamese', 'Bodo', 'English', 'Economics', 'Education', 'Geography', 'History', 'Political Science',
    'Physics', 'Chemistry', 'Botany', 'Zoology', 'Biotechnology', 'Mathematics',
    'Computer Science & Technology', 'Business Administration', 'Commerce',
  ];
  const rows = programmeRows([
    ...undergraduate, ...integrated, ...shortCourses, ...masters,
    ...doctoralSubjects.map((subject) => `Ph.D. in ${subject}`),
  ], BODOLAND_PROGRAMMES);
  for (const row of rows) {
    if (integrated.includes(row.name)) row.durationYears = 5;
    if (masters.slice(0, 18).includes(row.name)) row.durationYears = 2;
    if (['Diploma in Bamboo Technology', 'Post Graduate Diploma in Human Rights Education'].includes(row.name)) row.durationYears = 1;
  }
  return rows;
}

function cvvProgrammes() {
  return programmeRows([
    'B.A. Sanskrit', 'B.A. B.Ed. English', 'B.Sc. B.Ed. Mathematics', 'B.Sc. Applied Psychology (Hons.)',
    'B.Com. (Hons.)', 'Bachelor of Business Administration', 'Bachelor of Computer Applications',
    'B.Tech. Computer Science and Engineering', 'B.Tech. Computer Science and Engineering (Data Science)',
    'B.Tech. Computer Science and Engineering (Cyber Security)',
    'B.Tech. Computer Science and Engineering (Digital Forensics)', 'B.Tech. Mechanical Engineering',
    'M.A. Sanskrit', 'M.A. Music (Hindustani Vocal)', 'M.A. Music (Tabla)', 'M.A. Music (Bansuri)',
    'M.Sc. Applied Psychology', 'M.Sc. Clinical Psychology', 'M.Sc. Vedic Sciences (Research)',
    'M.Com. Finance & Wealth Management', 'Master of Business Administration', 'Ph.D. (Full Time)',
    'Ph.D. (Part Time)', 'Diploma in Advaita Vedanta', 'Post Graduate Diploma in Advaita Vedanta',
  ], CVV_HANDBOOK);
}

function cgcProgrammes() {
  return programmeRows([
    'B.Tech. Computer Science and Engineering (Cyber Security)', 'B.Tech. Civil Engineering',
    'B.Tech. Computer Science and Engineering (AI & ML)', 'B.Tech. Mechanical Engineering',
    'B.Tech. Computer Science and Engineering (Internet of Things)',
    'B.Tech. Electronics and Communication Engineering (Data Science & AI minor)',
    'B.Tech. Computer Science and Engineering in association with KPMG',
    'B.Tech. Computer Science and Engineering (Open-Source Programming minor)',
    'M.Tech. Computer Science and Engineering (AI & Data Science)',
    'M.Tech. Computer Science and Engineering (Cloud Computing)', 'Bachelor of Computer Applications',
    'BCA (Data Science)', 'Master of Computer Applications', 'MCA (AI & ML)', 'MCA (Data Science)',
    'Bachelor of Business Administration', 'BBA (Business Analytics)', 'Master of Business Administration',
    'MBA (Operations Management)', 'MBA (Digital Marketing)', 'MBA (Finance)',
    'MBA (FinTech) with KPMG', 'MBA (Human Resource Management) with KPMG', 'MBA (Business Analytics)',
    'Bachelor of Commerce (Hons.)', 'Bachelor of Science (Fashion Design)',
    'Journalism & Mass Communication', 'Graphic & Web Designing', 'B.Sc. Medical Laboratory Sciences',
    'B.Sc. Biotechnology', 'B.Sc. Medical Radiology & Imaging Technology', 'Doctoral Programmes',
  ], CGC_HOME);
}

function micaProgrammes() {
  return programmeRows([
    'Post Graduate Diploma in Management – Communications (PGDM-C)',
    'Post Graduate Diploma in Management (PGDM)',
    'Post Graduate Certificate in Management – Sports Management (PGCM-SM)',
    'Post Graduate Certificate in Management – Advertising and Marketing Communication (PGCM-AMC)',
    'Post Graduate Certificate in Management – Digital Media and Marketing Communications (PGCM-DMMC)',
    'Fellow Programme in Management (FPM)', 'Certificate Programme in Strategic Communication (CSC)',
  ], MICA_ABOUT);
}

function brainwareProgrammes() {
  return programmeRows([
    'Bachelor of Technology in Computer Science & Engineering',
    'Bachelor of Technology in Computer Science & Engineering – Lateral Entry',
    'Bachelor of Technology in Computer Science & Engineering – Artificial Intelligence & Machine Learning',
    'Bachelor of Technology in Computer Science & Engineering – Data Science – Lateral Entry',
    'Bachelor of Technology in Computer Science & Engineering – Cyber Security',
    'Bachelor of Computer Applications (Honours)',
    'Bachelor of Computer Applications in Artificial Intelligence & Machine Learning (Honours)',
    'Bachelor of Science (Honours) in Animation & Multimedia',
    'Bachelor of Science (Honours) in Animation, VFX & Gaming',
    'B.A. LL.B.', 'Master of Business Administration', 'M.Sc. Animation & Multimedia',
  ], BRAINWARE_PROGRAMMES);
}

async function existingIdentity(slug) {
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.institutions).findOne({ slug }, {
    projection: { _id: 0, name: 1, slug: 1, city: 1, state: 1, website: 1 },
  });
  if (!doc) throw new Error(`Institution ${slug} was not found`);
  return doc;
}

async function main() {
  const [
    amuProgrammes, siuRows, nfsuGujaratRows, nfsuDelhiRows, sriherRows,
    amu, bodoland, cvv, cgc, mica, brainware, siu, nfsuGujarat, nfsuDelhi, sriher, chitkaraHp,
    tifrMumbai, sctimst, aiimsRaebareli, iimb, jipmer, iiitt, iimRohtak, iimNagpur, iimBodhGaya,
    iitJodhpur, pgimer,
  ] = await Promise.all([
    fetchAmuProgrammes(),
    fetchSiuProgrammes(),
    fetchNfsuProgrammes(1, 'Gujarat', 60, 90),
    fetchNfsuProgrammes(2, 'Delhi', 10, 30),
    fetchSriherProgrammes(),
    existingIdentity('aligarh-muslim-university-aligarh'),
    existingIdentity('bodoland-university'),
    existingIdentity('chinmaya-vishwavidyapeeth'),
    existingIdentity('c-g-c-university'),
    existingIdentity('mica'),
    existingIdentity('brainware-university'),
    existingIdentity('symbiosis-international-deemed-university-pune'),
    existingIdentity('national-forensic-sciences-university-gandhinagar'),
    existingIdentity('national-forensic-sciences-university'),
    existingIdentity('sri-ramachandra-institute-of-higher-education-and-research-deemed-university'),
    existingIdentity('chitkara-university-kalu-jhanda-barotiwala-solan'),
    existingIdentity('tata-institute-of-fundamental-research-mumbai'),
    existingIdentity('sree-chitra-tirunal-institute-for-medical-sciences-and-technology-thiruvananthapuram'),
    existingIdentity('all-india-institute-of-medical-sciences-aiims-raebareli'),
    existingIdentity('indian-institute-of-management-bangalore'),
    existingIdentity('jawaharlal-institute-of-post-graduate-medical-education-research-puducherry'),
    existingIdentity('indian-institute-of-information-technology-srirangam'),
    existingIdentity('indian-institute-of-management-rohtak'),
    existingIdentity('indian-institute-of-management-nagpur'),
    existingIdentity('indian-institute-of-management-bodh-gaya'),
    existingIdentity('indian-institute-of-technology-jodhpur'),
    existingIdentity('post-graduate-institute-of-medical-sciences'),
  ]);
  const bodolandRows = bodolandProgrammes();
  const cvvRows = cvvProgrammes();
  const cgcRows = cgcProgrammes();
  const micaRows = micaProgrammes();
  const brainwareRows = brainwareProgrammes();
  const chitkaraHpRows = chitkaraHpProgrammes();
  const tifrMumbaiRows = tifrMumbaiProgrammes();
  const sctimstRows = sctimstProgrammes();
  const aiimsRaebareliRows = aiimsRaebareliProgrammes();
  const iimbRows = iimbProgrammes();
  const jipmerRows = jipmerProgrammes();
  const iiittRows = iiittProgrammes();
  const iimRohtakRows = iimRohtakProgrammes();
  const iimNagpurRows = iimNagpurProgrammes();
  const iimBodhGayaRows = iimBodhGayaProgrammes();
  const iitJodhpurRows = iitJodhpurProgrammes();
  const pgimerRows = pgimerProgrammes();
  const records = [
    {
      ...amu,
      about: 'Aligarh Muslim University is a Central University whose origins trace to the Muhammadan Anglo-Oriental College founded by Sir Syed Ahmad Khan in 1875; it became a university through an Act of Parliament in 1920. Its 2026–27 guide lists programmes across agricultural sciences, arts, commerce, engineering, international studies, law, life sciences, management, medicine, science, social sciences, theology and Unani medicine.',
      aboutSource: AMU_GUIDE,
      coursesOffered: amuProgrammes.map((row) => row.name),
      programmesOffered: amuProgrammes,
      facilities: ['Halls of Residence', 'Health Service', 'University Sports', 'Libraries', 'Computer Centre', 'Laboratories', 'Student Counselling Centre'],
      sourceUrl: AMU_GUIDE,
    },
    {
      ...bodoland,
      about: 'Bodoland University is a state university established under the Bodoland University Act, 2009. Based in western Assam, it serves the higher-education needs of the region through postgraduate departments, affiliated colleges, education colleges, research programmes, and certificate and diploma courses.',
      aboutSource: BODOLAND_ABOUT,
      coursesOffered: bodolandRows.map((row) => row.name),
      programmesOffered: bodolandRows,
      facilities: ['Central Library', 'Hostels', 'Sports Facilities', 'Health Facilities', 'Central Research Facilities', 'Bioinformatics Infrastructure Facility', 'Incubation Centre'],
      sourceUrl: BODOLAND_PROGRAMMES,
    },
    {
      ...cvv,
      about: 'Chinmaya Vishwa Vidyapeeth is a UGC-recognised deemed-to-be university established to blend Indian knowledge traditions with contemporary disciplines. Its official materials describe campuses in Kerala and Maharashtra and programmes spanning engineering, commerce, management, psychology, Sanskrit, education and the arts.',
      aboutSource: CVV_BROCHURE,
      coursesOffered: cvvRows.map((row) => row.name),
      programmesOffered: cvvRows,
      facilities: ['Classrooms', 'Laboratories', 'Hostel accommodation'],
      sourceUrl: CVV_BROCHURE,
    },
    {
      ...cgc,
      about: 'CGC University, Mohali offers undergraduate, postgraduate and doctoral study across engineering, management, computer applications, liberal arts, legal studies, sports, pharmacy and health sciences. Its official academics pages describe outcome-based, industry-linked teaching supported by smart classrooms, simulation facilities and collaborative laboratories.',
      aboutSource: CGC_ACADEMICS,
      coursesOffered: cgcRows.map((row) => row.name),
      programmesOffered: cgcRows,
      facilities: ['Computer Labs', 'Smart Classrooms', 'Digital Library', 'Research Labs', 'Hostels', 'Sports Facilities', 'Simulation Labs', 'Skill Development Zones', 'Automated Workshops'],
      placements: {
        highestPackageLpa: 100,
        placedPercent: 86,
        recruiters: ['Microsoft', 'Amazon', 'Deloitte'],
        sourcePage: CGC_ADMISSIONS,
      },
      sourceUrl: CGC_HOME,
    },
    {
      ...mica,
      about: 'Founded in 1991, MICA is a residential institute in Ahmedabad focused on strategic marketing and communication. Its programmes combine management, communications, analytics and creative practice, with admission to its flagship postgraduate programmes through the institute’s MICAT process.',
      aboutSource: MICA_ABOUT,
      coursesOffered: micaRows.map((row) => row.name),
      programmesOffered: micaRows,
      facilities: ['Residential Campus', 'Library and Database Access', 'Internet and Computing Facilities', 'Medical Facilities', 'Sports Facilities', 'Open-Air Theatre', 'Student Counselling'],
      campus: { sizeAcres: 19, sourcePage: MICA_HOME },
      placements: {
        year: 2026,
        averagePackageLpa: 20.46,
        highestPackageLpa: 45.67,
        placedPercent: 100,
        recruiters: ['Hindustan Unilever', 'ITC', 'Nestlé', 'Reckitt', 'Marico', 'Dabur', 'Amazon', 'Flipkart'],
        sourcePage: MICA_PLACEMENT_REPORT,
      },
      sourceUrl: MICA_HOME,
    },
    {
      ...brainware,
      website: BRAINWARE_HOME,
      about: 'Brainware University is a private university at Barasat, West Bengal, established under the Brainware University Act, 2015 and operating from 2016. Its official site describes undergraduate, postgraduate, doctoral and diploma study with industry-linked teaching, laboratories, research facilities, live projects and placement preparation.',
      aboutSource: BRAINWARE_HOME,
      coursesOffered: brainwareRows.map((row) => row.name),
      programmesOffered: brainwareRows,
      facilities: ['Laboratories', 'Research Stations', 'Multimedia Labs', 'Sound Recording Facilities', 'Photography Spaces', 'Shooting Floors', 'Editing Labs'],
      placements: {
        year: 2025,
        averagePackageLpa: 4,
        highestPackageLpa: 36,
        placedPercent: 98,
        recruiters: ['PwC', 'TCS', 'Adobe', 'Capgemini', 'Amazon', 'Deloitte', 'Accenture', 'HDFC', 'Airtel', 'Berger'],
        sourcePage: BRAINWARE_PLACEMENTS,
      },
      sourceUrl: BRAINWARE_HOME,
    },
    {
      ...siu,
      about: 'Symbiosis was established in 1971 by Prof. Dr. S. B. Mujumdar and developed as a multidisciplinary university guided by the idea that the world is one family. Its official academic calendar spans constituent institutions in law, management, computer studies, health sciences, media and communication, humanities, engineering, design and education across multiple Indian campuses.',
      aboutSource: SIU_ABOUT,
      coursesOffered: siuRows.map((row) => row.name),
      programmesOffered: siuRows,
      facilities: ['Library Services', 'Learning Management System', 'Academic Mentoring', 'Psychological Counselling', 'Career Counselling', 'Hostels', 'Mess and Canteen', 'Wi-Fi', 'Health Care', 'Sports and Wellness Centres', 'ATM', 'Laundry Service'],
      sourceUrl: SIU_CALENDAR,
    },
    {
      ...nfsuGujarat,
      about: 'National Forensic Sciences University is an Institution of National Importance under the Government of India. Established in 2009 as Gujarat Forensic Sciences University and elevated through the National Forensic Sciences University Act, 2020, it specialises in forensic science and allied areas including behavioural science, cybersecurity, digital forensics, forensic accounting, homeland security and forensic engineering.',
      aboutSource: NFSU_PLACEMENTS,
      coursesOffered: nfsuGujaratRows.map((row) => row.name),
      programmesOffered: nfsuGujaratRows,
      facilities: ['Smart Classrooms', 'Laboratories', 'Library', 'Computer Lab', 'Research and Development Labs', 'Hostels', 'Auditorium', 'Ballistics Research Centre', 'Cyber Defence Centre', 'Seminar Hall'],
      placements: {
        recruiters: ['ABB', 'Qualcomm', 'Salesforce', 'Accenture', 'Microsoft'],
        sourcePage: NFSU_PLACEMENTS,
      },
      sourceUrl: NFSU_PROGRAMMES,
    },
    {
      ...nfsuDelhi,
      about: 'National Forensic Sciences University is an Institution of National Importance under the Government of India. Its Delhi campus offers specialised education in behavioural forensics, cyber security, digital forensics, forensic science, forensic law and management, backed by the university’s national mandate to develop skilled forensic and allied-science professionals.',
      aboutSource: NFSU_PLACEMENTS,
      coursesOffered: nfsuDelhiRows.map((row) => row.name),
      programmesOffered: nfsuDelhiRows,
      facilities: ['Classrooms', 'Hostel Complex', 'Laboratories', 'Library', 'Server Room', 'Training Room', 'Computer Labs', 'Testing Equipment'],
      placements: {
        recruiters: ['ABB', 'Qualcomm', 'Salesforce', 'Accenture', 'Microsoft'],
        sourcePage: NFSU_PLACEMENTS,
      },
      sourceUrl: NFSU_PROGRAMMES,
    },
    {
      ...sriher,
      about: 'Sri Ramachandra Institute of Higher Education and Research (SRIHER) is a deemed university in Chennai offering multidisciplinary education in medicine, dentistry, pharmacy, nursing, physiotherapy, allied health sciences, biomedical sciences, management, engineering, public health and related fields. Its official admissions site reports more than 169 multidisciplinary UG, PG and PhD programmes and a 2,500-bed teaching hospital.',
      aboutSource: SRIHER_UG,
      coursesOffered: sriherRows.map((row) => row.name),
      programmesOffered: sriherRows,
      facilities: ['Teaching Hospitals', 'Laboratories', 'Central Library', 'Separate Hostels', 'Hostel Wi-Fi', 'Study Halls', 'Mess and Cafeteria', 'Indoor Sports', 'Laundry Service', 'Sports and Fitness Centre'],
      placements: {
        highestPackageLpa: 75,
        placedPercent: 85,
        sourcePage: SRIHER_UG,
      },
      sourceUrl: SRIHER_UG,
    },
    {
      ...chitkaraHp,
      website: 'https://www.chitkarauniversity.edu.in/',
      about: 'Chitkara University, Himachal Pradesh was established by the Himachal Pradesh State Legislature and is recognised to confer degrees under the UGC Act. Its official admissions material describes programmes in engineering, nursing, pharmacy and doctoral study, supported by an academic environment aligned with the National Education Policy.',
      aboutSource: CHITKARA_HP_ABOUT,
      coursesOffered: chitkaraHpRows.map((row) => row.name),
      programmesOffered: chitkaraHpRows,
      facilities: ['Smart Classrooms', 'Academic Laboratories', 'Computer Laboratories', 'Research Laboratories', 'Libraries', 'Incubation Centre', 'Gymnasium', 'Sports Facilities', 'Dispensary', 'Hostels'],
      sourceUrl: CHITKARA_HP_ADMISSIONS,
    },
    {
      ...tifrMumbai,
      about: 'Tata Institute of Fundamental Research (TIFR), founded in 1945, is a national centre of the Government of India under the Department of Atomic Energy and a deemed-to-be university for postgraduate and doctoral education. Its Mumbai campus conducts fundamental research and graduate training in mathematics, physics, chemistry, biological sciences, computer science, learning, information and data sciences.',
      aboutSource: TIFR_ABOUT,
      coursesOffered: tifrMumbaiRows.map((row) => row.name),
      programmesOffered: tifrMumbaiRows,
      facilities: ['Computing Facilities', 'Scientific Information Resource Centre', 'Hostel and Guesthouse', 'Lecture Halls', 'Auditorium', 'Low Temperature Facility', 'Central Workshop', 'Technical Services', 'Medical Facilities', 'Sports Club'],
      sourceUrl: TIFR_FACILITIES,
    },
    {
      ...sctimst,
      about: 'Sree Chitra Tirunal Institute for Medical Sciences and Technology (SCTIMST), Thiruvananthapuram is an Institution of National Importance and a university under the Department of Science and Technology, Government of India. Its integrated model combines advanced cardiovascular and neurological patient care, biomedical technology development and public-health research through its Hospital, Biomedical Technology and Achutha Menon Centre wings.',
      aboutSource: SCTIMST_ABOUT,
      coursesOffered: sctimstRows.map((row) => row.name),
      programmesOffered: sctimstRows,
      facilities: ['Hospital Wing', 'Biomedical Technology Wing', 'Achutha Menon Centre for Health Science Studies', 'Research Laboratories', 'Teaching Facilities', 'Library', 'Hostel Accommodation', 'Medical Device Incubator'],
      sourceUrl: SCTIMST_PROGRAMMES,
    },
    {
      ...aiimsRaebareli,
      about: 'All India Institute of Medical Sciences (AIIMS), Raebareli is an autonomous Institution of National Importance established under the All India Institute of Medical Sciences (Amendment) Act, 2013. It delivers medical and nursing education, tertiary health care, diagnostics and research from its campus at Munshiganj, Raebareli, with programmes spanning medicine, nursing and allied health sciences.',
      aboutSource: AIIMS_RBL_ABOUT,
      coursesOffered: aiimsRaebareliRows.map((row) => row.name),
      programmesOffered: aiimsRaebareliRows,
      facilities: ['Medical College', 'College of Nursing', 'Hospital Services', 'Emergency Services', 'Research Cell', 'Learning Management System'],
      campus: { sizeAcres: 97, sourcePage: AIIMS_RBL_ABOUT },
      sourceUrl: AIIMS_RBL_COURSES,
    },
    {
      ...iimb,
      about: 'Indian Institute of Management Bangalore (IIMB) is a graduate school of management and an Institution of National Importance under the Indian Institutes of Management Act, 2017. Established in 1973, it offers doctoral, MBA, public-policy, undergraduate and pre-doctoral programmes, combining management education and research with entrepreneurship, analytics and public-policy practice.',
      aboutSource: IIMB_PROGRAMMES,
      coursesOffered: iimbRows.map((row) => row.name),
      programmesOffered: iimbRows,
      facilities: ['Student Hostels', 'Library', 'Auditorium', 'Computer Centre', 'Internet and Email Access', 'High-Tech Classrooms', 'Seminar Rooms', 'Sports Facilities', 'Medical Centre', 'Cafeteria', 'Bank and ATM', 'Laundry Service'],
      campus: { sizeAcres: 100, sourcePage: IIMB_CAMPUS },
      placements: {
        year: 2026,
        averagePackageLpa: 35.35,
        medianPackageLpa: 34.75,
        recruiters: ['Accenture', 'Boston Consulting Group', 'Bain & Company', 'EY-Parthenon', 'American Express', 'Kearney', 'Tata Consultancy Services', 'Amazon', 'Goldman Sachs', 'Microsoft'],
        sourcePage: IIMB_PLACEMENT_REPORT,
      },
      sourceUrl: IIMB_PLACEMENTS,
    },
    {
      ...jipmer,
      about: 'Jawaharlal Institute of Postgraduate Medical Education and Research (JIPMER), Puducherry is an Institution of National Importance under the Ministry of Health and Family Welfare, Government of India. Its medical-school roots date to 1823; today it combines undergraduate, postgraduate, super-specialty, doctoral and post-doctoral education with patient care and research through its teaching hospital and College of Nursing.',
      aboutSource: JIPMER_ABOUT,
      coursesOffered: jipmerRows.map((row) => row.name),
      programmesOffered: jipmerRows,
      facilities: ['2,059-bed Teaching Hospital', 'College of Nursing', 'Central Library', 'E-Learning Centre', 'Skills Laboratory', 'Lecture Halls', 'Examination Halls', 'Mini Auditorium', 'Central Research Facility', 'Hostels', 'Indoor Stadium', 'Gymnasium and Sports Facilities'],
      campus: { sizeAcres: 195, sourcePage: JIPMER_PDF_PDCC_2026 },
      sourceUrl: JIPMER_INFRASTRUCTURE,
    },
    {
      ...iiitt,
      coursesOffered: iiittRows.map((row) => row.name),
      programmesOffered: iiittRows,
      facilities: ['Academic Block', 'Library', 'Classrooms', 'Software Lab', 'Hardware Lab', 'Conference Hall', 'Senate Hall', 'Boys Hostel', 'Girls Hostel', 'Mess Hall', 'Canteen', 'Gym', 'Medical Room'],
      placements: {
        year: 2026,
        averagePackageLpa: 18.04,
        medianPackageLpa: 12,
        highestPackageLpa: 46.67,
        placedPercent: 73.5,
        recruiters: ['Walmart', 'Amazon', 'Hevo', 'Worlder', 'Xebo.ai'],
        sourcePage: IIITT_PLACEMENT_REPORT,
      },
      sourceUrl: IIITT_FACILITIES,
    },
    {
      ...iimRohtak,
      about: 'Indian Institute of Management Rohtak, established in 2009, is an Institution of National Importance under the Indian Institutes of Management Act, 2017. Located in the National Capital Region, it provides management, law, doctoral and executive education from its residential campus at Sunaria, Rohtak, with a cross-functional focus on research and leadership development.',
      aboutSource: IIMR_ABOUT,
      coursesOffered: iimRohtakRows.map((row) => row.name),
      programmesOffered: iimRohtakRows,
      facilities: ['Knowledge Resource Centre', 'IT Resource Centre', 'Smart Classrooms', 'Lecture Theatres', 'Seminar Hall', 'Conference Halls', 'Video-Conferencing Studio', 'Student Hostels', 'Wi-Fi Campus Network', 'Mess and Cafeteria', 'Medical and Ambulance Services', 'Football Ground', 'Basketball Court', 'Badminton Courts', 'Cricket Ground', 'Table Tennis', 'Gymnasium'],
      campus: { sizeAcres: 200, sourcePage: IIMR_ABOUT },
      placements: {
        year: 2026,
        averagePackageLpa: 20.03,
        medianPackageLpa: 18,
        highestPackageLpa: 37.1,
        placedPercent: 100,
        recruiters: ['Aditya Birla Capital', 'Amazon', 'Amul', 'Barclays', 'AB InBev', 'BlackRock', 'Haleon', 'JSW Energy', 'Kotak Securities', 'Morgan Stanley', 'Suzlon'],
        sourcePage: IIMR_PLACEMENT_REPORT,
      },
      sourceUrl: IIMR_LIBRARY,
    },
    {
      ...iimNagpur,
      about: 'Indian Institute of Management Nagpur began in 2015 under the mentorship of IIM Ahmedabad and is an Institution of National Importance under the Indian Institutes of Management Act, 2017. Since November 2021 it has operated from a 132-acre permanent campus at MIHAN, combining management education and research with field immersion, entrepreneurship, analytics and executive learning.',
      aboutSource: IIMN_ABOUT,
      coursesOffered: iimNagpurRows.map((row) => row.name),
      programmesOffered: iimNagpurRows,
      facilities: ['Academic Complex', 'Library', 'Smart Classrooms', 'IT Infrastructure', 'Administrative Block', 'Student Hostels', 'Dining Hall', 'Sports Complex', 'Multipurpose Hall', 'Faculty Housing', 'Management Development Centre', 'InFED Entrepreneurship Incubation Centre', 'Engineering Support Centres'],
      campus: { sizeAcres: 132, sourcePage: IIMN_CAMPUS },
      placements: {
        year: 2026,
        averagePackageLpa: 18.08,
        medianPackageLpa: 16.32,
        highestPackageLpa: 73.18,
        recruiters: ['Deloitte', 'Amazon', 'L&T', 'ZS', 'BNY Mellon', 'Tredence Analytics', 'ANZ Bank', 'TVS', 'Gartner', 'Amul', 'Tata Power', 'CRISIL', 'Jio'],
        sourcePage: IIMN_PLACEMENT_REPORT,
      },
      gallery: [
        { url: 'https://res.cloudinary.com/dfxar1d0d/image/upload/v1792519745/gyaan-vidhya/universities/indian-institute-of-management-nagpur/photo-1.webp', width: 1500, height: 900, bytes: 135420, originalBytes: 182708, caption: 'Admin and faculty blocks', credit: 'official website', sourcePage: IIMN_CAMPUS },
        { url: 'https://res.cloudinary.com/dfxar1d0d/image/upload/v1792519750/gyaan-vidhya/universities/indian-institute-of-management-nagpur/photo-2.webp', width: 1500, height: 900, bytes: 155236, originalBytes: 199213, caption: 'IIM Nagpur square and main entrance', credit: 'official website', sourcePage: IIMN_CAMPUS },
        { url: 'https://res.cloudinary.com/dfxar1d0d/image/upload/v1792519753/gyaan-vidhya/universities/indian-institute-of-management-nagpur/photo-3.webp', width: 1600, height: 681, bytes: 141908, originalBytes: 294365, caption: 'Campus view from the main entrance', credit: 'official website', sourcePage: IIMN_CAMPUS },
      ],
      sourceUrl: IIMN_CAMPUS,
    },
    {
      ...iimBodhGaya,
      about: 'Indian Institute of Management Bodh Gaya was established in 2015 under the mentorship of IIM Calcutta and is an Institution of National Importance under the Indian Institutes of Management Act, 2017. From its permanent campus at Prabandh Vihar, it combines management education and research with mindfulness, social responsibility, sustainability, industry engagement and experiential learning.',
      aboutSource: IIMBG_ABOUT,
      coursesOffered: iimBodhGayaRows.map((row) => row.name),
      programmesOffered: iimBodhGayaRows,
      facilities: ['Academic Block Uruvela', 'Pragyata Learning Resource Centre', 'Smart Classrooms', 'Computer Lab', 'High-Speed Campus Network', 'Auditorium', 'Student Hostels', 'Dining and Mess Facilities', 'Sports Complex', 'Stadium and Running Track', 'Medical Centre', 'Faculty and Staff Residences', 'Samatvam Mindfulness and Wellbeing Centre'],
      campus: { sizeAcres: 119, sourcePage: IIMBG_CAMPUS },
      placements: {
        year: 2026,
        averagePackageLpa: 14.8,
        medianPackageLpa: 14,
        highestPackageLpa: 45.63,
        placedPercent: 100,
        recruiters: ['Accenture', 'Deloitte', 'PwC', 'EY', 'Grant Thornton', 'ICICI Bank', 'HSBC', 'Federal Bank', 'Tiger Analytics', 'SAP Labs', 'Volvo Eicher Commercial Vehicles', 'Lenskart', 'Wakefit', 'Narayana Health', 'Aditya Birla Capital'],
        sourcePage: IIMBG_PLACEMENT_REPORT,
      },
      gallery: [{
        url: 'https://res.cloudinary.com/dfxar1d0d/image/upload/v1792520175/gyaan-vidhya/universities/indian-institute-of-management-bodh-gaya/photo-1.webp',
        width: 1600,
        height: 1200,
        bytes: 227460,
        originalBytes: 1089231,
        caption: 'Main gate of IIM Bodh Gaya',
        credit: 'Sirikiller1700 / Wikimedia Commons (CC BY-SA 4.0)',
        sourcePage: IIMBG_COMMONS_PHOTO,
      }],
      sourceUrl: IIMBG_CAMPUS,
    },
    {
      ...iitJodhpur,
      about: 'Indian Institute of Technology Jodhpur, established in 2008, is an Institute of National Importance committed to technology education, multidisciplinary research and industry-relevant innovation. It operates from an 852-acre residential campus near Karwar, Jodhpur, with academic programmes organised through departments, schools and interdisciplinary centres spanning engineering, sciences, design, management, medical technologies, liberal arts and education.',
      aboutSource: IITJ_ABOUT,
      coursesOffered: iitJodhpurRows.map((row) => row.name),
      programmesOffered: iitJodhpurRows,
      facilities: ['Main Building and Administrative Block', 'Learning Hub and Central Library', 'Lecture Hall Complex', 'Basic Science Laboratories', 'Departmental Buildings and Research Laboratories', 'Technology Park', 'Student Hostels', 'Dining Halls and Food Courts', 'Sports Complex', 'Health Centre and Ambulance', 'Bank and Post Office', 'Campus Market', 'Faculty and Staff Housing', 'Wireless Campus Network', 'Incubation and Innovation Facilities'],
      campus: { sizeAcres: 852, sourcePage: IITJ_CAMPUS },
      placements: {
        year: 2024,
        placedPercent: 92,
        recruiters: ['Google', 'Microsoft', 'NVIDIA', 'Goldman Sachs', 'PayPal', 'Visa', 'Samsung', 'Oracle', 'MongoDB', 'Cisco', 'Deutsche Bank', 'HSBC', 'BNY', 'Caterpillar', 'Reliance', 'Meesho', 'Zomato', 'Skyroot Aerospace', 'Deloitte', 'Accenture'],
        sourcePage: IITJ_PLACEMENT_REPORT,
      },
      gallery: [
        { url: 'https://res.cloudinary.com/dfxar1d0d/image/upload/v1792520518/gyaan-vidhya/universities/indian-institute-of-technology-jodhpur/photo-1.webp', width: 1000, height: 625, bytes: 41882, originalBytes: 332636, caption: 'Tree of Knowledge and Technology at IIT Jodhpur', credit: 'official website', sourcePage: IITJ_ABOUT },
        { url: 'https://res.cloudinary.com/dfxar1d0d/image/upload/v1792520523/gyaan-vidhya/universities/indian-institute-of-technology-jodhpur/photo-2.webp', width: 1600, height: 756, bytes: 322558, originalBytes: 388577, caption: 'Aerial view of the IIT Jodhpur campus', credit: 'official website', sourcePage: IITJ_CAMPUS },
      ],
      sourceUrl: IITJ_FACILITIES,
    },
    {
      ...pgimer,
      name: 'Postgraduate Institute of Medical Education and Research, Chandigarh',
      shortName: 'PGIMER Chandigarh',
      establishedYear: 1962,
      about: 'Postgraduate Institute of Medical Education and Research (PGIMER), Chandigarh began in 1962 and became an autonomous Institution of National Importance under an Act of Parliament in 1967. Its mandate combines advanced medical and allied-health education, high-quality patient care, training of health personnel, and basic and community-based research through a large tertiary-care teaching hospital and specialist centres.',
      aboutSource: PGIMER_ABOUT,
      streams: ['Medical', 'Nursing', 'Dental', 'Paramedical', 'Science'],
      coursesOffered: pgimerRows.map((row) => row.name),
      programmesOffered: pgimerRows,
      facilities: ['Nehru Hospital', 'Advanced Cardiac Centre', 'Advanced Paediatric Centre', 'Advanced Eye Centre', 'Advanced Trauma Centre', 'New OPD Block', 'School of Public Health', 'National Institute of Nursing Education', 'Tulsi Das Library', 'Research Blocks', 'Lecture and Teaching Facilities', 'Central Workshop', 'Animal House', 'Student Hostels', 'Swimming Pool and Sports Facilities', 'Campus-wide IT Network', 'Main Data Centre', 'Cafeterias', 'Bank and ATMs', 'Post Office and Shopping Complex'],
      campus: { sizeAcres: 277, hostelAvailable: true, sourcePage: PGIMER_FACILITIES },
      placements: {
        year: 2024,
        placedPercent: 44.7,
        note: 'Computed from the latest official NIRF rows: 142 of 318 reported UG (4-year), PG (2-year) and PG (3-year) graduates were placed; another 176 entered higher studies.',
        sourcePage: PGIMER_NIRF_2025,
      },
      gallery: [{
        url: 'https://res.cloudinary.com/dfxar1d0d/image/upload/v1792520959/gyaan-vidhya/universities/post-graduate-institute-of-medical-sciences/photo-1.webp',
        width: 1280,
        height: 720,
        bytes: 203834,
        originalBytes: 288526,
        caption: 'Aerial view of the PGIMER Chandigarh campus',
        credit: 'official website',
        sourcePage: PGIMER_HOME,
      }],
      sourceUrl: PGIMER_FACILITIES,
    },
  ];
  const summary = await upsertUniversities(records, {
    source: { kind: 'scrape', name: 'Official indexed fallback repair', url: '' },
    publish: true,
    dryRun,
  });
  console.log(JSON.stringify({ dryRun, programmeCounts: {
    amu: amuProgrammes.length, bodoland: bodolandRows.length, cvv: cvvRows.length, cgc: cgcRows.length,
    mica: micaRows.length, brainware: brainwareRows.length, siu: siuRows.length,
    nfsuGujarat: nfsuGujaratRows.length, nfsuDelhi: nfsuDelhiRows.length,
    sriher: sriherRows.length, chitkaraHp: chitkaraHpRows.length,
    tifrMumbai: tifrMumbaiRows.length, sctimst: sctimstRows.length,
    aiimsRaebareli: aiimsRaebareliRows.length,
    iimb: iimbRows.length,
    jipmer: jipmerRows.length,
    iiitt: iiittRows.length,
    iimRohtak: iimRohtakRows.length,
    iimNagpur: iimNagpurRows.length,
    iimBodhGaya: iimBodhGayaRows.length,
    iitJodhpur: iitJodhpurRows.length,
    pgimer: pgimerRows.length,
  }, summary }, null, 2));
  if (summary.failed) throw new Error(`${summary.failed} official fallback record(s) failed validation`);
}

try {
  await main();
} finally {
  await closeDb();
}
