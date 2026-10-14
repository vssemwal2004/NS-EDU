# Compare area — competitive research (2026-10-09)

Method: WebSearch to find URLs, Playwright (headless Chrome via `channel: 'chrome'`, desktop 1440×900 Windows Chrome UA, mobile 390×844 Android Chrome UA, `--disable-blink-features=AutomationControlled`), WebFetch for page text. Scripts: scratchpad `compare/capture.mjs`, `probe.mjs`, `interact.mjs`, `nsedu.mjs`. Raw headings/text per page: `capture-*.json`.

## Access log (every URL tried)

| Portal | URL | Result |
|---|---|---|
| Collegedunia | https://collegedunia.com/college-compare | **404** (desktop + mobile) — URL from brief no longer exists (`01-*`) |
| Collegedunia | https://collegedunia.com/compare, /compare-colleges | 404 (probe only) |
| Collegedunia | https://collegedunia.com/ | 200 — harvested real pair URL from homepage links |
| Collegedunia | https://collegedunia.com/college-compare/iit-delhi-vs-iit-madras-2049-2049 | **200 desktop + mobile** — fully loaded and inspected (`05-*`, `10-*`, `11-*`). Add-college search input could not be clicked by script (timeout), so the search dropdown was NOT seen. |
| Shiksha | https://www.shiksha.com/resources/college-comparison | 200 → redirects to https://www.shiksha.com/compare (`02-*`) |
| Shiksha | https://www.shiksha.com/compare-iit-bombay-vs-iit-delhi-id-109575-110582 | 200 in Playwright → redirects to `/compare-iit-bombay-vs-iit-delhi-54212-53938?clpId1=…&clpId2=…&pageVariant=courseCompare` (`06-*`, `08-*`, `09-*`). **WebFetch returned 403** for the same URL. "Add College" click timed out (overlay), so the add-college search layer was NOT seen. |
| CollegeDekho | https://www.collegedekho.com/compare-colleges/ | 200 but page title "Coming Soon - CollegeDekho"; body is only login modal text + stream link chips, no comparison tool (`03-*`). WebFetch confirms no compare UI in first 100k chars. |
| CollegeDekho | https://www.collegedekho.com/compare/ | 200 → redirects to /colleges-in-india/ (no compare tool). Searches found no live CollegeDekho compare page. **Recorded as: compare tool not available / not observed.** |
| Careers360 | https://www.careers360.com/compare-colleges | 200 desktop; mobile first attempt ERR_NAME_NOT_RESOLVED (transient DNS), second attempt 200 (`04-*`, `13-*`) |
| Careers360 | https://www.careers360.com/compare-colleges/rv-college-of-engineering-bangalore-vs-bms-college-of-engineering-bangalore | 200 desktop + mobile (`07-*`, `12-*`). Page opens with a blocking "Add college, degree & course" modal; dismissing it (Esc/click outside) opened a full-screen sign-up wall. Only "Quick Facts" rows were visible behind the overlay. |
| NSEDU | http://127.0.0.1:3001/compare and /compare?course=btech (3 programmes preset in localStorage) | 200, 1440/1024/390, no horizontal overflow, only console error is a 401 from the logged-out student session check (`20-*`) |

Covered: Collegedunia, Shiksha, Careers360 (3 of 4). CollegeDekho's compare tool is not live.

## Observed patterns

### Shiksha (`02`, `06`, `08`, `09`)
- Landing `/compare`: 4 dashed "+ Add College" slots in a row (slots 2–4 greyed until slot 1 filled), share icons row, "Popular comparisons of B.Tech / MBA" horizontal carousels of pair cards (logo VS logo, name, course, star rating + review count, orange "Compare" button).
- Result page: course-level compare (title names the programme). Column cards: logo, name, city, programme, "Modify Selection"; × remove on each card; "VS" disc between cards; empty slots show "Add College **or** Add Similar College" (one-click suggestion — good idea).
- **Sticky compact header** on scroll: names + programme + × + empty "Add College" slots stay pinned at top while sections scroll (`08-*-scroll900`). Strong pattern.
- Grouped accordion sections with centred titles: Institute Information, Course Details, then Student Rating & Reviews, Ranking, Placement, Course Fees, Admission Info, Cut Off, Total Seats, Infrastructure & Facilities — all **locked behind "Login To Continue"** (lock icons).
- Poll "If you had to choose… which would you prefer?", "Download this Comparison as PDF", "Rate this page", share buttons, "Popular comparisons with <college A>/<college B>", news, ads.
- Mobile: 2 columns side by side, each cell repeats the label above its value (no separate label column); sticky name header persists; no horizontal scroll for 2 colleges.
- No highlight-differences toggle and no winner indicator observed.

