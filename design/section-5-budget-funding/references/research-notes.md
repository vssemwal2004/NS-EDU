# Section 5 reference review

Reviewed on 7 October 2026 (IST). Sources support content and UX decisions; they do not supply the fictional preview prices.

## Read public pages

1. [Shiksha homepage](https://www.shiksha.com/) — broad course/exam navigation and student discovery.
2. [Shiksha IIT Madras fees](https://www.shiksha.com/college/iit-madras-indian-institute-of-technology-adyar-chennai-3031/fees) — tuition, hostel, one-time fee/deposit distinctions and course-period details.
3. [CollegeDekho homepage](https://www.collegedekho.com/) — discovery, career-guidance and application journey actions. Browser screenshot captured successfully.
4. [CollegeDekho Chandigarh scholarship page](https://www.collegedekho.com/colleges/chandigarh-university-scholarship) — scholarship categories and criteria/renewal information; not treated as authority for actual scholarship decisions.
5. [Collegedunia homepage](https://collegedunia.com/) — fees/placement comparisons and course browsing.
6. [Collegedunia ranked-college directory](https://collegedunia.com/collegedunia-ranked-colleges) — fee filters and comparison actions; listing ranks/figures are not copied into NSEDU.
7. [Collegedunia DPCOE fees](https://collegedunia.com/college/13351-dhole-patil-college-of-engineering-dpcoe-pune/courses-fees) — separation of programme/hostel/mess costs and academic-year context. Browser access denied; web text available.
8. [Careers360 homepage](https://www.careers360.com/) — comparisons, college tools, careers and guidance links.
9. [Careers360 BITSAT fee structure](https://engineering.careers360.com/articles/bitsat-fee-structure) — itemized tuition, hostel, mess/electricity advances, admission and deposit costs. Browser screenshot captured successfully.
10. [Buddy4Study homepage](https://www.buddy4study.com/) — scholarship search and funding entry points. Browser screenshot captured successfully.
11. [Buddy4Study government scholarship guide](https://www.buddy4study.com/article/government-scholarships) — benefit, criteria, deadline and application information fields. No actual scholarship claim/amount is made in the preview.
12. [BigFuture net-price guidance](https://bigfuture.collegeboard.org/pay-for-college/get-started/focus-on-net-price-not-sticker-price) — distinguishes cost of attendance from aid-adjusted cost; a US UX reference. Browser page loaded but cookie overlay obscured part of its screenshot.
13. [BigFuture MyinTuition estimators](https://bigfuture.collegeboard.org/pay-for-college/get-started/myintuition-estimators) — lightweight early exploration before detailed financial inputs; a US UX reference.
14. [National Scholarship Portal](https://scholarships.gov.in/) — official Indian scheme/academic-year information. Page read without opening an application or providing student data.

## Access and interpretation

Browser evidence: [capture script](capture.mjs), [navigation/text/status records](browser-evidence.json), six PNG captures. Four 200 responses and two 403 responses. The failed Shiksha/Collegedunia browser pages are recorded as access failures, not visual reviews. BigFuture's cookie overlay limits its visual evidence. Both failed browser sites still had text available through web retrieval, which was used for the content review.

Attempts to open `https://www.collegedekho.com/articles/scholarships-in-india/`, `https://admissions.bits-pilani.ac.in/FD/FD_fee.html` and `https://www.bits-pilani.ac.in/admissions/fees/` failed through the web tool. They are not counted as read pages. Search snippets alone are not used as proof of current real prices or scheme rules.

## Decision

Recommend a college-budget/funding section after eligibility. The reviewed examples already contain fee breakdowns, scholarships and cost estimators; NSEDU's opportunity is to connect these ideas in its own student journey using a clear, compact planning surface. No claim is made that these features are absent across competitor platforms.

Use a total-cost breakdown, a visible first-year period, an editable living arrangement and a budget delta. Keep scholarship discovery adjacent and show an explicit zero automatic deduction. Real costs need source/year/status; unknown expenses cannot silently become zero. Actual aid must have verified criteria and confirmed award status before changing the payable amount.
