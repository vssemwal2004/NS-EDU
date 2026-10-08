# Section 4 — guided eligibility redesign E4–E6

Date: 7 October 2026 (IST).
Status: **E4 approved and implemented** following the user's request for responsive layouts and the complete flow. E5/E6 remain alternatives. See README and ../implementation/ for actual browser previews and implementation details. The original proposal text below is design history.

## User direction and content

The earlier E1–E3 presentation was rejected as basic and dated. Retain wine/taupe colours but change the background, composition, controls and visual explanation. Keep the check easy and avoid showing every input together.

Entry question: **Where are you in your studies?**

- Studying in Class 12
- Class 12 completed
- College student / graduate
- Secondary route: **Diploma or another qualification? Choose here**

College student/graduate must ask completion status and exact qualification later. The broad entry label is not evidence that the student holds a degree. The PNGs show Class 12 completed selected to demonstrate styling. A new visitor should explicitly choose a stage unless already confirmed in their profile/session.

Then ask relevant course/programme, admission year, qualification details, subjects and correctly labeled marks/CGPA, one focused question at a time. Ask conditional exam details with score/percentile/general rank/category rank distinguished. Ask category/domicile only when applicable. **Studies / Course details / Requirements** are journey groups, not a promise that every check needs exactly three questions.

Use Continue/Next question, with Back/Edit on later steps, and preserve answers. Start without sign-up; offer account saving after a useful review. Results explain academic matches, missing details, unmet criteria or unverified rules, then source/year-aware next actions. A stage answer alone never generates a college match or eligibility verdict. Academic criteria matching does not guarantee admission or establish all entrance-route requirements. The earlier brief's rule/source/result distinctions still apply; its six-field homepage presentation is superseded.

## Visual alternatives

| ID | Presentation | Background and graphics | Action |
| --- | --- | --- | --- |
| E4 | Open study-stage gallery with three illustrated choices | Pale folded-page sweep, shared curved band, tactile notebook/certificate/graduation-cap illustrations | Split wine Continue; selected outline and check indicator |
| E5 | Conversational checker with answer rows and slim progress rail | Cropped greige paper shape, illustrated study-to-requirements-to-campus route | Next question; selected row has wine edge and radio |
| E6 | Horizontal workbench with compact segmented choice track | Greige sweep, fine corner arcs, contained book/certificate artwork | Wine/taupe split Continue; selected wine segment |

**Recommendation:** E4 offers the strongest visual departure; E6 suits compact placement after the college table. E5 offers conversational presentation. These are alternatives for one section, not three additional homepage blocks. No option is treated as approved.

Palette intent: wine `#72243B`, taupe `#806C60`, ivory `#FFFAF8`, greige `#F1ECE8`, text `#2A2024`. Type intent: DM Serif Display and Plus Jakarta Sans. Raster images approximate fonts/colours; central theme values remain authoritative for implementation.

## Reference evidence

Six browser visits were attempted. [Capture script](references/capture.mjs), [retrieval observations](references/observations.json) and screenshots document actual access. No student details were entered or forms submitted.

| Source | Evidence | Adaptation |
| --- | --- | --- |
| [Careers360 JEE predictor](https://engineering.careers360.com/jee-main-college-predictor) | Actual browser screenshot inspected: contextual copy beside exam-details panel with counselling, rank, home state and route inputs. | Clear tool purpose and relevant inputs; no dark palette, sponsor content or accuracy claims copied. |
| [CollegeDekho NEET predictor](https://www.collegedekho.com/exam/neet-ug/college-predictor) | Actual browser screenshot inspected: compact category/rank tool and submit action amid article/sidebar content. | Focused tool and obvious action, without homepage article/sidebar density. |
| [BigFuture College Quiz](https://bigfuture.collegeboard.org/pay-for-college/bigfuture-scholarships/take-the-college-quiz) | Official content describes questions about intended major, GPA and preferences. Browser college-search connection reset. | Question-led discovery reference; does not establish Indian eligibility rules or prove engagement improvement. |
| [UCAS quiz](https://www.ucas.com/careers-quiz) | Official content describes personality/career matching and study pathways. Browser quiz timed out. | Approachable prompts and next-step explanation; career exploration remains separate from eligibility. No pixel-level quiz screen verified. |
| [Shiksha predictor](https://www.shiksha.com/engineering/jee-main-college-predictor) | Public indexed content available; direct browser returned 403 Access Denied. | Exam/programme context; no claim of successful screen inspection. |
| [Collegedunia predictor](https://collegedunia.com/jee-main-college-predictor) | Public text available; browser returned 403. | Cutoff-based discovery remains separate from academic requirement verification. |

These sources support content/interaction patterns. The paper backgrounds, illustrations and layouts are NSEDU proposals, not copied competitor assets. No measured conversion, completion-time, probability or accuracy claim was adopted.

## Responsive and motion intent

- Desktop: compact relative to the hero, with readable choices. Measure actual section height during implementation; PNG dimensions are not browser measurements.
- Tablet: move introductory copy above the question and wrap choices without squeezing labels.
- Mobile: compact stacked answer rows, reduced decorative artwork and Continue close to the active question. Do not shrink a desktop screenshot to fit.
- Accessible radio semantics, visible keyboard focus, indicator plus colour, and at least 44px touch targets.
- Optional brief selection/indicator transition and once-only illustration entrance; remove motion under reduced-motion preference. PNGs are static.

## Saved assets and verification

[E4.png](E4.png), [E5.png](E5.png), [E6.png](E6.png) were generated using **built-in image_gen** and copied into the project, preserving originals. [Exact prompts](prompts.json) use the implemented Section 3 screenshot as a brand reference only.

Outputs were visually inspected for readable stages, palette, selection, qualification route and one-question entry. No eligibility verdict appears. Raster differences from production intent include conceptual heading sizes, subtle tonal button finishes despite requesting flat controls, and added explanatory copy in E4. E4's tertiary choice copy may need tightening to keep diploma/other qualifications on their separate route. No application source changed or application tests rerun. These images do not verify working interactions, mobile behavior or accessibility.
