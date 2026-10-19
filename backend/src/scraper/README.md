# University data scraper

Collects public facts about Indian universities and colleges from each institution's **own official website** and writes them into the `institutions` collection as **unverified** records for admin review.

It is one of two ways data gets in. The other is a file import (Admin → Data → Import universities). Both go through `upsertUniversities()` in `modules/universities/university-service.js`, the only write path. That function never overwrites fields an administrator has edited (`lockedFields`) and never replaces a value with an empty one.

## Architecture

```
seed list (CSV/JSON) ──► scrape_sources ──enqueue──► scrape_jobs ──lease──► worker process(es)
admin "Add source" ─────┘    (one per institution)     (one per source per run)      │
                                                                                     ▼
                robots.txt → home page → ≤ 11 keyword-matched internal pages (polite fetcher)
                       (about, contact, admissions, programmes, accreditation, placement, campus)
                                                                                     │
                                 extract.js + deep.js (pure functions) → one record ─┤
                                                                                     │
                      campus photographs → lib/image-pipeline.js → Cloudinary ───────┤
                                                                                     ▼
                     upsertUniversities([record], { source: { kind: 'scrape', name: 'Official website', url } , publish })
```

| File | Role |
| --- | --- |
| `config.js` | Environment settings with safe defaults |
| `urls.js` | Registrable domain (understands `ac.in`, `edu.in`, `res.in`, …), website normalisation |
| `robots.js` | robots.txt parser (RFC 9309): user-agent groups, longest-match Allow/Disallow, `*`/`$`, Crawl-delay |
| `fetcher.js` | Polite HTTP client: User-Agent, robots per origin, per-domain delay, timeout, 2 MB cap, same-domain redirects only. `getPage` for HTML, `getFile` for images (8 MB cap, image types only) |
| `extract.js`, `india.js` | Pure extraction from HTML strings (name, address/PIN/state/city, established year, NAAC, NIRF, approvals, streams, programmes, catalogue courses, logo URL, short summary, admission page, institutional email/phone) |
| `deep.js` | Pure extraction of the detail a student judges a place on: factual about text, campus photo candidates, programme rows with duration and fee, placement figures, facilities, activities, campus size, admission note, entrance exams |
| `../lib/image-pipeline.js` | Download → decode with `sharp` → size/shape checks → strip metadata → resize → compress → Cloudinary |
| `crawler.js` | Crawls one source and builds one record; publish rule |
| `sources.js` | Source CRUD and seed-list import (CSV or JSON) |
| `queue.js` | MongoDB job queue: enqueue, lease, heartbeat, retry with backoff, release, stats |
| `worker.js` | Worker loop used by the CLI |
| `csv.js` | CSV parsing/writing, shared with the admin import/export |

Collections: `scrape_sources`, `scrape_jobs`, `scrape_runs` (indexes in `db/indexes.js`).

### Queue and leases

- A job is `queued → running → done | failed | skipped`, or `cancelled` by an admin.
- `leaseJob` uses one atomic `findOneAndUpdate` to set `status: 'running'`, `lockedBy` and `lockedUntil` (default 5 minutes). The worker extends the lease every third of that time while it crawls.
- If a worker dies, its lease expires. The next lease call puts the job back in the queue, or fails it once `maxAttempts` (4) is used up.
- Transient errors (network, timeouts, HTTP 5xx, robots.txt answering 5xx/429) are retried after 10 min, 20 min, 40 min and so on, capped at 12 h, with ±20% jitter.
- Permanent errors fail at once: an off-site redirect, HTTP 404/410, a record that cannot be saved (for example, no city).
- `skipped` means robots.txt disallows the page, the Crawl-delay is above 60 s, or the home page is not HTML.
- Two partial unique indexes keep the queue consistent across processes:
  - `{ sourceId }` where `open: true` allows at most one queued or running job per source, so enqueueing twice is harmless.
  - `{ host }` where `status: 'running'` allows at most one running job per registrable domain across all workers. A busy domain is skipped and its job waits.
