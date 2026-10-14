# Courses & exams research — 2026-10-09

Method: WebSearch to find URLs, then Playwright (system Chrome, headless, `--disable-blink-features=AutomationControlled`, real Chrome 141 UA, en-IN) at 1440×900 desktop and 390×844 mobile (Android UA, isMobile). Each run saved a viewport PNG and a full-page PNG (capped at 6000/7000 px). Section PNGs (`*-secN.png`) are scrolled to a named heading. Raw structure (h1/h2/h3, tab labels, first table rows) is in `capture-log-*.json`. WebFetch was not needed because every portal loaded in Chrome this round.

Scripts are in the session scratchpad (`scratchpad/courses/capture.mjs`, `sections.mjs`, `links.mjs`, `nsedu.mjs`).

## Access log (every URL tried)

| Portal | URL | Result | Files |
|---|---|---|---|
| Shiksha | https://www.shiksha.com/b-tech-chp | **404** (wrong slug) | — (overwritten) |
| Shiksha | https://www.shiksha.com/engineering/b-tech-chp | **404** | shiksha-btech2-* (404 page) |
| Shiksha | https://www.shiksha.com/engineering/exams-pc-2 | **404** | — (overwritten) |
| Shiksha | https://www.shiksha.com/b-tech-bachelor-of-technology-chp (found via link dump) | 200, loaded | shiksha-btech-d/m(-full), -sec1..4 |
| Shiksha | https://www.shiksha.com/engineering/jee-main-exam | 200, loaded | shiksha-jee-* |
| Shiksha | https://www.shiksha.com/mba/exams-pc-101 (MBA exam listing) | 200, loaded | shiksha-exams-* |
| Collegedunia | https://collegedunia.com/courses/bachelor-of-technology-btech | 200, loaded (no 403 this round) | cdunia-btech-* |
| Collegedunia | https://collegedunia.com/courses | 200 | cdunia-courses-* |
| Collegedunia | https://collegedunia.com/exams | 200 | cdunia-exams-* |
| Collegedunia | https://collegedunia.com/exams/jee-main | 200 | cdunia-jee-*, -sec1..2 |
| Collegedunia | https://collegedunia.com/exams/cuet | 200 | cdunia-cuet-* |
| CollegeDekho | https://www.collegedekho.com/courses/btech/ | **404** | — (overwritten) |
| CollegeDekho | https://www.collegedekho.com/bachelor-of-technology-btech-course-cid | 200 | cdekho-btech-*, -sec1..3 |
| CollegeDekho | https://www.collegedekho.com/courses/ | 200 (very long list, 922 courses) | cdekho-courses-* |
| CollegeDekho | https://www.collegedekho.com/exams/ | 200 but it **shows the "Top Colleges in India" page**, not an exam listing | cdekho-exams-* |
| CollegeDekho | https://www.collegedekho.com/exam/jee-main | 200 | cdekho-jee-* |
| Careers360 | https://www.careers360.com/courses/b-tech-bachelor-of-technology | 200 | c360-btech-*, -sec1..2 |
| Careers360 | https://www.careers360.com/courses | 200 | c360-courses-* |
| Careers360 | https://www.careers360.com/exams | 200 (sign-in modal over content) | c360-exams-* |
| Careers360 | https://engineering.careers360.com/exams/jee-main | 200 | c360-jee-* |
| Careers360 | https://medicine.careers360.com/exams/neet | 200 | c360-neet-* |
| Careers360 | https://bschool.careers360.com/exams/cat | 200 | c360-cat-* |
| NSEDU | http://127.0.0.1:3001/courses, /exams | 200. No overflow at 1440 or 390. One 401 console error from the anonymous session check (expected). | nsedu-courses-*, nsedu-exams-* |
| NSEDU | http://127.0.0.1:3001/courses/btech, /exams/jee | **404** (routes don't exist yet) | nsedu-course-detail-*, nsedu-exam-detail-* |

All 4 portals were seen in a real browser. Shiksha course/exam listing slugs I guessed returned 404; the working slugs came from the link dump on the JEE page.

## Observed patterns

### Course directories
- **Careers360 /courses**: a left filter rail (Sort: Popularity/Alphabetical; "Education Interest" radio list with counts, e.g. "Engineering And Architecture (135)", with an in-filter search and a "+8 More" link) beside a list of horizontal cards. Each card has an icon tile, the name, "Colleges Available: 6,643", "Degrees offered: …" links, a 2-line description and "Read More →". On mobile the rail becomes a sticky bottom bar with "SORT BY Popularity | FILTERS Applied 0".
- **CollegeDekho /courses**: a "Top Searches" pill row, a left checkbox rail (Duration, Mode, …) and "Total 922 Courses". Cards show the title, a "Follow" button and 2 stat boxes ("Average Duration 4 years", "Average Fees 50K–1.5 L INR"), a summary and a full-width "View Details". The full page is 262k px tall: an endless list with no pagination.
- **Collegedunia /courses**: a search hero with quick course links, then "Choose by level" photo tiles (After 10th / After 10+2 / Diploma / PG / PhD), each holding count-badge chips per stream ("207 Engineering"), then "Choose by interest".
- Shared idea across all 3: **stream + level are the main ways in, and every option shows a count**. Course cards stay short: name, 1–2 key numbers, one primary action.

