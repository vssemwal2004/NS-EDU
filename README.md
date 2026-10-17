# NSEDU — Student Platform

Last updated: 9 October 2026 (IST)

## Platform architecture — separate routes, student login and admin console

NSEDU is now a multi-page platform with a separate admin console. Catalogue data lives in MongoDB and is managed from the admin console. The public site reads it through the Express API.

### Run it

```bash
npm install
npm run seed     # creates indexes, inserts catalogue seed data and the initial admin (idempotent)
npm run dev      # Next.js on :3000, Express on :4100
```

Copy [backend/.env.example](backend/.env.example) to `backend/.env` and set `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The seed only creates the admin if missing; `npm run seed --workspace backend -- --reset-admin` resets the password.

### Public routes — `frontend/src/app/(site)/`

| Route | Feature |
| --- | --- |
| `/` | All six original sections in order (hero + popular courses, study destinations, course-wise colleges, eligibility, budget, news) plus stats, explore-by-stream and exam bands |
| `/colleges` | Filterable college listing: stream, course, location, fee, rating, sort; URL-synced (`?course=mba&location=Pune`); compare tray |
| `/colleges/<id>` | College profile: quick facts, courses & fees, placement bars, location, similar colleges |
| `/courses`, `/courses/<id>` | Course directory by field and level; course page with fee/salary spread, colleges offering it, related exams |
| `/exams`, `/exams/<id>` | Exam guides with official links, related courses and colleges (no invented dates) |
| `/locations` | Featured city/state tiles and a searchable directory with sample-programme counts |
| `/compare` | Up to three colleges for one course, side by side; shareable `?course=&c=` links; suggested comparisons |
| `/eligibility`, `/budget` | Eligibility checker and first-year budget check |
| `/scholarships`, `/career-guidance`, `/admission-checklist` | Guides with contents rail and a tick-list saved on this device |
| `/news`, `/search`, `/account` | Education news, tabbed catalogue search, student dashboard |

The redesigned header has the same content as before in a new layout: a wine utility strip (tagline, preferred city, news and help), then a sticky bar with mega menus, a live search panel (`/` shortcut) and **Log in**. Course and city choices carry across pages (browser storage plus the `?course=` URL).

### Portal redesign (9 October 2026)

The public pages were redesigned using patterns from Shiksha, Collegedunia, CollegeDekho and Careers360: stream-based mega menus, filter sidebars, profile pages with in-page tabs, comparison tables with best-value markers and a split-panel login. NSEDU's wine/ivory identity was kept, and no branding, text or images were copied. Research notes, the access status of each URL (some sites blocked automation) and screenshots are in [design/research-2026-10-09/](design/research-2026-10-09/).

- **Honest data:** every figure comes from the catalogue: counts, fee and salary ranges, and "demo rating". Fictional institutions stay labelled "Illustrative data". Rankings, cut-offs, reviews, exam dates and social login were deliberately not added.
- **Code organisation:** each area lives in its own feature folder (`features/home`, `colleges`, `compare`, `courses`, `guides`, `auth`, `components/layout/header`). Area theme tokens are in `styles/themes/<area>.css`, imported by `index.css`, and extra icons are in `components/ui/icons/<area>.js`.
- **Checks:** 60 routes were crawled, covering every college, course, exam and info page. None had page errors or horizontal overflow, and none of the 211 internal links were broken. Lint is clean.

### Student login — no separate sign-up

The **Log in** drawer offers **Email** or **Mobile number** (+91). Students receive a 6-digit one-time code. The first successful verification creates the account, so there is no "Create account" option. Codes expire after 5 minutes and allow 5 attempts. Sends are rate-limited. The session is a 7-day JWT in an http-only `nsedu_student` cookie.

**Development limitation:** no email/SMS provider is connected. With `OTP_DELIVERY=console` the code is printed in the API log and shown in the drawer as "Development mode". It is never returned when `NODE_ENV=production`. Plug a provider into `deliverOtp()` in [otp.js](backend/src/modules/student-auth/otp.js).

### Admin console — `/admin`

- **Separate from student login:** a separate route tree (`frontend/src/app/admin/`), cookie (`nsedu_admin`, 8-hour JWT, SameSite=Strict) and role check. A student token is rejected by every admin endpoint.
- **Employees:** administrators can open `/admin/employees` from **Add employee** to create an employee with an email, mobile number and temporary password. Employees sign in at `/admin` with that email and password. Their first session is restricted to `/admin/change-password` until they choose a different password with at least 8 characters, uppercase and lowercase letters, and a special character. Employees use only **Add student** and **View students**; dashboard, catalogue, student account management, settings, and employee management require the administrator role.
- **Student follow-ups:** **Add student** (`/admin/reference-students/new`) holds individual reference entry and CSV upload with `name`, `email`, and `mobile` columns (up to 200 rows). These records live in `reference_students`, separate from login accounts in `students`, and never create student credentials. **View students** (`/admin/reference-students`) has tabs for reference records and real student login accounts, with assignments and follow-up comments. Administrators see all records and can assign several employees to each one, including login accounts from **Student accounts**. Administrators can also select several students on a list page and add the same employees to all of them in one action; existing assignments remain. Employees see only login accounts assigned to them and reference records assigned to or created by them. Follow-up comments are stored with the author's identity and kept separate for the two record types.
- **`/admin`:** a split-screen sign-in with a platform overview, live catalogue counts and imagery on the left, and the form on the right. [proxy.js](frontend/src/proxy.js) sends cookieless visitors on `/admin/*` back to sign-in; Express verifies the JWT on every `/api/admin` request.
- **Sidebar:** a narrow wine rail with white icons. It slides open over 0.8 s on hover or keyboard focus and closes when the pointer leaves. On mobile it is an off-canvas drawer.
- **Screens:** Dashboard (key figures, 14-day sign-ups, programmes by course, recent students), Colleges, Programmes, Courses, Exams, Cities, States, Students (search, block/restore), Scholarships and Settings.
- **One generic editor:** forms are generated from the backend's field registry ([resources.js](backend/src/modules/admin/resources.js)). Adding a field there adds it to validation and the admin form. Edits publish immediately (`Cache-Control: no-store`).

**Initial admin:** the requested demo credentials `a@gmail.com` / `123456` are in the local, gitignored `backend/.env`. This password is weak; change it before any shared or public deployment.

### Code layout

- `backend/src/modules/` — `catalog` (public read API), `student-auth`, `admin-auth`, `admin` (CRUD registry, dashboard, students). Shared `lib/` covers JWT, scrypt password hashing, validation, rate limiting and cookies.
- `frontend/src/lib/api/` — `catalog.js` (server loader, deduplicated per request; falls back to the bundled seed files only if the API is unreachable) and `client.js` (browser fetch with typed errors).
- `frontend/src/providers/` — catalogue, preferences and student-session contexts.
- `frontend/src/features/site|auth|admin/` — page features. All colours, sizes and motion remain in [index.css](frontend/src/styles/index.css) (`--header-*`, `--login-*`, `--admin-*`, `--page-intro-*` tokens).

### Known limitations

- Rate limits are in memory per API process; they reset on restart and aren't shared across instances.
- JWT sessions are stateless. Blocking a student takes effect on their next request; a copied token stays valid until it expires.
- College records remain illustrative (fictional institutions); the admin console is where verified data would be entered.
- Eligibility rules, budget living-cost defaults and site page copy are still static files. They are candidates for the next round of making data dynamic.

## Final footer — dark maroon navigation and support

The homepage now ends with a shared, full-width **dark maroon footer with white text**, also rendered on supporting pages. The design includes an editorial closing heading, Explore colleges/Get help actions, subtle campus linework, NSEDU identity, contact/support, five social icons, four navigation groups, a compact source-information strip, copyright and a working Back to top link.

- **Explore:** colleges/universities, courses, cities, states, education news and Blog & student guides.
- **Student tools:** college comparison, eligibility, budgeting, scholarships, career guidance and an admission checklist.
- **NSEDU & support:** About, Contact, Help/FAQs, corrections, sources/editorial approach and accessibility.
- **Legal & privacy:** Legal information, Terms & conditions, Privacy policy, Cookies/browser storage and Disclaimer.

The footer contains **34 links**, including 23 grouped navigation links, with real homepage section anchors and **15 working supporting routes**. Supporting pages use static generation, individual titles/descriptions, breadcrumbs and useful starter copy. Legal copy remains visibly labeled **Policy preview**, with `noindex, follow` metadata until actual company policies are ready. The temporary contact page is also noindexed. No published company identity, phone number, social handle or final legal agreement is invented.

**Temporary details, as requested:** `support@nsedu.example` is labeled preview-only and does not open a fake working email channel. Instagram, LinkedIn, YouTube, Facebook and X icons link to the contact page's social-status section until official profile URLs are configured. Replace email/status/profile URLs in [site.js](frontend/src/data/site.js); edit page copy in [site-pages.js](frontend/src/data/site-pages.js). All footer colours, fonts, surfaces and sizing remain in [index.css](frontend/src/styles/index.css). A production-domain sitemap/canonical configuration can be added when the real domain is established.

**SEO approach:** descriptive anchors with actual `href` destinations and clear groups, following [Google's link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable). Draft policy pages use [noindex metadata](https://developers.google.com/search/docs/crawling-indexing/block-indexing); no search-ranking improvement is claimed. Section anchors navigate within the homepage and are not represented as separate indexable college/city pages.

**Responsive/lightweight:** five columns on desktop; separate identity/contact areas plus four link columns on tablet; two readable navigation columns on mobile. Links/social controls are at least 44px tall, focus is white on maroon, and the mobile information strip reflows without squeezed text. The footer is a server component with native SVG icons/linework; no images, animation libraries, contact-submit simulation or newsletter backend were added.

**Actual previews:** [desktop](design/footer/footer-1440.png), [tablet](design/footer/footer-768.png), [mobile](design/footer/footer-390.png), [small mobile](design/footer/footer-320.png) and [contact page](design/footer/contact-mobile.png). Implementation: [SiteFooter.js](frontend/src/components/layout/SiteFooter.js), [layout styles](frontend/src/components/layout/SiteFooter.module.css), [shared page route](frontend/src/app/[slug]/page.js).

**Validation:** seven browser widths (320, 390, 650, 768, 1100, 1440, 1920) had no horizontal overflow, out-of-bounds links, missing anchors, targets below 44px or captured page errors. All 15 supporting routes returned 200; an unknown route returned 404. Back to top worked on mobile. The existing fixed-header smoke test passed and news lazy loading passed on an isolated rerun after an initial timeout. Lint and the production build passed; supporting routes are statically generated. [Browser evidence](design/footer/browser-evidence.json), [capture script](design/footer/capture.mjs) and [validation record](design/footer/validation.json) preserve the checks.

## Section 6 — Education news and articles implemented

The working section is available at **http://localhost:3000/#education-news**, after the budget planner. It uses the same wine/taupe/ivory palette with a distinct compact newsroom layout, mixed sans/serif heading, fine editorial rules and lightweight document/grid background graphics.

- **Actual data:** Express reads the public education RSS feeds from [The Indian Express](https://indianexpress.com/rss/), [Hindustan Times](https://www.hindustantimes.com/rss) and [ET Education](https://education.economictimes.indiatimes.com/rss). `GET /api/education-news` returns dated headlines, short descriptions, sources, original links and publisher image URLs. No API key or MongoDB connection is needed. The latest local check returned **90 records with image URLs and three fresh publishers**.
- **Education scope:** broad categories cover admissions/funding, exams/results, schools, higher education, learning/EdTech and policy. There is no fixed board/exam-name list; search accepts any education topic. Allowed publisher education paths, date validation and filters exclude unrelated hiring and general news roundups. Coverage depends on these publishers; category/article classification uses text cues rather than official board verification.
- **Working interactions:** Overview, News, Articles and Saved views; topic filters; keyword search; newest/oldest sorting; load more; original publisher links; and browser-persisted bookmarks. The overview begins with three news rows and three reading previews, reduced to two reading previews on mobile. All articles remain accessible through the Articles view.
- **Person-free covers:** image URLs are fetched with the news. Only visually reviewed neutral photos display by default; unreviewed, absent or broken images use native education graphics. The [image policy](frontend/src/data/news-image-policy.js) is the single place to maintain reviewed URLs. This is editorial review, not automated person detection. [An actual reviewed campus-photo preview](design/section-6-news-articles/implementation/news-reviewed-photo.png) demonstrates the image path.
- **Loading and resilience:** fetching starts near the section; active visible pages check every ten minutes, with manual refresh. The backend shares an in-memory cache and bounds publisher timeouts/XML sizes. Partial, stale, empty and unavailable states remain distinct. An outage preserves available dated records without inventing demo news. Photos use lazy Next Image with small responsive sizes; backgrounds use native SVG/CSS, with no new UI/animation library.
- **Responsive and maintainable:** desktop uses adjacent news/reading columns; mobile uses compact horizontal story rows and scrollable topics. Shared colours, fonts, cards and sizing remain in [index.css](frontend/src/styles/index.css). The [news component](frontend/src/features/landing/EducationNews.js), [source configuration](backend/src/data/education-feeds.js), [feed service](backend/src/services/education-news.js) and [implementation notes](design/section-6-news-articles/implementation/implementation-notes.md) separate content, behavior and styling. The fixed header recognizes Education news while scrolling.

**Actual browser previews:** [desktop](design/section-6-news-articles/implementation/news-1672.png), [small desktop](design/section-6-news-articles/implementation/news-1366.png), [tablet](design/section-6-news-articles/implementation/news-768.png), [mobile](design/section-6-news-articles/implementation/news-390.png) and [small mobile](design/section-6-news-articles/implementation/news-320.png). Live content changes between captures. [Browser measurements](design/section-6-news-articles/implementation/browser-evidence.json), [API evidence](design/section-6-news-articles/implementation/live-api-evidence.json) and [validation record](design/section-6-news-articles/implementation/validation.json) preserve the checks.

**Validation:** 8 backend tests and 16 news/fixed-header browser tests passed; lint and production build passed. Actual live-feed captures fit five widths from 320px to 1672px, with no horizontal overflow, visible controls below 44px height or browser errors. Mobile inputs remain 16px. A reviewed campus thumbnail loaded through Next Image; unreviewed covers stayed person-free. Frontend and same-origin news endpoint both returned HTTP 200 after the build. Local checks verify behavior/loading strategy, not a public-network speed score.

Run **`npm run dev`** from the project root to start the frontend on port 3000 and Express on port 4100. This feature fetches publisher updates periodically; it does not claim streaming real-time delivery or coverage of every board notice.

## Section 6 design history — News & Articles previews

The following records describe the earlier image-only N1/N2 proposal round. The implementation above supersedes its named-exam filters and candidate API plans; original images and research are retained for reference.

**N2 is the current desktop/mobile design proposal.** Following the user's feedback, Section 6 now uses a compact newsroom composition with source-linked, dated stories and no person imagery. News/article navigation, topic filters and story metadata were reviewed on [Shiksha News](https://www.shiksha.com/news) and [Shiksha Articles](https://www.shiksha.com/articles-all). N1 is retained as rejected design history.

- **Content:** four dated news examples covering JEE Main, CBSE, NIOS and IIT Gandhinagar, plus NIT, CUET and UCEED reading. Topic filters include CBSE, ICSE / ISC, state boards, CUET UG, JEE Main, NEET UG and NCERT; empty topics must not generate invented stories.
- **Design:** contemporary sans-serif headlines, white news rows, fine editorial rules, small document/laptop/book thumbnails and a separate article column. Wine/taupe/ivory remains; heavy decorative shapes and student portraits are removed. Mobile stacks the news and article feeds with a visible topic-scroll affordance.
- **Realistic snapshot:** [N2 content records](design/section-6-news-articles/N2-content.json) preserve paraphrased headlines, original source URLs and dates displayed in the source listings. The preview says “Snapshot · 7 Oct 2026”. Images are illustrative AI artwork, not official notices or authenticated campus photography. Controls are design proposals; no API is connected.
- **Future behavior:** News / Articles / Saved tabs, topic filtering, search, chronological sorting, bookmarks and topic preferences. A real feed must retain source/update timestamps, handle stale/error/empty states and distinguish publisher reporting from official notices. [NewsAPI](https://newsapi.org/docs/endpoints/everything) remains a candidate; coverage and access terms need assessment before integration.
- **News images — research finding:** [NewsAPI](https://newsapi.org/docs/endpoints/everything) provides `urlToImage`; [GNews](https://docs.gnews.io/json-response) provides `image`, alongside headline, source, date and original URL. These are hosted API services, not open-source feed backends. Plan limits checked on 7 October 2026: [NewsAPI Developer](https://newsapi.org/pricing) is development-only with a 24-hour article delay; [GNews Free](https://docs.gnews.io/) lists a 12-hour delay. No provider has been selected. The future UI needs neutral topic covers for absent/broken images and a curated image policy to preserve this section's no-person visual requirement; keyword coverage must be evaluated with real results.

**Current previews:** [N2 desktop](design/section-6-news-articles/N2-desktop.png) · [N2 mobile](design/section-6-news-articles/N2-mobile.png). Generated with **built-in image_gen**; [exact N2 prompts](design/section-6-news-articles/N2-prompts.json), [manifest](design/section-6-news-articles/N2-manifest.json) and [current design brief](design/section-6-news-articles/N2-design-brief.md) are preserved. N1 assets and brief remain historical references.

**Reference access:** CollegeDekho and Careers360 browser views loaded and were visually inspected. Shiksha/Collegedunia returned 403 in Chrome; their page text was reviewed through web access. [Research notes and browser evidence](design/section-6-news-articles/references/research-notes.md) record the distinction. Application source is unchanged; no application tests/build were rerun for this image-only design round.

## Sections 4 and 5 — visual background and heading redesign

The compact eligibility and budget layouts now have a richer visual treatment matching NSEDU's wine/taupe/ivory theme.

- **Eligibility:** curved paper background, dot details, academic icon stamps and a small illustrated study path. Mixed serif/sans typography, a fine italic underline and a topic-icon tile give the introduction and active question clearer hierarchy. Bordered paper cards have circular artwork frames and a rose selected state; the progress rail shows step numbers.
- **Budget:** a separate ivory/rose background treatment, savings icon stamps and a notebook/wallet/rupee graphic cluster. The heading blends sans-serif text with a serif accent. A wallet medallion, soft corner surface, outlined result panel and shaped cost icons make the estimate easier to identify.
- **Responsive/lightweight:** mobile reduces decorative density and reserves room around headings and amounts. Background artwork uses native SVG/CSS, excludes pointer/accessibility interaction and adds no image downloads or animation library. Existing lazy WebP assets and local fonts are reused. All visual palette and font recipes remain in [index.css](frontend/src/styles/index.css); shared graphics live in [SectionVisuals.js](frontend/src/features/landing/SectionVisuals.js).

**Latest website previews:** [desktop eligibility](design/section-4-5-visual-refresh/after/course-eligibility-1672.png), [desktop budget](design/section-4-5-visual-refresh/after/college-budget-1672.png), [mobile eligibility](design/section-4-5-visual-refresh/after/course-eligibility-390.png) and [mobile budget](design/section-4-5-visual-refresh/after/college-budget-390.png). [Design notes](design/section-4-5-visual-refresh/design-notes.md) explain the refinement; [browser measurements](design/section-4-5-visual-refresh/after/measurements.json) and [validation](design/section-4-5-visual-refresh/validation.json) preserve the checks.

**Validation:** all **34 relevant interaction and fixed-header tests passed** in the final serial run; lint and production build passed. Both sections fit **14 widths from 320px to 1920px**, with no horizontal overflow, out-of-section controls/headings, undersized action targets or captured browser errors. The initial parallel run was interrupted after timeouts while host CPU usage measured 100%; the final run used one worker and a longer per-test timeout. Academic rules, costs and matching logic are unchanged. The homepage remains statically prerendered; no public-network speed score is claimed.

## Sections 4 and 5 — compact layout refinement

Eligibility and budget check now use smaller headings, illustrations, cards and gaps, with balanced panel padding. The existing wine/taupe colours and typography are preserved. Shared sizing is controlled from [index.css](frontend/src/styles/index.css).

- **Eligibility:** desktop introductory heading is capped at 42px, question heading at 28px and study artwork at 108px. Study cards have a 235px minimum height; the selected badge sits in the upper corner instead of reserving an empty row. Course, marks, exam and review panels also use tighter spacing. Mobile choices use 60px artwork and compact answer rows.
- **Budget:** heading is capped at 32px, the estimated total at approximately 42px and notebook artwork at 100px. Input rows, cost groups, result and funding panels use smaller icons and consistent padding. Detailed costs remain expandable.
- **Responsive:** action targets remain at least 44px; editable mobile inputs remain at least 16px. Image size hints match the smaller artwork. Existing calculation, eligibility and navigation behavior is preserved; no new assets or dependencies were added.

Measured section heights, with the same viewport widths and default state:

| Viewport width | Eligibility before → after | Budget before → after |
| --- | --- | --- |
| Desktop, 1672px | 653px → 473px (28% shorter) | 941px → 760px (19% shorter) |
| Tablet, 768px | 730px → 606px (17% shorter) | 995px → 809px (19% shorter) |
| Mobile, 390px | 947px → 778px (18% shorter) | 1480px → 1312px (11% shorter) |

**Updated browser previews:** [desktop eligibility](design/compact-sections/after/course-eligibility-1672.png), [desktop budget](design/compact-sections/after/college-budget-1672.png), [mobile eligibility](design/compact-sections/after/course-eligibility-390.png), [mobile budget](design/compact-sections/after/college-budget-390.png), [mobile marks](design/compact-sections/after/course-eligibility-390-marks.png) and [expanded budget](design/compact-sections/after/college-budget-1672-detailed.png).

**Validation:** 34 relevant eligibility, budget and fixed-header tests passed; lint and production build passed. Both sections were measured at 14 widths from 320px to 1920px, with no horizontal overflow, out-of-section controls or headings, undersized action targets, or browser errors. [Before measurements](design/compact-sections/before/measurements.json), [after measurements](design/compact-sections/after/measurements.json), [capture script](design/compact-sections/capture.mjs) and [validation record](design/compact-sections/validation.json) preserve the comparison. Mobile retains natural vertical scrolling.

## Section 5 — B2 budget check implemented

The approved B2 design is now available at **http://localhost:3000/#college-budget**, after the eligibility checker. It retains the wine/taupe theme, a light paper background, faint campus contours, a small notebook illustration and one clear planning surface.

- **Working controls:** choose a college/programme, hostel/shared rental/home and a first-year budget. Programme choices stay synchronized with the course explorer. The sample Northfield B.Tech plan starts at **₹3,75,000**, leaving **₹25,000** from a ₹4,00,000 budget.
- **Live totals:** tuition, stay/food and other costs recalculate immediately. Expand **View detailed costs** to edit accommodation, meals, books/travel, joining fees and the refundable deposit. Reset restores the selected living arrangement's sample assumptions; switching arrangements preserves its custom values. Clear, invalid, exact-budget, over-budget and missing-cost states remain distinct.
- **Useful actions:** **Find colleges in my budget** opens same-course, same-fee-year sample alternatives using tuition **plus the current living/extra-cost assumptions**, not tuition alone. Choose an alternative to update the plan; empty results offer plan adjustment. **Find scholarships** opens the existing guide with the National Scholarship Portal and Buddy4Study resource links. Scholarship awards are not automatically deducted.
- **Responsive and accessible:** desktop aligns the inputs and cost/result columns; mobile shows the result immediately after stacked controls. Native labeled inputs/selects, keyboard-operated disclosure, visible focus, polite result announcements and at least 44px action targets are included. The fixed header shows Budget check while browsing this section; Resources includes a shortcut.
- **Lightweight:** one transparent **400×400 WebP, 19,478 bytes**, lazy-loaded through Next Image with reserved dimensions. Background contours and paper surfaces use small SVG/CSS. Full design PNGs do not ship as section backgrounds, and no chart, animation or form library was added. The production page remains statically prerendered.
- **Maintainable:** [budget UI](frontend/src/features/landing/BudgetPlanner.js), [layout](frontend/src/features/landing/BudgetPlanner.module.css), [sample assumptions/resources](frontend/src/data/budget.js), [calculation/matching functions](frontend/src/lib/budget.js) and [artwork](frontend/src/features/landing/BudgetArtwork.js). Shared colours, fonts, card recipes and sizing remain centralized in [index.css](frontend/src/styles/index.css).

**Data scope:** this is a working frontend using illustrative programme records and editable living-cost fixtures. Match results reuse the student's assumptions across colleges and explain that actual costs vary. Verified fee sources, city-specific living data, searchable scholarships and saved-account plans will need backend data later.

**Actual browser previews:** [desktop](design/section-5-budget-funding/implementation/desktop/01-default.png), [tablet](design/section-5-budget-funding/implementation/tablet/01-default.png), [mobile](design/section-5-budget-funding/implementation/mobile/01-default.png), [detailed costs](design/section-5-budget-funding/implementation/desktop/02-detailed-costs.png), [over budget](design/section-5-budget-funding/implementation/desktop/03-over-budget.png), [college matches](design/section-5-budget-funding/implementation/desktop/04-college-matches.png). Each size has a real viewport capture, including the fixed header, and scholarship resource previews. Isolated section captures temporarily hide the header and extend capture height while preserving width to prevent clipped browser painting. [Capture script](design/section-5-budget-funding/implementation/capture.mjs) and [responsive measurements](design/section-5-budget-funding/implementation/measurements.json) preserve the evidence.

The desk asset was generated with **built-in image_gen**. [Exact prompt](design/section-5-budget-funding/implementation/assets/prompts.json), original PNG, [WebP optimisation script](design/section-5-budget-funding/implementation/assets/optimise.mjs) and [asset manifest](design/section-5-budget-funding/implementation/assets/manifest.json) are saved.

**Validation:** all **74 frontend tests passed**, including 12 budget calculation/interaction scenarios; lint and the final production build passed. Collapsed/expanded layouts fit **14 widths from 320px to 1920px**, with no horizontal overflow or controls outside the section. Desktop/tablet/mobile preview runs recorded no browser or console errors. A [fresh-context production loading audit](design/section-5-budget-funding/implementation/loading-audit.json) confirmed **zero budget-image requests before scrolling**; at device scale 1, Next delivered **9,536 bytes on desktop** and **2,456 bytes on mobile**. This verifies the local loading strategy rather than claiming a public-network speed score. The temporary audit server was stopped. [Validation record](design/section-5-budget-funding/implementation/validation.json) preserves the checks.

## Section 5 design history — College Budget & Funding Planner proposals

**Latest revision: B2 — easier student budget check.** The revised design answers **“Can this college fit your budget?”** with three labeled inputs: college/programme, living arrangement and first-year budget. It removes the initial slider, whole-course switch, save-plan button and chart percentages. Three simple cost groups replace the expanded six-item worksheet; **View detailed costs** reveals supporting information when needed. The estimated total, remaining/over-budget amount and one primary action take priority. Scholarships move into a compact support strip.

**B2 visual direction:** a cohesive white planning surface, a softly tinted result area, delicate campus contours and a small notebook/pencil vignette over the ivory background. Desktop uses aligned controls and unequal cost/result columns; mobile stacks inputs and places the result before the cost summary. Wine/taupe colours and existing typography continue. No application implementation is changed in this round.

**Latest previews:** [B2 desktop](design/section-5-budget-funding/B2-desktop.png), [B2 mobile](design/section-5-budget-funding/B2-mobile.png). The [B2 detailed brief](design/section-5-budget-funding/B2-design-brief.md) specifies disclosure behavior, empty/unknown/over-budget states, accessibility and later lightweight implementation. [Exact B2 prompts](design/section-5-budget-funding/B2-prompts.json) use **built-in image_gen**; [B2 artifact record](design/section-5-budget-funding/B2-manifest.json) preserves provenance and visual inspection. These are design proposals, not a working calculator or approval record. Original B1 previews remain below for comparison.

**Recommended next section:** help students understand total college costs after comparing programmes and checking academic eligibility. Section 3 shows tuition excluding living expenses; this proposal connects tuition, accommodation, meals, books/travel, one-time charges and refundable deposits into a clear first-year plan.

The [research/design brief](design/section-5-budget-funding/design-brief.md) and [reference review](design/section-5-budget-funding/references/research-notes.md) cover Shiksha, CollegeDekho, Collegedunia, Careers360, Buddy4Study, BigFuture and the official National Scholarship Portal. Public examples already contain fee breakdowns, scholarships and cost tools; the recommendation is to connect these ideas within NSEDU's existing student flow, not to claim they are absent from competitors. Browser evidence records four successful page loads, two access denials and a partially obscured BigFuture screenshot; web text was also reviewed.

- **Initial B1 content:** programme/city/year context, first-year budget, living arrangement, total-cost breakdown and remaining/over-budget status. Primary action: **Explore colleges in my budget**. A compact adjacent panel offers merit-based, need-based and state funding routes through **Explore scholarships**. B2 simplifies this first view as described above.
- **Initial B1 visual direction:** one broad planning worksheet with unequal control/report areas, a labeled cost ribbon and a narrower funding panel. Preserve wine/taupe/ivory and serif/sans typography; use faint notebook linework and a small envelope illustration. Mobile reflows the same content into a readable single column.
- **Illustrative arithmetic:** Northfield B.Tech demo tuition ₹2,40,000 + hostel ₹60,000 + meals ₹36,000 + books/travel ₹24,000 + one-time fees ₹10,000 + refundable deposit ₹5,000 = **₹3,75,000**. A ₹4,00,000 first-year budget leaves **₹25,000**. All amounts are design fixtures; no scholarship is deducted automatically.
- **Future data requirements:** programme/year/source for official fees, editable living estimates, explicit unknown values, one-time/refundable flags and verified scholarship conditions/deadlines. Whole-course projections require visible year/duration assumptions. Loans are optional separate guidance, not a reduction in college cost.
- **Proposed later order:** Section 6 admissions/deadlines, Section 7 career guidance, Section 8 useful news/articles. These are tentative recommendations.

**Status:** image-first design proposal; frontend/backend source is unchanged in this round. Application tests were not rerun for research/documents/raster previews. Exact prompts are stored in [prompts.json](design/section-5-budget-funding/prompts.json). Generation uses **built-in image_gen**.

**Design images:** [B1 desktop](design/section-5-budget-funding/B1-desktop.png) and [B1 mobile reflow](design/section-5-budget-funding/B1-mobile.png). Both were inspected for the theme, content, cost arithmetic and refund/aid notes. The original generated files are preserved; [manifest.json](design/section-5-budget-funding/manifest.json) records dimensions, provenance and review. Raster controls/chart geometry are illustrative; no working calculator is connected yet.

## Section 4 — compact spacing and reference proportions

The eligibility section now uses a centered **1480px maximum container**, balanced outer gutters and bounded heading/artwork sizes. The approved E4 composition is retained: editorial introduction on the left, three aligned illustrated choices on the right, a pale folded-page sweep and a subtle shared base beneath the cards. Fine SVG corner contours add detail without additional image downloads.

- **Desktop:** introduction tops out at 64px, question at 36px, illustrations at 160px. Study titles use deliberate two-line wrapping, with aligned descriptions and equal card heights. The diploma route and split Continue control share one row; the duplicate helper row and entry eyebrow were removed.
- **Responsive:** tablet uses a stacked introduction; mobile retains compact illustrated answer rows, wrapping actions and readable controls. A dedicated narrow-desktop title token prevents the graduate label from gaining an extra line around the tablet breakpoint. Buttons remain at least 44px tall.
- **Measured entry height:** **653px at 1672px wide**, compared with the previous 872px; tablet 768px is **730px** instead of 941px, and mobile 390px is **947px** instead of 993px. Later steps grow to fit their content. No fixed-height clipping or hidden content is used.
- **Central theme:** width, gutters, spacing, heading sizes, artwork sizes, card treatments and background colours are declared in [the theme entry](frontend/src/styles/index.css). Existing guided questions, demo rules and answer retention remain available.

**Updated browser previews:** [desktop](design/section-4-eligibility/spacing-refinement/desktop/01-study-stage.png), [tablet](design/section-4-eligibility/spacing-refinement/tablet/01-study-stage.png), [mobile](design/section-4-eligibility/spacing-refinement/mobile/01-study-stage.png), [marks step](design/section-4-eligibility/spacing-refinement/desktop/05-marks.png), [review](design/section-4-eligibility/spacing-refinement/desktop/08-review.png). [All nine states at three sizes](design/section-4-eligibility/spacing-refinement/) include 27 isolated section previews and six viewport previews. Isolated captures temporarily hide the fixed header; viewport captures show it. [Capture measurements](design/section-4-eligibility/spacing-refinement/measurements.json) and [additional responsive checks](design/section-4-eligibility/spacing-refinement/responsive-measurements.json) preserve the evidence.

**Validation:** **22 eligibility and fixed-header browser scenarios passed**. Lint and the final production build passed. Additional entry previews/checks cover **12 widths from 320px to 1920px** with no horizontal/text overflow or browser errors, including the final 901px typography refinement. [Validation record](design/section-4-eligibility/spacing-refinement/validation.json) includes before/after entry dimensions.

## Section 4 — approved E4 eligibility checker implemented

The user approved **E4** and requested all steps, responsive layouts and lightweight creative backgrounds. The working checker now follows the college explorer at **`http://localhost:3000/#course-eligibility`**, retaining wine/taupe colours, illustrated study choices, editorial headings, a folded-paper background, fine corner curves, a journey indicator and split Continue controls.

- **Working flow:** study stage → qualification/completion when relevant → course → admission year → subjects when relevant → marks → entrance status → optional scorecard details → requirement review. Back/Edit preserves answers; changing course clears dependent marks/subjects; restart clears the checker. Diploma/other qualifications have a separate entry.
- **Review:** 11 fictional academic profiles for sample year 2026–27, with explained matching, unmet, pending and unverified results. Other years and medical courses without profiles remain unverified. CGPA is not converted without official rules; diploma/equivalence routes need programme review. Entrance scores/percentiles/general/category ranks remain distinct; no admission prediction is made.
- **Actions/navigation:** explore the selected course in Section 3, inspect answers/next-step checklist, edit, keep a check while the page stays open or restart. The hero shortcut and Resources menu jump to the checker. The fixed header displays Eligibility context in Section 4. Account/device persistence is not connected.
- **Responsive/accessible:** desktop illustrated gallery, tablet stacked intro, mobile compact answer rows and labeled requirements. Native radio/checkbox choices, visible focus, focus on the active question and reduced-motion support are included.
- **Lightweight assets:** three transparent 480×480 WebP files total **69,008 bytes** before Next image optimisation. Lazy artwork reserves dimensions. CSS/SVG create the background without large mockup PNGs or animation libraries.
- **Structure:** [checker UI](frontend/src/features/landing/EligibilityChecker.js), [static choices/rules](frontend/src/data/eligibility.js), [validation/review logic](frontend/src/lib/eligibility.js), and central [theme tokens](frontend/src/styles/index.css). Backend data can replace the fictional profiles later.

Artwork was generated with **built-in image_gen** from E4's style. [Exact asset prompts](design/section-4-eligibility/implementation/assets/prompts.json), original PNG copies, [optimisation script](design/section-4-eligibility/implementation/assets/optimise.mjs) and [size/provenance manifest](design/section-4-eligibility/implementation/assets/manifest.json) are preserved. Browser previews and validation are recorded after the checks complete.

**Actual browser previews:** [desktop entry](design/section-4-eligibility/implementation/desktop/01-study-stage.png), [tablet entry](design/section-4-eligibility/implementation/tablet/01-study-stage.png), [mobile entry](design/section-4-eligibility/implementation/mobile/01-study-stage.png), [mobile result](design/section-4-eligibility/implementation/mobile/08-review.png), [mobile viewport with fixed header](design/section-4-eligibility/implementation/mobile/08-review-viewport.png). [All steps](design/section-4-eligibility/implementation/) contain **27 isolated section previews plus six real viewport previews**. The fixed header is temporarily hidden only for isolated section captures, then restored; viewport captures show its actual behavior. [Capture script](design/section-4-eligibility/implementation/capture.mjs) and [measurements](design/section-4-eligibility/implementation/measurements.json) record no horizontal overflow or browser errors across all captured states.

**Validation:** all **62 browser tests passed** in the complete suite, including 15 checker scenarios, earlier landing/destination/college flows and fixed-header behavior. After the final mobile font refinement, **five responsive checker scenarios passed again** at 320, 390, 768, 1101 and 1672px. Mobile inputs/selects use a central 16px minimum control font; marks are larger. **Lint and production build passed**; the homepage is statically prerendered. Static demo rules and account/device persistence limitations remain explicit.

## Section 4 design history — E4 approved; E5/E6 alternatives

The user rejected the earlier E1–E3 presentation as basic and requested a new background, button treatment and layout while keeping wine/taupe colours. The current proposals ask **one focused question at a time**, beginning with **Where are you in your studies?**: Class 12 studying/completed or college student/graduate, plus a diploma/other qualification route. Relevant course, year, subjects, marks and exam information follow in later steps; no first-stage answer implies eligibility or admission.

| Concept | Preview | Direction |
| --- | --- | --- |
| E4 — Study-stage gallery | [View E4](design/section-4-eligibility/redesign-v2/E4.png) | Open editorial layout, folded-page background, crafted academic illustrations and split Continue. Strongest visual departure. |
| E5 — Conversational eligibility | [View E5](design/section-4-eligibility/redesign-v2/E5.png) | Focused prompt, answer rows, slim progress rail and illustrated academic path. |
| E6 — Eligibility workbench | [View E6](design/section-4-eligibility/redesign-v2/E6.png) | Compact horizontal layout, contained paper artwork, segmented choices and wine/taupe split button. Recommended for compact placement. |

Browser screens for [Careers360](https://engineering.careers360.com/jee-main-college-predictor) and [CollegeDekho](https://www.collegedekho.com/exam/neet-ug/college-predictor) were inspected. Official [BigFuture College Quiz](https://bigfuture.collegeboard.org/pay-for-college/bigfuture-scholarships/take-the-college-quiz) and [UCAS quiz](https://www.ucas.com/careers-quiz) content supplied discovery references. Shiksha/Collegedunia browser views returned 403 errors, BigFuture search reset its connection and UCAS quiz timed out; those are not counted as successful visual inspections. [Reference evidence](design/section-4-eligibility/redesign-v2/references/) records actual access.

Three alternative PNGs were generated with **built-in image_gen**, using the implemented Section 3 screenshot only as a brand reference. Images and [exact prompts](design/section-4-eligibility/redesign-v2/prompts.json) are saved in [redesign-v2](design/section-4-eligibility/redesign-v2/), with originals preserved. [Updated design brief](design/section-4-eligibility/redesign-v2/design-brief.md) covers later questions, results, mobile and motion intent. These remain **unapproved visual proposals**; no application source changed or application tests rerun in this round.

## Earlier Section 4 proposals E1–E3 — presentation rejected

**Recommended next section:** **Check your course eligibility**, followed by **Understand the requirements before you apply**. After location discovery and the course-wise college explorer, this section helps students understand which academic requirements they match, what information is missing and what to do next. These are design proposals; Section 4 has not been implemented.

Public predictor flows were reviewed on [Shiksha](https://www.shiksha.com/engineering/jee-main-college-predictor), [Careers360](https://engineering.careers360.com/jee-main-college-predictor), [CollegeDekho](https://www.collegedekho.com/exam/neet-ug/college-predictor) and [Collegedunia](https://collegedunia.com/jee-main-college-predictor). They use exam score/rank and contextual inputs such as category or home state to suggest colleges using cutoff information. NSEDU's proposed entry starts with academic requirements and keeps admission-chance prediction separate. The review did not submit student information or test paid reports. Actual programme rules will require institution/year-specific sources; [JoSAA](https://josaa.nic.in/) provides official business rules, programme restrictions and opening/closing ranks for its counselling routes.

- **Primary inputs:** course/programme, qualification/completion status, admission year, subjects studied, relevant marks/CGPA with its exact basis, and entrance-exam status. Carry forward the earlier course choice where possible. Request exam/session/rank type and category/domicile only when applicable to the chosen route.
- **Result content:** requirement-by-requirement comparison, reasons for matching or missing a requirement, missing exam/details, source/year when verified, and the next action. Distinguish **Academic criteria match**, **More details needed**, **Requirement not met** and **Requirements not yet verified**. Academic criteria matching alone must not imply admission or completion of every entrance-route requirement.
- **Student flow:** start without sign-up; **Check eligibility** opens a useful review. Offer **Explore colleges**, **Add exam details** or **Review admission requirements** as relevant next steps. An account can be offered afterward to save the check and continue later. These interactions are proposals, not working features yet.
- **Layout:** a compact section rather than another hero. Use the established wine `#72243B`, taupe `#806C60`, ivory `#FFFAF8`, greige surfaces, serif headings and sans-serif controls. Desktop uses a form beside an explanation panel; tablet/mobile should collapse into readable stacked controls and labeled result rows.

| Concept | Preview | Intended use |
| --- | --- | --- |
| E1 — Compact eligibility desk | [View E1](design/section-4-eligibility/E1.png) | Recommended homepage entry: six concise inputs with a small panel explaining the result. |
| E2 — Guided eligibility steps | [View E2](design/section-4-eligibility/E2.png) | Alternative entry: progressive questions, course choices and an explanation of why each detail matters. |
| E3 — Requirements explained | [View E3](design/section-4-eligibility/E3.png) | Proposed result state: academic requirements, student details, status and an entrance-route follow-up. |

**Recommended pairing: E1 entry + E3 result**, as two states of the same section. E2 is an alternative rather than an additional homepage block. No concept has been approved yet. E3 uses **Northfield Institute of Technology**, a fictional programme and a fictional **50% PCM minimum** against a **78% PCM** example; those numbers are illustrative, not a general B.Tech rule or a verified institutional decision.

The three PNGs were generated using **built-in image_gen**, with the [implemented Section 3 screenshot](design/implementation-preview/section-3/desktop.png) as a style reference. Original generated assets are preserved. The [detailed content brief](design/section-4-eligibility/content-brief.md) contains the input contract, result distinctions, research links and responsive intent; [exact prompts](design/section-4-eligibility/prompts.json) are saved alongside the images. Raster mockups approximate the existing typefaces and do not demonstrate working interactions or mobile behavior. Application source remains unchanged in this design round, so application tests were not rerun.

## Fixed header — section-aware scroll behavior

The header now remains fixed at the top while browsing. Section 1 retains the original full two-row desktop composition. Near Section 2 it becomes a compact two-row bar: smaller wordmark, search, preferred city, accounts and main navigation. Two section shortcuts, **Locations** and **Course-wise colleges**, highlight the current section and jump to it. Scrolling back into the introduction restores the full header.

On mobile/tablet the fixed bar becomes shorter, replaces the tagline with **Locations** or **Colleges**, and keeps the registration action and navigation drawer available. Search and city selection remain accessible inside the drawer. The original header space is reserved in the document, so switching modes does not move the content or change the desktop first-screen fit. A header ResizeObserver updates the anchor scroll offset so headings remain visible beneath the fixed bar. Passive scroll handling uses animation frames and updates React state only when the section or shadow state changes. Reduced-motion settings disable transitions.

Behavior lives in [Header.js](frontend/src/components/layout/Header.js), responsive layout in [Header.module.css](frontend/src/components/layout/Header.module.css), and height/font/shadow/motion settings in the central [index.css](frontend/src/styles/index.css). Actual previews: [desktop intro](design/implementation-preview/header-scroll/desktop-intro.png), [desktop locations](design/implementation-preview/header-scroll/desktop-locations.png), [desktop colleges](design/implementation-preview/header-scroll/desktop-colleges.png), [mobile colleges](design/implementation-preview/header-scroll/mobile-colleges.png). [Measurements](design/implementation-preview/header-scroll/measurements.json) record desktop height changing from 114.75px to 81px at 1440×900 and mobile height from 77px to 65px at 390px width, with no horizontal page overflow.

Validation: **all 47 browser scenarios passed**, including seven dedicated scroll checks, all Section 3 interactions and earlier landing/destination regression checks. **Lint and production build passed.** Scroll checks cover fixed positioning, full/compact restoration, stable document layout, section anchors, compact search/city/account actions, dropdown bounds, mobile drawer focus and reduced motion, including a 1101×600 desktop viewport.

## Section 3 — approved course-wise college explorer implemented

The user approved the course-wise table design and requested implementation. Section 3 now follows city/state discovery, using the approved Wine + Warm Taupe theme and **static demo records**. Dynamic records will come from the Express backend later.

**Design preview:** [Course-wise colleges](design/section-3-course-wise-colleges/course-wise-colleges.png). Generated using **built-in image_gen** with the implemented Section 2 screenshot as a brand/style reference. [Exact prompt](design/section-3-course-wise-colleges/prompt.json) and [static demo records](design/section-3-course-wise-colleges/static-demo-data.json) are saved beside the image. The original generated image remains preserved.

- **Actual browser previews:** [desktop](design/implementation-preview/section-3/desktop.png), [tablet](design/implementation-preview/section-3/tablet.png), [mobile](design/implementation-preview/section-3/mobile.png), [comparison dialog](design/implementation-preview/section-3/compare.png). Preview at `http://localhost:3000/#course-colleges`. [Capture script](design/implementation-preview/section-3/capture.mjs) and [measurements](design/implementation-preview/section-3/measurements.json) reproduce these screenshots.
- **Content:** 11 primary course tabs and five more choices, a compact location/annual-fee/sort toolbar and up to five preview rows. The runtime catalog contains **29 programme records across 11 fictional institutions and 16 courses**. Each course has its own records; switching to MBA does not relabel B.Tech fees or placements. Medical/law programme salaries without sample values display **Not provided**.
- **Table:** list position, campus thumbnail/name/location/course, annual tuition with academic year, programme-level median/highest salary with reporting year, demo rating and actions. List numbers represent display order rather than an official rank. Fees exclude hostel/living expenses; LPA means lakh rupees per annum.
- **Working interactions:** city/region or state filtering, maximum annual tuition, fee/median-salary/demo-rating sorting, empty states and filter reset; course choices share context with Section 2. Save works for the current visit and follows an institution across course tabs. Comparison retains up to three selections per course, including colleges hidden by filters, and opens a side-by-side detail dialog. B.Tech initially selects Northfield and Central to match the approved design. Clear resets only the active course's comparison.
- **Details and directory:** View details shows the selected programme's fees, location, reporting years and demo figures. View all colleges opens a searchable directory for the current course/location/budget. Apply now opens an application checklist; it does not collect personal information, submit an application or imply admission to a fictional institution.
- **Theme:** wine `#72243B`, taupe `#806C60`, ivory `#FFFAF8`, white row surfaces and pale greige controls. Serif section headings, compact sans-serif college names/controls, fine borders, restrained shadows, subtle selection outlines and minimal corner linework continue Section 2.
- **Compact spacing revision:** following the user's course-table reference, campus thumbnails are now 48×48px on desktop and 40×40px on mobile. College name and location/course use two compact lines; Save is an accessible heart button beside them. Desktop row actions share one line, with slimmer padding, small corner radii and vertical column dividers. At 1672px width, each row is now **66px high**, and section height reduced from 1,275px to approximately **863px**. At 390px width, cards are approximately 240–257px high and section height is 1,924px rather than 2,763px. Central `--college-*` tokens control the row/thumbnail/font recipes. All **13 Section 3 browser checks passed** after this revision; additional captures confirmed no page overflow and row controls fitting at 320, 1101, 1250 and 1366px.
- **Demo content:** fictional institutions, generated campus images, tuition, salaries and scores are visibly labeled illustrative. List positions are not official ranks and scores are not actual student reviews. The original design JSON remains a historical reference; [colleges.js](frontend/src/data/colleges.js) is the runtime data source. Actual institutional records will need source-backed research.
- **Structure:** [CollegeExplorer.js](frontend/src/features/landing/CollegeExplorer.js) contains the UI; its CSS module handles responsive layout. Desktop uses a semantic table, tablet a two-column card grid and mobile readable single-column cards. [college-data.js](frontend/src/lib/college-data.js) is the server-side loader to replace with an Express API call; [college-catalog.js](frontend/src/lib/college-catalog.js) provides filtering, sorting and INR formatting. Theme colors, fonts, row radii, thumbnail sizing and section typography are declared in the central [index.css](frontend/src/styles/index.css).
- **Accessibility and asset budget:** labeled controls, keyboard course tabs, native modal dialogs, Escape/focus restoration, live action feedback and reduced-motion support. Campus thumbnails reuse one Next.js optimized source: **84,006 bytes (about 82 KiB) as WebP**, under the 250 KB budget. Browser captures recorded no page overflow at desktop/tablet/mobile sizes.

Validation: **lint and production build passed**. All **40 browser scenarios** were verified: 39 passed in the full run; one details/dialog case reported a development hydration mismatch and passed in three subsequent isolated runs. Checks cover course-specific data, shared course context, filter intersections/sorting/empty states, session saves, the three-college comparison limit, retained hidden selections, directory search, the application checklist, keyboard/focus behavior and widths from 320–1920px. Earlier header, hero and destination checks also passed. The five default B.Tech rows match the approved names and values; selected rows match the comparison tray. Runtime screenshots are saved above.

## Section 2 — approved city and state discovery implemented

Latest decision: the user approved the combined reference and requested implementation. Section 2 now contains **arched city landmark tiles** followed by **compact landscape state cards**, matching the reference's wine/taupe theme, light background, course selector, headings, divider and actions. The first-screen header/hero/course/resource composition stays in its existing desktop viewport; Section 2 follows below it in the scrollable homepage.

**Combined preview:** [Cities + States](design/research-2026-10-06/section-2-city-and-state/cities-and-states.png).

**Actual browser previews:** [desktop](design/implementation-preview/section-2/desktop.png), [tablet](design/implementation-preview/section-2/tablet.png), [mobile](design/implementation-preview/section-2/mobile.png), [whole desktop page](design/implementation-preview/section-2/page-desktop.png). Preview locally at `http://localhost:3000/#study-destinations`.

| Part of Section 2 | Visual presentation | Content |
| --- | --- | --- |
| City discovery — implemented | Arched landmark tiles, same wine/taupe brand and light background | Delhi NCR, Bengaluru, Mumbai, Hyderabad, Pune and Chennai; course context and college-explore actions. |
| State discovery — implemented | Separate smaller heading, short explanation, six shallow rectangular image cards with slim white name/action footers | Madhya Pradesh, Karnataka, Maharashtra, Uttar Pradesh, Telangana and Tamil Nadu; **View all states** action. |

State heading: **Explore states to study in India**. Supporting copy: **Browse colleges across cities within your preferred state.** This presents exploration choices rather than an unsupported numeric ranking. The state landmarks differ from the city images: Sanchi Stupa, Mysore Palace, Ajanta caves, Taj Mahal, Golconda Fort and Mahabalipuram Shore Temple respectively. Generated imagery remains illustrative design artwork, not verified destination photography or college-campus assets.

The city and state rows retain common course context, aligned columns, restrained spacing, a fine dividing rule, wine `#72243B`, warm taupe `#806C60` and light ivory surfaces. Arch-shaped city tiles and landscape state cards make the two navigation levels visually distinct. Both rows fit in one coherent downstream section; this is not a new hero or full homepage.

The combined mockup was created using **built-in image_gen** with [L1](design/research-2026-10-06/section-2-location-discovery/L1.png) as the edit target. The source remains preserved. [Exact prompt](design/research-2026-10-06/section-2-city-and-state/prompt.json) and the final PNG are saved in the workspace. The implementation reuses the approved landmark artwork through SVG image windows and one shared Next.js optimized source; all headings, labels, selects and buttons are real editable UI. Background sketches retain their proportions on mobile, with a softly fading campus sketch at the top right. Detailed institution coverage is still future work.

### Implemented behavior and structure

- [LocationDiscovery.js](frontend/src/features/landing/LocationDiscovery.js) contains the section and searchable location dialogs; [LocationDiscovery.module.css](frontend/src/features/landing/LocationDiscovery.module.css) handles layout. Desktop uses six columns, tablet three and mobile two, without horizontal page overflow.
- **Course context:** an exact course chosen in the first-screen course search/popular-course actions carries into the location selector. Location actions preserve that course and open the existing college discovery dialog with an explicit city or state preference. Course/exam browsing remains available from there; no matching college records are fabricated.
- **View all locations** offers the eight current city/region options; **View all states** offers searchable state preferences. Geographic names follow the [official Indian Embassy state listing](https://www.indianembassynetherlands.gov.in/page/indian-states-and-union-territories/). These are navigation choices, not a claim that NSEDU already covers institutions in every place. Delhi NCR remains a city/region choice rather than a state.
- [destinations.js](frontend/src/data/destinations.js) contains tile names, illustrative landmark descriptions, artwork windows and state choices. [LocationArtwork.js](frontend/src/features/landing/LocationArtwork.js) and [destination-image.js](frontend/src/lib/destination-image.js) render the lightweight shared visual source.
- **One central theme file:** [index.css](frontend/src/styles/index.css) controls colors, font families, section type sizes, city/state image ratios, radii, card shadow, artwork opacity and spacing variables. Layout styles consume those variables.
- Accessible native buttons, labeled course selection, descriptive artwork, keyboard search, Escape dismissal, focus restoration, visible focus indicators and reduced-motion support are included. Touch targets remain usable at narrow widths.
- Accounts, live college results, fees, admissions and applications remain future work. This section implements destination navigation and preference context; it does not connect a live college database.

Validation: **lint and production build passed**. All **27 browser scenarios** were verified: 25 passed in the full run; the two local timeout cases passed in an isolated single-worker run after resolving shared trace-file collisions. Checks cover responsive widths, first-screen desktop fit, course/city/state context, searchable directories, keyboard access and focus restoration. Shared landmark artwork transfers as WebP: **144,810 bytes (about 141 KiB)**, below the 250 KB test budget. The [capture script](design/implementation-preview/section-2/capture.mjs) reproduces actual desktop/tablet/mobile previews and [measurements](design/implementation-preview/section-2/measurements.json); no horizontal overflow was recorded at those three sizes.

Earlier reference round: the user requested a compact downstream content block and supplied city/state/course-wise discovery screenshots, with Careers360 as another reference. The explorations below remain design history; the specific city selection is now L1.

**Recommended content domain:** College Discovery by City / State. Proposed heading: **Explore where you want to study**. Supporting copy: **Choose a city or state to explore colleges, courses and fees.**

### Earlier compact explorations — L1 city treatment selected

| Option | Preview | Presentation |
| --- | --- | --- |
| L1 — Architectural Destination Shelf | [View L1](design/research-2026-10-06/section-2-location-discovery/L1.png) | Six cohesive landmark illustrations with curved upper edges; direct city actions; compact state chips. Most distinctive illustration treatment. |
| L2 — Editorial City Postcards | [View L2](design/research-2026-10-06/section-2-location-discovery/L2.png) | Alternative with six shallow photographic tiles. The selected Pune tile connects to a small action ribbon, **Explore colleges in Pune**. State shortcuts remain a thin text row. The user chose L1's city treatment instead. |
| L3 — Two-Row Location Atlas | [View L3](design/research-2026-10-06/section-2-location-discovery/L3.png) | Six compact horizontal location entries in a three-by-two layout, with city/state mode controls and course context. Text remains prominent alongside small landmark vignettes. |

These are deliberately panoramic section previews with smaller content headings, not another full-screen hero. Design heights are proposals; actual responsive layout and browser measurements remain future implementation work. All three retain the approved wine `#72243B`, taupe `#806C60`, light ivory/greige surfaces, editorial serif headings and clean sans-serif controls. Fine edge contours and subtle architectural linework enrich the background without sitting behind the main text.

### Earlier proposed content and interaction contract — design history

- **City destinations:** Delhi NCR, Bengaluru, Mumbai, Hyderabad, Pune and Chennai. Each tile opens location-specific college browsing; the landmark represents the destination, not a college campus or a promise of nearby facilities.
- **State discovery:** the latest combined proposal uses image cards for Madhya Pradesh, Karnataka, Maharashtra, Uttar Pradesh, Telangana and Tamil Nadu, plus **View all states**. This replaces the earlier plain-chip shortcut suggestion. These are navigation examples, not an asserted ranking or exhaustive catalog. Delhi NCR is a destination region and is not mislabelled as a state.
- **Course context:** one small **Course: All courses** control, populated from the earlier student choice when available. Changing location preserves the course choice. Do not repeat the large first-section course icon grid.
- **Next action:** browse colleges in the chosen place and then inspect course-specific tuition, admissions, campus details and comparison. L2 demonstrates a selected location and matching action ribbon; it is not an implemented selection flow.
- **Scope:** keep the detailed course-wise college results/table in a separate subsequent block or directory, rather than putting cities, states, a long rank table, adverts, exams and news into this one section. The exact later section order is still to be decided.
- **Labels:** use exploration wording, without unsupported top/best rankings, institution counts, cheapest/safest claims or fabricated city cost estimates. Destination examples do not imply a completed live institution database.
- **Responsive intent:** city shelves can scroll horizontally with visible labels on mobile; L3 can collapse from three columns to two and then one; state shortcuts can wrap or scroll. Keep content headings and controls readable, keyboard accessible and touch targets usable. No mobile UI was implemented or tested in this design round.
- **Motion intent:** a small hover lift/outline for location tiles and a short selected-state transition can provide feedback. Any subtle background line reveal should run once and respect reduced motion. These static PNGs do not contain animation.

### Reference review and saved artifacts

The user's screenshot supplied the direct evidence for city/state rows and course-wise tables. The current [Careers360 homepage](https://www.careers360.com/) was separately reviewed: its public navigation includes college discovery by location/state, programs and comparison. Its currently retrieved page did not expose the screenshot's exact **Top Places / Top States** row headings, so this is a content-pattern adaptation, not a claim that the screenshot was verified as the current Careers360 homepage. No sponsor banners, competitor statistics or rankings were carried over.

L1–L3 were generated with **built-in image_gen**, saved in [section-2-location-discovery](design/research-2026-10-06/section-2-location-discovery/) with [exact prompts and L3 polish prompt](design/research-2026-10-06/section-2-location-discovery/prompts.json). Generated landmark imagery is illustrative and should be replaced or checked against suitable source assets before use as real destination photography. Final previews were checked visually for city/state labels, content hierarchy, matching selected location in L2, palette and compact framing. Frontend/backend source files remain unchanged in this round.

### Intermediate creative explorations R1–R4 — retained for reference

After rejecting the original college-card proposals as too basic, the user requested changed content and more creative composition. Four broader exploration concepts were generated before the user clarified the need for a compact next section:

| Concept | Image | Content |
| --- | --- | --- |
| R1 — Decision Compass | [View R1](design/research-2026-10-06/section-2-creative-redesign/R1.png) | Student stage selection, an interests-to-courses-to-shortlist route and a relevant next action. Decorative slogans were removed in the saved refinement. |
| R2 — Career Route Studio | [View R2](design/research-2026-10-06/section-2-creative-redesign/R2.png) | An example design-interest pathway into courses and careers; not a personal suitability assessment or employment promise. |
| R3 — Cost Clarity Desk | [View R3](design/research-2026-10-06/section-2-creative-redesign/R3.png) | Illustrative annual planning inputs: tuition ₹1,80,000 + hostel/meals ₹70,000 + books/travel/personal ₹40,000 = ₹2,90,000. No actual institution fee quotes. |
| R4 — Campus Life Explorer | [View R4](design/research-2026-10-06/section-2-creative-redesign/R4.png) | Campus imagery and living/learning/support research questions; not verified institution amenities or real student testimonials. |

The user indicated that this creative direction had useful elements but clarified that the next block should not look like another landing section. No specific R-number was approved. These broader concepts remain optional references for later sections, rather than the current Section 2 recommendation. Their interest/career exploration content was informed by [BigFuture's starting-point navigation](https://bigfuture.collegeboard.org/bigfuture-pathfinder), [UCAS subject/career discovery](https://www.ucas.com/explore/what-to-do) and indexed [CollegeDekho career exploration](https://www.collegedekho.com/) content. Exact built-in generation/refinement prompts are in [R prompts.json](design/research-2026-10-06/section-2-creative-redesign/prompts.json).

## Earlier Section 2 visual proposals — S1–S5 rejected as too basic

Requested deliverable: **five detailed image mockups of the second homepage section**, continuing the approved Wine + Warm Taupe theme. These are visual proposals only; no frontend/backend implementation was changed in this round. The approved first section remains the reference, and these previews represent the next section below it.

**Content direction:** College & University Discovery + Shortlisting, headed **Explore colleges for your goals**. Students choose a course, location and annual tuition budget, inspect college previews, open details, save options and select colleges for comparison. The course shown is a sample B.Tech selection; the intended explorer supports the other education domains recorded below.

| Option | Saved image | Layout and student benefit |
| --- | --- | --- |
| S1 — Focused College Explorer | [View S1](design/research-2026-10-06/section-2-concepts/S1.png) | One filter toolbar and four equal campus cards. Strong visual scanning with course/duration, city, annual tuition, admission-detail links, Save and Compare. Recommended starting layout. |
| S2 — Editorial Campus Discovery | [View S2](design/research-2026-10-06/section-2-concepts/S2.png) | Four horizontal photo-and-detail cards in a two-by-two grid. Larger campus imagery beside readable facts; equal prominence for every option. |
| S3 — Compare As You Browse | [View S3](design/research-2026-10-06/section-2-concepts/S3.png) | Four compact thumbnail rows with aligned course/tuition columns. Two selected colleges demonstrate a small comparison tray; no full comparison matrix or popup is needed on the homepage. |
| S4 — Preferences First | [View S4](design/research-2026-10-06/section-2-concepts/S4.png) | A short course/location/tuition panel beside three cards. Makes active preferences explicit and explains the factual budget fit. |
| S5 — Location Led Discovery | [View S5](design/research-2026-10-06/section-2-concepts/S5.png) | Course and budget controls plus compact city tabs, followed by four two-by-two college snapshots. A geography-led alternative without a large map or city-poster gallery. |

**Historical recommendation:** the first proposal favoured S1's card grid and S3's comparison tray. The user subsequently rejected this group as too basic and requested changed content/composition. It is retained as design history, not the current recommendation.

### Shared visual and content decisions

- Wine `#72243B` carries heading/action emphasis; warm taupe `#806C60` carries secondary icons and preference chips. Ivory `#FFFAF8`, pale greige `#F1ECE8` and white provide the light surfaces. Typography follows DM Serif Display and Plus Jakarta Sans; generated images approximate the exact font rendering.
- White cards, restrained rounded corners, fine borders, shallow shadows and useful campus imagery preserve the approved editorial direction. No large background decoration, new accent theme, ratings or unsupported ranking badges were added. S1's initial green budget chips were refined to greige/taupe before saving the final.
- All names, campus photographs and tuition figures are **illustrative design data**, not sourced institution records. Every preview visibly labels demo data. Tuition uses a stated annual basis and academic year 2026–27; hostel/living costs are separate. The sample institutions/fees must not become live catalog records.
- Budget chips describe only a tuition preference match; they do not predict admission eligibility. No placement values or accepted-exam claims were fabricated for the sample colleges.
- Save/Compare controls and the selected state in S3 illustrate intended interactions. These PNGs are static proposals, not functioning search/account/comparison flows.
- During implementation, preserve readable mobile cards: stack or horizontally browse cards in S1/S4, stack wide cards in S2/S5, and convert S3's rows into labelled compact cards. Wrap filters, allow accessible city-tab scrolling, and keep comparison actions within the mobile viewport. These mobile adaptations are planning notes, not separately generated or tested mobile screens.

### Research grounding and artifact provenance

The prior content research below supplied the product direction. This visual round rechecked [Shiksha college discovery](https://www.shiksha.com/colleges), [Collegedunia's college directory](https://collegedunia.com/india-colleges), [Careers360](https://www.careers360.com/) and indexed first-party [CollegeDekho homepage content](https://www.collegedekho.com/). CollegeDekho's direct open returned an error in this round; its indexed homepage content remained available. The research supports college/course/location/fee discovery and comparison as relevant content; it does not establish that one mockup performs better than another.

All five images were produced with **built-in image_gen** using [H2](design/research-2026-10-06/harmonious-wine-refinements/H2.png) as the brand reference, then copied into the workspace. The exact generation prompts and S1 refinement prompt are saved in [prompts.json](design/research-2026-10-06/section-2-concepts/prompts.json). Final previews were visually checked for legibility, institution/fee consistency, demo labels, palette continuity and complete section framing. Application checks were not rerun because this round changed design/documentation assets only.

## Earlier Section 2 content research — design history

Current request: plan a seven-to-eight-section student homepage progressively and decide only the second section's content. No application UI, theme or code changes in this research round. The existing first-screen header/hero/course/resource strips remain the approved starting point. Additional future sections will sit below that first screen; preserving its proportions does not mean compressing the entire planned homepage into one viewport.

### Competitor evidence reviewed on 6 October 2026

| Platform and source | Observed content pattern | Relevance to NSEDU |
| --- | --- | --- |
| [Shiksha homepage](https://www.shiksha.com/) and [college discovery](https://www.shiksha.com/colleges) | Stream-specific discovery, location/branch preferences, exams, guidance and comparison; listings expose institution location/type, course fees, accepted exams and some placement data. | Show substantive college options after the introductory discovery hero. |
| [CollegeDekho homepage](https://www.collegedekho.com/) | Career/counselling/application journey, followed by field-led discovery with featured institutions, exams, states and related courses. | Keep the next step connected to the student's chosen field and admission research. |
| [Collegedunia homepage](https://collegedunia.com/) and [college directory](https://collegedunia.com/india-colleges) | Study goals/programs, college finding/comparison, ranking and study-place content; directory provides course-fee, placement, review and ranking information. | Let students inspect and shortlist colleges without repeating the first screen's course/icon grid. |
| [Careers360 homepage](https://www.careers360.com/) | Stream-specific college discovery/reviews plus exam predictors and guidance resources. | Keep factual college exploration separate from personalised admission prediction. |

Evidence is public page content, not a pixel-by-pixel competitor layout audit or a conversion study. Collegedunia's direct homepage open initially failed; its indexed first-party homepage content and directly readable college directory supplied the evidence. Competitor fees/ranks/counts are observations only and are not imported as verified NSEDU records. The proposed distinctions below are product choices, not claims that competitors lack these features.

### Recommended domain: College & University Discovery + Shortlisting

Recommended heading: **Explore colleges for your goals**.

Supporting copy: **Find options by course, location and budget. Review the details, compare colleges and build your shortlist.**

The section should answer: “Which colleges should I look at next, and what makes each relevant to my preferences?” Section 1 introduces NSEDU and offers entry points; Section 2 should provide real institution options. Another large course/category grid would repeat content already present. A news feed, detailed AI chat, marks-prediction form and application form can each have a later dedicated role.

### Proposed content inventory

1. **One heading and short explanation.** Use neutral exploration wording before preferences exist; do not call anonymous default results “best colleges for you.”
2. **Three compact preferences: course, city/state and budget.** Carry the first section's selections forward where available. Budget must state whether it means annual tuition or total study cost; proposed first version uses annual tuition, excluding hostel/living expenses with a clear label. Keep institution type, exams and specialisation under optional additional filters rather than a long homepage form.
3. **A small preview of college options.** Start with four compact cards on desktop and a readable mobile layout. The full directory opens through “View all colleges.” Initial records should be an editorial selection with a disclosed basis; “popular/trending” requires real usage evidence. Personalised ordering follows actual user preferences rather than invented scores.
4. **Each card contains:** real campus photo/logo, institution name, city/state and public/private type; selected course with duration; course-specific tuition with its period and academic year; one useful supporting admission/outcome fact; “View details,” “Compare” and “Save.” For engineering/management an available program-level placement median and reporting year can be useful; for other streams an admission route/exam may be more relevant. Avoid packing every ranking/review/facility into the card.
5. **Transparent context.** If available, show a factual reason such as “Offers your selected course,” “In your selected city,” or “Within your tuition budget.” Do not equate a preference match with admission eligibility. Relevant facts should link to their source and last checked date in expanded details. Sponsored placements must be labelled and distinguished from preference-based results.
6. **A clear next action.** Primary section action: “View all colleges.” Secondary actions: college detail, compare and save. Avoid making “Apply now” the main action before the student can inspect the institution/course. Exploration should remain open; later account prompts can explain saving a shortlist across sessions/devices.
7. **Useful empty state.** If no college matches, identify the active restrictions and offer to widen location/budget or review course options. Preserve the student's choices; do not fabricate matching records or reset filters silently.

### Education coverage

This is a cross-domain institution section, not an engineering-only block. Initial browse coverage can include Engineering/Technology, Management, Commerce, Computing, Medical/Health Sciences, Design, Law, Science and Arts/Humanities, with additional streams as verified data becomes available. Course examples include B.Tech, BBA/MBA, B.Com, BCA, MBBS, B.Des, LL.B, B.Sc and BA. These are navigation examples, not a claim that all programs are already in the implemented starter catalog. The student's selected course determines which institutions and figures are relevant; do not compare an institution's cheapest unrelated program or a campus-wide placement statistic as if it describes the selected course.

### NSEDU priorities and content rules

- **Clear costs:** identify course/branch, fee period, academic year and inclusions. Hostel/mess/living estimates remain separately labelled; do not present tuition-only figures as complete study costs.
- **Comparable outcomes:** identify placement median/average correctly and specify program/cohort/report year. Do not headline the highest package as a typical student outcome or reuse university-wide figures as course-specific data.
- **Evidence-backed labels:** rankings require agency/category/year; approval/accreditation needs the correct scope and current source. Do not attach generic “verified,” “best,” ratings or admission-open badges without supporting evidence.
- **Missing-data honesty:** use “Not available” or omit an optional metric with a clear explanation; missing is not zero. Only offer cost/outcome sorting when the underlying records are comparable and have sufficient coverage.
- **Respectful registration:** let students inspect options first. Later saved-shortlist/account flows should explain the specific benefit rather than opening an unsolicited sign-up gate.
- **Data readiness:** the 2,000+ institution coverage remains a long-term target, not a live count. Real cards require researched official institution/program sources, appropriately usable campus assets and current admission information. Design prototypes must explicitly label sample records rather than presenting fictional institutions as real results.

### Decision and remaining choices

Recommended Section 2: **a compact, preference-led college explorer that helps students open details and start a shortlist**. This is a recommendation awaiting the user's selection, not an approved design or an implemented live directory. Card preview count, initial editorial selection, budget basis and the exact final heading can be refined during the next content/design round. The content-only research round preserved the primary wine/warm-taupe theme and produced no UI. Its subsequent five visual proposals are documented above.

## Current implementation — Next.js landing page

Approved reference: [H2 Wine + Warm Taupe](design/research-2026-10-06/harmonious-wine-refinements/H2.png). Frontend is now **Next.js App Router with JavaScript**, replacing Angular. Backend remains **Node.js / Express in JavaScript**, with an optional MongoDB connector. The earlier Angular source/configuration is preserved in [design/archive/angular-scaffold](design/archive/angular-scaffold/).

The student landing page includes the two-tier desktop header, search/location controls, account actions, split hero with the approved student photograph, Colleges / Courses / Exams search tabs, six discipline shortcuts, six popular-course links and four compact student-resource actions. This introductory composition fits one desktop viewport at the checked sizes. City/state discovery and the course-wise college explorer follow below it; the homepage scrolls to Sections 2 and 3. Mobile/tablet uses readable stacked content, horizontal shortcut strips and an accessible navigation drawer, followed by responsive destination grids and college cards.

**One central theme file:** [frontend/src/styles/index.css](frontend/src/styles/index.css). Change primary wine `#72243B`, warm taupe `#806C60`, supporting colors, self-hosted font families, type sizes, spacing, desktop section proportions, border radii, card/button/input recipes, shadows and motion here. Layout modules consume these shared variables. Typography: DM Serif Display headings and Plus Jakarta Sans body; font files and OFL licenses are included under `frontend/public/fonts/`.

### Professional, simple folder structure

```text
frontend/
  public/fonts/             # Local fonts and licenses
  public/images/            # Approved reference and visual assets
  src/app/                  # Routes, root layout, metadata and not-found page
  src/components/layout/    # Site header and navigation
  src/components/ui/        # Shared icons and accessible dialog
  src/features/landing/     # Hero, destination discovery, college explorer and interactions
  src/data/                 # Courses, exams, navigation, destinations and demo colleges
  src/lib/                  # Data loader, filtering and optimized image helpers
  src/styles/index.css      # Single theme entry and reusable UI recipes
  tests/                    # Browser, interaction and viewport checks
backend/
  src/config/               # Environment and optional MongoDB connection
  src/routes/               # API routes; health endpoint now
  src/app.js                # Express application
  src/server.js             # Server lifecycle
  test/                     # API checks
design/
  implementation-preview/   # Actual desktop/mobile browser screenshots
  archive/                  # Preserved earlier scaffold and rejected themes
```

### Run and check

Use Node.js 22.12+; this workspace uses Node 22.13.1. Next.js 16.3.8 and React 19.3.0 are pinned in the frontend package and lockfile.

```powershell
npm install
npm run dev
```

Frontend: `http://localhost:3000`. Express health: `http://localhost:4100/api/health`. Browser API requests go through the Next.js `/api` proxy; `http://localhost:3000/api/health` returns the Express health response. Port 4100 avoids the unrelated service already using 4000 in this workspace. Optional configuration examples: [frontend/.env.example](frontend/.env.example), [backend/.env.example](backend/.env.example). MongoDB is not required to preview this draft.

```powershell
npm run dev:frontend
npm run dev:backend
npm run lint
npm run build
npm run test:frontend
npm run test:backend
```

Browser tests use installed Google Chrome by default. For bundled Playwright Chromium: run `npx playwright install chromium` from `frontend/` and set `$env:PLAYWRIGHT_CHANNEL='chromium'` before running the tests.

Earlier Section 1 validation: production build, lint, 22 browser tests, backend health/API proxy and dependency audit. Section 2 extends browser checks with city/state context, retained course choice, searchable directories, empty states, shared compressed artwork, narrow touch targets and keyboard skip navigation. Desktop fit checks still cover 1280×720, 1366×600, 1366×768, 1440×900, 1672×941 and 1920×1080, now confirming that Section 2 starts below the first viewport. Responsive width checks cover 320–1920px. Current Section 2 verification results are recorded above.

### Current functionality and next work

Course/exam search filters local starter content. Course pills, discipline links and navigation open working discovery dialogs. Resource shortcuts open practical comparison, eligibility, scholarship and career-research guides. City/state discovery offers course-aware destination actions and searchable pickers. The course-wise explorer filters and compares fictional programme records. Its location/budget filters operate within Section 3; its course selection is shared with destination discovery. Header city preferences and Section 2 location actions still use the existing browse dialog pending the live directory.

Verified college records, authenticated accounts, application forms/tracking, live institution comparison, scholarship data, AI recommendations and admin workflows are planned next. Section 3's sample comparison is functional; all sample fees, salaries and ratings are labeled illustrative rather than presented as real institution facts. Account controls and the application checklist explain their current draft state.

The desktop hero now reuses the approved photograph, actual campus sketch and background curves together, with an SVG mask excluding the reference's interface text/controls. This replaces the earlier approximate building drawing and irregular photo outline. Feathered edges blend the visual behind real editable headings, quotes, tabs, inputs and buttons. The visual preserves its aspect ratio and crops to the viewport rather than stretching student faces. Mobile uses a smaller rounded rectangular photo crop; its height is controlled centrally by `--hero-mobile-photo-ratio` in the theme file. All visual regions reuse one Next.js optimized source; WebP transfer measured 101,568 bytes (about 99 KiB), compared with the 1.66 MB source PNG. Browser tests enforce a 150 KB WebP budget. Header and lower sections remain responsive components. Reference typography is recreated with real fonts and can differ from the generated raster lettering.

## Previous design research — historical decisions

Entries below record earlier explorations and decisions at the time. The implementation and stack above supersede older “no implementation,” Angular and unapproved-palette notes.

### Approved C1 layout; harmonious wine accents — earlier exploration

User requires primary wine #72243B and rejects sage/gold combinations as mismatched. Preserve approved C1 composition. New static color edits keep wine dominant on headline, wordmark, all CTAs and clickable text, reserving a softer second accent for icon strokes, subtle borders and lightly tinted supporting surfaces.

- [H1 Wine + Dusty Mauve](design/research-2026-10-06/harmonious-wine-refinements/H1.png): wine #72243B, dusty mauve #8D667A, pale mauve #F2E9EE, ivory #FFFAF8. Closely related hue family; preferred subtle matching direction.
- [H2 Wine + Warm Taupe](design/research-2026-10-06/harmonious-wine-refinements/H2.png): wine #72243B, warm taupe #806C60, pale greige #F1ECE8, ivory #FFFAF8. Neutral supporting color for a calmer appearance.

Both generated with built-in imagegen using the original C1 file. Saved outputs locally; exact [prompts.json](design/research-2026-10-06/harmonious-wine-refinements/prompts.json). Requested hex values are intended tokens, not guaranteed raster color measurements. Layout retained visually; no implementation, palette approval or measured engagement claim. Before implementation verify actual SVG/control contrast and semantic color roles. Earlier P1/P2 are rejected color proposals.

## Approved first-section layout; rejected sage/gold exploration

User identifies the attached C1 Course & Tools Strip layout as the final landing first-section direction. Preserve layout, spacing, content and photo arrangement; current change request is only adding a complementary second brand color. This approves composition, not either new palette or implementation.

- [P1 Wine + Sage](design/research-2026-10-06/two-color-refinements/P1.png): primary wine #72243B, secondary sage #4F6754, supporting sage tint #EDF2EA, ivory #FFFAF8. Wine remains on logo, hero title, active search tab and Search button; sage on account CTA, discipline/course icons and lower actions.
- [P2 Wine + Warm Gold](design/research-2026-10-06/two-color-refinements/P2.png): primary wine #72243B, secondary muted gold #96702F, supporting champagne #F4EDDE, ivory #FFFAF8. Wine anchors title/search; gold accents shortcuts, icons and account CTA.

Design preference: P1 creates a clearer fresh contrast with wine; P2 creates a warmer editorial appearance. Raster edits approximate requested colors and preservation, not exact hex/pixel rendering; P2 retains a wine comparison heading while other lower headings shift to gold. Before implementation settle the color roles and verify exact rendered contrast. Neither palette is selected yet. No app code changed.

Built-in imagegen used with the latest C1 attachment as edit target. Saved both mockups locally. Exact prompts: [prompts.json](design/research-2026-10-06/two-color-refinements/prompts.json).

## Compact landing strips — approved C1 layout exploration

User asks to remove oversized lower content while retaining the supplied D1 upper layout and comfortable spacing. New scope: two short useful horizontal rows below hero, roughly one quarter of the desktop preview, with no tall catalogs, forms, article thumbnails or sidebars. Rechecked Collegedunia study-goal/course shortcuts and CollegeDekho course/location discovery links; adapted them as compact navigation rather than copying their complete sections.

- [C1 Course & Tools Strip](design/research-2026-10-06/compact-landing-strips/C1.png): popular-course shortcuts then compact comparison, eligibility, scholarship and career-guide actions. Recommended baseline.
- [C2 City & Guidance Strip](design/research-2026-10-06/compact-landing-strips/C2.png): city shortcuts then exam resources with a restrained help-me-choose prompt.
- [C3 Goal Finder Ribbon](design/research-2026-10-06/compact-landing-strips/C3.png): preference shortcuts then a narrow comparison/career/checklist/save-account ribbon.

Generated using built-in imagegen and the latest full reference attachment. Upper composition retained visually, not pixel-exactly. Lower height reduced significantly against the original reference and E-series proposals; final pixel sizing needs actual viewport review. Exact prompts: [prompts.json](design/research-2026-10-06/compact-landing-strips/prompts.json). Saved all three previews locally. No application changes, no final variant selected. These actions/resources are proposed functionality; incidental tool-generated copy such as trusted resources does not establish verification. Responsive plan if selected: wrap or horizontally scroll the course/city shortcuts while retaining clear link labels, rather than expanding to tall desktop-style blocks on mobile.

## Student content explorations — previous exploration

User rejected both R-series lower sections and requested four more distinct, useful landing layouts after reviewing education platforms. Keep the approved D1 upper header/split hero direction; redesign only the content below it. Public homepage content rechecked: [CollegeDekho](https://www.collegedekho.com/), [Collegedunia](https://collegedunia.com/), [Shiksha](https://www.shiksha.com/), [Careers360](https://www.careers360.com/), [Whatuni](https://www.whatuni.com/) and [UCAS](https://www.ucas.com/). Shiksha exposes comparison by fees/rank/infrastructure; Careers360 exposes college discovery, predictors and exam resources. These are observed content patterns, not evidence of improved conversion. Direct browser evidence from earlier research includes blocked pages; current public text can be read for these sites.

| Static concept | Lower content and student use |
| --- | --- |
| [E1 College Explorer](design/research-2026-10-06/student-content-refinements/E1.png) | Campus listing previews, course/city/budget filters, save and comparison tray; helps start a shortlist |
| [E2 City Explorer](design/research-2026-10-06/student-content-refinements/E2.png) | Photographic study destinations and annual-tuition brackets; helps narrow location and cost preferences |
| [E3 Course & Career Explorer](design/research-2026-10-06/student-content-refinements/E3.png) | Browsable course tiles with eligibility/college links and an example career pathway; helps undecided students research options |
| [E4 Admission Resource Desk](design/research-2026-10-06/student-content-refinements/E4.png) | Compact entrance-exam resource table, application checklist and save/account prompt; helps organize admission research |

Lower surfaces are plain ivory with restrained rose accents, wine section headings, readable metadata and deliberate spacing. Upper composition preserved approximately by generated edits, not pixel-exactly. E1 is the strongest homepage starting point for college discovery; E2 is the most visual location-led alternative. Do not stack all four modules into a dense first screen without further hierarchy review.

E1 uses explicitly fictional sample listings and generated campus photos; no fees, rankings, placements or college identities should be treated as verified data. City landmark images are generated illustrative assets. Resources and actions are concept previews, not implemented services. Before production, clean incidental generated prop slogans, inconsistent comparison-tray placeholder text, typographic sizing and duplicate filters. Actual responsive/interaction checks are pending because this round creates images only. No engagement uplift has been measured.

Built-in imagegen used with D1 as the reference. Exact prompts: [prompts.json](design/research-2026-10-06/student-content-refinements/prompts.json). Four images saved locally; no application code changed or final lower-section theme selected.

## Lower-section refinements — rejected exploration

Latest user supplied D1 Discovery Desk and its lower crop. They approve the upper header/hero and request replacing the lower feature-card row and combined Student essentials/exam panel. This supersedes the earlier preference for the centered L-series hero. Preserve the supplied upper split-hero direction; approval applies to that area, not the entire theme.

Two static image edits using the built-in imagegen tool:

- [R1 Find your fit](design/research-2026-10-06/lower-section-refinements/R1.png): shortlist form with course, annual budget and city; adjacent comparison/career guidance actions; exam-guide strip.
- [R2 Choose your next step](design/research-2026-10-06/lower-section-refinements/R2.png): three student-intent entry points (know my course, comparing options, still deciding), then a slim useful-guides row. Recommended baseline because it avoids repeating the hero search form and gives undecided students a clear route.

Upper composition retained visually; these are generated mockups rather than pixel-exact edits. Lower backgrounds stay white/ivory with restrained rose accents and wine typography. Proposed actions remain unimplemented. Prompt set: [prompts.json](design/research-2026-10-06/lower-section-refinements/prompts.json). All images saved locally; no application code changed.

## Light reference refinements — previous exploration

Latest user feedback rejects heavy illustrated backgrounds and excessive content panels. The newly attached centered Wine reference is the composition to preserve: ivory background, wine serif heading, panoramic student photo and floating search. Theme remains under review.

Rechecked the public homepages of CollegeDekho, Collegedunia, Shiksha and Careers360. Course/exam discovery and guidance resources inform compact navigation additions; no competitor branding copied. This round uses a two-tier header and useful inline shortcuts rather than article/tool grids.

| Image | Useful additions |
| --- | --- |
| [L1 Clean Discovery](design/research-2026-10-06/light-reference-refinements/L1.png) | Field subheader, scholarship link, popular-course chips; closest to reference |
| [L2 Guided Discovery](design/research-2026-10-06/light-reference-refinements/L2.png) | Class 12/graduation/exam entry points, search tabs, marks matching and comparison links |
| [L3 Editorial Clarity](design/research-2026-10-06/light-reference-refinements/L3.png) | Course/exam guide subheader, city search, comparison/scholarship/guidance shortcuts |

Background stays almost entirely plain ivory #FFFAF8, with only faint rose glow or thin corner strokes. Wine #72243B and rose #F2CAD1 remain accents. Intended fonts: DM Serif Display and Plus Jakarta Sans. Static previews generated with built-in imagegen using the latest attachment as the reference; prompts saved in [prompts.json](design/research-2026-10-06/light-reference-refinements/prompts.json). No app code changed. L1 is the recommended baseline; L2 is a useful alternative for students unsure where to start. Final typography, mobile navigation and contrast need actual-size verification before implementation. Proposed services shown are not implemented.

## Content-rich Wine landing concepts — rejected exploration

Latest feedback: earlier hero variants felt empty and pale; retain wine/rose colors but strengthen the header, background and useful student content. Revisited [CollegeDekho](https://www.collegedekho.com/), [Collegedunia](https://collegedunia.com/), [Shiksha](https://www.shiksha.com/) and [Careers360](https://www.careers360.com/) on 6 October 2026. Their public homepage content emphasizes discipline/course discovery, exams, guidance and decision resources. These patterns inform NSEDU's navigation rather than copying their branding.

Scope: static desktop first-screen concepts with header, hero, tool shortcuts and reading resources. No implementation or final theme approval.

| Concept | Layout |
| --- | --- |
| [D1 Discovery Desk](design/research-2026-10-06/wine-discovery-heroes/D1.png) | Split search/photo hero, four tools, horizontal reading and exam strip |
| [D2 Student Launchpad](design/research-2026-10-06/wine-discovery-heroes/D2.png) | Wine navigation band, discipline rail, central search, resource sidebar; highest density |
| [D3 Campus Navigator](design/research-2026-10-06/wine-discovery-heroes/D3.png) | Rose campus illustration, multi-field search, arch-framed students, contrasting matching tool |
| [D4 Editorial Hub](design/research-2026-10-06/wine-discovery-heroes/D4.png) | Exam strip, editorial split hero, photo caption band, tools and article sidebar |

Palette remains ivory #FFFAF8, wine #72243B, rose #F2CAD1 and dark text #2A2024. Intended fonts: DM Serif Display and Plus Jakarta Sans. Proposed header: Colleges, Courses, Exams, Compare, Scholarships, Career guidance, Resources; global search, city selector, login and create account. Tools: marks matching, comparison, budget planning and career guidance. Reading topics are illustrative preview content, not verified current news. These functions are proposals, not working services; eligibility and AI/expert wording in generated images needs qualification before launch.

Design recommendation: D1 for balance and D3 for the strongest education-related background. D2 repeats some discipline links and should be simplified if selected. Remove incidental slogans generated on photographic props and excess margin text before production. Check readability, contrast, responsive hierarchy and visible content at actual viewport sizes. Proposed motion: short image reveal, restrained card hover and search focus feedback, with reduced-motion support. Raster images do not demonstrate animation or measured engagement.

Exact prompts: [prompts.json](design/research-2026-10-06/wine-discovery-heroes/prompts.json). Images saved locally; application unchanged.

## Wine Editorial hero refinements — previous exploration

User partly likes the supplied Wine Editorial reference (about 30%), specifically its landing hero and color/card treatment. It is a direction for refinement, not a locked final theme. Current scope is **header and hero first viewport only**; exclude all lower sections from this round. Earlier full-page and glossy variants are historical proposals.

Four landscape static refinements use the supplied image as a style reference:

| Variant | Composition |
| --- | --- |
| [W1 Editorial Panorama](design/research-2026-10-06/wine-hero-refinements/W1.png) | Centered serif title, wide library photograph, overlapping search dock |
| [W2 Editorial Window](design/research-2026-10-06/wine-hero-refinements/W2.png) | Asymmetric title/search and tall framed student photograph |
| [W3 Campus Edition](design/research-2026-10-06/wine-hero-refinements/W3.png) | Campus panorama with separate course/city/annual-budget search row |
| [W4 Quiet Confidence](design/research-2026-10-06/wine-hero-refinements/W4.png) | Search before imagery, three-panel photographic composition |

Intended palette: ivory #FFFAF8, wine #72243B, rose #F2CAD1, text #2A2024. Intended typography: DM Serif Display with Plus Jakarta Sans; generated raster appearance is indicative. Visual detail: warm photography, very subtle paper texture, fine rules, restrained rose framing and soft search-panel shadow. Generated scenery/text are illustrative, not named real institution assets.

Design judgment: W1 stays closest to the supplied reference; W4 makes search the most immediate first action. Refine decorative side slogans and remove incidental text on photographic objects before production; typography sizing must be checked at actual desktop/mobile viewport sizes. Proposed motion: one short photo fade, button/field focus feedback and a very restrained image hover; reduced-motion support. No continuous effect required. Images are static and no engagement uplift is measured.

Exact prompts: [wine-hero-refinements/prompts.json](design/research-2026-10-06/wine-hero-refinements/prompts.json). All four generated images saved locally; no application code changed and no theme locked.

## Balanced education themes — historical exploration

The user rejected the G1–G4 glossy concepts as excessive and unsuitable for student engagement. All earlier concepts remain historical proposals; no theme is locked. This latest round prioritizes a professional, attractive education experience with restrained visual effects.

### Fresh research and what changed

A fresh Chrome pass revisited 20 education/admissions/career references: CollegeDekho, Careers360, CollegeBatch, Sarvgyan, GetMyUni, CollegeChalo, Vidyavision, CollegeSearch, Buddy4Study, Univariety, Mindler, LeverageEdu, CareerGuide, Yocket, Educations, ApplyBoard, UCAS, Whatuni, Prospects and UniCompare. All returned HTTP 200, but some captured states include cookies, unloaded images or a transient full-image overlay (CollegeChalo); HTTP success alone is not a complete visual load. Univariety is an adjacent institution/alumni service rather than a direct college-discovery competitor. Shiksha and Collegedunia public text was reopened separately; their earlier browser access limitation is retained.

New inspiration review: [Landbook education collection](https://land-book.com/design/website/education) read through web text (Chrome challenge); live browser views of [Corndel](https://www.corndel.com/), [VCASS](https://vcass.vic.edu.au/) and [Readymag for Education](https://readymag.com/students/). These provide current examples, not proof of a universal trend or higher conversion. Captured Corndel uses contained photography with a clear foreground message; VCASS emphasizes typography over campus footage; Readymag uses expressive typography and layout. Adapt hierarchy/composition while keeping NSEDU light and excluding blue branding.

Fresh evidence: [20-site list](design/research-2026-10-06/balanced-concepts/sites.json), [browser records](design/research-2026-10-06/balanced-concepts/browser-evidence.json), [design-reference records](design/research-2026-10-06/balanced-concepts/design-references/browser-evidence.json). Selected mobile/section screenshots are saved alongside desktop images. Existing 32-reference findings remain background research.

### Decisions before drawing

- Search/guidance must be visible on first view; a hero photo supports it instead of dominating the first task.
- Keep an immediate course/city/budget entry and a separate help-me-choose path. Collect detailed marks/exam context progressively.
- Use stable readable surfaces, dark text, a disciplined grid, thin borders and restrained shadows. Glass is optional on one toolbar, not the visual identity.
- Choose a purposeful student/campus visual or actual comparison preview, not unrelated sculptures.
- Keep fees/location and comparison controls consistent; show placement information as pending when unavailable.
- Signup explains saved colleges, continued research and chosen reminders. No forced lead form before exploration.
- News is secondary and dated. Small hover/selection feedback only; no continuous spectacle.
- Engagement and performance remain untested; verify with students and measured implementation rather than judging conversion from an image.

### Four revised concepts

| Concept | Palette | Fonts | Difference |
| --- | --- | --- | --- |
| [B1 Campus Studio](design/research-2026-10-06/balanced-concepts/B1-campus-studio.png) | #FAF9F5 #214B3C #DCE7DF #262B27 | Manrope / Inter | Copy, central search form and campus photo; useful comparison preview. |
| [B2 Next Chapter](design/research-2026-10-06/balanced-concepts/B2-next-chapter.png) | #FFFBF8 #753B57 #F0DCD1 #2C252A | Instrument Sans / DM Sans | Panoramic student photo with search dock; asymmetric featured college composition. |
| [B3 Clear Choice](design/research-2026-10-06/balanced-concepts/B3-clear-choice.png) | #FFFFFF #B4472D #F7E9D8 #252321 | Plus Jakarta Sans / Source Sans 3 | Search plus comparison preview; compact readable college list. |
| [B4 Student Atlas](design/research-2026-10-06/balanced-concepts/B4-student-atlas.png) | #FCFAF1 #59603A #EEE7C9 #292B22 | Outfit / Lato | Centered discovery search and course-photo mosaic; calm olive/ivory. |

**Design recommendation:** B2 for the strongest balance of student imagery and professional hierarchy; B4 for immediate course discovery and warmth. B3 is the most utilitarian comparison-first option. These are design judgments, not measured engagement scores; no automatic selection.

Motion proposals: B1: Selected cards rise 2px; saved check 180ms. B2: Photo fades once; tabs crossfade 160ms. B3: Compare highlights 180ms; hover outline. B4: Tiles lift 2px; category underline slides. Support reduced motion and equivalent keyboard-focus states when implemented.

Exact intended specs/prompts: [prompts.json](design/research-2026-10-06/balanced-concepts/prompts.json). The images are static generated concepts; fonts/colors can be approximate, and small generated labels can vary. College data and dated articles are explicitly demonstrations. The campus photos are illustrations of the proposed treatment, not sourced photographs of named real institutions. Before implementation refine the selected hero and cards at desktop/mobile size, validate contrast/font licensing, remove unnecessary repeated save controls and clarify marks denominator/exam type. Application code remains neutral and unchanged.


## Glass and spatial theme exploration — rejected exploration

The user rejected all six previous concepts as basic and requested stronger contemporary visuals, glass effects and attractive backgrounds. Those six are exploration history, not selected themes. Four new static concepts are being explored; no frontend changes or theme lock.

| Concept | Visual direction | Fonts | Intended palette |
| --- | --- | --- | --- |
| G1 Pearl Prism | Refractive pearl/lilac sculpture, floating search dock | General Sans / Inter | #FAF7F5 #E6D3EF #713A81 #25212C |
| G2 Citrus Lens | Optical lime lens, bold type, comparison strip | Neue Montreal / DM Sans | #FFFDF3 #E8F2A5 #657522 #24271C |
| G3 Rose Aperture | Layered rose-glass arch, suspended finder | Clash Display / Manrope | #FFF7F4 #F6D5D8 #AC354D #2F2027 |
| G4 Mono Chrome | Silver/amber sculptural pathway and shortlist console | Unbounded / IBM Plex Sans | #F6F5F2 #DDD9D2 #EE7047 #232323 |

Reference direction: [Apple's Liquid Glass description](https://www.apple.com/os/pdf/All_New_Features_iOS_26_Sept_2025.pdf) documents reflection, refraction and layered controls. This is a visual inspiration adapted to a college platform, not evidence that the style increases student registration or is unique to NSEDU.

Keep glass on navigation, decorative layers and panel edges; text/input content needs a stable readable surface. Search/marks/budget/city, college comparisons, AI guidance and saving a shortlist remain useful entry points. Motion proposals are slow decorative refraction/rotation and short selection feedback, with reduced-motion support; static images do not demonstrate working animation or measured performance.

All four images are complete and saved in [glass-concepts](design/research-2026-10-06/glass-concepts/). Prompts: [prompts.json](design/research-2026-10-06/glass-concepts/prompts.json). Generated college names, ratings, counts, accreditations, news and dates are illustrative placeholders and must not be published as facts. Intended font names and palette specifications are authoritative over approximate raster labels. Check font availability/licensing before implementation.

## New theme research — 6 October 2026

Current scope: research and static mockups only. No new theme selected or applied. Application stays neutral.

### Coverage

32 public first-party references attempted: **21 browser renders, 11 security/access blocks**. Readable web text supplemented blocked sites; no visual/font conclusions drawn from security pages. Selected 390×844 mobile and 1440×1000 desktop/lower-page captures are in [research folder](design/research-2026-10-06/). This is a homepage study, not a complete feature or conversion audit. No registration/application submitted.

| Reference | Evidence | Observations |
| --- | --- | --- |
| Shiksha | Text; browser403 | Dense course taxonomy; comparison, predictors, current-student Q&A; exact visual/font not verified. |
| CollegeDekho | Desktop/mobile | Navy/orange photo-video hero; two actions; journey and guidance tiles; system font stack. |
| CollegeDunia | Text; browser403 | Goal/city selection, program tabs, course finder, scholarships, reviews and news; visual not verified. |
| Careers360 | Desktop/mobile | White search header, lilac split hero, orange CTA, predictor promos, news and counselling; Arial. |
| GetMyUni | Desktop/mobile | Blue header, campus carousel, tabbed search, city discovery and scholarships; system sans. |
| CollegePravesh | Text; browser403 | Institution/exam information reference; challenge page is not brand UI. |
| CollegeBatch | Desktop | Very large campus photo/search hero; recently updated profiles and reviews; Roboto. |
| Vidyavision | Desktop | Two navigation tiers, campus hero, results and admissions blocks; Arial. |
| Sarvgyan | Desktop | Article-led cards/carousel and course-career articles; Poppins/system stack. |
| CollegeSearch | Desktop/mobile | Graphite navigation, course-location search, preferred-course panel, compact news cards; Roboto. |
| CollegeChalo | Desktop | Centered blue search hero, live application cards, stream/news/scholarship sections; Poppins. |
| Buddy4Study | Desktop/mobile | Scholarship-first search, banners and opportunities; Poppins; floating WhatsApp overlaps content in captured mobile state. |
| Mindler | Desktop/mobile | Centered assessment hero, career illustration, stage-specific programs, AI prompt; Open Sans. |
| iDreamCareer | Text; browser403 | Career-guidance reference only; challenge prevents reliable visual comparison. |
| Univariety | Desktop | Current home is institution/alumni oriented; B2B adjacent reference, not direct college-search competitor; Jost. |
| CareerGuide | Desktop/mobile | AI/assessment positioning, watercolor rocket hero and counselling paths; Inter/Noto Sans Devanagari. |
| Yocket | Desktop/mobile | Graduation photo hero, expert guidance and product dashboard previews; Satoshi; sticky eligibility bar. |
| LeverageEdu | Desktop | Editorial serif photography hero, consultation CTA and study/work paths; Source Serif Pro/Proxima Nova/Rubik. |
| IDP | Browser403; web fetch failed | No current UI conclusions drawn. |
| ApplyBoard | Desktop/mobile | Student cutout shapes, prominent registration action, application benefits; Montserrat/Open Sans; cookie overlay captured. |
| Bachelorsportal | Text; browser403 | Degree discipline filters, personalized suggestions and study tools; no visual conclusions. |
| Mastersportal | Text; browser403 | Explore/compare/apply journey, saved recommendations, Sophia AI advisor; no visual conclusions. |
| Educations | Desktop/mobile | Subject/destination inputs, subject cards, matching quiz; Poppins/Open Sans; mobile cookie dialog obscures hero. |
| HotcoursesAbroad | Browser403; web fetch failed | No current UI conclusions drawn. |
| SI-UK / StudyIn | Text; browser403 | Redirected to StudyIn; counselling reference; visual blocked. |
| StudyLink / Goingto.University | Text; browser403 | Redirected education-journey resource; visual blocked. |
| Studyportals | Desktop | Institution/student audience split; adjacent parent-company reference; Plus Jakarta Sans. |
| Niche | Text; browser403 | Fit quiz, personal list, reviews and compare; direct-admissions offering exists but cannot be promised by NSEDU. |
| UCAS | Desktop + text | Search-led course/university/career journey, dates/funding and account CTA; cookie overlay captured; Roboto. |
| Prospects | Desktop + text | Career-first matching quiz and clear job/study paths; Ne10 simplified/Source Sans Pro; cookie overlay captured. |
| Whatuni | Desktop + text | Course/university search, student-choice rankings, open days and scholarship navigation; Farro/Inter; cookie overlay. |
| UniCompare | Desktop + text | Course/degree-level search, university photos, favorites and guides; Outfit. |

Evidence files: [browser observations](design/research-2026-10-06/browser-evidence.json), [additional references](design/research-2026-10-06/extra-evidence.json), [findings and limitations](design/research-2026-10-06/research-findings.json). Computed font-family is a CSS declaration, not a verification of every downloaded font. Animation counts are snapshots, not complete animation descriptions.

### Findings and NSEDU decisions

- **Comparison, predictors and AI are not unique by themselves:** [Shiksha](https://www.shiksha.com/) lists predictors/comparison/Q&A, [Collegedunia](https://collegedunia.com/) lists course finder/scholarships, and [CareerGuide](https://www.careerguide.com/) and [Mastersportal](https://www.mastersportal.com/) present AI guidance. Differentiate through clarity, transparent data and connected planning.
- **Two entry paths:** known course → direct search; confused student → guided questions. [Educations](https://www.educations.com/) offers search and matching, while [Mindler](https://www.mindler.com/) foregrounds career discovery.
- **Registration should preserve useful work:** saved colleges, priorities and deadlines, with browsing before login. [UCAS](https://www.ucas.com/) and [Niche](https://www.niche.com/) connect personal accounts to planning. Conversion improvement remains a hypothesis.
- **College cards:** name/course, city, clearly labeled annual tuition versus total cost, placement metric with cohort/year/source, eligibility context, save and compare. Show unknown values; distinguish average/median/highest placement salary.
- **Recommendations:** explain budget/location/interest tradeoffs. Marks alone cannot determine admission or career; request stream, exam/score type and other relevant context.
- **News:** quiet dated/source-linked cards. Separate confirmed deadlines from general articles; avoid competing tickers around the primary action.
- **Mobile:** captured cookie dialogs/sticky contact widgets sometimes obscure content; keep the primary search and form accessible.
- **Visuals:** campus imagery helps exploration; student imagery adds aspiration; product previews explain use. Use strong hierarchy and restrained graphics rather than a feature wall.

### Six distinct concepts

All use light backgrounds and no blue brand color. Each image shows landing sections, fonts, hex swatches, cards/states, motion proposal and a mobile hero crop.

| # | Theme | Fonts | Intended experience |
| --- | --- | --- | --- |
| 1 | [Emerald Route](design/research-2026-10-06/themes/01-emerald-route.png) | Manrope headings, Inter body | Search first; isometric campus and leaves. |
| 2 | [Wine Editorial](design/research-2026-10-06/themes/02-wine-editorial.png) | DM Serif Display headings, Plus Jakarta Sans body | Premium editorial photography. |
| 3 | [Graphite + Saffron](design/research-2026-10-06/themes/03-graphite-saffron.png) | Space Grotesk headings, Source Sans 3 body | Practical shortlist and comparison. |
| 4 | [Plum Compass](design/research-2026-10-06/themes/04-plum-compass.png) | Sora headings, Nunito Sans body | Guided questions for confused students. |
| 5 | [Ruby Paper](design/research-2026-10-06/themes/05-ruby-paper.png) | Outfit headings, IBM Plex Sans body | Student collage and stronger visual energy. |
| 6 | [Cocoa + Orchid](design/research-2026-10-06/themes/06-cocoa-orchid.png) | Fraunces headings, DM Sans body | Calm connected college plan. |

Exact intended palettes and generation prompts: [theme-prompts.json](design/research-2026-10-06/theme-prompts.json). Font rendering and hex labels in generated images are indicative; this JSON is authoritative if a small label differs.

**Recommendation:** 03 Graphite + Saffron for information clarity, 04 Plum Compass for the guided journey; 05 Ruby Paper if stronger student visuals are preferred. None is locked.

Section plan: header → search/guidance hero → course/intent choices → marks/budget/city finder → college cards → compare preview → AI career guide → scholarships/deadlines/articles → save-plan registration CTA → light footer. Order varies by theme entry path.

### Proposed lightweight motion

- **Emerald Route:** Leaves sway 6s; route draws once; card hover rises 3px.
- **Wine Editorial:** Photo reveal once 450ms; saved heart fills 180ms; cards fade up once.
- **Graphite + Saffron:** Priority chips slide 180ms; comparison bars grow once; hover border appears.
- **Plum Compass:** Compass tilts 4deg slowly; selection check 160ms; result preview slides 220ms.
- **Ruby Paper:** Ribbon gently shifts 6px; course tile icon nudges on hover; saved check appears.
- **Cocoa + Orchid:** Bookmark sways 4s; plan connector draws once; selection crossfade 180ms.

These are static storyboards, not working animations. Prefer restrained transform/opacity effects; stop decorative loops offscreen; support reduced motion; never animate reading text continuously or make hover required. Keyboard focus must convey equivalent states. A swaying-leaf graphic need not require a heavy 3D engine. Performance has not yet been measured.

### Review before implementation

Choose one direction, then refine header/hero, college cards and comparison at real desktop/mobile sizes. Check actual contrast, keyboard focus, touch targets and responsive readability. Ask students to find a course, interpret a recommendation and save a shortlist; do not assume an attractive image guarantees registration.

Images use fictional colleges and demo fees/articles. Generated small text, totals, dates and labels can be inconsistent; replace with researched content before publishing. No real affiliation, live admission prediction, conversion uplift or worldwide design-uniqueness claim is implied. App code remains unchanged during this research.

## Previous implementation and visual status — historical

User has **rejected and removed the previously selected terracotta/pistachio theme from the application**. No replacement theme is selected. Its landing-page UI, custom fonts/colors, cards and leaves motion have been removed. Frontend now renders only a neutral placeholder. Rejected images and screenshots were moved out of active folders into `design/archive/rejected-theme-p/`; permanent deletion commands were blocked by automatic policy review. Earlier theme discussions below are historical research, not active decisions; old preview links are historical references.

At this earlier stage the scaffold used Angular frontend, JavaScript Node.js/Express backend and an optional MongoDB connector. Angular source and the earlier style entry are now archived under `design/archive/angular-scaffold/`; current Next.js implementation is described above.

### Simple folder structure

```text
frontend/
  public/                 # Static assets for the next design
  src/app/
    components/           # Reusable UI components
    data/                 # Content when needed
    pages/home/           # Neutral placeholder
  src/styles/index.scss   # Central style/theme entry
backend/
  src/config/             # Environment and optional MongoDB connection
  src/routes/             # Health endpoint
  src/app.js              # Express application
  src/server.js           # Server startup
  test/                   # API checks
design/archive/           # Rejected design references, not application assets
```

Historical Angular preview used frontend port 4200 and API port 3000. Current Next.js/Express ports and commands are documented at the top of this README.

## Abhi ka scope

Research ke baad implementation start hua. Earlier rejected theme archive mein hai. Ab approved Wine + Warm Taupe reference ke according Next.js student landing page implemented hai; backend Node.js/Express JavaScript hai. Agla kaam verified college data aur student account/application flows hai.

Ye README project ka living research document hai. Aage NSEDU ke related research aur agreed decisions isi file mein update honge. Proposed ideas ko confirmed decisions se alag rakhenge.

## Project vision aur confirmed direction

NSEDU India ke students ko colleges/universities discover, understand, compare aur shortlist karne mein help karega. Inspiration Shiksha jaisa platform hai, lekin aim student ko apni priorities ke hisaab se informed decision lene mein better help dena hai.

- Long-term content target: 2,000+ colleges/universities. Data collection planned hai; abhi records collect ya verify nahi hue hain.
- College profiles mein fees, infrastructure, courses, location aur placements ki information hogi.
- Students multiple institutions compare kar sakenge.
- Suggestions budget, location, course/field, placement preference aur individual priorities par based honge.
- Student mobile number ya email se login kar sakega.
- Student selected college/course ke liye ek form submit karega; details admin ko milengi.
- Admin request manage kar sakega. Detailed admin operations baad mein decide honge.
- Har listed college par interest/request submit karna aur institution ko official admission application bhejna alag actions hain. Official submission ka claim tabhi hoga jab institution ka supported admission process confirmed ho.

## Competitor research — initial findings

Ye public pages ka initial review hai, full feature audit nahi. Kisi website par feature na milna us feature ke absent hone ka proof nahi hai. Marketing claims independently verified nahi hain.

| Website | Public pages par kya mila | NSEDU ke liye research takeaway |
| --- | --- | --- |
| [Shiksha](https://www.shiksha.com/) | College discovery, comparison, predictors, student/expert guidance | Comparison aur suggestions baseline features hain; decision quality improve karni hogi. |
| [CollegeDunia](https://collegedunia.com/?arc=1) | College/course discovery, comparison aur college predictor | Profile depth, navigation aur comparison journey study karein. |
| [CollegeDekho](https://www.collegedekho.com/common-application-form) | Common application form; page 2,000+ partner colleges aur application tracking advertise karta hai | One-form application concept already market mein hai; coverage aur actual submission meaning clearly explain karna hoga. |
| [Careers360](https://www.careers360.com/commonform) | Common form, NIRF-based comparison, counselling aur personalized recommendations | Advice ko supporting evidence se connect karna useful benchmark hai. |
| [Careers360 predictors](https://university.careers360.com/college-predictor) | Rank/category-based suggestions aur previous round-wise cutoffs | Admission suggestions mein student context aur historical cutoff year zaroori hai. |
| [College Pravesh](https://www.collegepravesh.com/engineering-colleges/uvce-bangalore/) | Sample engineering profile mein fees, opening/closing ranks aur placement details | Structured, focused course information ka benchmark. |
| [GetMyUni](https://www.getmyuni.com/about-us) | College/course information, forums aur student reviews describe karta hai | Student experience content aur review quality study karein. |

Next comparison shortlist: official university admission portals, government/state counselling portals aur scholarship portals. Inka detailed audit pending hai.

## Student problems aur possible differentiation

Neeche ke gaps research hypotheses hain. Inhe student interviews aur competitor journeys se validate karna hai; ye confirmed competitor shortcomings nahi hain.

| Student ka question/problem | NSEDU ka proposed response | Content/evidence needed |
| --- | --- | --- |
| Mere budget mein degree ka actual total kharcha kya hoga? | Tuition + mandatory charges + hostel/mess + living/travel estimate; one-time aur recurring costs separate | Course fee notice, hostel fees, academic year, estimate assumptions |
| Highest package dekhkar college choose karna sahi hai? | Median, average, highest package, placed students aur batch size clearly distinguish karein | Placement report, cohort/year, denominator, course/branch scope |
| College acha hai, par mera chosen course kaisa hai? | Course/branch-level comparison, curriculum, labs, internships aur outcomes | Course pages, curriculum, branch-specific reports where available |
| Mere marks/rank par realistic options kaunse hain? | Eligibility check aur historical cutoff-based ambitious/target/safer shortlist | Exam, rank, category, domicile/quota, round aur year; outcome guarantee nahi |
| Mere liye ye college recommend kyun hua? | Recommendation ke reasons, tradeoffs aur missing information explain karein | Student priorities + comparable, sourced college facts |
| Information purani ya conflicting ho to? | Source link, applicable academic year, last checked date aur conflict note | Original notice/report and verification history |
| College ka real student experience kya hai? | Structured reviews: academics, support, hostel, accessibility, campus life | Review date, course/batch context, verification method and moderation policy |
| Apply karne ke baad kya hua? | Student ko request status aur next action visible ho | Clear request/application labels, process steps and responsible contact |
| Recommendations paid promotion hain kya? | Sponsored results visibly label; academic suggestions ke reasons disclose | Editorial and sponsorship policy |
| Mujhe unwanted calls nahi chahiye | Contact preferences aur chosen colleges ke saath data sharing ka clear choice | Plain-language consent and communication policy |

## Proposed student features

### Priority 1 — core content and decision journey

- Search by institution, course, specialization, city/state and institution type.
- Filters: total budget, tuition fee, location, eligibility, exam accepted, study mode and hostel availability.
- Structured college profiles with source links, academic year and verification date.
- Compare 2–4 college-course options side by side; same year/scope where possible.
- Comparison dimensions: total cost, eligibility, cutoffs, placements, curriculum, infrastructure, hostel and location.
- Unknown data ko `Not available` dikhayein; missing value ko zero na samjhein.
- Shortlist/save colleges; student apni priorities set kar sake.
- Personalized suggestions with explanation: match, tradeoffs, missing data.
- Login with mobile/email; exact authentication approach later.
- Reusable student profile/form; selected institution and course explicitly confirm hon.
- Interest/request receipt aur simple status visibility.

### Priority 2 — stronger guidance

- Scholarship eligibility, deadlines, required documents and official source links.
- Admission timeline, reminders and document checklist.
- Budget/location scenarios: ghar se commute vs hostel; nearby vs another state.
- Hindi + English explanations; education/admission terms ki simple glossary.
- Course-to-career explainers and related course alternatives.
- Parent-friendly comparison summary that students can share.
- Structured student reviews, FAQs and current student/alumni Q&A.

### Later research ideas

- Detailed historical cutoff explorer and counselling preference guidance.
- Campus visit/open-day information.
- Accessibility, student support and grievance information.
- Alumni outcomes and internship quality, where reliable evidence exists.
- Data correction/report-an-error option.

Priority labels planning suggestions hain, approved development backlog nahi.

## Recommendation content principles

- Ek universal “best college” list ke bajay “best fit for this student” explain karein.
- Pehle constraints: course, eligibility, budget and location. Phir preferences: placements, infrastructure, campus life etc.
- Student placement ko priority de sakta hai; doosra affordability ya ghar ke paas rehne ko. Dono ke results different ho sakte hain.
- Har suggestion ke saath: why it fits, main compromise, source freshness and unknowns.
- Ranking mein category aur year dikhayein; overall rank ko course quality ka direct proof na banayein.
- Historical cutoffs future admission ki guarantee nahi. Data insufficient ho to precise probability invent na karein.
- Sponsorship ko fit score ya editorial ranking mein silently mix na karein.

## College/university content checklist

| Content group | Collect karne wale main points |
| --- | --- |
| Identity | Official name, aliases, institution type, campus, city/state, affiliation, official website |
| Recognition | Relevant authority, recognition/approval/accreditation scope, source and validity where published |
| Courses | Course name, degree, specialization, duration, mode, campus, seats where published |
| Admissions | Eligibility, accepted exams, selection process, quota/category applicability, deadlines, official apply link |
| Fees | Course/year, tuition, mandatory fees, one-time charges, deposits and refundability, hostel/mess, official refund policy |
| Cutoffs | Exam, course/branch, category, quota, round, opening/closing rank or score, year |
| Placements | Cohort/year, course scope, graduates/eligible/participating/placed counts as reported, median/average/highest salary, recruiters |
| Infrastructure | Course-relevant labs, library, hostel, internet, accessibility, sports, published campus facilities |
| Scholarships | Eligibility, amount/benefit, renewal conditions, deadline, official application source |
| Student life | Course/batch-specific reviews, campus rules, support services, nearby transport and estimated living cost |
| Provenance | Per-fact source URL, source/report year, checked date, verification status, conflicts and missing fields |

Placement percentage ka denominator explicitly record karein. NIRF program-level data ko branch-level placement claim na banayein. Highest CTC ko typical salary ya take-home income na label karein.

## Data collection approach — research only

- Competitors se feature/content structure study karein; published college facts ko official sources se verify karein.
- Preferred sources: institutional course pages, prospectuses, fee notices, admission notices, placement reports and official counselling publications.
- [UGC university directory](https://www.ugc.gov.in/universitydetails/university/?type=0wBmFB1Rb4JGVzq9UP%2FiOg%3D%3D) institution identity/recognition research ka source hai; program approvals ko separately verify karna hoga.
- [NIRF published rankings](https://www.nirfindia.org/Rankings/2025/Ranking.html) year/category ke saath reference ho sakte hain. Linked 2025 edition initial reference hai, latest-edition claim nahi.
- [Example NIRF institution submission](https://www.nirfindia.org/nirfpdfcdn/2025/pdf/Engineering/IR-E-U-0535.pdf) graduates, placed students aur median salary jaise structured fields dikhata hai; institution-reported scope retain karein.
- Institution, affiliated college aur separate campus ko duplicates ke taur par accidentally merge na karein.
- Facts ka structured summary collect karein; third-party descriptions, photos aur reviews reuse karne se pehle permitted use check karein.
- Automated collection future phase mein source access conditions ke according plan hogi. Abhi scraper build/run nahi karna.
- Conflicting values ko flag karein. Missing values estimate karke factual field mein fill na karein.
- Pehle 25–50 diverse institutions ka content pilot propose hai; quality checklist validate karke 2,000+ coverage expand karein.
- Coverage progress aur verified coverage separate count hon. Listing present hone ka matlab complete/verified profile nahi.

## Student form and admin — high-level concept only

Proposed journey: explore → compare → shortlist → login → select college/course → submit form → admin receives request → student sees next step/status.

Initial form content: name, mobile/email, current qualification, intended course/intake, selected college/campus, relevant marks/exam details, location/budget preferences and contact/data-sharing choices. Detailed documents tabhi maangein jab particular process ko zaroorat ho.

Admin ko student details, selected institution/course, submission date, request status and follow-up notes mil sakein. Possible statuses: received, under review, more information needed, counselling scheduled, closed. “Submitted to institution” aur “admitted” sirf confirmed evidence par use hon.

Admin permissions, integrations, payments, document storage aur operational workflows later scope hain.

## Next research tasks

- [x] Initial project scope and user direction capture.
- [x] Seven relevant education websites ki initial reference list.
- [x] Initial differentiation hypotheses, content checklist and feature priorities.
- [ ] Four main competitors ka same-course/same-city journey audit: discovery → compare → suggestion → apply.
- [ ] 10–15 students/parents se interviews; hypotheses validate karein, complaints assume na karein.
- [ ] 25–50 institutions ka proposed pilot select karein across locations, budgets and institution types.
- [ ] Pilot ke liye official-source content samples collect aur verify karein.
- [ ] Total-cost, placement, comparison and recommendation explanation ke content formats finalize karein.
- [ ] Initial streams/geography and target student segment decide karein.
- [ ] Request form vs official application support ka operating scope decide karein.

Interview prompts: last college search mein sabse confusing kya tha; kis information par trust nahi hua; actual budget kaise calculate kiya; compare karte waqt kaunsi details missing thi; recommendation ki explanation kya chahiye; application ke baad kaunsa status useful hoga; contact sharing par kya preference hai?

## Open decisions

- Initial focus UG, PG ya dono? Engineering/management se start ya broader streams?
- Nationwide listing se pehle specific states/cities ka deep verified coverage?
- First release mein guidance requests only, supported partner applications, ya dono clearly separated?
- Recommendation priorities ka student-facing format kya ho?
- Verification/update cadence aur correction ownership kya ho?

## Expanded gap-to-feature shortlist — 6 October 2026

Student-facing opportunities below are hypotheses, not proven features absent from every competitor. Public pages reconfirmed: [Shiksha comparison](https://www.shiksha.com/compare), [CollegeDekho common form/tracking](https://www.collegedekho.com/common-application-form), [Careers360 contextual predictors](https://university.careers360.com/college-predictor). Comparison, tracking and predictors themselves are baseline capabilities.

| Proposed feature | Student benefit and content requirement |
| --- | --- |
| Full-degree budget planner | Compare full-course tuition, mandatory charges and living costs; show verified fees separately from estimates and potential increases. |
| Explainable personal shortlist | Match course, eligibility, total budget and location; student controls priorities and sees reasons/tradeoffs. |
| Course-versus-college decision guide | Explain options such as preferred branch at one institution versus another branch elsewhere using curriculum and relevant outcomes. |
| Placement evidence card | Label year, branch/program scope, median, count placed and denominator; flag unsupported promotional claims. |
| Scholarship-adjusted affordability | Show confirmed eligibility/benefit separately from conditional scholarships, renewal rules and deadlines. |
| Evidence and freshness labels | Per-fact official source, applicable year, checked date, missing/conflicting information and correction path. |
| Local study versus relocation comparison | Compare commute/hostel, travel time, transport and estimated living cost with assumptions. |
| Admission action checklist | Per shortlisted course show eligibility, documents, official deadline and student's next step. |
| Student-controlled contact | Public discovery without mandatory login; login for saved profile/applications; opt-in college sharing and contact preferences. |
| Meaningful student experience | Structured course/batch reviews, hostel rules, lab access, support and verified student Q&A with moderation. |
| Scholarship/deadline/fee change watchlist | Alert on verified updates relevant to saved colleges; include official notice and effective year. |
| Parent discussion summary | Share a shortlist with costs, reasons, compromises, evidence and pending decisions. |
| Application clarity | Distinguish request received by NSEDU, institution submission confirmed, document pending and official outcome. |
| Sponsored-result transparency | Label promotion and explain editorial recommendation criteria. |

Recommended first differentiation bundle: total-cost clarity, course-level comparison, explainable fit, evidence/freshness and clear next steps. Additional features follow after content validation. Suggested student journey: enter goals/preferences → see reasoned shortlist → compare actual costs and outcomes → save options → request guidance/apply through supported route → follow next steps.

## AI guidance, news and broader student journey — proposed expansion

User direction: include landing-page current news/articles, marks-based course suggestions, AI career guidance and confusion solving connected to college suggestions. These are research/content proposals, not implemented capabilities.

### Landing-page content proposal

1. Search and entry actions: Find a college, Find a course, Confused about career?
2. Important current updates: admissions opening/closing, exams, counselling, scholarships; each item includes official source, publish/update date, relevant intake and student's next action. Confirmed notices and expected dates must be distinguished.
3. Explore courses by field, eligibility, interests and study goals; popularity and personal suitability use separate labels.
4. Colleges by location, affordability, course and documented outcomes.
5. Career explainers, practical guides, course comparisons and student stories.
6. After preferences are known, show relevant updates and suggestions; generic visitors see clearly labeled general content.

### Proposed guidance features

| Feature | Student problem and intended output |
| --- | --- |
| Marks + subjects course finder | Use qualification, subject combination and marks for eligibility, then interests/goals/budget for suitability; never imply marks alone determine best career. |
| AI career guide | Ask short, relevant questions; present 3–5 possible pathways with reasons, course requirements, colleges and next steps. |
| Confusion solver | Handle BCA vs B.Tech, BBA vs B.Com, course vs college, nearby vs relocation, job vs further study using student context and explicit tradeoffs. |
| Career-to-course map | Start from a desired role and show relevant degree/diploma routes, prerequisites, skills and alternatives. |
| Course preview | Explain actual subjects, sample tasks, learning demands and daily work examples before recommending a field. |
| What-if exploration | Let students change budget, city, course or rank assumptions and see how shortlist reasons change. |
| Plan B finder | Suggest relevant alternative routes when entrance results, affordability or deadlines rule out the first plan. Verify route-specific eligibility. |
| Personal next-step plan | Summarize shortlisted courses/colleges, pending questions, required exams/documents and upcoming deadlines. |
| AI college-page assistant | Answer questions using sourced institution/course information; identify year, uncertainty and missing facts. |
| Human counsellor escalation | Offer handoff when student requests it or guidance remains unresolved; availability and operational scope pending. |
| Student/parent discussion aid | Compare competing priorities in a shared summary without deciding on the student's behalf. |

### Guidance content standards

- Career exploration and admission eligibility are distinct. Eligibility uses current institution/exam rules; career fit includes interests, goals and constraints.
- AI answers about fees, dates, eligibility, approvals and placements require cited, dated evidence. Missing information must be disclosed rather than invented.
- Casual interest questions are exploratory; do not label them a validated psychometric assessment without a suitable validated instrument and qualified interpretation.
- Suggestions support student decisions; no guaranteed admission, employment or fixed salary claims.
- News/articles and career profiling exist in competitor offerings: [Shiksha articles](https://www.shiksha.com/articles-all-327), [CollegeDekho Career Compass](https://www.collegedekho.com/psychometric-test), [Careers360 guidance campaign](https://www.careers360.com/campaign/career-guidance). The Careers360 page says registration ended; it is a reference to an advertised offering, not proof of current availability.
- Proposed differentiation is a connected, explainable journey: confusion → pathways → eligible courses → suitable colleges → verified comparison → next steps.
- Broader positioning: help with college discovery, career exploration and admission planning. Do not promise to solve every student problem.

## Tech-stack discussion and frontend-first direction

User proposal: Angular frontend, Node.js + Express backend in JavaScript (not TypeScript), MongoDB database. Pehle frontend design par kaam karna hai. Stack discussion ongoing hai; exact versions and additional services not finalized.

- Important clarification: modern Angular ka standard CLI/tooling TypeScript-based hai. [Official compatibility table](https://angular.dev/reference/versions) supported TypeScript and Node.js ranges specifies karta hai. Recommended fit: Angular frontend in TypeScript, Node.js/Express backend in JavaScript. Frontend language exception needs clarification before Angular scaffolding.
- Agar JavaScript-only preference frontend par bhi apply hoti hai, Angular choose karne se pehle alternative framework discuss karein; silently TypeScript project create na karein.
- Recommended styling starting point: custom responsive CSS with reusable colors, typography, spacing, buttons and cards. Additional component/CSS library optional and pending.
- Public college/course/article pages ke liye SEO rendering plan early include karein: prerender stable published pages and SSR where request-time content needs it. Student/admin dashboards can use client rendering. [Angular rendering guidance](https://angular.dev/guide/routing/rendering-strategies).
- Node runtime: supported LTS release compatible with chosen Angular version; pin exact version at setup, not now. [Node release policy](https://github.com/nodejs/Release).
- MongoDB is a reasonable proposed fit for institution/course content, but schema validation, indexes and relationships must be deliberate. College identity/campus/course/year should stay distinguishable; [MongoDB modeling guidance](https://www.mongodb.com/docs/manual/data-modeling/embedding/).
- Later services to decide by need: file/object storage for media/documents, email/SMS provider for verification and reminders, search improvements and server-side AI provider. No provider selected now.
- Frontend prototype should use clearly labeled sample data; APIs, authentication and AI integrations follow later. AI secret credentials remain server-side.
- Suggested design sequence: visual style and mobile layout → landing page → college listing/filter view → college detail → comparison → guidance flow → student forms/dashboard → admin views later.

## Landing-page visual research and theme proposals

Date: 6 October 2026. User explicitly requested detailed theme/UI research and suggestions only, with a light background. No frontend implementation, framework installation or landing-page mockup was created. The following is a proposed design direction, not an approved theme.

### Research method and limitations

- Public homepage content reviewed for Shiksha, CollegeDekho, Careers360, CollegeDunia, GetMyUni and Bachelorsportal.
- Browser screenshots visually inspected for CollegeDekho and Careers360 desktop hero, middle sections, footer and mobile hero; GetMyUni desktop hero inspected.
- Desktop viewport: 1440 × 1000; mobile viewport: 390 × 844. This is a targeted visual review, not a full interaction/accessibility/performance audit.
- Shiksha and CollegeDunia direct browser access was denied; Bachelorsportal returned a Cloudflare challenge. Their exact current colors/fonts/layouts were not visually verified. Text-based content structure was available through web research.
- Screenshots are temporary research files outside the repository, under the operating-system temp directory `nsedu-visual-research`. They are observations of pages at inspection time; rotating banners may differ later.
- These samples reveal current patterns, not market-wide trend prevalence or measured student preference. Attraction and usability need later student testing.

| Reference | Observed pattern | Proposed NSEDU takeaway |
| --- | --- | --- |
| [CollegeDekho](https://www.collegedekho.com/) | Dark navy header, orange actions, student-photo hero; white lower sections and explicit career/admission guidance blocks; dark multi-column footer. Mobile hero stacks text, actions and image. | Use human warmth and clear guidance entry; retain NSEDU's requested light header/background rather than copying the dark brand treatment. |
| [Careers360](https://www.careers360.com/) | White search header, pale lavender hero, orange action accents, predictor panel, prominent news panel, illustrated guidance/data sections; dark footer. Mobile stacks search, feature panel and news. | Strong search and relevant updates should be easy to find; use one clear hero composition and manageable section density. |
| [GetMyUni](https://www.getmyuni.com/) | Blue top navigation, campus-photo hero with dark overlay, Colleges/Exams/Courses search tabs, trending links and image-led featured college cards. | Intent tabs and authentic campus imagery can support discovery; college-card data needs a consistent independent layout. |
| [Shiksha](https://www.shiksha.com/) | Text review: extensive stream/course/location navigation, comparison, predictors and guidance. Exact visual design not verified. | Keep content depth reachable through grouped menus, while main landing-page navigation remains concise. |
| [CollegeDunia](https://collegedunia.com/) | Text review: broad college/course discovery, comparison and predictor routes. Exact visual design not verified. | Discovery tools need a clear path; homepage should show a selected subset with links to deeper listings. |
| [Bachelorsportal](https://www.bachelorsportal.com/) | Text review: degree search, fields of study, study matching and articles. Exact visual design not verified. | Course-first browsing should sit alongside college-first browsing. |

### Three proposed light-theme directions

| Direction | Base | Brand/action | Supporting accent | Intended character |
| --- | --- | --- | --- | --- |
| A — recommended: blue + peach | `#F7F9FC` and white | Royal blue `#3157D5` | Soft peach `#FFF0E6`; apricot `#FFB86B` | Crisp, approachable education platform with warm guidance sections. |
| B — teal + warm sand | `#FAFAF6` and white | Deep teal `#087F8C` | Sand `#F4E9D8`; amber `#FFB86B` | Calm, supportive, suitable for a counselling-led identity. |
| C — violet + mint | `#FAF9FF` and white | Violet `#6547C6` | Pale mint `#E8F6EF` | Expressive identity suitable for discovery and career exploration. |

Character descriptions are design judgments, not verified psychological effects. Recommendation A best balances NSEDU's search/comparison and guidance/news goals. Color roles and palettes must remain consistent rather than mixing all three themes.

### Recommended palette roles

| Role | Value | Proposed use |
| --- | --- | --- |
| Page background | `#F7F9FC` | Light neutral canvas |
| Surface | `#FFFFFF` | Header, cards, search/form surfaces |
| Primary | `#3157D5` | Primary actions, selected tabs, links with clear affordance |
| Primary hover | `#2445B5` | Interactive button state |
| Main text | `#18243B` | Headings, college names, key values |
| Secondary text | `#526079` | Descriptions, dates, supporting facts |
| Soft blue | `#EEF2FF` | Hero tint, selected-control surfaces, tool section |
| Soft peach | `#FFF0E6` | Career guidance feature area |
| Apricot | `#FFB86B` | Small highlights/illustration details with dark text |
| Border | `#E2E8F0` | Decorative card separators; meaningful controls need sufficiently visible boundaries |

Most of the page uses white/light neutral surfaces, with small controlled accents. Primary action color remains blue across sections. Semantic warning/success colors should carry text/icons too and must not be confused with decorative accents.

Selected static contrast checks: white on primary blue 6.08:1; main text on page background 14.70:1; secondary text on white 6.35:1; dark text on apricot 9.10:1. These checks cover selected pairs only, not full-theme accessibility. [WCAG text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum/) specifies 4.5:1 for ordinary text and 3:1 for qualifying large text.

### Typography proposal

- Heading family: [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans), weight 600/700, for a distinct but readable heading style.
- Body/UI family: [Inter](https://rsms.me/inter/), weight 400/500/600, for descriptions, filters, buttons and data.
- Hindi-script content: [Noto Sans Devanagari](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari), matched optical size/line spacing. Hinglish in Latin script uses the main fonts.
- Proposed desktop scale: hero 48–56px, section title 28–34px, card title 18–20px, body 16px, metadata 14px.
- Mobile: hero 32–36px, section title 24–28px, body 16px. Font size should adapt to available width and actual copy.
- Body line height approximately 1.5–1.65; headings 1.1–1.2. Avoid long all-caps text and tiny metadata.
- Keep paragraphs short, descriptive labels clear, and data units explicit; support text resizing and long institution names.

### Header and hero proposal

- White header, subtle bottom divider, approximately 72–80px desktop / 60–64px mobile.
- Logo left; grouped Colleges & Courses, Compare, Career Guidance, News & Guides links in the middle; Login and one primary Find My College action right.
- Search remains central in hero and can move into a compact header search affordance after scrolling. Avoid two visually competing full search bars in the first viewport.
- Mobile: logo, search affordance and menu; expanded menu exposes other actions. Sticky header must preserve content space and visible keyboard focus.
- Hero desktop: approximately 60% content/search, 40% editorial image/guide preview. White or gently blue-tinted background; contained accent shape rather than a full-screen dark image.
- Proposed headline: “Find a college that fits your future.” Support: “Explore courses, compare real costs, and get guidance for your next step.”
- One dominant search form with clear College/Course intent selection, Search action and a secondary “Not sure what to study?” guidance link.
- Hero visual: authentic student/campus image paired with one readable guidance preview, or a carefully composed editorial illustration. Keep facts readable rather than scattered in decorative tiny floating cards.
- Trust cues can mention documented product methods; counts, ratings, partner badges and outcome claims require actual evidence. 2,000+ is currently a coverage target, not a live verified inventory.

### Landing-page section sequence and representation

| Order | Section | Proposed presentation |
| --- | --- | --- |
| 1 | Header and hero | Search-first entry and clear career-help alternative |
| 2 | Important updates | 3 compact dated items with category/status and next action; full updates link |
| 3 | What do you need help with? | 3 purposeful tools: Find eligible courses, Compare colleges, Get career guidance |
| 4 | Explore courses | Compact icon tiles with field/course names; course popularity and personal fit remain distinct |
| 5 | Explore colleges | 3 college-course cards on desktop, selected course/location controls, view-all link; recommendations only once preferences are known |
| 6 | Career confusion feature | Asymmetric soft-peach section, example questions, short explanation and one Start Guidance action |
| 7 | Comparison preview | Compact example table for fee/cost, eligibility, placement year and location; use explicitly illustrative data during design |
| 8 | Explore by location | Compact city tiles using images where useful; specific locality/campus available deeper in the journey |
| 9 | Guides and articles | One featured editorial guide and 2–3 smaller stories; headline, category, reading time/date |
| 10 | Trust and process | Explain sources, recommendation reasons and correction process; genuine testimonials only when available |
| 11 | FAQ and final guidance action | Short expandable questions and a purposeful next step |
| 12 | Footer | Light blue/neutral surface and grouped navigation |

This is a candidate full landing-page inventory. Section count and order should be narrowed according to launch content and student testing; avoid empty or repetitive blocks merely to make the page longer.

### Card and component proposal

- Shared card surface white, subtle border, low-opacity navy shadow, 16px radius, 20–24px padding, 20–24px desktop gaps. Large editorial panels may use 24px radius.
- College card: clean campus thumbnail; logo/name/city; selected course; clearly labeled fee scope/year; placement metric/year when known; save/compare controls; one dominant View Details action. Sponsored placement labeled. Comparisons act on college-course pairs.
- Tool card: small consistent line icon, student problem as heading, one explanation line and clear action; restrained pastel icon background.
- Course tile: compact, no unnecessary oversized image; course/field name and concise route description.
- News item: category, date, short headline, status and action; visually distinct from evergreen guides. Use factual status labels rather than manufactured urgency.
- Article card: consistent image crop, readable headline and metadata; editorial layout may feature one story larger than the others.
- Visual rhythm comes from mixing tile grids, editorial split sections, news lists and comparison tables; not every section should be identical rounded cards.
- Buttons: 12px radius, approximately 48–52px height; primary blue/white, secondary white/blue outline, text action for low-priority links. Hover can use a slight shadow/lift; visible focus state, disabled/loading states and reduced-motion support planned.
- Proposed layout width 1200–1280px; desktop section spacing 72–88px, mobile 40–56px with 16–20px side padding.
- Use consistent line icons and authentic campus/student photos; decorative gradients, if used, stay small and subtle. Motion should explain state and preserve reading stability.

### Light footer proposal

Background `#EEF2F7` or compatible pale blue, dark headings and readable secondary links, top divider and ample spacing. Desktop groups: NSEDU introduction; Explore; Student Tools; Help & Trust. Include relevant contact, About, sources/correction policy, Privacy and Terms when content exists. Mobile groups collapse into accessible accordion sections. Show social links, app badges or partner logos only when those properties actually exist.

### Decisions pending before implementation

- User selects theme A/B/C or requests adjustment; none selected yet.
- Final visual identity/logo, hero imagery, language mix and launch section inventory.
- Frontend TypeScript exception for Angular remains unresolved from the earlier stack discussion.
- Future validation: students locate search/career help, interpret college-card costs, identify next steps and use mobile navigation with realistic content. Current palette recommendations are not claims of proven conversion improvement.

## Generated theme previews

Three preview-only raster boards generated with built-in imagegen: A blue/peach, B teal/sand, C violet/mint. Each shows a landing-page concept plus palette, typography and component samples. Displayed in chat; no frontend implemented and no theme selected. College information, news, fees, claims and dates inside images are illustrative/generated content, not verified research. Font/hex labels describe intended styling; generated raster rendering is approximate, not a deterministic font/color specification.

Underlying preview files remain in `C:/Users/422se/.codex/generated_images/01a10d7b-9010-7a01-9daa-701856239cc4/` as `exec-be56ad47-cd06-4133-a482-3962ffc87d98.png` (A), `exec-a77c908a-3a55-432c-8a24-2e0d9fe45a43.png` (B), and `exec-dfdec7ca-68e8-42fc-b9d1-c15adf7ef2cc.png` (C). Preview references only; not application assets.

### Additional readable theme boards D–I

User requested 5–6 more clearly differentiated visual options with larger font/card samples and explicit color decoding. Six additional preview-only boards generated through built-in imagegen and displayed inline. Each simplifies the page inventory to emphasize header/hero, enlarged college card, guidance/news component, labeled palette, typography and buttons. All backgrounds remain light. No theme is selected and no frontend implementation occurred.

| Board | Proposed identity | Heading / body font labels | Main palette | Preview filename |
| --- | --- | --- | --- | --- |
| D — Editorial Blue | Structured, precise, blue-led | Manrope / Source Sans 3 | `#F6F8FC`, `#2457D6`, `#17243B`, `#EAF0FF`, white | `exec-2045b646-2bf3-4c85-b2ac-efa2895b34db.png` |
| E — Warm Academic | Ivory/forest with serif editorial headings | DM Serif Display / DM Sans | `#FFFBF5`, `#176B52`, `#24352D`, `#F2C572`, white | `exec-9e289bb3-1f41-4a06-a42b-176025512f42.png` |
| F — Coral Discovery | Warm expressive rounded cards/controls | Outfit / Nunito Sans | `#FFF8F5`, `#C84432`, `#27283D`, `#FFE5DC`, white | `exec-6b771695-8f86-4848-8ee9-28e37528a59e.png` |
| G — Ink + Lime | Strong type, flat modular rows, 6px corners | Space Grotesk / IBM Plex Sans | `#F8FAF7`, `#202C29`, `#D6F57A`, `#E8EEE6`, white | `exec-95e665a8-1f75-46af-b108-9ceb2a60469f.png` |
| H — Sky + Plum | Airy counselling/editorial feel, serif headings | Lora / Figtree | `#F3FAFD`, `#713A70`, `#213547`, `#DDF1FA`, white | `exec-5bef0b96-51fd-445f-b977-93b3ea34c8f0.png` |
| I — Amber + Graphite | Search-led, clean catalogue, compact structured card | Sora / Work Sans | `#FAF9F6`, `#30343B`, `#F4B544`, `#F1E9DB`, white | `exec-d5bbe471-d4bc-44a5-ac1f-68af79ea4b98.png` |

Preview filenames are under the same generated-image directory documented above; brainstorming previews are not application assets. Font appearance and colors in AI raster output remain approximate. Generated institution photography, facts, dates, counts, logos and slogans must not be interpreted as actual institution records, verified claims or final brand decisions. Design prompts specified preview-only light boards with large specimens and short labels; the generator can add illustrative details that would need correction before any production use.

### Alternative visual directions J–L

User feedback: previous variants still felt too similar; no prior option selected. Generated three alternative preview-only full-page compositions with different information architecture rather than another recoloring of photo-led hero layouts.

| Concept | Direction | Intended fonts/colors | Preview filename |
| --- | --- | --- | --- |
| J — Course Playground | Bold type, course mosaic, flat bordered cards and controlled offset shadows | Archivo Black + DM Sans; paper `#FFFDF6`, blue `#304FFE`, lemon `#FBE87A`, lilac `#E6DDFF` | `exec-3fe6187c-8ae4-470d-8ac9-763689cda9bb.png` |
| K — College Journal | Centered serif hero, illustrated campus, news/guidance editorial columns and slim institution rows | Fraunces + Public Sans; porcelain `#FAF7F2`, burgundy `#842D43`, charcoal `#292826`, blush `#F2E4E2` | `exec-08751467-8045-466a-99a7-99242221529e.png` |
| L — College Atlas | Search, filters and illustrative map-led exploration with comparison tray | Bricolage Grotesque + Atkinson Hyperlegible; ice `#F5FAFB`, petrol `#125C66`, orange `#DF682F`, cyan `#DFF0F1` | `exec-1c1535b1-3fd4-42fe-ad56-c26f7839598b.png` |

Files remain in the previously documented generated-image directory as brainstorming previews. Generated map/boundaries, dates, institutional details, counts and brand marks are illustrative and not verified production content. J includes an unrequested registered-mark symbol generated by the model; it is not a trademark registration claim and must not carry into final branding. All three are visual proposals only; no frontend implementation or theme approval.

### Professional purpose-led concepts M–N

Latest user direction: a professional, distinctive theme that represents NSEDU's purpose. Previous concepts remain unapproved. Two built-in imagegen previews displayed in chat, no UI implementation.

- M — Decision Lens: Oxford navy `#19334A`, light slate `#F8FAFC`/`#EAF0F4`, restrained copper; intended IBM Plex Sans + Source Sans 3. Comparison strips and focus/lens framing represent examining facts and choosing with clarity. Preview `exec-85070a74-b103-47ac-ab8f-eb3c9c1c90ab.png`.
- N — The Pathway: evergreen `#174C42`, limestone `#FAFAF7`, sage `#EAF0EB`, muted ochre; intended Instrument Sans + Source Sans 3. Three-stage route represents interests → courses → colleges; task-first sections distinguish students who know their course from those needing guidance. Preview `exec-97f62a30-7eb0-4ea9-91b1-6d5dff67ff2c.png`.

Files remain in the generated-image directory documented above. All facts, names, news, prices, fit labels and illustrations in raster previews are sample/generated content. M's generated hero uses a total-cost heading with annual values; final design must distinguish annual tuition from full-course total cost. N's generated update strip contains sample factual-looking announcements; these are not verified news. Typography, graphics and color reproduction are conceptual and must be specified precisely only after direction is selected.

### Student-focused welcoming homepage concept O

Latest user feedback: purpose-led concepts felt confusing; priority is a student-attractive, easy-to-understand UI that motivates registration and ongoing platform use. This supersedes abstract metaphor-led design as the preferred exploration direction, but no particular theme is approved.

Generated one built-in imagegen preview: `exec-93dae06c-d8b9-4886-a1b9-006fde841591.png`, in the generated-image directory above. Light white/soft-blue surfaces, royal-blue actions, navy text and small sunny-yellow accents; intended Plus Jakarta Sans + Inter. Welcoming student photo, concise value proposition, Find My Colleges and Explore Colleges actions, visible search, course tiles, scannable college cards, explicit shortlist benefit for account creation, guidance and sample updates.

Registration should communicate actual benefits (save shortlist, return to comparisons), while exploration remains available. Free-account copy in preview is proposed positioning and needs confirmation of pricing before production. No proven signup/conversion improvement is claimed; this is a design hypothesis to test with students. All photo/college/news/date content remains illustrative. No implementation or theme approval occurred.

### Latest visual constraint: no blue; concepts P–R

User explicitly rejected blue and the common-looking student-photo theme. Persisting direction: light background, attractive professional student experience, clear registration/use benefit, stronger visual distinction; blue is excluded from current theme exploration. User requested a theme that feels new; no claim can be made that any proposed style has never been used elsewhere.

Three built-in imagegen brainstorming previews displayed inline, still unselected:

| Concept | Visual direction | Intended fonts / main colors | Preview filename |
| --- | --- | --- | --- |
| P — Terracotta / Pistachio | Centered search hero framed by academic still-life imagery, asymmetric discovery/content area | Cabinet Grotesk + DM Sans; `#FFF9F0`, `#A8412B`, `#E6EDCB` | `exec-5dac90d3-6c65-4cc0-89fb-c983b37674d8.png` |
| Q — Mulberry / Butter | Bold search-led typography and task shelf for courses, colleges and guidance | Geist; `#FFFCF5`, `#76264D`, `#FFF0B8`, `#F6E6ED` | `exec-d5e17dfc-8cef-4c2d-af94-5b6ae884e75d.png` |
| R — Aubergine / Apricot | Centered headline, warm architectural image framing, course/budget/city discovery form | General Sans + Lato; `#FCF8F4`, `#4F2942`, `#FFD7BA`, `#EEE7ED` | `exec-e02ba64b-5ffe-42b4-ae0a-befef642a431.png` |

Files remain in the generated-image directory above as previews. Generated images may contain extra copy and institutional names, including real institution names in R; all associated fees/photos/course content are illustrative, not verified data. Font labels are intended directions and availability/licensing needs checking if selected. No frontend implemented, no theme approved, no proven conversion claim.

## Historical theme-P refinements and motion proposals — revoked

User approved theme P and requested further clarity and motion suggestions within the same theme. Files saved locally, originals retained:

- [Approved reference](design/theme/nsedu-locked-terracotta-pistachio.png).
- [P1 — desktop landing refinement](design/theme/nsedu-p1-landing-refinement.png): updates strip, clearer sample annual-fee labels, college cards, career help, grouped footer.
- [P2 — mobile clarity](design/theme/nsedu-p2-mobile-clarity.png): mobile header, single-column content, collapsible pistachio filters, comfortable controls. Refinement note: generated image places the illustration before search; actual mobile design should place search directly after heading/support text and keep illustration secondary so students can start immediately.
- [P3 — motion storyboard](design/theme/nsedu-p3-motion-storyboard.png): static before/after visual states, not an animation or implemented interaction.
- [Exact generation prompts](design/theme/refinement-prompts.json), built-in imagegen with approved image as reference.

### Historical theme tokens — no longer applied

Page `#FFF9F0`; primary `#A8412B`; main text `#332820`; supporting pistachio `#E6EDCB`; warm sand `#F4E4C8`; card surface white. Heading direction [Cabinet Grotesk](https://www.fontshare.com/fonts/cabinet-grotesk); body [DM Sans](https://fonts.google.com/specimen/DM+Sans). Raster font/color appearance is approximate; exact font loading, license review and contrast checks occur before implementation.

### Proposed interaction details

| Interaction | Suggested visual feedback | Starting timing |
| --- | --- | --- |
| Search focus | Visible terracotta ring; input stays stable | 150ms |
| Button hover/press | Slight shade change; arrow moves 2px where appropriate; press settles | 150–180ms |
| College-card hover | Subtle 4px lift and warm shadow; focus provides equally clear feedback | 180ms |
| Save college | Heart fills; Saved label confirms success; on failure revert and explain | 160ms |
| Compare selection | Checkbox selected and comparison tray appears; tray preserves content access | 220ms |
| Mobile filters | Expand/collapse with selected values retained | 200ms |
| Header on scroll | Divider/shadow gains emphasis; header dimensions remain stable | 180ms |

Timings are starting design suggestions, not measured results. Motion should acknowledge actions, not obstruct search or cause reading movement. Optional first-load visual fade may apply to decorative still-life only; headings/search remain available immediately. Avoid continuous moving books/plants, bouncing signup actions, auto-scrolling news and scroll-linked parallax. Honor system reduced-motion preference with immediate state changes and minimal/no movement; [MDN reduced-motion reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).

College names, news, dates, illustrations and fees in preview images remain sample content. Account pricing and factual claims are not finalized by image copy. Theme is locked; refinements are reviewable suggestions. No backend/frontend code, animation or integration was created.

## Research log

| Date | Update |
| --- | --- |
| 6 October 2026 | README created; research-only scope, competitor references, proposed student value, 2,000+ coverage direction, content checklist and high-level request/admin concept recorded. No implementation or college dataset collection performed. |
| 6 October 2026 | Expanded gap-to-feature shortlist with 14 proposals and first differentiation bundle; public competitor comparison, tracking and predictor capabilities reconfirmed. |
| 6 October 2026 | Added user-requested news/articles, marks-and-subjects course finder, AI career guide, confusion solver and related guidance proposals, with content accuracy standards and landing-page content order. |
| 6 October 2026 | Scope advanced to frontend-first planning and tech-stack discussion; recorded proposed Angular/Node/Express/MongoDB stack and pending Angular TypeScript vs JavaScript-only clarification. No implementation started. |
| 6 October 2026 | Completed targeted visual review of CollegeDekho/Careers360 desktop and mobile plus GetMyUni desktop; documented blocked visual references, three light palettes, typography, header/hero/footer, card system, landing-page inventory and selected contrast checks. Suggestions only; no UI implemented. |
| 6 October 2026 | Generated and displayed three labeled theme concept images with palette/font/card samples; preview only, no theme selected or frontend implemented. |
| 6 October 2026 | Generated six additional readable visual boards D–I with different palettes, serif/sans pairings, hero arrangements and card/control styles; preview only, no selection or implementation. |
| 6 October 2026 | User requested a different theme direction; generated J course mosaic, K editorial journal and L map-led discovery concepts. Prior themes remain unselected; no implementation. |
| 6 October 2026 | User requested professional purpose-led representation; generated M Decision Lens and N Pathway previews centered on comparison clarity and the student journey. No theme selected or implementation started. |
| 6 October 2026 | User prioritized student attraction, immediate clarity, registration value and platform use; generated simplified student-focused homepage concept O. Earlier abstract concepts not approved; no implementation. |
| 6 October 2026 | User explicitly rejected blue/common-looking theme; generated non-blue concepts P terracotta/pistachio, Q mulberry/butter and R aubergine/apricot with new hero/content arrangements. No selection or implementation. |
| 6 October 2026 | User locked theme P. Saved reference, generated/saved P1 desktop, P2 mobile and P3 static motion storyboard, archived exact prompts and recorded suggested motion/clarity refinements. No implementation. |
| 6 October 2026 | Established simple Angular frontend / JavaScript Express backend scaffold, central styles, optional MongoDB connector, and an initial theme-P landing page with lightweight CSS/SVG motion. |
| 6 October 2026 | User rejected the entire applied theme. Removed themed UI, motion, tokens/fonts and sample content. Policy review blocked permanent image deletion, so project images/previews were moved out of active folders into design/archive/rejected-theme-p. Retained scaffold and neutral placeholder; replacement theme not selected. |
| 6 October 2026 | User approved H2 Wine + Warm Taupe, switched the frontend to Next.js JavaScript, and authorized implementation. Archived Angular source, built the responsive student landing page with one central theme file, retained JavaScript Express/optional MongoDB, and validated desktop viewport fit, mobile interactions, build, lint, API health/proxy and dependencies. |
| 6 October 2026 | Refined the student hero after image/background feedback: replaced approximate campus drawing and photo cutout with the approved visual, blended its edges behind editable UI, preserved photographic proportions, made the mobile crop compact, and verified the WebP payload stays below 150 KB. Desktop first-screen fit remains validated. |
| 6 October 2026 | User approved the combined Section 2 city/state reference and requested implementation. Added arched city tiles, compact state cards, retained course context, searchable location pickers, responsive grids and shared optimized landmark artwork; updated the central theme and kept the first desktop screen within its viewport. Actual browser previews are saved under design/implementation-preview/section-2. |
