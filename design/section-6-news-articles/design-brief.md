# Section 6 — News & Student Articles

7 October 2026 (IST). **Historical N1 proposal — rejected as too static and repetitive.** See [N2-design-brief.md](N2-design-brief.md) for the current no-person newsroom design. The website and backend have not been changed in this round.

After college discovery, eligibility and cost planning, this section gives students a reason to return: find relevant board/exam updates quickly, understand what they mean and read practical guidance.

## Content and visual hierarchy

1. **Heading:** “Education updates, made clear.” with a small News & Articles label, short helper and View all updates route.
2. **Topic filters:** All updates, CBSE, ICSE / ISC, State boards, CUET UG, JEE Main, NEET UG and NCERT. Selecting a state-board topic can reveal the board selector later; do not assume a student's board from their location.
3. **Updates desk:** five compact preview rows for results/scorecards, board notices, CUET, JEE Main and NCERT resources. Each has a topic badge, readable headline, type and open action. The dataset can grow without making the homepage show every story.
4. **Featured reading:** a Class 12 next-step checklist, relevant student photograph and concise guide summary. The image remains an article cover, not another landing-page hero.
5. **Useful reads:** CUET subject choices, JEE application documents and a weekly NCERT study plan, with small thumbnails and bookmark actions.
6. **Optional preferences:** Choose interests after the content. It should lead to a clear board/exam preference picker; permission to receive notifications is a separate explicit choice later.

The “Demo content” badge and Sample headlines label identify fixtures. No actual result publication, date-sheet release, deadline or official verification is implied. “Featured guide” is editorial placement; no invented popularity counts appear.

## NSEDU visual direction

Wine `#72243B`, taupe `#806C60`, ivory `#FFFAF8`, white, charcoal and pale rose remain. A newspaper vignette, calendar/book motifs, light corner wash and dotted details give this section its own reading/news identity. Sans-serif headings and short rows support scanning; a restrained serif italic heading accent and featured title connect to the site's editorial theme. Thin separators and three unequal columns replace a wall of large cards.

Desktop places a feature beside the news list and useful-reading column. Mobile prioritizes **updates first**, then featured reading and supporting guides. Topic chips scroll horizontally with an obvious control. Normal vertical scrolling is appropriate. The mobile raster is a visual proposal: implementation must use real responsive breakpoints, at least 44px hit areas, readable inputs and keyboard-operable controls rather than shrinking the image.

## Planned behavior

- Keep news and evergreen guides as distinct record types; preserve a selected topic when moving to View all updates.
- Every dynamic update should expose publication/update time, source name and original link. Distinguish an official notice from publisher reporting and NSEDU explanation. Add an official-notice link only when verified for that story.
- Keep stale or corrected stories clearly dated. Remove expired urgency indicators when a real deadline passes; do not fabricate live status from a periodic fetch.
- Article rows open a useful article/detail view or identified external source. Bookmark actions must show their state; account saving follows existing account flows when implemented.
- Include loading placeholders, readable empty-topic results, thumbnail fallbacks and an error state with retry. Retain previously fetched content with its timestamp if refreshing fails.

## Static data and later API work

[demo-content.json](demo-content.json) contains the visible fixture text and topic labels. Publication/source URLs are null for sample news. It is saved with design artifacts and is not imported into the app yet.

Later records should carry `id`, `type`, `title`, `excerpt`, `topic`, `tags`, `publishedAt`, `updatedAt`, `sourceName`, `sourceUrl`, `officialNoticeUrl`, `image`, `isDemo` and verification metadata. A discovery API is a future candidate; official board/exam notices need their own verified references. API keys, caching, deduplication and refresh jobs belong in the later backend phase.

For a lightweight implementation, use native SVG/CSS for newspaper/calendar background details and small WebP/AVIF article covers with reserved dimensions and lazy loading. The full mockup PNGs are review artifacts, not webpage backgrounds. Reuse local fonts and the shared theme file. Avoid an auto-playing carousel or a news animation library.

## Deliverables

- [N1 desktop](N1-desktop.png) and [N1 mobile](N1-mobile.png), generated with built-in image_gen and visually inspected.
- [Exact prompts](prompts.json), [artifact manifest](manifest.json), [reference review](references/research-notes.md) and browser evidence.
- Approval/revision is the next design decision; application implementation remains outside this design-first round. No application tests or builds were rerun because application source is unchanged.
