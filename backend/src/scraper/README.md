# University data scraper

Collects public facts about Indian universities and colleges from each institution's **own official website** and writes them into the `institutions` collection as **unverified** records for admin review.

It is one of two ways data gets in. The other is a file import (Admin → Data → Import universities). Both go through `upsertUniversities()` in `modules/universities/university-service.js`, the only write path. That function never overwrites fields an administrator has edited (`lockedFields`) and never replaces a value with an empty one.

## Architecture

```
seed list (CSV/JSON) ──► scrape_sources ──enqueue──► scrape_jobs ──lease──► worker process(es)
admin "Add source" ─────┘    (one per institution)     (one per source per run)      │
                                                                                     ▼
                         robots.txt → home page → ≤ 7 keyword-matched internal pages (polite fetcher)
                                                                                     │
                                         extract.js (pure functions) → one record ───┤
                                                                                     ▼
                     upsertUniversities([record], { source: { kind: 'scrape', name: 'Official website', url } , publish })
```

| File | Role |
| --- | --- |
| `config.js` | Environment settings with safe defaults |
| `urls.js` | Registrable domain (understands `ac.in`, `edu.in`, `res.in`, …), website normalisation |
| `robots.js` | robots.txt parser (RFC 9309): user-agent groups, longest-match Allow/Disallow, `*`/`$`, Crawl-delay |
| `fetcher.js` | Polite HTTP client: User-Agent, robots per origin, per-domain delay, timeout, 2 MB cap, same-domain redirects only |
| `extract.js`, `india.js` | Pure extraction from HTML strings (name, address/PIN/state/city, established year, NAAC, NIRF, approvals, streams, programmes, catalogue courses, logo URL, short summary, admission page, institutional email/phone) |
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

### Scaling to 20,000+ institutions

- Run as many worker processes as you like, on one machine or several, all pointing at the same `MONGODB_URI`. Leases and the per-host index keep them from colliding.
- Throughput per worker is roughly `concurrency × 3600 / (pages × delay + fetch time)`. With the defaults (4 sites, 8 pages, 3 s) that is a few hundred sites an hour.
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
npm run scrape --workspace backend -- work --concurrency 4 --max-jobs 200

# Inspect / maintain
npm run scrape --workspace backend -- status
npm run scrape --workspace backend -- retry-failed
npm run scrape --workspace backend -- cancel-queued
```

The admin screens under **Admin → Data** do the same jobs in the browser: upload seed lists, add or pause sources, queue runs, retry or cancel jobs, and review results.

**Seed lists.** The importer is generic on purpose. Use a list you are entitled to use, for example a directory an official body publishes for download, and keep a note of where and when you got it (the seed list name is stored on every source). Check the website column by hand where you can: directories often contain stale or wrong URLs, and the crawler only follows the domain you give it.

### Configuration (`backend/.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `SITE_URL` | — | Public site URL. The User-Agent becomes `GyaanVidhyaBot/1.0 (+<SITE_URL>/bot)` |
| `SCRAPER_USER_AGENT` | derived | Full User-Agent override (keep the `GyaanVidhyaBot` token) |
| `SCRAPER_CONCURRENCY` | 4 | Sites crawled in parallel per worker |
| `SCRAPER_HOST_DELAY_MS` | 3000 | Minimum gap between requests to one registrable domain; a larger `Crawl-delay` wins |
| `SCRAPER_MAX_PAGES` | 8 | Pages per site, home page included |
| `SCRAPER_TIMEOUT_MS` | 15000 | Per-request timeout |

Fixed limits: 2 MB per response (the rest is not downloaded), 5 redirects, and 4 attempts.

## What gets stored, and the publish rule

- Seed values (name, state, city, type, category) win over guesses from the site. A different name found on the site is added as an alias.
- Each job's `result.fields` lists the fields the crawl contributed. The review queue shows them next to the source URL and fetch time.
- **Publish rule.** A record is created visible (`active: true`) only if it has a name, a state/UT and the official website; otherwise it is held for review (`active: false`). It always starts `verification: 'unverified'`. Updates to existing records never change their visibility.
- `city` is required by the institutions schema. A crawl that finds no city, with none on the source, fails with a clear message; add the city to the source and retry.
- Extraction is heuristic and the records are unverified. A manual check against two real university sites found mostly right values, but also an admission link pointing at an archived page and a department's mailbox. Treat every field as a lead for a reviewer, not a fact. NIRF ranks are stored without their category (overall, university, engineering, …), so check them before verifying.
- If the state is not written in the address, it may be inferred from the PIN code's postal circle (contact and about pages only). PIN prefixes shared between two states are left blank.

## Compliance notes (read before running at scale)

This section describes the safeguards built in. It is **not legal advice**, and the safeguards do not make any particular crawl lawful. A page being publicly viewable is not a licence to copy it.

- **robots.txt and site terms.** The crawler fetches and obeys robots.txt for every origin, including Crawl-delay, and skips a site that disallows it. Some sites forbid automated access or reuse in their terms of use; robots.txt does not override those. When a site's terms prohibit it, set the source to **Blocked**.
- **Facts, not content.** We store short factual data points (address, PIN, year of establishment, accreditation grade, programme names) plus links. Facts are generally not protected by copyright, but the wording, layout, photographs and logos are.
  - We never download or re-host images. `logoUrl` is only the absolute URL of the institution's own logo, and displaying it remains a product and legal decision.
  - `about` is a short extract (at most 600 characters) of the institution's own description. Treat it as a quotation with attribution, or better, have an editor rewrite it before verifying.
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
- `scraper-crawl.test.js`: politeness, robots, redirects and size caps, against an in-memory fake web.
- `scraper-queue.test.js`: leases, backoff, reclaim, retries, the worker end to end and the publish rule, on a throwaway MongoDB database.
- `data-ops.test.js`: the admin API.