- `Ctrl+C` (SIGINT) or SIGTERM stops new leases, aborts in-flight requests and hands those jobs back without counting the attempt. Press it twice to force an exit.

### Concurrency: 50 sites, never 50 requests to one site

`--concurrency N` (or `SCRAPER_CONCURRENCY`) is the number of **institutions** a worker has in flight, not a request rate. Three separate rules keep a single site from being hit hard, and none of them is relaxed when the number goes up:

1. **One job per domain at a time, across every worker.** A partial unique index on `{ host }` where `status: 'running'` makes the database refuse a second running job for the same registrable domain; `leaseJob` skips hosts that are busy. So 50 lanes means up to 50 *different* hosts.
2. **A minimum gap between requests to one domain** (`SCRAPER_HOST_DELAY_MS`, default 3 s), applied inside the fetcher and keyed by registrable domain, so `www.x.ac.in` and `x.ac.in` share one budget. Pages and images queue behind the same gap.
3. **robots.txt, including `Crawl-delay`.** A larger `Crawl-delay` replaces the default gap for that domain; above 60 s the site is skipped rather than tying up a lane.

```bash
work --concurrency 50          # 50 institutions at once; each site still sees one request per ≥3 s
```

The practical ceiling is 64 lanes per process. Lanes cost almost nothing while they wait, but each one holds a MongoDB lease, so with a small queue many lanes find no free host and exit — queue more work than you have lanes.

### Scaling to 20,000+ institutions

- Run as many worker processes as you like, on one machine or several, all pointing at the same `MONGODB_URI`. Leases and the per-host index keep them from colliding.
- Throughput per worker is roughly `concurrency × 3600 / ((pages + images) × delay + fetch time)`. With the defaults (8 sites, 12 pages, 6 photographs, 3 s) that is around 500 sites an hour; at `--concurrency 50`, a few thousand.
- A full pass over 20k sources takes one worker a couple of days. Spread it out: `enqueue --never` for new sources, then `enqueue --stale-days 30` from a daily cron or systemd timer, followed by `work --max-jobs N`.
- `work --watch` keeps polling instead of exiting when the queue is empty, which suits a long-running service.
- Workers never run inside the API process; the admin screens only manage the queue.

## Running it

```bash
# 1. Load institutions to crawl (CSV or JSON). Columns: name, website (required), state, city, type, category.
#    Common headers such as "Name of the Institution" or "Website URL" are recognised.
npm run scrape --workspace backend -- import-sources ./universities.csv --list "State universities 2026"

# 2. Queue jobs (one per active source)
npm run scrape --workspace backend -- enqueue --never           # never crawled
npm run scrape --workspace backend -- enqueue --stale-days 30   # refresh
npm run scrape --workspace backend -- enqueue --all --limit 500

# 3. Crawl
npm run scrape --workspace backend -- work --concurrency 50 --max-jobs 200

# 4. Photographs only, for records that already exist (no re-crawl of the text)
npm run scrape --workspace backend -- enrich-images --limit 50            # institutions with no photographs yet
npm run scrape --workspace backend -- enrich-images --slug iit-bombay --all   # redo one
npm run scrape --workspace backend -- enrich-images --limit 20 --dry-run  # count candidates, upload nothing

# Inspect / maintain
npm run scrape --workspace backend -- status
npm run scrape --workspace backend -- retry-failed
npm run scrape --workspace backend -- cancel-queued
```

> **npm eats flags.** `npm run … -- enqueue --never --limit 60` reaches the script as `enqueue 60`: npm consumes the `--`-prefixed arguments it recognises. For anything with flags, call the script directly:
> `cd backend && node --env-file-if-exists=.env --env-file-if-exists=.env.local src/scripts/scrape.js enqueue --never --limit 60`

