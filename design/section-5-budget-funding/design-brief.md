# NSEDU Section 5 — College Budget & Funding Planner

Research/design date: 7 October 2026 (IST). Status: **design proposal only, awaiting the user's choice**. No frontend/backend implementation is part of this round.

## Recommended purpose

Help a student answer: **What will this college actually cost in the first year, and which funding routes should I explore?**

The current page already provides discovery, location browsing, course-wise colleges/comparison and academic eligibility. Section 3 explicitly shows tuition excluding living costs; Section 4 reviews academic requirements. A total-cost planner adds a distinct decision task immediately afterward.

This recommendation is an inference from NSEDU's current flow and the reviewed pages. It is not a claim that competitors lack budget or scholarship tools throughout their sites.

## Research and design implications

| Reviewed source | Observed content/pattern | NSEDU design implication |
| --- | --- | --- |
| [Shiksha IIT Madras fees](https://www.shiksha.com/college/iit-madras-indian-institute-of-technology-adyar-chennai-3031/fees) | Tuition, hostel and one-time components; fee-detail expansion; estimated figures flagged. Browser navigation returned 403, so content was reviewed through web retrieval. | Distinguish tuition from the total; retain fee period and refundable deposits. |
| [CollegeDekho homepage](https://www.collegedekho.com/) and [scholarship page](https://www.collegedekho.com/colleges/chandigarh-university-scholarship) | Student journey/counselling actions; scholarship criteria, concessions and renewal conditions. Homepage visually inspected successfully. Scholarship article read through web retrieval. | Provide a clear next action; show criteria/renewal information in scholarship details later. |
| [Collegedunia homepage](https://collegedunia.com/) and [DPCOE fees](https://collegedunia.com/college/13351-dhole-patil-college-of-engineering-dpcoe-pune/courses-fees) | Fee/placement comparison; programme and hostel costs are separated, with mess noted separately. Browser fees page returned 403; web content was available. | Let students change living arrangements and compare like-for-like cost periods. |
| [Careers360 BITSAT fees](https://engineering.careers360.com/articles/bitsat-fee-structure) | Tuition, hostel, mess/electricity advances, admission and deposit components; year-specific fee tables. Page visually inspected successfully. | Break the estimate into understandable components and show source/year when real records exist. |
| [Buddy4Study](https://www.buddy4study.com/) and [government scholarship guide](https://www.buddy4study.com/article/government-scholarships) | Funding search and scholarship opportunities; benefit, eligibility and application information. Homepage visually inspected successfully; article read. | A compact scholarship-discovery entry belongs next to the plan; no inferred award or made-up match count. |
| [BigFuture cost guidance](https://bigfuture.collegeboard.org/pay-for-college/get-started/focus-on-net-price-not-sticker-price) and [MyinTuition tools](https://bigfuture.collegeboard.org/pay-for-college/get-started/myintuition-estimators) | Early cost estimation, cost of attendance and aid-adjusted net price. US context supplies a UX idea, not Indian rules. Screenshot initially includes a cookie overlay. | Offer a useful quick estimate before a long financial form; distinguish confirmed awards from opportunities. |
| [National Scholarship Portal](https://scholarships.gov.in/) | Official academic-year and scholarship application information. Content read; no application submitted. | Official scheme criteria/status must be checked before publishing scheme details. |

Six browser navigation attempts and their captures are preserved in [references/browser-evidence.json](references/browser-evidence.json). Four returned 200; two returned 403. BigFuture's screenshot was partly covered by its cookie panel. Do not count denied/partly obscured pages as complete visual inspections. Searches also found BITS official fee URLs, but direct retrieval failed; no real BITS figures are used in the design.

## Why this section rather than another listing

- **Budget/funding — recommended Section 5:** adds living costs and a practical affordability decision after academic eligibility.
- **Admissions/deadline timeline — possible Section 6:** important before applying; needs verified, current exam/institution dates.
- **Career guidance — possible Section 7:** helps students reconsider a course, explore roles and ask focused questions.
- **News/articles — possible Section 8:** useful supporting content after the core decision tools.

This sequence is a proposal; later sections have not been approved.

## Content visible in the first design

Headline: **Know the cost. Plan with confidence.**

Description: **Tuition is just the start. Include living costs and explore funding options.**

The primary area is a compact planning worksheet rather than another oversized hero, repeated college table or study-stage card gallery. Use a smaller control rail beside a prominent cost breakdown, with a separate narrow funding panel. Unequal widths and a clear horizontal hierarchy distinguish it from Sections 2–4.

- Programme context: fictional **Northfield Institute (demo)**, B.Tech, Bengaluru, academic year 2026–27. Reuse a student's earlier course/location/college choice when available; otherwise show a labeled sample scenario.
- Controls: **First-year budget**, editable INR amount/range; **Living arrangement**, Hostel / Rental / At home; **First year / Whole course** period selection. Whole-course estimates need duration/year-specific assumptions, not an unexplained multiple of first-year costs.
- Cost output: first-year total, a labeled tuition/living/other stacked ribbon and six concise cost rows. Identify refundable deposits as a cash requirement that can be returned, not a recurring charge.
- Budget status: either remaining budget or amount over budget; do not imply an institution's costs are verified when they are estimates.
- Primary action: **Explore colleges in my budget**. Secondary actions: **Edit assumptions**, **Save plan** after useful output.
- Funding panel: **Find ways to fund it**, with Merit-based / Need-based / State schemes and **Explore scholarships**. Show opportunities, not awards; require criteria/deadline verification on scheme detail pages. No automatic scholarship deduction, fabricated savings, match percentages or guaranteed scholarship amounts.

## Exact illustrative arithmetic

These amounts are fictional design fixtures, not real college prices. Tuition aligns with NSEDU's existing Northfield B.Tech demo record; all other components are new illustrative assumptions.

| Component | First-year cash requirement |
| --- | ---: |
| Tuition | ₹2,40,000 |
| Hostel | ₹60,000 |
| Meals | ₹36,000 |
| Books & travel | ₹24,000 |
| One-time fees | ₹10,000 |
| Refundable deposit | ₹5,000 |
| **Total** | **₹3,75,000** |
| Student first-year budget | ₹4,00,000 |
| **Remaining budget** | **₹25,000** |

Recurring sample annual components sum to ₹3,60,000; ₹15,000 is first-year-only cash (including the ₹5,000 refundable deposit). No aid is assumed. The ribbon groups ₹2,40,000 tuition, ₹96,000 living and ₹39,000 other into 64%, 25.6% and 10.4% respectively. A future fee increase/whole-course scenario must disclose its assumptions and keep one-time/deposit items from recurring each year.

Small UI note: **Illustrative amounts. Scholarships are not deducted.** Deposit row: **₹5,000 · refundable**.

## Visual direction

- Preserve wine **#72243B**, warm taupe **#806C60**, ivory **#FFFAF8**, white, greige **#F1ECE8**, rose **#EED8DC** and dark text **#2A2024**.
- DM Serif Display headings; Plus Jakarta Sans for controls, explanatory labels and tabular numbers.
- Wide, flat, front-facing section preview; centered content, generous but controlled gutters. Desktop target approximately 600–680px rendered section height at normal sizes; heading 36–44px, controls/body 14–16px.
- A single refined worksheet with fine internal rules and a cost ribbon; a smaller funding panel uses one restrained envelope/award-paper illustration. No giant decorative art or repeated three-card layout.
- Background uses faint stationery/grid linework at outer edges and a small soft taupe wash. Keep the content area clear. Avoid blue, glass, neon, noisy patterns, gold-heavy loan advertising or a large background blob.
- Mobile reflows the same content into context → controls → total/breakdown → primary action → funding routes. Budget fields remain 16px minimum and touch controls at least 44px; content can scroll naturally.
- Later motion intent: subtle bar/value interpolation after a deliberate input change, restrained focus/selection transitions; disable decorative motion for reduced-motion preference. Use CSS/SVG and optimized small assets in implementation.

## Data and future behavior

Each real fee component needs programme/campus/year, amount/currency, annual/semester/one-time basis, mandatory/optional status, refundable flag, source URL and verified date. Separate official amounts from living estimates and user overrides. Missing components must remain **not provided** rather than becoming zero. Prevent double-counting included mess/hostel costs. Confirmed aid can reduce net payable only once its applicable period and covered component are known. Loans belong to a separate optional guidance flow because borrowing changes payment timing rather than reducing college cost.

Budget exploration should work without registration. Saving a plan can later use the student's account. No family income, identity documents, phone number or scholarship application is collected in this design round.

## Deliverables

First generate a desktop section concept, then a mobile reflow of that concept. Save the exact prompts alongside both PNGs. These are raster design previews, not working controls or an implemented calculator.

Completed previews: [B1 desktop](B1-desktop.png), [B1 mobile](B1-mobile.png). Generated with **built-in image_gen**. [Exact prompts](prompts.json) and [asset/review manifest](manifest.json) are saved alongside them. Both previews retain the correct illustrative amounts and labels; image-rendered controls/charts do not demonstrate actual interactions or precise layout measurements. Frontend/backend implementation awaits the user's design direction.
