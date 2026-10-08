# Section 6 — N2 Newsroom design

7 October 2026 (IST). Current image proposal after the user rejected N1 as too static, too similar to earlier sections and containing unwanted person imagery. No website code or backend/API has been changed.

## Purpose and content

Help students quickly find education updates relevant to their board or entrance exam, open the source, save a story and find practical reading. Shiksha's news/articles routes and dated category lists informed the structure; NSEDU keeps its wine/taupe/ivory palette and creates its own layout.

- Contemporary sans-serif heading: **News & education updates**; small NSEDU Journal label and concise helper.
- News / Articles / Saved navigation with topic filters, search and sort affordances.
- Four compact dated news rows: JEE Main registration coverage, tentative CBSE schedule coverage, NIOS October exam coverage and IIT Gandhinagar visiting-student research applications.
- Three separate reading links: NIT course/fee/admission comparison, CUET B.Sc. subject combinations and UCEED topics.
- Topic follow/preferences actions and small bookmarks; these are proposed controls in a raster image, not working features.

Headline paraphrases, source URLs and date basis are preserved in [N2-content.json](N2-content.json). Shiksha is the reporting publisher, not an official board/NTA notice. Dates are source-listing dates and may represent updates; exact publication timestamps remain null unless verified. Show a dated snapshot rather than a false LIVE label. ICSE, state boards, NCERT and other topics stay available without fabricated current news.

## Different visual presentation

Desktop uses a wider news list and a narrower article column with thin dividers, short rows and small document/book/laptop thumbnails. There are no people, portraits or avatars. The sans-serif hierarchy, open white surfaces and fine editorial rules distinguish this section from the hero, eligibility wizard and budget calculator. A small wine interest tile provides one restrained accent. Background detail stays peripheral and light.

AI-generated imagery is illustrative: it does not show an official notice, actual form, real timetable or authenticated campus photograph. During implementation use licensed covers or native topic graphics, with accessible descriptions and no implied official status. Rendered warm accent rules should resolve to the central brand tokens rather than introducing a new orange palette.

## Responsive implementation intent

Mobile stacks news before articles, reduces descriptions, keeps source/date metadata and scrolls topic chips horizontally. Normal vertical scrolling is expected. The mobile image is a reflow concept, not proof of CSS breakpoints. Build with responsive grid/flex layouts, readable 16px body/input text, at least 44px control targets, keyboard focus and clear labels for bookmark/external-link icons.

Keep four homepage news items and three articles initially; the dedicated feed handles larger archives. View all retains the selected topic. Use small optimized thumbnails with stable aspect ratios and lazy loading, CSS/native SVG for background details, local fonts and no motion library. These are implementation recommendations, not measured performance claims. Palette and type recipes belong in the existing central theme file.

## Future dynamic behavior

The mockup is a static research snapshot. A later feed should support topic + content-type filtering, query search, date sorting, bookmarks and preferences. Source name, URL, last-update/publication metadata and optional verified official-notice links must remain distinct. Validate source status before publishing actionable claims; handle refresh failure, empty topics and stale stories visibly. Never infer a student's board from their city.

Refresh automatically only when the backend is connected; indicate the last successful refresh and preserve a stable list while fetching. Avoid unsolicited notification permission prompts and auto-moving tickers. Respect reduced motion for any later subtle transition. API provider selection and full-text licensing remain separate work.

## Deliverables and inspection

[Desktop](N2-desktop.png), [mobile](N2-mobile.png), [exact prompts](N2-prompts.json) and [manifest](N2-manifest.json) were saved using built-in image_gen. Both images were visually inspected: no people, populated source/date labels, readable content hierarchy and clear news/article separation. Raster generation cannot verify actual tap areas, device reflow, browser behavior or load speed. No application tests or build were necessary for this image-only revision. N1 files remain historical and are not the current direction.
