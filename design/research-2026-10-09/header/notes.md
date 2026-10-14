# Header, mega menus, search and footer: research notes (2026-10-09)

Method: Playwright using headless Chrome (channel `chrome`, `navigator.webdriver` masked, desktop 1440×900 with a Chrome 141 Windows UA, mobile 390×844 with a Pixel 8 UA, locale en-IN), plus WebFetch and WebSearch. Scripts are in the session scratchpad (`header/capture.mjs`, `interact.mjs`, `retry.mjs`, `c360mega.mjs`, `nsedu.mjs`). Each screenshot below was opened and checked by eye. Where something could not be observed, it is marked as such.

## Access log

| Site | URL | Tool | Result |
|---|---|---|---|
| Shiksha | https://www.shiksha.com/ | WebFetch | **403** |
| Shiksha | https://www.shiksha.com/engineering/colleges/b-tech-colleges-india | WebFetch | **403** |
| Shiksha | https://www.shiksha.com/ | Playwright desktop + mobile | **200**. Captured: viewport, MBA/Engineering/More/Counseling mega menus, search overlay (empty + typed "mba"), mobile drawer, footer area, scrolled view |
| Collegedunia | https://collegedunia.com/ | WebFetch | **403** |
| Collegedunia | https://s4.collegedunia.com/exams | WebFetch | **401** |
| Collegedunia | https://collegedunia.com/ | Playwright desktop + mobile | **200**. Captured: viewport, Explore panel, Goal & City picker, search overlay (empty + typed "mba"), mobile drawer, footer, scrolled view. Hovering the course strip (B.Tech, All Courses) opened no panel. |
| Collegedunia | (WebSearch snippets of cached pages) | WebSearch | Snippets confirm the goal selector, city selector, "Write a Review" CTA and course strip. Undated cache, used only to corroborate. |
| CollegeDekho | https://www.collegedekho.com/ | WebFetch | 200 (text). Utility bar and footer groups extracted |
| CollegeDekho | https://www.collegedekho.com/ | Playwright desktop | **200**. Captured: Colleges/Exam/Courses/Careers mega menus, search panel, footer, scrolled view |
| CollegeDekho | https://www.collegedekho.com/ | Playwright mobile | First run failed with net::ERR_NAME_NOT_RESOLVED (transient DNS). Retry returned **200**: viewport, drawer, search |
| Careers360 | https://www.careers360.com/ | WebFetch (two parts, offset 100000) | 200. Stream menu link structure and footer groups extracted |
| Careers360 | https://www.careers360.com/ | Playwright desktop | First run failed with ERR_INTERNET_DISCONNECTED (transient), then a screenshot timeout. Retry returned **200**: viewport, scrolled view, footer. Hovering the menus did not show them, because an automatic "Sign In/Sign Up" modal with a backdrop covered the page (`careers360-desktop-mega-*.png` show the modal, not the menus). Menu contents come from WebFetch text only. |
| Careers360 | https://www.careers360.com/ | Playwright mobile | **200**: viewport. Tapping top-left produced the auto sign-in modal (`careers360-mobile-drawer.png`), not the drawer. **The drawer itself was not seen.** |
| NSEDU | http://127.0.0.1:3001/ | Playwright 1440 / 1024 / 390 | 200. No horizontal overflow at any width. Desktop utility strip 36px, header 73px (72px bar plus 1px border-bottom). Console: a hydration-mismatch warning on desktop (the Next dev overlay shows "1 Issue") and a 401 from the signed-out session probe, which is expected. |

## Observed patterns per portal

### Shiksha (seen)
- **Top bar (teal):** logo on the left, a wide search input with a solid "Search" button at the centre-top, and the stream menu (MBA, ENGINEERING, MEDICAL, DESIGN, MORE, STUDY ABROAD, COUNSELING) below the search. "Login" and "Sign Up" are small text links on the right.
- **Stream mega menu** (`shiksha-desktop-mega-0-mba.png`, `-1-engineering.png`):
  - Panel about 845px wide.
  - Left vertical rail of facets: Top Ranked Colleges, Popular Courses, Popular Specializations, Exams, Colleges By Location, Compare Colleges, College Predictors, Reviews, Resources. Each facet has a chevron.
  - The middle column lists links for the active facet, such as "Top Engineering Colleges in Bangalore/Pune/Hyderabad…" (course × city).
  - The right column holds "Featured Colleges" (sponsored).
  - The active facet is tinted.
