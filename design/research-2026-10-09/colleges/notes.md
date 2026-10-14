# Colleges area research (listing and profile pages), 2026-10-09

Method: WebSearch to find URLs, then WebFetch to read page text, then Playwright with headless Chrome (channel `chrome`). Each page was captured at 1440×900 with a desktop Chrome 129 UA and at 390×844 with an Android Pixel 8 UA, using `--disable-blink-features=AutomationControlled` and with `navigator.webdriver` masked. I read every screenshot listed below. The scripts are `capture-portals.mjs`, `capture-details.mjs`, `capture-nsedu.mjs` and `crop.ps1`, all in this folder. Logs are in `capture-log-*.json`, `capture-details-log.json` and `nsedu-capture-log.json`.

All observations are about UI and information architecture. Copy, branding, logos and images from these portals must not be reused.

## Access log

| Site | URL | WebFetch | Playwright | Evidence |
|---|---|---|---|---|
| Collegedunia listing | https://collegedunia.com/btech-colleges | 403 | 200 desktop + mobile | collegedunia-listing-{desktop,mobile}[-full].png, collegedunia-listing-table-crop.png, collegedunia-listing-text.txt |
| Collegedunia profile | https://collegedunia.com/university/25881-indian-institute-of-technology-iit-madras-chennai | 403 | 200 desktop + mobile | collegedunia-profile-*.png, collegedunia-profile-section-*.png |
| Shiksha listing | https://www.shiksha.com/engineering/colleges/b-tech-colleges-india | 403 | 200 desktop + mobile; mobile filter sheet opened | shiksha-listing-*.png, shiksha-listing-mobile-filters.png |
| Shiksha profile | https://www.shiksha.com/university/iit-madras-indian-institute-of-technology-madras-3031 | 403 | 200 desktop + mobile | shiksha-profile-*.png (incl. -scrolled), shiksha-profile-section-*.png |
| CollegeDekho listing | https://www.collegedekho.com/btech-colleges-in-india/ | 200 (text, truncated) | 200 desktop + mobile; the mobile "Filters" click failed (timeout, the locator matched a modal title), so the drawer was not observed | collegedekho-listing-*.png, collegedekho-listing-cards-crop.png |
| CollegeDekho profile | https://www.collegedekho.com/colleges/iitm (found from a card link; /colleges/iit-madras returned 404) | n/a | 200 desktop + mobile | collegedekho-profile-*.png, collegedekho-profile-text.txt |
| Careers360 listing | https://engineering.careers360.com/colleges/list-of-be-btech-colleges-in-india | 200 (text) | 200 desktop + mobile; filter sheet opened | careers360-listing-*.png, careers360-listing-mobile-filters.png |
| Careers360 profile | https://www.careers360.com/university/indian-institute-of-technology-madras | 200 (text) | 200 desktop + mobile | careers360-profile-*.png, careers360-profile-section-*.png |
| Careers360 courses tab | https://www.careers360.com/university/indian-institute-of-technology-madras/courses | 200 (text only) | not captured | — |
| NSEDU /colleges | http://127.0.0.1:3001/colleges (+ ?course=mba&location=Pune) | n/a | 200 at 1440/1024/390 | nsedu-colleges-*.png, nsedu-colleges-mba-pune-*.png |
| NSEDU /compare | http://127.0.0.1:3001/compare?course=btech | n/a | 200 | nsedu-compare-*.png |
| NSEDU /colleges/northfield-tech | profile probe | n/a | 404 (route does not exist yet) | nsedu-profile-probe-*.png |
| NSEDU / | homepage | n/a | 200, but `#course-colleges` was **not found**. LandingPage.js does not currently render CollegeExplorer | — |

Earlier rounds saw 403 responses from Shiksha and Collegedunia for headless Chrome. This round all four portals returned 200 once a real UA was set. WebFetch still received 403 from both.

## Listing page patterns

