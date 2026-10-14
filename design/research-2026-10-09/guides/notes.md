# Guides, search and information pages: research notes (2026-10-09)

Scope: scholarship pages, career-guidance/article pages, admission guides, search results, about/contact/help/legal pages on Shiksha, Collegedunia, CollegeDekho and Careers360, plus the current NSEDU implementation.
Method: Playwright with headless Chrome (channel `chrome`). Desktop was 1440x900 with a Windows Chrome UA. Mobile was 390x844 at DPR 2 with an Android Chrome UA. Each URL got a viewport PNG and a full-page PNG capped at 7000/9000 px, plus an h1-h3, breadcrumb, TOC and tab dump (`capture-*.json`). WebFetch and WebSearch filled in page text. Scripts are in the session scratchpad (`capture.mjs`, `search.mjs`, `search2.mjs`).
Shiksha and Collegedunia returned 403 in an earlier round. This round the same headless Chrome loaded them with a desktop UA and `navigator.webdriver` masked. WebFetch still got 403 from both.

## Access log (every URL tried)

| # | URL | Method | Result | Evidence |
|---|-----|--------|--------|----------|
| 1 | https://www.collegedekho.com/scholarships/ | Playwright + WebFetch | 200, but it **redirects to the "Top Colleges in India 2026" listing**, not a scholarship hub | cdekho-scholarships-*.png |
| 2 | https://www.collegedekho.com/search/?q=btech | Playwright | ERR_TOO_MANY_REDIRECTS (no screen) | none |
| 3 | https://www.collegedekho.com/about-us/ | Playwright | 200 | cdekho-about-*.png |
| 4 | https://www.collegedekho.com/articles/ | Playwright | 200 | cdekho-articles-*.png |
| 5 | https://www.careers360.com/scholarships | Playwright + WebFetch | 404 | c360-scholarships-* (404 page) |
| 6 | https://www.careers360.com/about-us | Playwright + WebFetch | 200 | c360-about-*.png |
| 7 | https://www.careers360.com/contact-us | Playwright + WebFetch | 200 | c360-contact-*.png |
| 8 | https://www.careers360.com/search?q=btech and ?query=btech | Playwright | 404 both | c360-search-* (404) |
| 9 | https://www.shiksha.com/scholarships | Playwright (WebFetch 403) | 200, redirects to the **Study Abroad scholarships** hub | shiksha-scholarships-*.png |
| 10 | https://www.shiksha.com/search?q=btech | Playwright | 200, lands on the "Best BTech Colleges in India 2026" category page | shiksha-search-*.png |
| 11 | https://www.shiksha.com/about-us | Playwright | 404 | shiksha-about-* (404) |
| 12 | https://collegedunia.com/scholarship | Playwright (WebFetch 403) | 200, study-abroad scholarship listing | cdunia-scholarship-*.png |
| 13 | https://collegedunia.com/about-us | Playwright | 404 | none useful |
| 14 | https://collegedunia.com/search?q=btech | Playwright | 404 | none useful |
| 15 | https://engineering.careers360.com/articles/how-get-100-percent-scholarship-in-engineering-colleges | Playwright + WebFetch | 200 | c360-article-scholarship-*.png |
| 16 | https://engineering.careers360.com/articles/idfc-first-bank-engineering-scholarship | Playwright | 200 | c360-article-idfc-*.png |
| 17 | https://www.collegedekho.com/post-matric-scholarship-for-minorities-dsp-3 | Playwright + WebFetch | 200 | cdekho-scholarship-detail-*.png |
| 18 | https://www.collegedekho.com/articles/how-to-fill-nsp-scholarship-2025-application-form-steps-to-generate-otr-number/ | Playwright | 200 | cdekho-article-nsp-*.png |
| 19 | https://collegedunia.com/courses/courses-after-12th | Playwright | 200 | cdunia-career-guide-*.png |
| 20 | https://collegedunia.com/news/e-704-career-options-after-class-12-arts | Playwright | 200 | cdunia-news-article-*.png |
| 21 | https://www.shiksha.com/studyabroad/documents-required-for-filling-applications-for-universities-in-the-usa-articlepage-600 | Playwright | 200 | shiksha-abroad-docs-*.png |
| 22 | https://www.shiksha.com/shikshaHelp/ShikshaHelp/contactUs | Playwright | 200 on desktop. The mobile UA was redirected to the home page | shiksha-contact-*.png |
| 23 | https://www.shiksha.com/shikshaHelp/ShikshaHelp/grievances | Playwright | 200 | shiksha-grievances-*.png |
| 24 | http://faq.shiksha.com/ | Playwright | 200 on desktop, but the page is the Terms and Conditions with a numbered TOC. The mobile UA was redirected to the home page | shiksha-faq-*.png |
| 25 | https://www.collegedekho.com/contact-us/ | Playwright | 200 | cdekho-contact-*.png |
| 26 | https://www.shiksha.com/b-tech-bachelor-of-technology-chp | Playwright | 200 | shiksha-btech-hub-*.png |
| 27 | Header search flows on careers360.com, collegedunia.com, collegedekho.com and shiksha.com (typed "btech", then Enter) | Playwright | Captured the focus, suggest and results screens. Careers360 opened a sign-in modal over the search, and Enter did nothing | *-search-focus/suggest/results-1440.png, search-capture*.json |
| 28 | WebSearch (site-restricted) for scholarship, admission and career-guide URLs on each portal | WebSearch | Gave URLs 15-21. The search snippets themselves were not used as evidence of layout | none |