### Collegedunia (`05`, `10`, `11`)
- Top: 4 image cards (campus photo, name, programme, "Edit"); empty slots have inline "Search College" + "Search Course" inputs ("Add More").
- Left numbered section nav (01 Course Comparison … 08 Question Answer) with active state; collapsible section cards (—).
- Table per section: label column + college columns; Cost to Study (first-year + total fees), Ranking, Eligibility, General Course Details, College Course Details; Placement (highest/average salary, recruiters).
- **Placement, Reviews, Cutoff, Photos, Facilities, Popular Comparison and Q&A are blurred behind orange "Unlock" buttons** (lead-capture gate). Right rail: Apply Now, Download Brochure, "Write a review & win ₹1,00,000", admission predictor, popular comparison list.
- Mobile: sticky bottom bar (Brochure / Apply Now); the comparison table scrolls horizontally but the **label column scrolls away** with it (`11-*-table-scrolled`) and column 2 is cut with no affordance. Header cards do not stay pinned.
- No highlight-differences toggle or winner indicator observed.

### Careers360 (`04`, `07`, `12`, `13`)
- Landing: hero "College Compare" + "Start Comparing" CTA opens a modal with 3 slots; each slot = Search college → Select degree → Select course → Apply; "Start Compare" enabled when ready. Disabled slots show a line-art campus illustration.
- "Check what your peers compared": UG/PG toggle + stream tabs (Engineering, Management, Medicine, Law, Design…) + horizontal carousel of pair cards (name, city, VS logos).
- Result page: re-opens the same modal on arrival; dismissing leads to a full-screen sign-up (pre-ticked consent to promotional contact). Behind it: "Quick Facts" table (Location, Ownership, College Type, Establishment Year, Campus Size, Total Courses Offered) and a "Which college/course would you like to go ahead with?" thumbs poll; share icon in header.
- No highlight-differences toggle or winner indicator observed.

### CollegeDekho (`03`)
- `/compare-colleges/` is a "Coming Soon" shell. No tool observed.

## Patterns worth adopting (adapted, not copied)
1. Fixed number of slot cards with an explicit empty "Add college" slot (all three portals).
2. Course-scoped comparison (Shiksha/Collegedunia/Careers360 all scope to programme).
3. Sticky compact header row of selected colleges with remove × and empty add slot (Shiksha).
4. "Add similar college" one-click suggestion in empty slots (Shiksha).
5. Grouped sections with section headings / jump nav (Collegedunia, Shiksha).
6. Pair cards "A vs B" for ready-made comparisons, grouped by course (Shiksha, Careers360).
7. Shareable pair URLs (all three use SEO pair slugs; NSEDU should use query params).

## Not observed anywhere (NSEDU differentiators — design from first principles)
- Highlight-differences toggle, best-value markers, inline bars, data-year provenance, sticky label column on mobile.

## Anti-patterns to avoid
- Blurred/locked data behind "Unlock"/"Login to continue" (Collegedunia, Shiksha).
- Blocking modal on arrival + sign-up wall on dismiss; pre-ticked marketing consent (Careers360).
- Ad/promo clutter in rails (Apply Now, Brochure, Write-a-review-and-win cash, app QR banners).
- "Popular" labels backed by traffic/review counts NSEDU does not have; star ratings with review counts; rankings.
- Mobile table where the label column scrolls away (Collegedunia).

## Current NSEDU (`20-*`)
- Left picker of checkbox cards + right table (Location, Annual tuition, Median, Highest, Demo rating, Data years). Best cells use colour only (no icon/text), remove × is ~30px (<44px), no grouping, no sticky header, no URL state for selection, empty state has no suggestions, courses with a single programme lead to a dead end.
- 1024: third column clipped inside the table scroller (Telangana cut). 390: picker list pushes the table below the fold; label column not sticky; third column hidden without affordance.
- Catalogue facts (live API): 29 programmes in 16 courses; only btech has >3 (5); bca 3; bba, bcom, bdes, bpharm, llb, mba, mtech have 2; ba, bams, bds, bhm, bhms, mbbs, nursing have 1 (not comparable). Salary is null for llb, mbbs, bds, bams, bhms, nursing and Central Health bpharm. Demo ratings range 4.0–4.4. tuitionYear/placementYear are identical for all rows (2026–27 / 2024–25). Only same-city pair inside a course: bcom (Riverside Arts + Riverside, Chennai).
