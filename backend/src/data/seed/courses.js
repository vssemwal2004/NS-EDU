// The course catalogue: the degrees, diplomas and doctorates Indian universities and colleges award,
// named as the University Grants Commission's specification of degrees and the professional
// regulators (AICTE, NMC, DCI, PCI, INC, BCI, NCTE, CoA, VCI, ICAR, NCAHP) name them. One entry per
// degree, not per specialisation: "B.Tech Computer Science" is the B.Tech here, and the institution's
// own programme row keeps the branch. General knowledge about the degree only — fees, seats and
// durations differ by institution and come from each institution's own pages.
//
// `aliases` are other spellings an institution prints, used to link its programmes to a course.
// The first sixteen slugs predate this list and are referenced elsewhere; they must not change.
const course = (slug, name, fullName, field, level, icon, summary, aliases = []) => ({ slug, name, fullName, field, level, icon, summary, aliases });

const courses = [
  // ---- Popular first (landing order) -----------------------------------------------------------
  course('btech', 'B.Tech', 'Bachelor of Technology', 'Engineering', 'UG', 'cap', 'Undergraduate engineering degree, studied in a chosen branch such as computer science, mechanical, civil or electronics.', ['BTech', 'B Tech']),
  course('mba', 'MBA', 'Master of Business Administration', 'Management', 'PG', 'chart', 'Postgraduate management degree with specialisations such as finance, marketing, human resources and operations.'),
  course('bcom', 'B.Com', 'Bachelor of Commerce', 'Commerce', 'UG', 'document', 'Undergraduate degree in accounting, taxation, finance and business law, offered as a general or honours programme.'),
  course('bca', 'BCA', 'Bachelor of Computer Applications', 'Computing', 'UG', 'laptop', 'Undergraduate degree in programming, databases, networks and software development.'),
  course('mbbs', 'MBBS', 'Bachelor of Medicine and Bachelor of Surgery', 'Medical', 'UG', 'medical', 'The undergraduate medical degree, followed by a compulsory rotating internship; admission is through NEET UG.'),
  course('bdes', 'B.Des', 'Bachelor of Design', 'Design', 'UG', 'palette', 'Undergraduate design degree in areas such as communication, product, fashion, interior and interaction design.'),
  course('llb', 'LL.B', 'Bachelor of Laws', 'Law', 'UG', 'scales', 'The three-year law degree taken after graduation, leading to enrolment as an advocate.', ['LLB', 'LL.B.']),
  course('bba', 'BBA', 'Bachelor of Business Administration', 'Management', 'UG', 'people', 'Undergraduate degree in management, marketing, finance and business operations.', ['BBM', 'Bachelor of Business Management']),
  course('mtech', 'M.Tech', 'Master of Technology', 'Engineering', 'PG', 'gear', 'Postgraduate engineering degree in a specialisation, commonly entered through GATE.', ['MTech', 'M Tech']),
  course('bpharm', 'B.Pharm', 'Bachelor of Pharmacy', 'Pharmacy', 'UG', 'science', 'Undergraduate pharmacy degree covering pharmaceutics, pharmacology, pharmaceutical chemistry and pharmacognosy.', ['B.Pharma', 'B. Pharmacy']),
  course('nursing', 'B.Sc Nursing', 'Bachelor of Science in Nursing', 'Nursing', 'UG', 'medical', 'Undergraduate nursing degree recognised by the Indian Nursing Council, with clinical training in hospitals.', ['B.Sc. (Nursing)', 'BSc Nursing', 'Basic B.Sc Nursing']),
  course('ba', 'BA', 'Bachelor of Arts', 'Arts', 'UG', 'book', 'Undergraduate degree in humanities and social sciences such as English, history, economics, political science and psychology.', ['B.A.', 'B.A']),
  course('bams', 'BAMS', 'Bachelor of Ayurvedic Medicine and Surgery', 'Medical', 'UG', 'medical', 'Undergraduate degree in Ayurveda; admission is through NEET UG.'),
  course('bhms', 'BHMS', 'Bachelor of Homoeopathic Medicine and Surgery', 'Medical', 'UG', 'medical', 'Undergraduate degree in homoeopathy; admission is through NEET UG.'),
  course('bds', 'BDS', 'Bachelor of Dental Surgery', 'Dentistry', 'UG', 'medical', 'The undergraduate dental degree, followed by a compulsory internship; admission is through NEET UG.'),
  course('bhm', 'BHM', 'Bachelor of Hotel Management', 'Hospitality', 'UG', 'people', 'Undergraduate degree in hotel operations, food production, front office and hospitality management.', ['BHMCT', 'Bachelor of Hotel Management and Catering Technology', 'B.Sc Hospitality and Hotel Administration', 'B.Sc HHA', 'Bachelor of Hospitality Management']),

  // ---- Engineering and technology --------------------------------------------------------------
  course('be', 'B.E.', 'Bachelor of Engineering', 'Engineering', 'UG', 'gear', 'Undergraduate engineering degree, equivalent to the B.Tech, studied in a chosen branch.', ['BE']),
  course('me', 'M.E.', 'Master of Engineering', 'Engineering', 'PG', 'gear', 'Postgraduate engineering degree, equivalent to the M.Tech, in a chosen specialisation.', ['ME']),
  course('btech-mtech', 'B.Tech + M.Tech', 'Integrated B.Tech and M.Tech (Dual Degree)', 'Engineering', 'UG', 'gear', 'An integrated programme leading to both an undergraduate and a postgraduate engineering degree.', ['B.Tech M.Tech', 'B.Tech-M.Tech Dual Degree', 'Dual Degree B.Tech M.Tech', 'Integrated M.Tech']),
  course('diploma-engineering', 'Diploma in Engineering', 'Polytechnic Diploma in Engineering', 'Engineering', 'Diploma', 'gear', 'Polytechnic diploma in an engineering branch, taken after class 10; holders can join a B.Tech through lateral entry.', [
    'Polytechnic Diploma', 'Diploma Civil', 'Diploma Mechanical', 'Diploma Electrical', 'Diploma Computer', 'Diploma Electronic', 'Diploma Automobile', 'Diploma Mining', 'Diploma Chemical','Diploma in Civil Engineering', 'Diploma in Mechanical Engineering', 'Diploma in Electrical Engineering', 'Diploma in Electrical and Electronics Engineering',
    'Diploma in Electronics and Communication Engineering', 'Diploma in Computer Science and Engineering', 'Diploma in Computer Engineering', 'Diploma in Information Technology',
    'Diploma in Automobile Engineering', 'Diploma in Chemical Engineering', 'Diploma in Mining Engineering', 'Diploma in Electronics Engineering', 'Diploma in Instrumentation Engineering',
  ]),

  // ---- Computing -------------------------------------------------------------------------------
  course('mca', 'MCA', 'Master of Computer Applications', 'Computing', 'PG', 'laptop', 'Postgraduate degree in software development, systems and computer applications.'),
  course('pgdca', 'PGDCA', 'Post Graduate Diploma in Computer Applications', 'Computing', 'Diploma', 'laptop', 'A one-year postgraduate diploma in computer applications for graduates of any discipline.', ['PG Diploma in Computer Applications']),

  // ---- Management ------------------------------------------------------------------------------
  course('pgdm', 'PGDM', 'Post Graduate Diploma in Management', 'Management', 'PG', 'chart', 'An AICTE-approved two-year postgraduate management programme offered by autonomous business schools.', ['PG Diploma in Management', 'PGPM', 'Post Graduate Programme in Management']),
  course('executive-mba', 'Executive MBA', 'Executive Master of Business Administration', 'Management', 'PG', 'chart', 'An MBA for working professionals, usually requiring prior work experience.', ['EMBA', 'MBA (Executive)', 'MBA Executive']),
  course('integrated-mba', 'BBA + MBA', 'Integrated BBA and MBA', 'Management', 'UG', 'chart', 'An integrated programme entered after class 12 that leads to both a BBA and an MBA.', ['Integrated MBA', 'BBA MBA', 'BBA-MBA Integrated', 'IPM', 'Integrated Programme in Management']),
  course('bms', 'BMS', 'Bachelor of Management Studies', 'Management', 'UG', 'people', 'Undergraduate management degree in business, economics, finance and marketing.'),
  course('mms', 'MMS', 'Master of Management Studies', 'Management', 'PG', 'chart', 'Postgraduate management degree, offered mainly by universities in Maharashtra.'),

  // ---- Commerce --------------------------------------------------------------------------------
  course('mcom', 'M.Com', 'Master of Commerce', 'Commerce', 'PG', 'document', 'Postgraduate degree in advanced accounting, finance, taxation and business economics.', ['MCom', 'M Com']),
  course('baf', 'BAF', 'Bachelor of Commerce in Accounting and Finance', 'Commerce', 'UG', 'document', 'Undergraduate commerce degree focused on accounting, auditing, taxation and finance.', ['B.Com Accounting and Finance', 'B.Com (Accounting and Finance)', 'Bachelor of Accounting and Finance']),
  course('bbi', 'BBI', 'Bachelor of Commerce in Banking and Insurance', 'Commerce', 'UG', 'document', 'Undergraduate commerce degree in banking, insurance and financial services.', ['B.Com Banking and Insurance', 'B.Com (Banking and Insurance)', 'Bachelor of Banking and Insurance']),

  // ---- Science ---------------------------------------------------------------------------------
  course('bsc', 'B.Sc', 'Bachelor of Science', 'Science', 'UG', 'science', 'Undergraduate science degree in subjects such as physics, chemistry, mathematics, biology, computer science and biotechnology.', ['BSc', 'B.S.', 'B.Sc.']),
  course('msc', 'M.Sc', 'Master of Science', 'Science', 'PG', 'science', 'Postgraduate science degree in a chosen subject, often with a research project.', ['MSc', 'M.Sc.']),
  course('integrated-msc', 'Integrated M.Sc', 'Integrated Bachelor and Master of Science', 'Science', 'UG', 'science', 'An integrated science programme entered after class 12 that leads to a master\'s degree.', ['B.Sc M.Sc', 'B.Sc-M.Sc', 'BS-MS', 'BS MS Dual Degree', 'Five Year Integrated M.Sc']),
  course('bstat', 'B.Stat', 'Bachelor of Statistics', 'Science', 'UG', 'science', 'Undergraduate degree in statistics and probability with applications in data analysis.', ['B. Stat', 'B.Stat (Hons)']),
  course('mstat', 'M.Stat', 'Master of Statistics', 'Science', 'PG', 'science', 'Postgraduate degree in theoretical and applied statistics.', ['M. Stat']),

  // ---- Arts, humanities and social sciences ------------------------------------------------------
  course('ma', 'MA', 'Master of Arts', 'Arts', 'PG', 'book', 'Postgraduate degree in a humanities or social science subject.', ['M.A.', 'M.A']),
  course('bfa', 'BFA', 'Bachelor of Fine Arts', 'Arts', 'UG', 'palette', 'Undergraduate degree in painting, sculpture, applied art, printmaking or photography.', ['B.F.A.', 'B.F.A']),
  course('mfa', 'MFA', 'Master of Fine Arts', 'Arts', 'PG', 'palette', 'Postgraduate degree in a fine or visual arts discipline.', ['M.F.A.', 'M.F.A', 'MVA', 'Master of Visual Arts']),
  course('bpa', 'BPA', 'Bachelor of Performing Arts', 'Arts', 'UG', 'palette', 'Undergraduate degree in music, dance or theatre.', ['B.P.A.', 'B.Mus', 'Bachelor of Music', 'Bachelor of Fine Arts in Music']),
  course('bsw', 'BSW', 'Bachelor of Social Work', 'Arts', 'UG', 'people', 'Undergraduate degree in social work practice, community development and welfare.', ['B.S.W.']),
  course('msw', 'MSW', 'Master of Social Work', 'Arts', 'PG', 'people', 'Postgraduate degree in professional social work with supervised fieldwork.', ['M.S.W.']),
  course('blis', 'B.Lib.I.Sc', 'Bachelor of Library and Information Science', 'Arts', 'UG', 'book', 'A degree in library management, cataloguing and information services, taken after graduation.', ['B.Lib', 'BLIS', 'B.L.I.Sc', 'B.Lib.Sc']),
  course('mlis', 'M.Lib.I.Sc', 'Master of Library and Information Science', 'Arts', 'PG', 'book', 'Postgraduate degree in library and information science.', ['M.Lib', 'MLIS', 'M.L.I.Sc', 'M.Lib.Sc']),

  // ---- Media and journalism ----------------------------------------------------------------------
  course('bjmc', 'BJMC', 'Bachelor of Journalism and Mass Communication', 'Media & Journalism', 'UG', 'document', 'Undergraduate degree in reporting, editing, broadcast, digital media and public relations.', ['BAJMC', 'BA JMC', 'BA Journalism and Mass Communication', 'B.A. (JMC)', 'BMC', 'Bachelor of Mass Communication']),
  course('mjmc', 'MJMC', 'Master of Journalism and Mass Communication', 'Media & Journalism', 'PG', 'document', 'Postgraduate degree in journalism, media production and communication research.', ['MAJMC', 'MA JMC', 'MA Journalism and Mass Communication', 'MMC', 'Master of Mass Communication']),
  course('bmm', 'BMM', 'Bachelor of Mass Media', 'Media & Journalism', 'UG', 'document', 'Undergraduate degree in advertising and journalism, offered mainly by universities in Maharashtra.', ['BAMMC', 'BA Multimedia and Mass Communication']),

  // ---- Law -------------------------------------------------------------------------------------
  course('ba-llb', 'BA LLB', 'Bachelor of Arts and Bachelor of Laws (Integrated)', 'Law', 'UG', 'scales', 'Five-year integrated law degree entered after class 12, combining arts subjects with law.', ['B.A. LL.B', 'B.A. LL.B. (Hons.)', 'BA LLB (Hons)', 'B.A.LL.B']),
  course('bba-llb', 'BBA LLB', 'Bachelor of Business Administration and Bachelor of Laws (Integrated)', 'Law', 'UG', 'scales', 'Five-year integrated law degree entered after class 12, combining management with law.', ['B.B.A. LL.B', 'BBA LLB (Hons)', 'B.B.A.LL.B']),
  course('bcom-llb', 'B.Com LLB', 'Bachelor of Commerce and Bachelor of Laws (Integrated)', 'Law', 'UG', 'scales', 'Five-year integrated law degree entered after class 12, combining commerce with law.', ['B.Com LL.B', 'B.Com. LL.B. (Hons.)']),
  course('bsc-llb', 'B.Sc LLB', 'Bachelor of Science and Bachelor of Laws (Integrated)', 'Law', 'UG', 'scales', 'Five-year integrated law degree entered after class 12, combining science with law.', ['B.Sc LL.B', 'B.Sc. LL.B. (Hons.)']),
  course('llm', 'LL.M', 'Master of Laws', 'Law', 'PG', 'scales', 'Postgraduate law degree in a specialisation such as constitutional, corporate or criminal law.', ['LLM', 'LL.M.']),

  // ---- Medical, dental and AYUSH -----------------------------------------------------------------
  course('md', 'MD', 'Doctor of Medicine', 'Medical', 'PG', 'medical', 'Postgraduate medical degree in a clinical or para-clinical specialty, taken after MBBS through NEET PG.', ['M.D.']),
  course('ms-medical', 'MS', 'Master of Surgery', 'Medical', 'PG', 'medical', 'Postgraduate surgical degree in a specialty such as general surgery or orthopaedics, taken after MBBS through NEET PG.', ['M.S.', 'MS (Surgery)']),
  course('dm', 'DM', 'Doctorate of Medicine', 'Medical', 'PG', 'medical', 'Super-specialty medical degree taken after an MD, such as cardiology or neurology.', ['D.M.']),
  course('mch', 'M.Ch', 'Master of Chirurgiae', 'Medical', 'PG', 'medical', 'Super-specialty surgical degree taken after an MS, such as neurosurgery or urology.', ['MCh', 'M.Ch.']),
  course('dnb', 'DNB', 'Diplomate of National Board', 'Medical', 'PG', 'medical', 'Postgraduate medical qualification awarded by the National Board of Examinations in Medical Sciences.'),
  course('mds', 'MDS', 'Master of Dental Surgery', 'Dentistry', 'PG', 'medical', 'Postgraduate dental degree in a specialty such as orthodontics or prosthodontics, taken after BDS.'),
  course('bums', 'BUMS', 'Bachelor of Unani Medicine and Surgery', 'Medical', 'UG', 'medical', 'Undergraduate degree in Unani medicine; admission is through NEET UG.'),
  course('bsms', 'BSMS', 'Bachelor of Siddha Medicine and Surgery', 'Medical', 'UG', 'medical', 'Undergraduate degree in Siddha medicine; admission is through NEET UG.'),
  course('bnys', 'BNYS', 'Bachelor of Naturopathy and Yogic Sciences', 'Medical', 'UG', 'medical', 'Undergraduate degree in naturopathy and yoga therapy.'),
  course('md-ayush', 'MD (AYUSH)', 'Doctor of Medicine in Ayurveda, Homoeopathy or Unani', 'Medical', 'PG', 'medical', 'Postgraduate degree in an AYUSH system of medicine, entered through AIAPGET.', ['MD (Ayurveda)', 'MD (Hom)', 'MD (Homoeopathy)', 'MD (Unani)', 'MS (Ayurveda)']),
  course('bvsc', 'B.V.Sc & A.H.', 'Bachelor of Veterinary Science and Animal Husbandry', 'Veterinary', 'UG', 'medical', 'The undergraduate veterinary degree, recognised by the Veterinary Council of India.', ['BVSc', 'B.V.Sc', 'B.V.Sc. & A.H.', 'BVSc and AH']),
  course('mvsc', 'M.V.Sc', 'Master of Veterinary Science', 'Veterinary', 'PG', 'medical', 'Postgraduate veterinary degree in a specialty such as surgery, medicine or animal nutrition.', ['MVSc', 'M.V.Sc.']),

  // ---- Pharmacy --------------------------------------------------------------------------------
  course('mpharm', 'M.Pharm', 'Master of Pharmacy', 'Pharmacy', 'PG', 'science', 'Postgraduate pharmacy degree in a specialisation such as pharmaceutics or pharmacology, commonly entered through GPAT.', ['M.Pharma', 'M. Pharmacy']),
  course('pharmd', 'Pharm.D', 'Doctor of Pharmacy', 'Pharmacy', 'UG', 'science', 'A clinical pharmacy degree entered after class 12, including hospital training.', ['Pharm D', 'PharmD', 'Pharm.D.']),
  course('dpharm', 'D.Pharm', 'Diploma in Pharmacy', 'Pharmacy', 'Diploma', 'science', 'The diploma that qualifies a pharmacist to register with a State Pharmacy Council.', ['D.Pharma', 'D. Pharmacy', 'Diploma in Pharmacy']),

  // ---- Nursing ---------------------------------------------------------------------------------
  course('msc-nursing', 'M.Sc Nursing', 'Master of Science in Nursing', 'Nursing', 'PG', 'medical', 'Postgraduate nursing degree in a specialty such as medical-surgical, paediatric or community health nursing.', ['M.Sc. (Nursing)', 'MSc Nursing']),
  course('pb-bsc-nursing', 'Post Basic B.Sc Nursing', 'Post Basic Bachelor of Science in Nursing', 'Nursing', 'UG', 'medical', 'A nursing degree for registered GNM nurses.', ['P.B.B.Sc Nursing', 'Post Basic B.Sc. (Nursing)', 'PB BSc Nursing']),
  course('gnm', 'GNM', 'General Nursing and Midwifery', 'Nursing', 'Diploma', 'medical', 'Diploma in general nursing and midwifery, recognised by the Indian Nursing Council.', ['Diploma in General Nursing and Midwifery']),
  course('anm', 'ANM', 'Auxiliary Nurse Midwifery', 'Nursing', 'Diploma', 'medical', 'Diploma for community health and midwifery work, recognised by the Indian Nursing Council.', ['Diploma in Auxiliary Nurse Midwifery']),

  // ---- Allied health and paramedical -------------------------------------------------------------
  course('bpt', 'BPT', 'Bachelor of Physiotherapy', 'Allied Health', 'UG', 'medical', 'Undergraduate physiotherapy degree with clinical training and an internship.', ['B.P.T.', 'B.P.T']),
  course('mpt', 'MPT', 'Master of Physiotherapy', 'Allied Health', 'PG', 'medical', 'Postgraduate physiotherapy degree in a specialty such as orthopaedics, neurology or sports.', ['M.P.T.', 'M.P.T']),
  course('bot', 'BOT', 'Bachelor of Occupational Therapy', 'Allied Health', 'UG', 'medical', 'Undergraduate degree in occupational therapy and rehabilitation.', ['B.O.T.', 'BOTh']),
  course('bmlt', 'BMLT', 'Bachelor of Medical Laboratory Technology', 'Allied Health', 'UG', 'science', 'Undergraduate degree in clinical laboratory testing: pathology, biochemistry and microbiology.', ['B.Sc MLT', 'B.Sc Medical Laboratory Technology', 'B.Sc Medical Lab Technology', 'B.Sc (MLT)']),
  course('dmlt', 'DMLT', 'Diploma in Medical Laboratory Technology', 'Allied Health', 'Diploma', 'science', 'Diploma for work as a medical laboratory technician.', ['Diploma in Medical Lab Technology']),
  course('baslp', 'BASLP', 'Bachelor in Audiology and Speech-Language Pathology', 'Allied Health', 'UG', 'medical', 'Undergraduate degree in hearing and speech assessment and therapy, recognised by the Rehabilitation Council of India.', ['B.ASLP', 'B.Sc Speech and Hearing']),
  course('boptom', 'B.Optom', 'Bachelor of Optometry', 'Allied Health', 'UG', 'medical', 'Undergraduate degree in eye examination, vision correction and optometric care.', ['B.Sc Optometry', 'B.Sc (Optometry)', 'Bachelor of Science in Optometry']),
  course('bsc-radiology', 'B.Sc Radiology', 'Bachelor of Science in Radiology and Imaging Technology', 'Allied Health', 'UG', 'medical', 'Undergraduate degree in X-ray, CT, MRI and ultrasound imaging technology.', ['B.Sc Radiology and Imaging Technology', 'BRIT', 'B.Sc Medical Imaging Technology', 'B.Sc Radio Imaging', 'B.Sc Medical Radiology and Imaging Technology']),
  course('bsc-ott', 'B.Sc OTT', 'Bachelor of Science in Operation Theatre Technology', 'Allied Health', 'UG', 'medical', 'Undergraduate degree in operation theatre and anaesthesia technology.', ['B.Sc Operation Theatre Technology', 'B.Sc Anaesthesia and Operation Theatre Technology', 'B.Sc Anaesthesia Technology', 'B.Sc OT Technology']),
  course('mph', 'MPH', 'Master of Public Health', 'Allied Health', 'PG', 'medical', 'Postgraduate degree in epidemiology, health policy and community health.', ['M.P.H.']),

  // ---- Design and fashion ------------------------------------------------------------------------
  course('mdes', 'M.Des', 'Master of Design', 'Design', 'PG', 'palette', 'Postgraduate design degree in a specialisation such as product, communication or interaction design.', ['MDes', 'M Des']),
  course('bftech', 'B.F.Tech', 'Bachelor of Fashion Technology', 'Design', 'UG', 'palette', 'Undergraduate degree in apparel production, garment technology and fashion manufacturing.', ['BFTech', 'Bachelor of Fashion Technology']),
  course('mftech', 'M.F.Tech', 'Master of Fashion Technology', 'Design', 'PG', 'palette', 'Postgraduate degree in apparel and fashion technology.', ['MFTech']),
  course('mfm', 'MFM', 'Master of Fashion Management', 'Design', 'PG', 'palette', 'Postgraduate degree in fashion merchandising, retail and brand management.'),

  // ---- Architecture and planning -----------------------------------------------------------------
  course('barch', 'B.Arch', 'Bachelor of Architecture', 'Architecture', 'UG', 'building', 'Undergraduate architecture degree approved by the Council of Architecture; admission uses NATA or JEE Main Paper 2.', ['BArch', 'B. Arch']),
  course('march', 'M.Arch', 'Master of Architecture', 'Architecture', 'PG', 'building', 'Postgraduate architecture degree in a specialisation such as urban design or landscape architecture.', ['MArch', 'M. Arch']),
  course('bplan', 'B.Plan', 'Bachelor of Planning', 'Architecture', 'UG', 'building', 'Undergraduate degree in urban and regional planning.', ['BPlan', 'B. Planning']),
  course('mplan', 'M.Plan', 'Master of Planning', 'Architecture', 'PG', 'building', 'Postgraduate degree in urban, regional, transport or environmental planning.', ['MPlan', 'M. Planning']),

  // ---- Education -------------------------------------------------------------------------------
  course('bed', 'B.Ed', 'Bachelor of Education', 'Education', 'UG', 'book', 'The teacher-training degree for secondary schools, recognised by the NCTE and taken after graduation.', ['BEd', 'B. Ed', 'B.Ed.']),
  course('med', 'M.Ed', 'Master of Education', 'Education', 'PG', 'book', 'Postgraduate degree in educational theory, research and teacher education.', ['MEd', 'M. Ed', 'M.Ed.']),
  course('bped', 'B.P.Ed', 'Bachelor of Physical Education', 'Education', 'UG', 'people', 'Teacher-training degree in physical education and sports, recognised by the NCTE.', ['BPEd', 'B.P.E.S', 'BPES', 'Bachelor of Physical Education and Sports']),
  course('mped', 'M.P.Ed', 'Master of Physical Education', 'Education', 'PG', 'people', 'Postgraduate degree in physical education and sports science.', ['MPEd', 'M.P.E.S']),
  course('deled', 'D.El.Ed', 'Diploma in Elementary Education', 'Education', 'Diploma', 'book', 'The teacher-training diploma for primary and upper-primary schools, recognised by the NCTE.', ['DElEd', 'D.El.Ed.', 'BTC', 'JBT', 'Diploma in Education']),
  course('itep', 'Integrated B.Ed', 'Integrated Teacher Education Programme', 'Education', 'UG', 'book', 'A four-year integrated programme entered after class 12, leading to a bachelor\'s degree with a B.Ed (BA B.Ed, B.Sc B.Ed or B.Com B.Ed).', ['ITEP', 'BA B.Ed', 'B.A. B.Ed', 'B.A.B.Ed', 'B.Sc B.Ed', 'B.Sc. B.Ed', 'B.Sc.B.Ed', 'B.Com B.Ed']),
  course('bel-ed', 'B.El.Ed', 'Bachelor of Elementary Education', 'Education', 'UG', 'book', 'A four-year degree for teaching in elementary schools, entered after class 12.', ['BElEd', 'B.El.Ed.']),

  // ---- Agriculture and allied ------------------------------------------------------------------
  course('bsc-agriculture', 'B.Sc Agriculture', 'Bachelor of Science in Agriculture', 'Agriculture', 'UG', 'science', 'Undergraduate degree in agronomy, soil science, plant breeding, entomology and agricultural economics.', ['B.Sc (Hons) Agriculture', 'B.Sc. (Hons.) Agriculture', 'B.Sc Ag', 'B.Sc. (Ag)', 'B.Sc Agri']),
  course('msc-agriculture', 'M.Sc Agriculture', 'Master of Science in Agriculture', 'Agriculture', 'PG', 'science', 'Postgraduate agriculture degree in a discipline such as agronomy or plant pathology.', ['M.Sc (Ag)', 'M.Sc. (Agri)', 'M.Sc Ag']),
  course('bsc-horticulture', 'B.Sc Horticulture', 'Bachelor of Science in Horticulture', 'Agriculture', 'UG', 'science', 'Undergraduate degree in fruit, vegetable, flower and plantation crop production.', ['B.Sc (Hons) Horticulture', 'B.Sc. (Hort)']),
  course('bsc-forestry', 'B.Sc Forestry', 'Bachelor of Science in Forestry', 'Agriculture', 'UG', 'science', 'Undergraduate degree in forest management, silviculture and wildlife.', ['B.Sc (Hons) Forestry']),
  course('bfsc', 'B.F.Sc', 'Bachelor of Fisheries Science', 'Agriculture', 'UG', 'science', 'Undergraduate degree in aquaculture, fish processing and fisheries management.', ['BFSc', 'B.F.Sc.']),
  course('btech-agri', 'B.Tech Agricultural Engineering', 'Bachelor of Technology in Agricultural Engineering', 'Agriculture', 'UG', 'gear', 'Undergraduate degree in farm machinery, irrigation and post-harvest engineering.', ['B.Tech (Agricultural Engineering)', 'B.Tech Agriculture Engineering', 'B.Tech (Agri. Engg.)']),
  course('btech-food', 'B.Tech Food Technology', 'Bachelor of Technology in Food Technology', 'Agriculture', 'UG', 'science', 'Undergraduate degree in food processing, preservation and quality control.', ['B.Tech (Food Technology)', 'B.Tech Food Science and Technology', 'B.Tech Dairy Technology']),

  // ---- Hospitality and tourism -----------------------------------------------------------------
  course('mhm', 'MHM', 'Master of Hotel Management', 'Hospitality', 'PG', 'people', 'Postgraduate degree in hospitality and hotel administration.', ['M.Sc Hospitality Administration', 'MHMCT']),
  course('bttm', 'BTTM', 'Bachelor of Tourism and Travel Management', 'Hospitality', 'UG', 'compass', 'Undergraduate degree in tourism operations, travel services and destination management.', ['BTTS', 'BTM', 'Bachelor of Travel and Tourism Management', 'BBA Tourism and Travel Management', 'BA Tourism']),
  course('mttm', 'MTTM', 'Master of Tourism and Travel Management', 'Hospitality', 'PG', 'compass', 'Postgraduate degree in tourism and travel management.', ['MTM', 'Master of Tourism Management', 'MBA Tourism']),

  // ---- Vocational ------------------------------------------------------------------------------
  course('bvoc', 'B.Voc', 'Bachelor of Vocation', 'Vocational', 'UG', 'gear', 'A skill-based undergraduate degree in a trade or industry, with practical training.', ['BVoc', 'B. Voc', 'Bachelor of Vocational Studies']),
  course('mvoc', 'M.Voc', 'Master of Vocation', 'Vocational', 'PG', 'gear', 'A skill-based postgraduate degree in a trade or industry.', ['MVoc', 'M. Voc']),

  // ---- Research --------------------------------------------------------------------------------
  course('phd', 'Ph.D', 'Doctor of Philosophy', 'Research', 'PhD', 'book', 'The research doctorate, awarded for a thesis under a supervisor; entry is usually through UGC NET or the university\'s own test.', ['PhD', 'Ph.D.', 'Ph. D', 'D.Phil', 'Doctoral Programme', 'Doctoral Research']),
  course('mphil', 'M.Phil', 'Master of Philosophy', 'Research', 'PG', 'book', 'A pre-doctoral research degree; the UGC discontinued new M.Phil admissions under its 2022 regulations.', ['MPhil', 'M.Phil.']),
  course('dsc', 'D.Sc', 'Doctor of Science', 'Research', 'PhD', 'book', 'A higher doctorate awarded for a body of published research in science.', ['DSc', 'D.Sc.']),
  course('dlitt', 'D.Litt', 'Doctor of Letters', 'Research', 'PhD', 'book', 'A higher doctorate awarded for a body of published work in the humanities.', ['DLitt', 'D.Litt.', 'Doctor of Literature']),

  // ---- More postgraduate degrees -------------------------------------------------------------
  course('mha', 'MHA', 'Master of Hospital Administration', 'Management', 'PG', 'medical', 'Postgraduate degree in hospital and healthcare management.', ['M.H.A.', 'MBA Hospital Administration', 'MBA Hospital Management', 'Master of Hospital Management', 'MBA Healthcare Management']),
  course('mpa', 'MPA', 'Master of Public Administration', 'Arts', 'PG', 'book', 'Postgraduate degree in public policy, governance and administration.', ['M.P.A.', 'MA Public Administration']),

  // ---- Diplomas and certificates in any subject ------------------------------------------------
  // Catch-alls: a "Diploma in Graphic Designing" is a diploma, and is listed as one. Named diplomas
  // above (D.Pharm, polytechnic, GNM, D.El.Ed …) win because the longest match wins.
  course('dca', 'DCA', 'Diploma in Computer Applications', 'Computing', 'Diploma', 'laptop', 'A short diploma in office software, programming basics and computer use.', ['Diploma in Computer Application']),
  course('pg-diploma', 'PG Diploma', 'Post Graduate Diploma', 'Diplomas & Certificates', 'Diploma', 'document', 'A postgraduate diploma in a specific subject, usually one year, taken after graduation.', ['P.G. Diploma', 'PGD', 'Post-Graduate Diploma', 'Postgraduate Diploma', 'P G Diploma']),
  course('diploma', 'Diploma', 'Diploma programme', 'Diplomas & Certificates', 'Diploma', 'document', 'A diploma in a specific subject or skill, shorter than a degree.', ['Advanced Diploma', 'Diploma Course', 'Diploma Programme']),
  course('certificate', 'Certificate', 'Certificate course', 'Diplomas & Certificates', 'Diploma', 'document', 'A short certificate course in a specific subject or skill.', ['Certificate Course', 'Certificate Programme', 'Certificate in']),
];

// The first six (landing order) are shown as popular.
export const seedCourses = courses.map((item, order) => ({ ...item, popular: order < 6, order, active: true }));
