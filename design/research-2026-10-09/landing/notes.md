# Landing area research — 9 October 2026

Scope: homepages of four Indian college portals plus the current NSEDU landing page and `/locations`. Everything here is for reference only. No competitor text, images, colours, logos or figures are carried into NSEDU.

## Access log

| URL | Method | Result |
| --- | --- | --- |
| https://www.careers360.com/ | Playwright headless Chrome, desktop 1440×900 + mobile 390×844 (Android UA) | 200. Full page captured. A sign-in modal covers the first screen on both viewports. |
| https://www.careers360.com/ | WebFetch | 200. Text was truncated after about 100k characters, so only the hero, banners and news were read. |
| https://www.collegedekho.com/ | Playwright desktop + mobile | 200. Desktop rendered. The first mobile run loaded without CSS (unstyled DOM, 32k px tall), so it is not used as visual evidence. |
| https://www.collegedekho.com/ | Playwright mobile retry (iPhone UA, networkidle) | 200. Styled first screen and one scrolled screen captured (`*-retry.png`). |
| https://www.collegedekho.com/ | WebFetch | 200. Full section list and per-stream blocks read. |
| https://www.shiksha.com/ | Playwright desktop + mobile | 200. Full page captured. A cookie bar overlays the lower desktop viewport. This differs from the 403 recorded in an earlier round. |
| https://www.shiksha.com/ | WebFetch | **403 Forbidden**. Screenshots are the only source. |
| https://collegedunia.com/ | Playwright desktop + mobile | 200. Full page captured. Many logos and images rendered as grey placeholders (lazy or blocked assets). |
| https://collegedunia.com/ | WebFetch | **403 Forbidden**. Screenshots are the only source. |
| WebSearch: portal homepage patterns | WebSearch | Returned only third-party profiles. Nothing was used from it. |
| http://127.0.0.1:3001/ and /locations (NSEDU) | Playwright at 1440×900, 1366×768, 1280×800, 1920×1080, 1101×700, 1024×768, 390×844 | All loaded. 0px horizontal overflow at every size. Measurements are in `nsedu-measurements.json`. |
| NSEDU hero fix probes | Playwright with CSS injected at runtime (no source edits) | `probe-fix-*.png` (v1) and `probe2-*.png` (v2, recommended) |

Raw logs: `capture-log.json` (status, title, page height and headings for each site and viewport). Full-page PNGs were also sliced into 1500px or 1700px chunks in the session scratchpad so they could be inspected.

## Observed patterns

**Careers360** (`careers360-*`)
- Hero: one sentence-case headline, a single search field and two chips tagged "Popular" for predictors. A promotional carousel sits on the right.
- A "Latest News and Notifications" strip overlaps the bottom edge of the hero. It is a horizontal rail of thumbnail, headline and IST timestamp.
- Feature groups are laid out as illustration plus white cards. Each card has a title, one line of copy and a cluster of outline chips (Rankings, Exams, College/Rank Predictors). Sections are centred, with generous whitespace and a low density of about 1 idea per screen.
- The lower page has a 6-icon product row (Compare, Reviews, Companions, List of courses, Applications), then a community CTA band and an app band with a stat row ("400M+ students…").
- Dark patterns: a sign-in modal on load, and very large self-reported counts.

**Shiksha** (`shiksha-*`)
- Hero: a large photo, a headline and a search box. A compact stat line (colleges, courses, reviews, exams) sits directly above the search. Mobile turns it into a 4-column stat row under the title.
- A "Featured" sponsored college rail appears straight after the hero, with ranking and accreditation badges. This is ad clutter.
- Stream tabs (MBA / B.TECH / MEDICAL / DESIGN / MORE) each show 7–8 tool tiles: exams, rankings, predictor, find colleges, compare, alumni salary, ask students. On mobile this becomes a list of tool rows, each with an icon, a title and one line.
- The rest of the page is: a 2-column news list with author and date, "View All Updates" as a centred outline button, short videos, then chip clouds ("Top Exams this month", "Trending Courses", "Top Boards", "Trending Colleges"), "Predict colleges by exam" image cards (stream and exam count), featured articles and an app promo.
- Density is high. The page relies on chip clouds for SEO.

**Collegedunia** (`collegedunia-*`)
- Hero: a full-bleed campus photo carousel, a centred headline with a count ("Find Over 250+ Exams"), a search bar and a "Need Counselling" CTA. Mobile has an app install bar, a short hero and a "Top Links" chip block.
- "Select Your Study Goal" is a horizontal rail of stream cards. Each card has an icon, the stream name, an "N Colleges" count and 3–4 sub-course links. On mobile it becomes a list with counts and chevrons.
- "Explore Programs": course filter chips above 6 tool cards (Ranking, Find Colleges, Compare, Exams, College Predictor, Course Finder). Each card has a title, a line of copy, chip links and a footer "› link".
- "Top 10 Colleges": a table with course chips (Rank, College, Ranking, Cutoff, Application deadline, Fees). "Top Universities" is a dark card carousel with rating, reviews, fees, ranking and Brochure/Compare.
- Further down: "Top Study Places" (a row of square city tiles), "Explore Courses" cards (duration, average fees, college count, Course Overview ›), "Top Exams" cards (participating colleges, exam date, level, Application Process ›, Exam Info ›), "Admission 2026" chips, "Latest News & Stories" tabs (Exam / College / Admission alerts) as card rails, and "Study Abroad" cards.
- Full-width banners ("Know your chances", "Subscribe") are placed between sections.

