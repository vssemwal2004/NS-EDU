# Section 4 — Course Eligibility & Next Steps

Status: historical E1–E3 brief. The user rejected this presentation, then approved E4's study-stage gallery. Section 4 is now implemented with guided questions; see README. The rule/source/result distinctions remain useful; the six-field entry is superseded.

## Purpose and sequence

After students discover locations in Section 2 and inspect programme-level colleges in Section 3, answer their next question: **Which requirements do I meet, and what do I still need before applying?** This placement is a product recommendation, not a measured conversion result.

Primary heading: **Check your course eligibility**. Supporting copy: **Understand the requirements before you apply.** Primary CTA: **Check eligibility**. Secondary help: **Not sure about your course?** Allow an academic check before sign-up; offer account creation to save results after delivering useful information.

Keep the homepage block compact: six primary fields, one main action, a short explanation of the result, and a concise note. Detailed entrance-route inputs belong in a progressive disclosure or follow-up view. Avoid another full-size college table, huge dashboard, promotional hero, fake success metric or mandatory contact form before the first result.

## Research reviewed on 7 October 2026

Public page content was reviewed through web search/open. These observations concern content and workflow patterns; the competitor UI was not recreated pixel-for-pixel and no submission, paid report or logged-in result was tested.

| Reference | Observed pattern | Proposed NSEDU adaptation |
| --- | --- | --- |
| [Shiksha JEE Main College Predictor](https://www.shiksha.com/engineering/jee-main-college-predictor) | College/branch estimates use rank, category, home-state context and historical cutoffs. | Show why an option appears; keep academic requirements distinct from estimates based on prior cutoffs. |
| [Careers360 JEE Main College Predictor](https://engineering.careers360.com/jee-main-college-predictor) and [university predictors](https://university.careers360.com/college-predictor) | Rank/percentile, home state, category and course inputs; report, cutoff and admission-process information. | Make missing entrance-route inputs visible and provide a next-step checklist. |
| [CollegeDekho NEET predictor](https://www.collegedekho.com/exam/neet-ug/college-predictor) | Exam-specific rank/category entry and contact-detail fields for prediction requests. | Use a course-sensitive academic entry and request an account only when the student chooses to save. |
| [Collegedunia JEE Main predictor](https://collegedunia.com/jee-main-college-predictor) | Rank/percentile, category/home-state context and opening/closing-rank-based exploration. | Put historical cutoff exploration in a separate admission-route stage with the data year and source visible. |
| [Official JoSAA portal](https://josaa.nic.in/) | Separately publishes Business Rules, institute/programme restrictions, opening/closing ranks and top-20-percentile information. | Use the actual programme/admission-route rules and their cycle/source to support decisions. Do not turn a previous closing rank into proof of current eligibility or admission. |

Competitor claims about prediction accuracy, popularity or guaranteed outcomes were not adopted. Eligibility rules for individual programmes have not been verified in this design round.

## Primary inputs

1. **Course / programme:** inherit the previous section's course; let students change it. Support undergraduate, postgraduate and relevant diploma routes instead of restricting the whole platform to engineering.
2. **Qualification and completion status:** e.g. Class 12 passed/appearing, diploma, graduation. Follow-ups depend on the selected programme. An appearing result remains provisional or incomplete where required.
3. **Admission year:** evaluate against the appropriate intake's requirements; never silently reuse rules from another year. If current-year official rules are unavailable, display **Requirements not yet verified**.
4. **Subjects studied:** collect individual subjects, not only a stream label, so subject requirements can be explained.
5. **Relevant marks / CGPA:** label the exact basis, e.g. PCM aggregate, overall percentage, specified subject marks or degree CGPA. Ask for the relevant denominator/scale when required. Do not assume an overall percentage equals a subject aggregate or convert CGPA without the institution/board's applicable method.
6. **Entrance exam status:** Not taken yet / Appeared / Result available / No exam applicable to this route. Allow an academic check when exam data is missing, with incomplete route checks clearly identified.

On the homepage, E1 shows the simplified Class 12/B.Tech example. Completion year, board/university, detailed subject marks, qualification equivalence and other conditions can be requested when programme rules require them. Budget and preferred city refine discovery, not academic eligibility.

## Conditional entrance-route inputs

Ask for exam name/session and the actual result type: raw marks, percentile, overall rank or category rank. Keep these distinct; do not silently estimate one from another. Home-state/domicile, category, quota, gender, PwD status or age are requested only where applicable to the official admission route and explain why they are needed. Do not infer personal attributes. Skip or omit irrelevant fields. Prior-year cutoff comparison must identify institution, programme, round, quota/category, rank type, source and year. Offer it as historical context, not a probability or admission guarantee.

## Results and actions

Each result presents the programme/institution, requirement, student's supplied detail, status, short reason, official source, applicable year and verification date. The eventual engine must distinguish:

- **Academic criteria match:** only the academic criteria that have been checked match; do not label full eligibility if route/age/equivalence or other conditions remain unchecked.
- **More details needed:** name the missing marks, subject, document or exam result and provide an **Add details** action.
- **Requirement not met:** show the specific unmet verified criterion and relevant alternatives, without converting it into a statement about every college.
- **Requirements not yet verified:** no affirmative eligibility decision when official rules or their current-cycle applicability cannot be confirmed.

Next actions: Review admission route, Explore relevant colleges, Edit details and Save my check. Saving can lead to an account flow; the homepage check should not imply that an account or application has already been submitted.

For initial frontend implementation, data and rules must be explicitly marked **Illustrative demo**. The existing fictional Section 3 colleges can demonstrate the workflow. No real institution eligibility claims should be generated from sample rules.

## Visual concepts

- **E1 — Compact eligibility desk:** recommended entry. Six labeled controls, a wine Check eligibility CTA, short guidance link and a restrained three-item result explanation in a greige side panel.
- **E2 — Guided eligibility steps:** alternative entry. Three-step navigation, course chips, four initial study fields and optional exam disclosure. Additional steps are proposed; the PNG shows step 1.
- **E3 — Requirements explained:** proposed result state for E1. A compact student summary, requirement-versus-detail table and next actions. Northfield Institute of Technology is fictional; **50% PCM minimum is a fictional demo rule**, compared with a demo 78% PCM aggregate. It is not a universal B.Tech requirement. Entrance-route eligibility is explicitly unchecked. No admission chance is claimed.

Files: E1.png, E2.png and E3.png. Exact generation prompts are in prompts.json. Created with built-in image_gen, using the actual Section 3 screenshot as a palette/type/density reference. Font labels in prompts express intended typography; generated raster lettering and hex colors are approximate. Actual responsive, validation, keyboard and motion behavior require implementation and browser verification.

## Responsive and motion intent

Desktop: compact split panels and aligned 44px-or-larger controls. Tablet: two-column form, with the explanation below when necessary. Mobile: one-column form, concise expandable help, results as labeled requirement rows rather than a squeezed three-column table. Preserve user-entered values between steps; show inline validation without moving focus unexpectedly. Provide visible focus indicators, native labels, accessible status announcements and reduced-motion support. Motion should be limited to selected-state feedback and a short result reveal; no background animation is needed.

No frontend/backend source, existing theme or active site behavior was changed for this content/design round. No tests were rerun because only documentation and raster concepts were created.