- **"MORE" menu:** the same rail-plus-columns model, used for long-tail streams (Law, Hospitality, Animation…). The rail scrolls with up/down buttons.
- **Counseling panel:** mostly empty right pane. Sparse panels look broken.
- **Search overlay** (`shiksha-desktop-search-focus.png`, `-typed.png`):
  - Full-screen overlay with a close X.
  - Empty state: "TRENDING SEARCHES", 5 rows, each with a type tag on the right (Colleges / College / Exam).
  - Typed state: suggestions are generated **course × city** combinations ("MBA/PGDM in Pune", "…in Bangalore") tagged "Colleges", with the query match in bold.
- **Mobile:**
  - Hamburger, a pill search ("Search for any college") and a user icon.
  - The drawer (`shiksha-mobile-drawer.png`) starts with a "Select Stream" dropdown, then accordions: COURSES / COLLEGES (Find Colleges By Specialization, By Course, Rankings, Compare), EXAMS, TOOLS, EXPERT GUIDANCE, RESOURCES, ABOUT. An app-install promo sits at the bottom.
- **Sticky:** after a programmatic scroll to 1600px the header was not visible, so it is not sticky on scroll-down. Scroll-up reveal was not tested.
- **Clutter:** a cookie bar, a floating chat bubble, a "Featured" sponsored strip, and an app-download block near the footer. The footer link groups were not reached in the capture, because the cookie bar and the app block filled the last viewport.

### Collegedunia (seen)
- **Main bar:** dark bar with the logo, then a **"Select Goal & City"** two-line picker, then a wide search, then "Write a Review" (an incentive CTA), an "Explore" grid icon, a notifications bell, and a hamburger with the avatar.
- **Second row:** a horizontal **course strip** (All Courses, B.Tech, MBA, M.Tech, MBBS, B.Com, B.Sc, B.Sc Nursing, BA, BBA, BCA), with Work Abroad / Study Abroad / Course Finder on the right.
- **Goal & City picker** (`collegedunia-desktop-goal-city.png`): popover titled "Select Your Study Preference" with a course search input and courses grouped by stream (Engineering → BE/B.Tech, Diploma, ME/M.Tech; Management → MBA/PGDM…), plus a "Skip" link. This is the same idea as NSEDU's course + city preference.
- **Explore panel:** two columns of icon + label tools (Top Universities, Top Courses, Reviews, Admission Alerts, College Predictor, Scholarship, Exams, News, Education Loan, Ask a Question, Course Finder…) and a promotional "Write a Review" card.
- **Search overlay:**
  - Empty: full-width top overlay with a big input and "TRENDING SEARCHES" written as **query-in-scope** ("IIT" in Colleges, "CAT" in Exams, "MBA Colleges" in Delhi/NCR).
  - Typed: a long flat list of courses, each with a type label on the right. No grouping headers.
- **Mobile drawer** (`collegedunia-mobile-drawer.png`): "Menu" title, a "Select Your Goal" field, a course search inside the drawer, course accordions (+), "All Courses", then tool tiles (Course Finder, College Predictor).
- **Mobile:** an app-install banner sits above the header (clutter).
- **Footer:**
  - A newsletter strip asking for email, mobile number and course.
  - Dense columns: Top Colleges (by degree), Top Universities (by stream), Top Exam, Study Abroad (two columns), Board Exams.
  - An "Other Links" row (About, Contact, Advertising, Career, T&C, Privacy), socials, and app badges.
- **Sticky:** not visible after a scroll to 1600px.

### CollegeDekho (seen)
- **Utility strip** (dark navy, about 40px): email on the left, "We're on your favourite socials!" plus social icons on the right.
- **Main bar:** logo on the left, nav on the right (Colleges, Exam, Courses, Careers, Latest Updates, More), then a user icon and a search icon.
- **Colleges mega** (`collegedekho-desktop-mega-0.png`): **the clearest stream pattern.**
  - Full-container panel with a tinted left rail of about 18 streams (Engineering, Management, Commerce & Banking, Medical, Sciences, …).
  - Three columns for the active stream: "Colleges By Degrees" + "Colleges By Location" (stacked, each ending in "View All"), "Popular Colleges", and "Top Colleges".
