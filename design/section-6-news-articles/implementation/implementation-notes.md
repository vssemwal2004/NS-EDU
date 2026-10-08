# Section 6 — Education news and reading

Implemented 7 October; finalized 8 October 2026 (IST). The homepage now fetches real publisher education feeds through an Express JSON endpoint. N1/N2 raster proposals remain design history; this directory contains browser captures of the actual website.

## Data and restrictions

- `GET /api/education-news` reads public education RSS feeds from The Indian Express, Hindustan Times and ET Education. No API key or MongoDB connection is required for this feature. The feeds are publisher content; fast-xml-parser is the open-source parser, not an open licence for the publisher's content.
- Only fixed education-feed URLs can be fetched. Article links must have HTTPS, an allowed publisher host and its education path. Image URLs must use known publisher/CDN hosts. Requests cannot supply arbitrary fetch URLs.
- Discard malformed/undated stories, future-dated entries beyond clock tolerance and stories older than 45 days. Exclude unrelated hiring notices and general-news roundups written for school assemblies. Retain education-sector opportunities and education policy reporting.
- Clean HTML to plain text, keep only short descriptions and open original publisher pages. Do not scrape/reproduce full articles or claim official board verification. Feed/image reuse must follow the publisher's applicable terms for deployment.
- Broad categories cover admissions/funding, exams/results, schools, higher education, learning/EdTech and education policy. There is no fixed list of exam or board names. Category/type assignment uses headline/description cues and publisher paths; it is a heuristic and can be refined. News coverage is limited to what the configured publishers supply, not guaranteed coverage of every Indian examination or board notice.

## Refresh and failure behavior

Server refreshes share a ten-minute in-memory cache and one in-flight fetch. Publisher requests have a seven-second deadline and a bounded 2MB XML body; DOCTYPE/entity declarations and invalid XML are rejected. Canonical URLs deduplicate records. Return at most 90 latest records; show three news rows plus three reading previews initially (two reading previews on mobile) and reveal more on demand. The Articles view exposes all article records, including the third mobile preview. This bounds homepage payload/render work without restricting exam subjects.

On a publisher outage, other sources still load. Previously fetched items can remain for up to 24 hours with their original fetch/publish times and an explicit partial state; after that they expire. An all-source outage with no cached content returns 503 and an empty collection, never old demo headlines. A valid but empty feed has a separate UI message.

The browser starts the request near the section, polls at ten-minute intervals only after activation while the page is visible, and offers manual refresh. It does not pretend to use streaming real-time updates. A failed refresh preserves any already loaded records and reports that earlier updates are being shown. Checked time uses IST; publisher publication dates remain attached to every story.

## Student interactions and visual design

Desktop uses a compact wider news list and a separate reading column. The heading combines contemporary sans type with one serif accent, a fine wine rule and a restrained newspaper-grid/document background. Mobile stacks the feed and reading rows, makes the lead story horizontal rather than a large hero, and exposes horizontal topic scrolling. The fixed header changes its section context to Education news.

Overview / News / Articles / Saved views, category filters, arbitrary topic search, chronological sorting, load-more and external story links all work. Bookmarks persist in this browser with a 60-story cap and a storage-unavailable message. They are not synced accounts or push subscriptions. Empty filtered/saved views offer a clear next step.

Colours, typography and surface recipes live in `frontend/src/styles/index.css`. Components consume those variables. Background graphics are native SVG/CSS; no animation or news UI library was added. Publisher thumbnails use Next Image with allowed hosts, responsive size hints and lazy loading, with native topic-cover fallbacks. `frontend/src/data/news-image-policy.js` implements the user's existing person-free preference: only exact visually reviewed neutral photo URLs display; every other cover uses a matching education graphic. No automated person detection is claimed. The existing BHU campus, ISB logo and Colorado campus URLs were reviewed; the newer Odisha/Kerala/careers images were rejected because people were visible. Review-only downloads in this directory are not shipped in the website.

## Validation

Backend tests cover source/path restriction, HTML cleanup, untrusted images, invalid/entity XML, unrelated hiring and general news roundups, feed size limits, canonical deduplication, cache/in-flight sharing, partial outage/stale expiry and the unavailable HTTP response. Frontend tests cover lazy activation, search/filtering, content types, sorting, bookmarks, retry/stale/empty states, broken images, responsive controls and fixed-header behavior.

Final checks passed: 8 backend tests; 16 news/fixed-header browser tests; lint; production build. Five live-feed capture widths (320, 390, 768, 1366, 1672) had no horizontal overflow, undersized visible controls or browser errors. A reviewed publisher campus photo loaded through Next Image. The frontend and same-origin news API returned HTTP 200 after the build. `validation.json`, `browser-evidence.json`, `live-api-evidence.json` and `reviewed-photo-evidence.json` preserve results. Local measurements are not a public-network performance score. The feature uses the existing Next.js + JavaScript frontend and Node.js/Express backend.