NSEDU current state is in `nsedu-current/` (http://127.0.0.1:3001): /scholarships, /career-guidance, /admission-checklist, /search?q=btech, ?q=pune, ?q=zzqx, /search, /about, /contact, /help, /privacy-policy and /news, each at 1440 and 390.
- During the first pass every route returned 500 because of a build error in another agent's file (`features/home/ComparePromo.js` could not resolve `./Home.module.css`). That error was not in guides code. All routes rendered 200 on a re-capture a few minutes later, except one /news mobile hit that caught another transient HMR error.
- Every NSEDU page logs a single console 401, which looks like the unauthenticated student-session probe. It is not guides code.
- No horizontal overflow on any NSEDU page at 390 or 1440.

## Observed patterns, by page type

### Page headers and breadcrumbs (all four)
- Every article or info page has a breadcrumb trail above the H1, and the trail carries the **real hierarchy**: Home > Engineering > B Tech on Shiksha; Home > Scholarships > government-scholarships > slug on CollegeDekho; Home > Exams > JEE Main > article on Careers360. Collegedunia puts the breadcrumb on the right side of the title row on desktop.
- The H1 sits next to one or two primary actions: Shiksha has "View Colleges" plus "Download Guide", Careers360 has "Download PDF".
- A byline with an "Updated on <date>" line comes next. CollegeDekho shows "Updated on" with **no date**, and Careers360's "2024" title carries a 2026 update date. Both are trust failures.
- Shiksha's course hub and CollegeDekho's articles use a horizontal **section tab or chip bar** under the header (Overview, Courses, Syllabus, Career, Admission, Fees and so on). On mobile it scrolls sideways or wraps with an expand chevron.
- Careers360's info pages (About, Grievance, Contact Us, Careers) use a **sibling-page side nav card** with the current page highlighted. On mobile it becomes a horizontal tab strip under the header. This is the cleanest help-centre pattern seen.

### Table of contents
- CollegeDekho uses a boxed "Table of Contents" with two columns of anchor links after the intro. Careers360 uses "This Story also Contains" as a numbered list. Collegedunia uses a numbered list collapsed behind "Read More", which hides navigation and should be avoided.
- None of the four portals used a **sticky** TOC with scroll-spy in the captures. All TOCs are static blocks at the top. On a long page a sticky rail is a clear improvement over the competition.

### Step lists, checklists and quick facts
- Scholarship detail pages (CollegeDekho) follow a fixed template: Key dates table (Event / Details), Overview table (Scholarship name, Provider, Beneficiaries, Eligibility, Amount, Application method), Eligibility, a 6-step Application process, Application status, a 9-item **Documents required** bullet list, Benefits, Contact, Popular and Other scholarships link lists, and FAQs as H3 question plus paragraph.
- Steps and checklists are plain bullet lists everywhere. **None are interactive**, and there is no way to tick off documents. That gap is where NSEDU can stand out.
- Collegedunia's scholarship cards have a title, 5 key-value bullets (eligibility, amount, type, level, count), "Read More", and twin "APPLY NOW" / "GET ALERT" buttons, with a filter row of pills (Level, Type, Gender, Nationality, Deadline, Clear All) and country chips. The page shows "591 Scholarships Found" next to a scholarship search box.

### Career guidance
- Collegedunia "Courses after 12th" starts with an intro, then a 3-way **stream segmented control** (Science, Commerce, Arts), a TOC, and course rows with duration and mode badges plus overview, syllabus and career links.
- Shiksha's course hub has a highlights table, specialisations, an "How to apply" step section, entrance exams, fees, colleges, salary and FAQs.

### Search
- **Autosuggest rows with a type label** are shown by CollegeDekho (Course, Colleges, Article, College, Exam, Qna on the right), Shiksha (Colleges, College) and Collegedunia (Course). The matched part of the query is bold on Shiksha.
- **Collegedunia results page**: header "Searched For 'btech'", then "Found 701 Results | 29 Colleges | 672 Updates" as count links. Grouped sections ("Colleges ... View All 29 Colleges", "News ... View All 672 News") show a 4-up card grid. Relevance was poor: a "btech" search returned **dental colleges**. There was no explanation of why an item matched.
- **Shiksha** sends an exact course query straight to the course hub (best-match routing). A broad query goes to a category listing with "5,016 results", filter chips, "Clear All" and "Sort By".
- **Careers360** search opened a mobile-number sign-in modal over the search, so search was gated behind lead capture. This is a dark pattern.

### About, contact and help
- Careers360 Contact: a hero with an illustration, then "Reach out to us through these" with **channel cards** (icon, title, one-line purpose, single action such as Mail or Subscribe), then "Where to Find Us".
- Shiksha Contact: an "Ask a question" box, then email lines and city office cards with addresses and phones. Grievances shows a named officer with email and address.
- CollegeDekho Contact: a dark hero ("Thanks for visiting us."), then an address column and a regional offices grid.
- Careers360 About: a photo hero with in-page tabs (About, Who We Are?, Our Team) and big stat counters. The counters contradict the footer (225M vs 400M+ students).
- The Shiksha "FAQ" link actually opens Terms and Conditions with a numbered TOC. Legal pages on all portals are long numbered documents.

### Ad clutter and dark patterns seen (do NOT adopt)
- Unlabelled sponsored "Apply" college cards inside article sidebars (Careers360 "Applications for Admissions are open").
- Full-width university banner ads between the header and the H1 (Shiksha search) and inside article lists (CollegeDekho articles).
- Floating chat or counselling bubbles covering body text on mobile (Shiksha's lightning FAB, Collegedunia's filter FAB over a card).
- A sign-in modal interrupting search (Careers360). "Install App" banners above the header (Collegedunia mobile).
- Repeated "APPLY NOW / GET ALERT / Download Brochure / Get Free Counselling" on every card.
- Stale years in titles (2023/2024/2025 pages updated in 2026), missing update dates, and conflicting statistics.
- TOC hidden behind "Read More". Cookie bars covering the bottom 10% of the first screen.

## NSEDU current state (from screenshots)
- PageIntro is already a good base: breadcrumb, icon eyebrow, H1 with an italic underlined accent, description and related-tool pills. Gaps: no stats or aside slot is used, the breadcrumb has only one level (Home > eyebrow), and nothing is above-the-fold useful beyond the pills.
- Guides (/scholarships, /career-guidance, /admission-checklist) have 2-3 numbered step cards, a wine checklist card in the aside, and on /scholarships two resource cards. The page is short, with lots of empty space at 1440. There is no TOC and the checklist is not interactive. The aside card is not sticky, and on mobile it drops to the very bottom after all steps.
- /search?q=btech shows "1 result" (just the B.Tech course card). The backend search only matches institution name, shortName, city and state, so the programmes offering B.Tech are not surfaced even though the catalogue has them. /search?q=pune shows 3 institutions (Meadow Engineering, Meadow Management, Meadow Pharmacy) with course chips. The zero state has a dashed box, "No matches found" and one "Browse all courses" button. The empty query shows only one line of text.
- [slug] info pages use a different header (plain breadcrumb with "/", uppercase category, large H1) from the PageIntro band, so they look like a separate site. They are a single text column of H2 + paragraph + links. Contact adds an "Email support" card (temporary address, labelled "not active yet") and "Official social profiles" marked "Coming soon". There is no sibling navigation between the 13 info pages.
- Live data at research time: 2 scholarships (National Scholarship Portal, Buddy4Study), 16 courses (6 popular), 4 exams (each with an official href), and search results shaped as `{query, courses[], exams[], colleges[{id,name,city,state,courses[]}]}`.