- **Exam mega:** the same rail. Columns per exam (JEE Main, JEE Advanced, BITSAT, GATE, WBJEE), each with sub-links (Eligibility, Syllabus, Exam Pattern, How to Prepare, Previous Papers), and "View all".
- **Courses mega:** a flat 4-column "Popular Courses" grid with "View All Courses".
- **Search:** clicking the icon drops a full-width panel ("Search for best colleges, Courses, Exams and Education updates"). The empty state is **a large blank white area**: no trending, no recents. This is a weak pattern. Mobile is the same: a full-screen sheet that is blank until typing.
- **Mobile drawer:** a large brand header, then icon rows (Colleges, Exam, Courses, Careers, Latest Updates, More), each with a chevron that drills into a sub-level, then "Connect with us" (email, socials).
- **Hover bug:** the hover-opened panel stayed open while the page scrolled, and covered the footer (`collegedekho-desktop-footer.png`). Hover menus must close on scroll or mouse-leave.
- **Footer:**
  - Link columns: More To Explore, Tools & Research, Quick Links.
  - Office addresses, socials and a Play Store badge.
  - Collapsible "Trending Links" and "Most Viewed Links" accordions.
  - A "Popular Universities" 5-column grid, and Terms/Privacy plus the legal-entity copyright.
- **Sticky:** not visible after a scroll to 1500px.
- **Clutter:** a Google-rating badge, a news ticker and "Praised by the media" logos.

### Careers360 (partly seen)
- **Desktop row 1:** logo, a wide pill search ("Search Colleges, Exams, Schools & more"), share icon, and an orange "Login" pill.
- **Desktop row 2:** a centred stream bar with an icon per stream (Engineering, Medicine, Design, Law, Management and Business Administration, University, Others, School) and chevrons.
- **Sticky:** row 1 was visible at the footer (`careers360-desktop-footer.png`), so it is the only one of the four that kept a sticky bar in our captures.
- **Stream menu structure** (WebFetch text, not seen rendered): each stream lists exams, then exam-prep articles, courses, colleges, college predictors, careers, and "Articles & Guides".
- **Footer** (seen and fetched):
  - Columns: Top Exams, College, Predictors & Ebooks, Resources.
  - A bottom row: Sitemap, Terms, Privacy, Grievance Redressal, and the copyright.
  - The site nav (About, Hiring, Magazine, News, Contact, Blogs) and app/social links come from WebFetch.
- **Dark pattern:** an **automatic "Sign In/Sign Up" modal** appears without any user action, on both desktop and mobile. It asks for a mobile number, uses a backdrop and blocks the menus.

## Cross-portal synthesis
1. **Stream rail mega menu** (Shiksha, CollegeDekho): a left vertical list of streams, with the right side showing that stream's facets (courses, colleges by location, exams, tools) and a "View all" at the end of each column. Wide panels, dense 13–14px links, an active tint on the rail. *Adopt.*
2. **Course × city suggestions** (Shiksha's typed search, Collegedunia's trending): "MBA in Pune". *Adopt, generated from the catalogue with real counts.*
3. **Trending / recent in empty search** (Shiksha, Collegedunia). A blank empty state (CollegeDekho) is poor. *Adopt.*
4. **Goal (course) + city preference in the header** (Collegedunia). *Adopt, using NSEDU's existing preferences.*
5. **Course strip:** a horizontal list of popular courses. *Adopt only inside panels and the drawer, not as a third header row* (the 36 + 72 height budget is fixed).
6. **Mobile drawer:** stream selector, then accordions, then tools. *Adopt.* Skip app promos.
7. **Footer:** dense link columns plus a legal row. *Adopt a moderate, catalogue-driven version* (popular courses, cities, exams). Skip newsletters that ask for mobile numbers, office addresses, app badges and "Trending links" SEO walls.
8. **Anti-patterns seen:**
   - forced sign-in modals (Careers360)
   - cookie bar plus chat bubble plus app banner stacking (Shiksha, Collegedunia)
   - sponsored "Featured colleges" inside navigation (Shiksha)
   - incentive "Write a review, get ₹500" CTAs (Collegedunia)
   - hover panels that stay open while scrolling (CollegeDekho)
   - empty search sheets (CollegeDekho)
   - sparse panels (Shiksha Counseling)
   - ranking/cutoff claims in nav-adjacent promos

