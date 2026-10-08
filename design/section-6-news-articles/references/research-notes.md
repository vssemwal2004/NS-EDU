# Education news and articles reference review

## N2 follow-up: compact source-linked newsroom

The user rejected N1's student photograph, generic sample headlines and repeated editorial treatment. Revisited [Shiksha News](https://www.shiksha.com/news) and [Articles](https://www.shiksha.com/articles-all) through web page access. Both expose content-type navigation, category filters, a top pick and dated linked story lists. The news listing also exposes trending topic links. These observations informed N2's tabs, topic chips, search/sort affordances, compact news rows and separate article list; the composition is NSEDU's own.

Seven paraphrased examples and their original URLs are saved in [N2-content.json](../N2-content.json). The displayed date is the date in the source listing at the research snapshot, not an independently established first-publication time. A JEE Main story separately showed “Updated on Oct 7, 2026 17:30 IST”; some other direct pages failed on follow-up while their listing links remained readable. Source pages can change or disagree with cached listings, so verify status again before publishing a real feed. No official release, deadline, relative time, view count or live connection has been invented.

Chrome access to Shiksha previously returned 403; N2's Shiksha observations are based on readable web text, not a successful screenshot inspection. Existing browser evidence is retained. N2's generated document and campus thumbnails are illustrative covers, not official PDFs or verified campus photography.

## Initial N1 review (historical)

Reviewed 7 October 2026 (IST). The aim is the next NSEDU homepage section: useful education updates and reading, with a distinct editorial layout and the existing wine/taupe palette.

| Reference | Observed pattern | NSEDU adaptation |
| --- | --- | --- |
| [Shiksha news](https://www.shiksha.com/news) | News/articles routes, exam/college categories, board topics, featured stories and publication metadata. | A small topic filter row, compact updates desk and a separate reading area. |
| [CollegeDekho news](https://www.collegedekho.com/news/) | Category navigation, featured story with image/summary, byline/date/reading metadata and supporting article cards. | One student-focused feature and shorter supporting rows suitable for a homepage section. |
| [Careers360 news](https://news.careers360.com/) | Search/topics, latest and featured columns, school/entrance/college categories and image-led stories. | Updates and practical guides have separate headings; scan news without opening every article. |
| [Collegedunia news](https://collegedunia.com/news) | Exam/college news, trending topics, featured lists and subscription forms. | Topic preferences are a compact optional action after useful content. |

**Access evidence:** all four pages were reviewed through web text. The independent Chrome captures loaded **CollegeDekho and Careers360 with HTTP 200**; their screenshots were visually inspected. **Shiksha and Collegedunia returned HTTP 403** in Chrome, so their saved captures are access-denied screens, not successful visual inspections. [Browser evidence](browser-evidence.json) preserves the actual outcomes. Competitor headlines are not copied into NSEDU fixtures.

## Content-source direction

[CBSE](https://www.cbse.gov.in/cbsenew/cbse.html) exposes examination circulars and student resources. [NTA](https://nta.ac.in/) was also reviewed as an official-source entry point for entrance announcements. The CISCE and NCERT homepage web opens failed in this run; no claim of reviewing a current notice from those pages is made. They remain planned source categories for later verification.

For news discovery, the official [NewsAPI Everything documentation](https://newsapi.org/docs/endpoints/everything) supports keyword/domain/date filtering and returns title, source, description, article URL, image URL and publication time. Its content field is truncated to 200 characters. It is a **candidate for later evaluation**, rather than a selected or connected service. Coverage of every Indian board/exam notice and immediate publication are not established by this review. A broad discovery feed and official examination notices should retain distinct source/verification metadata.

The design therefore uses **topic-shaped sample headlines**, not fabricated current results, deadlines, live badges or timestamps. External updates will use short summaries and source links; NSEDU guides will be authored separately. Full source/API selection, refresh behavior and production access are deferred to backend work.