The admin screens under **Admin → Data** do the same jobs in the browser: upload seed lists, add or pause sources, queue runs, retry or cancel jobs, and review results.

**Seed lists.** The importer is generic on purpose. Use a list you are entitled to use, for example a directory an official body publishes for download, and keep a note of where and when you got it (the seed list name is stored on every source). Check the website column by hand where you can: directories often contain stale or wrong URLs, and the crawler only follows the domain you give it.

### Configuration (`backend/.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `SITE_URL` | — | Public site URL. The User-Agent becomes `GyaanVidhyaBot/1.0 (+<SITE_URL>/bot)` |
| `SCRAPER_USER_AGENT` | derived | Full User-Agent override (keep the `GyaanVidhyaBot` token) |
| `SCRAPER_CONCURRENCY` | 8 | Institutions crawled in parallel per worker (max 64); see the section above |
| `SCRAPER_HOST_DELAY_MS` | 3000 | Minimum gap between requests to one registrable domain; a larger `Crawl-delay` wins |
| `SCRAPER_MAX_PAGES` | 12 | Pages per site, home page included |
| `SCRAPER_MAX_IMAGES` | 6 | Campus photographs downloaded per institution (0 turns the image pipeline off) |
| `SCRAPER_TIMEOUT_MS` | 15000 | Per-request timeout |
| `SCRAPER_JOB_TIMEOUT_MS` | 480000 | Whole-institution budget. A site that answers every request slowly is given up on and retried later, instead of holding a lane |
| `CLOUDINARY_URL` | — | Required for photographs. Without it the crawl still runs and simply stores no images |
| `CLOUDINARY_FOLDER` | `gyaan-vidhya` | Root folder; photographs land in `<folder>/universities/<slug>/photo-<n>` |

Fixed limits: 2 MB per HTML response (the rest is not downloaded), 8 MB per image, 5 redirects, and 4 attempts.

## The image pipeline

`lib/image-pipeline.js` is the only way a picture reaches our storage, and it is used both by the crawler and by `enrich-images`.

1. **Download** through the same polite fetcher as the pages: robots.txt, the per-host delay, redirects inside the institution's own domain only, an image content type, a 15 s timeout and an 8 MB cap. Nothing is streamed to disk; a response bigger than the cap is abandoned rather than truncated.
2. **Verify** by decoding with `sharp`. A file that will not decode is not an image, whatever its extension said. Photographs must be at least 480×320 with an aspect ratio between 1.2 and 2.4 — that removes logos, icons, banner strips and portrait headshots that slipped through the filename rules.
3. **Compress**: EXIF orientation applied and then dropped with every other metadata block, resized to at most 1600 px wide, re-encoded as WebP at quality 78. A logo keeps PNG only when it actually has an alpha channel.
4. **Upload** to Cloudinary at `<folder>/universities/<slug>/photo-<n>` with `overwrite: true`, so re-running replaces the same objects instead of filling the account with copies. Only the returned `secure_url` is stored.

A picture that fails any step is logged and skipped; it never fails the crawl. Run summaries print how many were uploaded, skipped and failed, and the total bytes before and after compression.

Which pictures are even considered (`deep.js`, `galleryCandidates`): images served from the institution's own domain, with a `.jpg`/`.png`/`.webp` path, whose filename, `alt` text or CSS class does not look like a logo, icon, sprite, social badge, accreditation mark or a named person, preferring ones that mention campus, building, infrastructure, library, lab, hostel, sports, convocation or campus life.

## What gets stored, and the publish rule