### Course detail (B.Tech)
- **Header**: a breadcrumb (Home › Engineering › B.Tech), an SEO title, then 1–2 CTAs. Shiksha has "View Colleges" + "Download Guide"; CollegeDekho has "Try Our College Finder" + "Check Eligibility" plus Save/Request callback/Ask us.
- **In-page tab bar under the header**, which is sticky on CollegeDekho (cdekho-btech-sec2 shows it pinned). Labels: Shiksha has Overview, Courses, Syllabus, Career, Admission, Fees, Popular Colleges, Top Ranked, Top Exams, Featured Colleges, Q&A (wraps to 2 lines on desktop). CollegeDekho has Overview, Syllabus, Jobs, Salary, B Tech Colleges. Collegedunia has dropdown tabs with a horizontal scroll arrow. On mobile the tabs scroll horizontally (Shiksha uses pill tabs plus an expand chevron).
- **"Highlights" key/value table** near the top on all 4 portals: Course level, Full form, Duration, Eligibility, Admission process, Fees, Average salary.
- **Colleges table**: Name | fee | NIRF rank (Shiksha, Careers360 "Top private B.Tech colleges with fees", CollegeDekho "Top 100"). Rankings are a core trust signal for them. **NSEDU must not do this** because it has no real rankings.
- **Related exams** as chips/links (JEE Main, JEE Advanced, MHT CET…). Specialisations and "Popular courses" link farms appear near the bottom.
- **FAQ accordion** (Shiksha "BTech Course FAQs", CollegeDekho FAQs) and a Table of contents block (Shiksha, Collegedunia, Careers360 "This Story also Contains").
- **Right rail** of sponsored "Applications open → Apply" college ads (Careers360), "Integrated/Featured courses" (Collegedunia) and lead forms.

### Exam listings
- **Collegedunia /exams**: a search hero with quick exam links, then "Exams Category" stream chips (Engineering active, plus Medical, Management, …, "View less"). Exam cards (2-col) have a logo, name, full name, "Online Exam" tag, key-date rows, and links: Application Process, Exam Pattern, Previous Year Paper, "Apply Now". On mobile the chips wrap to 3 rows, then "View All Stream →", then stacked cards.
- **Careers360 /exams**: "Showing 676 Exams" with a left rail (Sort by Popularity/Application Date/Exam Date/Result Date/Upcoming; Stream(13) with counts; Degree; Exam type…). Cards show mode, level, conducting body, "42 Accepting Colleges", plus a sub-link strip (Application | Exam Pattern | Admit Card | … | FAQs) and Get Update/Brochure buttons.
- **Shiksha MBA exams**: 2-col cards with a mini date table and a sub-link strip. "Download Guide" sits on every card.

### Exam detail (JEE Main, NEET, CUET, CAT)
- Each has a breadcrumb, an H1 title, and a sticky horizontal tab bar (Overview, Admit card, Cutoff, Question paper, Preparation, Mock test, College predictor, News, Participating colleges…).
- The top block is a "Latest updates" box with dated items. Below it is a **highlights table** (Exam name, Conducting body, Level, Sessions, Mode, Languages). Shiksha puts an exam-date callout in the hero; Careers360 mobile shows "Upcoming event: Admit card 04 Nov–29 Nov" with Get Update / Brochure / Apply.
- They usually link to the official site ("jeemain.nta.nic.in", "cuet.nta.nic.in" appear as tab/link items on Collegedunia).
- Shiksha shows "2259 Institutes accepting JEE Main" as a right-rail carousel of college cards with Compare + Brochure, and has a "You're looking at B.E./B.Tech" course-context bar.
- Lower down: FAQ, "Similar/Other exams", news list.

### Patterns to avoid (seen)
Forced sign-in modals after a few seconds (Careers360 desktop and mobile), cookie bars covering CTAs (Shiksha), mobile-number capture in content (Shiksha "Register Now"), "Download Guide/Brochure" lead gates on every card, sponsored "Apply" rails mixed in with editorial content, floating chat/WhatsApp bubbles over content, app-install banners (Collegedunia mobile), ad slots that leave blank space above content (Collegedunia), SEO keyword-stuffed H1s, 10+ tabs that wrap, NIRF tables, unverified salary claims, author photos used as authority.

## Current NSEDU (nsedu-*.png)
- /courses: PageIntro, a full-width search, then 13 field chips that wrap to 2 rows on desktop and **6 rows on mobile** (the first card starts about 760 px down at 390 px wide). Cards: field eyebrow, name, full name, summary, "N sample colleges listed", a "View colleges" primary and a "Check eligibility" link. Card heights are uneven and CTA alignment drifts. There are no fees/salary figures, no level, no sort and no detail page.
- /exams: 4 cards, each with related-course tags, "Official website ↗" and "Exam & results news". There is no field filter, though 4 items don't need one. The related tags are matched by field only, which gives **wrong links**: JEE Main → M.Tech (M.Tech admission goes through GATE, not JEE Main), CAT → BBA (CAT is for postgraduate management). CUET UG has field "Undergraduate", which matches no course, so it shows no related courses.
- /courses/[id] and /exams/[id] return 404. Card `id` anchors exist on /exams (jee, neet, cuet, cat).