- **Filter sidebar** (Shiksha, CollegeDekho, Careers360): a left column of about 300px. Each group is a collapsible heading. Long groups have their own search box (State, City, Exam, Branch). Each option has a checkbox and a right-aligned count, for example "Hyderabad (193)". Groups are truncated after 5–6 options with "+31 More". Careers360 also shows a "Showing N Colleges" line and a "Clear Filters" link at the top. Collegedunia instead uses a horizontal row of dropdown pills (Sub Stream, State, Stream, City, Degree, …, Total Fees) with a horizontal scroll arrow.
- **Filter groups that appear repeatedly**: Location (state, city), Stream/Degree/Course, Specialization/Branch, Total fees ranges (Shiksha: "< 1 Lakh, 1–3 L, 3–5 L…" with counts; Careers360: radio "Upto 1/2/3/5/10 Lakh, Above 10 Lakh" plus a custom "Upto ₹" input with Apply), Rating buckets (Shiksha "4–5 Star"), Ownership, Exams accepted, Study mode, Gender.
- **Active filter chips**: outlined pills with ×, placed above the results (Shiksha, Careers360, CollegeDekho) or under the pill bar (Collegedunia). There is always a "Clear all".
- **Results header**: "5,016 results | Best BTech Colleges in India 2026" with "Sort By: Popularity ▾" on the right (Shiksha). Careers360 puts sort inside the sidebar as radios. Collegedunia shows sort as inline radios (Popularity / Rating / Highest Fees / Lowest Fees) plus a list/grid/table view toggle.
- **Search within results**: Careers360 has a full-width "Search by College Name" box above the results.
- **Result cards**:
  - Shiksha has the cleanest card. It shows the name (link), a location pin, ownership and NIRF on one meta line, then a 2×2 key/value grid (Courses offered with rating, Exams accepted, Total tuition fees as a range, Median salary as a range), a bookmark icon at top right, and Compare (outline) and Brochure (filled) buttons at the bottom right.
  - CollegeDekho shows a photo on the left with a rating badge, then meta icons (location, type, approval), then fee range, average package, NIRF and exams in a row. It adds a carousel of "specialties" and a footer row with deep links (Course and Fee (98) · Admission · Placement) plus Brochure and Shortlist buttons.
  - Careers360 shows a logo, an ownership/location/rating/NIRF grid, a "featured course" line with exam and fee plus "(13 Courses)", and a footer link row (Courses · Fees · Cut-off · Admissions · Placements · Review …) with Brochure, Enquire and Compare buttons stacked on the right.
  - Collegedunia is a dense table: CD Rank | College (Apply Now, Download Brochure, Add To Compare) | Course Fees | Placement (avg/highest + "Compare Placement") | User Reviews | Ranking. On mobile the table scrolls sideways, which is the weakest mobile pattern seen.
- **Deep links from a card to profile sections** (CollegeDekho, Careers360) are a good pattern because they connect the listing to profile anchors.
- **Mid-list inserts**: FAQ accordions, "Filter by State" chip panels (Careers360), counsellor carousels, featured/sponsored cards and display ads (CollegeDekho shows an LPU banner between cards, and Collegedunia shows a "Featured" row inside the ranking table).
- **Pagination**: Shiksha uses "Load More Colleges". Careers360 uses numbered pages with Next. Collegedunia and CollegeDekho load more on scroll.
- **Mobile**: Shiksha has a pill row at the top: a filter icon with a count badge, then Rating, Specialization and Location pills. It opens a full-height sheet with a category rail on the left (with count badges) and options on the right, plus a sticky Cancel / Apply Filters footer. Careers360 has a sticky bottom bar split into "SORT BY · Careers360 R…" and "FILTERS · Applied 1". Its sheet has accordions, a "(4824 Colleges)" count in the title, and a Clear Filter / Apply Filter footer. Shiksha and Careers360 both stack cards in a single column. Collegedunia's mobile listing scrolls its table sideways.

## Profile page patterns

- **Hero**:
  - Shiksha shows a cover image with a logo overlap, the H1 name, a location / rating / Q&A meta line, ownership and established-year tags, and Save, Compare and Brochure buttons on the right.
  - Careers360 shows a logo, an SEO-style H1, location links, rating, a line of badges, and stacked Enquire, Brochure and Compare buttons on the right.
  - CollegeDekho puts a photo on the right with four floating stat cards (NIRF, established year, highest package, type) and Download Brochure and Shortlist buttons.
  - Collegedunia has a dark band with logo, H1, city · type · established year, a rating with review count, and "Get Contact Details".
- **Sticky section tabs**: every portal has a horizontally scrolling tab bar. Shiksha: College Info, Courses, Fees, Reviews, Admissions, Placements, Cut-Offs, Rankings, Gallery, Hostel & Campus, Faculty, Compare, Q&A, Scholarships. Shiksha's desktop sticky header collapses to the name plus Save/Compare/Brochure above the tabs (shiksha-profile-desktop-scrolled.png). On mobile, Shiksha and Collegedunia make only the tab bar sticky.
- **Courses and fees**:
  - Shiksha uses a card per degree family: name, course count, rating, duration, Exams, Total tuition fees, Median salary, and Compare and Brochure buttons.
  - CollegeDekho uses a table: Course name | Fees (/year) with a Shortlist button | Eligibility, with "Show More" behind a fade. One cell rendered "null / year", which is a data-quality failure.
  - Careers360 uses course cards: Duration, Total fees, Seats, Exams, Brochure/Compare. Its courses tab has its own faceted sidebar (Stream, Degree, Level, Mode, Exam) and fee sorts.