**CollegeDekho** (`collegedekho-*`)
- Hero: a full-bleed video still, a headline, two CTAs and a link to a brand film. A news ticker and a Google rating badge sit under the hero.
- A progress stepper (Register → Select course → Fill application …) is followed by 6 solid service cards and two CTAs.
- Promo bands follow: online degrees, "Praised by the media" logos, a career quiz CTA and "2000+ colleges, 1 application form".
- "Find The Perfect College For You" has stream tabs (12 streams). Each tab panel holds 3 tinted panels: Featured Colleges chips, Important Exams chips plus Top States chips, and Related Courses chips. Every panel has its own "View all" link at the top right. WebFetch notes that featured colleges repeat across streams, which suggests paid placement.
- Then: a recommended-college video carousel, achievements, a Media/Articles/News/Boards/Partner tab block, testimonials, a callback lead form (name, mobile, email, stream) and a mega footer with office addresses.
- Mobile stacks everything as full-width blocks with large CTAs. A WhatsApp floating button is present.

## Common, reusable information architecture
1. A search-first hero with entity scope (colleges, courses, exams). Popular tools appear as chips.
2. A browse-by-stream block with counts and sub-course links (Collegedunia study goal, CollegeDekho stream tabs, Shiksha stream tools).
3. Tool promos as compact cards with chip shortcuts.
4. Top exams as cards or chips that deep-link to the exam pages.
5. Study places: city tiles and a states list.
6. News: a dated list or rail with a single "View all" control.
7. Every block has a heading row with a top-right "View all" link, or a centred outline "View all" button after the block.
8. Mobile collapses rails into vertical lists with chevrons, and chip rows become horizontal scrollers.

## Patterns to avoid (seen on these portals)
Sign-in modals on load, cookie bars over content, sponsored "Featured" rails without clear labelling, inflated or unverifiable counts, awards and media logos, testimonials, callback lead forms, app-install bars, floating chat or WhatsApp buttons, autoplay carousels, and ranking or cutoff tables. NSEDU has no data for rankings or cutoffs.

## NSEDU current state (see `nsedu-*`)
- **Hero defect (confirmed):** the centre quote overlaps the photo at 1440×900 (quote x 710–789, photo arch edge at about x 728), at 1280×800 and at 1101×700. The "Commerce" icon and label sit on the photo at 1440, 1280 and 1101 (label x 662–758 against a photo edge at about x 656–700). The "Commerce" label also becomes unreadable white-on-photo. The cause is that the SVG uses `slice` scaling: when the hero aspect is below 2.96, the image scales by height and moves left behind fixed-percentage text.
- **Probe v2 (`probe2-*.png`)** fixes this at every tested size, from 1101×700 to 2560×1440, including 1280×1024 at aspect 2.02. It caps the photo scale and derives the text column from the photo edge. Exact numbers are in the returned brief.
- **Shortcut row:** `white-space: nowrap` on the descriptions makes "Understand admission requirements" run into the divider at 1440 and 1920. At 1920 the "Explore scholarships" arrow also collides with its title.
- **Mobile:** on the 390px "Plan every step" cards, the decorative ring paints over the description text ("st…oy step", "publi…rs"). The six large cards make the page very long. The hero field row scrolls horizontally, so Law and Commerce are hidden off-screen.
- **/locations:** the PageIntro h1 "Where do you want to study?" is followed immediately by the section's own h2 "Explore where you want to study", which duplicates the heading. There is no full directory and no counts. "View all" opens a dialog of names with no indication of which places have records.
- **Live catalogue (via /api proxy):** 29 programmes, 11 institutions and 16 courses (12 fields).
  - Cities with sample programmes: Chennai 9, Hyderabad 9, Bengaluru 5, Pune 4, Delhi NCR 2. Mumbai, Ahmedabad and Kolkata have 0.
  - States: Tamil Nadu 9, Telangana 9, Karnataka 5, Maharashtra 4. The 2 Delhi NCR rows have an empty state. The featured states Madhya Pradesh and Uttar Pradesh have 0.
  - Annual tuition ranges from ₹70,000 to ₹6,50,000 (median about ₹1,60,000). Median salary appears on 20 rows, ranging from 3.8 to 9.2 LPA.
  - Exams: JEE Main, NEET UG, CUET UG and CAT. Each has an official link and no dates.