## NSEDU current state (screenshots `nsedu-*`)
- **Utility strip:** "Discover · Learn · Belong" repeats the brand tagline that is already under the wordmark. The admissions notice is good. City select, Education news and Help centre sit on the right.
- **Colleges / Courses / Resources mega menus:** 620px panels with 4–5 static links plus a wine feature card. They use no catalogue data: no streams, no course list, no city counts.
- **Exams mega:** lists the 4 exams from the catalogue plus "All exam guides" and a news feature card.
- **Search panel:**
  - Popular courses chips appear only when the query is empty. No recent searches, no course × city suggestions, no keyboard navigation through results (Tab only).
  - Results sit in one narrow column on the left with empty space to the right. "pune" returned 3 colleges only, with no "MBA in Pune" style rows.
- **Mobile:**
  - Bar: search icon, "Log in" pill and hamburger. Clean.
  - Drawer: search, city select, accordions mirroring the desktop groups, and a full-width Log in. Solid, but the accordion contents are the same thin static lists.
- **Footer:** wine background, CTA band, brand column and 4 link groups, an honest temporary-contact note, "Social profiles coming soon", the sources band and back-to-top.
  - Link bugs: **"Courses & programmes" goes to /colleges** (should be /courses) and **"Compare colleges" goes to /colleges** (should be /compare).
  - `© {new Date().getFullYear()}` is rendered in a server component. Probably fine, but check it if the hydration warning persists.
- **Height:** the header measures 73px because of its 1px border-bottom, while `--desktop-header-height` assumes 72px. Draw the border inside (inset box-shadow or `box-sizing` with an explicit height) so the first-screen fit is exact.

## Verified NSEDU routes
`/`, `/account`, `/admission-checklist`, `/budget?course=`, `/career-guidance`, `/colleges?course=&location=`, `/compare?course=`, `/courses?field=&q=`, `/eligibility?course=`, `/exams?q=` (cards have `id={exam.id}`, so `/exams#jee` works), `/locations` (with `#study-destinations` and `#study-states`, owned by the landing agent, so re-verify), `/news`, `/scholarships`, `/search?q=`, plus the `[slug]` pages: about, contact, help, blog, sources-and-editorial, report-correction, accessibility, legal, terms-and-conditions, privacy-policy, cookie-policy, disclaimer.

There is no `/exams/[id]` route at the time of writing, so keep `/exams#id`.

## Catalogue facts (live API, 2026-10-09)

**Courses:** 16 courses across 12 fields. Programme counts per field (29 programmes in total):

| Field | Programmes |
|---|---|
| Engineering | 7 |
| Management | 4 |
| Computing | 3 |
| Medical | 3 |
| Commerce | 2 |
| Design | 2 |
| Law | 2 |
| Pharmacy | 2 |
| Arts | 1 |
| Dentistry | 1 |
| Healthcare | 1 |
| Hospitality | 1 |

Popular courses: btech, mba, bcom, bca, mbbs, bdes.

**Cities:** only these have programmes.

| City | Programmes |
|---|---|
| Chennai | 9 |
| Hyderabad | 9 |
| Bengaluru | 5 |
| Pune | 4 |
| Delhi NCR | 2 |

Mumbai, Ahmedabad and Kolkata are in the city list but have **0** programmes.

**Exams:** JEE Main (Engineering), NEET UG (Medical), CUET UG (Undergraduate), CAT (Management).

**Search API:** `/api/catalog/search?q=` returns `{courses, exams, colleges:[{id,name,city,state,courses[]}]}`. It has no city entity.

**`/colleges` filter:** `location` matches the city **or** the state. A course should always be passed, because the page otherwise falls back to the stored preference.