| Field | What it holds | When it is absent |
| --- | --- | --- |
| `about`, `aboutSource` | 2–4 factual sentences (≤ 1200 chars) from the institution's own about/overview page, and that page's URL. Sentences that only sell ("a premier institute with world-class infrastructure") are dropped unless they also state something checkable | No about page, or nothing factual on it |
| `gallery[]` | Up to 8 `{ url, caption?, credit: 'official website', sourcePage, width?, height? }` — photographs re-hosted on Cloudinary | Nothing on the site passed the photo checks, or Cloudinary is not configured |
| `coverUrl` | The first gallery photograph, unless a cover is already set | — |
| `programmesOffered[]` | Up to 60 `{ name, level?, durationYears?, annualFeeInr?, feeNote?, sourcePage }` rows, from fee/course tables, topped up from the plain name list | — |
| `coursesOffered[]` | The plain programme-name list, unchanged | — |
| `placements` | `{ year?, averagePackageLpa?, highestPackageLpa?, medianPackageLpa?, placedPercent?, recruiters[]?, sourcePage }` from the official placement page | No placement page, or it prints no figures |
| `facilities[]`, `activities[]` | Up to 20 each, only names the site itself uses (hostel, library, labs, sports, NSS, NCC, fests, clubs …) | — |
| `campus` | `{ sizeAcres?, hostelAvailable?, coEd?, sourcePage }` | Not printed |
| `admissionNote`, `entranceExams[]` | ≤ 400 chars from the admissions page, and named exams (JEE Main, NEET UG, CUET, state CETs …) | — |

Rules that matter more than coverage:

- **A fee is stored only when the page states it unambiguously, per year, in rupees, for that programme.** A "total course fee" or a per-semester amount goes into `feeNote` as the page wrote it, and `annualFeeInr` stays empty. Nothing is ever annualised, averaged or estimated.
- **Placement figures are never inferred.** A median that is not printed stays absent; it is not derived from the average. The year is stored only when the page says which year the numbers belong to.
- **An absent value means "we did not find it", never "there is none".** `hostelAvailable` is only ever set to `true`; a site that does not mention hostels leaves it empty rather than claiming there is no hostel.
- Every structured value keeps the `sourcePage` it was read from, so a university page can link the claim back to the institution's own page.

**How far to trust each field** (from real runs over ~260 institutions, not a guess):

| Confidence | Fields | Why |
| --- | --- | --- |
| Good | `facilities`, `activities`, `entranceExams`, `gallery` | Fixed vocabularies and pixel-level checks; wrong answers are rare and obvious |
| Usable, check before verifying | `about`, `admissionNote`, `programmesOffered` names, `campus` | Heuristic over free prose. Some about pages are pure sales copy and produce nothing (by design); some produce a page header instead of a paragraph |
| Weak — review before showing | `placements.recruiters` | Read from the alt text of images the markup labels as a recruiter wall. Sites label those images inconsistently, so the list can still pick up a logo file name or the institution's own banner. Treat it as a lead, not a fact; several real runs were needed just to get it this far |
| Rare but reliable when present | `programmesOffered[].annualFeeInr`, `placements.*Lpa`, `placedPercent` | Deliberately strict. About 1 crawl in 20 yields a fee; that is the price of never publishing a number the page did not print |
- Seed values (name, state, city, type, category) win over guesses from the site. A different name found on the site is added as an alias.
- Each job's `result.fields` lists the fields the crawl contributed. The review queue shows them next to the source URL and fetch time.
- **Publish rule.** A record is created visible (`active: true`) only if it has a name, a state/UT and the official website; otherwise it is held for review (`active: false`). It always starts `verification: 'unverified'`. Updates to existing records never change their visibility.
- `city` is required by the institutions schema. A crawl that finds no city, with none on the source, fails with a clear message; add the city to the source and retry.
- Extraction is heuristic and the records are unverified. A manual check against two real university sites found mostly right values, but also an admission link pointing at an archived page and a department's mailbox. Treat every field as a lead for a reviewer, not a fact. NIRF ranks are stored without their category (overall, university, engineering, …), so check them before verifying.
- If the state is not written in the address, it may be inferred from the PIN code's postal circle (contact and about pages only). PIN prefixes shared between two states are left blank.

## Compliance notes (read before running at scale)