- **Placements**: mostly prose, plus a table (Course | Students placed | Median package) and NIRF-sourced progress bars ("PG (2 years): 962/1464"). Careers360 labels its source ("Data Source: NIRF 2026"), which is a pattern worth adopting.
- **Similar colleges**: Shiksha has "Explore popular similar colleges", a carousel of mini cards (name, location, courses offered, rating, total fees, Brochure). Careers360 has "Popular College Comparisons": paired "College A vs College B · same course" cards, each with a Compare button.
- **CTA rails**: a right rail with "Are you interested in this college?" (Apply Now / Download Brochure) followed by ad banners (Collegedunia, Careers360 "Applications open" list). There is also a sticky bottom CTA bar: Careers360 desktop shows Enquire/Brochure/Compare, CollegeDekho shows "Request a Callback / Check Eligibility", and mobile shows Compare + Brochure (Shiksha) or Brochure + Apply Now (Collegedunia).

## Dark patterns and quality problems observed (avoid)

- Interruptive sign-in modals asking for a mobile number on scroll (Careers360 desktop, careers360-profile-section-highlights.png) and cookie bars that cover cards (Shiksha).
- Display ads and "Featured"/"Applications invited" cards mixed into organic results and profile rails (CollegeDekho LPU banner; Collegedunia Paru/Amity banners; Careers360 "Apply" list; Shiksha "Popular MBA Exam Apply").
- Fees and contact details gated behind "Get Fee Details", "Get Contact Details" and "Brochure" lead forms.
- Popularity signals presented as quality ("Shortlisted by 5115+ students", "5000+ Brochures downloaded so far").
- Inconsistent data: a title year that does not match the heading year (CollegeDekho 2026/2025); "null / year" shown as a fee; conflicting fee values for the same course on the same page (noted in the Careers360 WebFetch); and CollegeDekho's IIT Madras hero says "Year of Establishment 2008" although its own text and other portals say 1959. This shows why NSEDU must never display fields it does not hold.
- Large empty ad slots on mobile (Collegedunia profile, mobile scrolled view) and floating chat or WhatsApp bubbles covering content.

## Current NSEDU state (read from code and screenshots)

- `/colleges` = PageIntro + CollegesView → CollegeExplorer: course tabs (11 + More), three selects (Location, Annual fee, Sort), a 5-row preview table, a compare bar, and dialogs for details, apply, compare and directory. The layout has no overflow at 390, 1024 or 1440.
- Issues:
  1. Compare state is component-only and starts with Northfield and Central already selected (`collegeDemo.initialComparison`). It is never written to `nsedu:compare`, so /compare shows "0/3 selected" (nsedu-compare-1440.png).
  2. "Explore fees, placements and reviews" claims reviews that do not exist.
  3. "Apply now" opens a checklist that cannot submit, which reads as a promise.
  4. The save (heart) only lasts for the visit.
  5. Only 5 rows are shown, and the full list sits in a modal.
  6. Filters are not synced to the URL apart from course.
  7. There is no profile route (/colleges/northfield-tech returns 404).
  8. A hydration-mismatch console error appeared at 1440 on /colleges, shown in the Next dev overlay as "1 Issue". The source was not traced; re-check after the rebuild.
  9. A 401 console error comes from the student session probe, which is expected when logged out.
- The homepage (`/`) currently does not render CollegeExplorer (LandingPage.js does not import it), so `#course-colleges` exists only on /colleges.

## Catalogue facts the design must handle (from backend seed and frontend fallback)

- 11 institutions and 29 programmes.
- Programmes per institution: Riverside University 7, Central Health 6, Northfield Tech 3, Central Tech 3, Meadow Management 2, Northfield Design 2, Riverside Arts 2, and 1 each for the remaining four.
- Cities: Bengaluru 2, Pune 3, Hyderabad 2, Chennai 2, Delhi NCR 2. **Delhi NCR has `state: null`.**
- States: Karnataka, Maharashtra, Telangana, Tamil Nadu.
- Fields (by programme count): Engineering 7, Management 4, Computing 3, Medical 3, Commerce 2, Design 2, Law 2, Pharmacy 2, Healthcare 1, Arts 1, Dentistry 1, Hospitality 1.
- Tuition ranges from ₹70,000 (Riverside Arts BA) to ₹6,50,000 (Central Health MBBS).
- 9 programmes have no placement data (null median and highest).
- Demo ratings are per institution, between 4.0 and 4.4.
- Tuition year is 2026–27 and placement year is 2024–25.