This section describes the safeguards built in. It is **not legal advice**, and the safeguards do not make any particular crawl lawful. A page being publicly viewable is not a licence to copy it.

- **robots.txt and site terms.** The crawler fetches and obeys robots.txt for every origin, including Crawl-delay, and skips a site that disallows it. Some sites forbid automated access or reuse in their terms of use; robots.txt does not override those. When a site's terms prohibit it, set the source to **Blocked**.
- **Facts, not content.** We store short factual data points (address, PIN, year of establishment, accreditation grade, programme names, fees and placement figures as printed) plus links. Facts are generally not protected by copyright, but the wording, layout, photographs and logos are.
  - `about` is a short extract (at most 1200 characters) of the institution's own description. Treat it as a quotation with attribution, or better, have an editor rewrite it before verifying.
  - **Photographs are now downloaded and re-hosted** (`gallery`), which earlier versions of this crawler deliberately did not do. This is a product decision by the owner, and it is the part of this pipeline with the clearest copyright exposure: a campus photograph is a creative work owned by the institution or its photographer, and re-publishing it is not covered by any "facts are free" argument. The safeguards are narrow ones:
    - only images served from the institution's own domain, never a stock library, a CDN we do not control or a third-party page;
    - every row stores `credit: 'official website'` and the `sourcePage` it came from, and the university page is expected to show both next to the photographs;
    - `overwrite: true` on a fixed public id, so a correction or a removal replaces rather than accumulates.

    Before this runs beyond a pilot, get written permission or an explicit licence from the institutions, or fall back to hot-linking the original URL. Treat a takedown request as binding and immediate: delete the Cloudinary objects (`destroyImage`) as well as the `gallery` rows.
  - `logoUrl` is still only the absolute URL of the institution's own logo; the pipeline does not re-host logos by default.
- **Attribution.** Every record keeps `source.url` and `source.fetchedAt`, and the public API returns them. University pages should show a visible "Source: official website, fetched on …" link.
- **Personal data (DPDP Act 2023).** The extractor is built to collect only institutional contact data:
  - Emails must be generic role mailboxes (info@, admissions@, registrar@, office@ …) on the institution's own domain.
  - Phone numbers come from structured data, tel: links or labelled contact lines.
  - Any line that names a person with a title (Dr., Prof., Mr., Ms., Shri, Smt …) is ignored.
  - Staff, faculty-directory, alumni, login and portal pages are never followed.

  If personal data still slips through, delete it during review.
- **Identification and load.**
  - The bot identifies itself with a stable User-Agent and a URL. Publish a `/bot` page at `SITE_URL` that explains what the bot collects, why, and how a site owner can opt out or ask for a correction.
  - Per-domain politeness: at most one job per domain at a time, a few seconds between requests, and a handful of pages per site.
- **Takedown and correction requests.** Honour them promptly:
  - Set the source to **Blocked**. Blocked sources are never queued, and later seed uploads do not reactivate them.
  - Hide or reject the institution record, and correct or delete fields on request.
  - Keep a short log of requests and actions.
- Review the approach with legal counsel before running large-scale crawls, especially for commercial use.

## Tests

`npm test --workspace backend` runs these suites, which never touch the network:

- `scraper-robots.test.js`: robots.txt parser and URL helpers.
- `scraper-extract.test.js`: extraction on HTML fixtures in `scraper-fixtures.js`.
- `scraper-deep.test.js`: the deep extractors (about, programme rows and fees, placements, facilities, activities, campus, admissions, photo candidates) and the structured institution fields.
- `image-pipeline.test.js`: decode/size/shape checks, WebP and PNG encoding and the upload contract, against images generated with `sharp` and a stubbed Cloudinary.
- `scraper-crawl.test.js`: politeness, robots, redirects and size caps, against an in-memory fake web.
- `scraper-queue.test.js`: leases, backoff, reclaim, retries, the worker end to end and the publish rule, on a throwaway MongoDB database.
- `data-ops.test.js`: the admin API.
