# B2 — a simpler student budget check

Status: revised image-first proposal. B1 is preserved as the initial concept. Application source is unchanged.

## Student question and hierarchy

Answer one question: **Can this college fit my first-year budget?** Keep the programme, city and admission year visible; explain living costs before suggesting affordable alternatives. This revision builds on the [existing reference research](references/research-notes.md), rather than claiming a new competitor audit.

1. Choose the college/programme, living arrangement and first-year budget in one labeled input row.
2. See the estimated total and the amount remaining or over budget immediately.
3. Scan three understandable cost groups; open the detailed costs only when needed.
4. Find colleges within that budget, or explore scholarships through a separate compact entry.

The opening view removes the slider, whole-course switch, save-plan action, percentages and three scholarship route rows. They distracted from the first decision. Supporting details remain available through a clear disclosure rather than disappearing from the feature.

## Exact illustrative values

| Group | Breakdown | First-year amount |
| --- | --- | ---: |
| College fees | Tuition | ₹2,40,000 |
| Stay & food | Hostel ₹60,000 + meals ₹36,000 | ₹96,000 |
| Other costs | Books/travel ₹24,000 + one-time fees ₹10,000 + refundable deposit ₹5,000 | ₹39,000 |
| Total | Includes the refundable deposit | **₹3,75,000** |
| Student budget | First year | **₹4,00,000** |
| Remaining | Budget minus estimated cost | **₹25,000** |

Northfield Institute, B.Tech, Bengaluru, 2026–27 is a fictional example. Living and additional costs are design fixtures, not verified college data. Scholarships are not deducted, and the preview does not claim scholarship eligibility.

## Visual direction

- Retain wine #72243B, taupe #806C60, ivory #FFFAF8, light greige #F1ECE8, pale rose #EED8DC and charcoal #2A2024.
- Use DM Serif Display for the short question and Plus Jakarta Sans for controls, explanations and amounts.
- One cohesive white planning surface with an input row, three compact cost groups and a lightly tinted result area. One main action: **Find colleges in my budget**.
- Add an unobtrusive study-desk vignette, faint campus/arch linework and a small paper-fold detail to the outer background. Decoration does not cross inputs or reduce text contrast.
- Funding becomes a slim support strip with one **Find scholarships** action. Keep the scholarship search criteria off the initial budget view.
- Desktop uses unequal summary/result columns. Mobile reflows to labeled stacked inputs, then the total/status/action, three compact cost rows and the small funding strip. No horizontal controls or page clipping.

## Interaction contract for later implementation

- No signup is required to begin. Preselect a saved/compared programme only when actual student context exists; otherwise clearly ask for one. The raster example is prefilled to demonstrate the result.
- The budget input accepts positive INR amounts with Indian grouping. An empty input asks for a budget; it must not show a fictional remaining amount. Errors sit beside the field and explain what to enter.
- Programme changes update the fee context; living arrangement changes update the living assumptions. Show the source/year for verified fees and identify estimates. Missing cost data is explicitly unknown, not zero.
- **View detailed costs** expands six labeled rows with editable living estimates and one-time/refundable indicators. Keep the three group totals and result synchronized; use a proper disclosure button with expanded state.
- Budget states: positive = “₹X left in your budget”; zero = “Matches your budget”; negative = “₹X above your budget”. Explain the gap calmly and offer adjustments or alternative colleges. Partial/unverified totals are labeled before giving an affordability conclusion.
- **Find colleges in my budget** carries programme/course, first-year budget and living assumptions into discovery. Present total-cost matches only when the data supports them; explain partial information otherwise.
- **Find scholarships** opens a separate criteria-led search. Awards, deadlines and requirements require a verified source. Funding is not assumed or deducted before confirmation.
- Later controls should have visible keyboard focus, accessible names, at least 44px touch targets, keyboard-operable disclosures and an announced updated result. No animation is necessary for calculation; any decoration is static or respects reduced motion.

## Lightweight implementation plan after design approval

Use existing theme tokens in frontend/src/styles/index.css for all shared colours, type, spacing, borders and radii. Use CSS for paper surfaces and small inline SVG for contours; one optimized decorative WebP with reserved dimensions is enough for the desk illustration. Do not ship these full raster mockups as page backgrounds. Validate actual responsive layout, keyboard operation and calculation behavior during implementation; the current previews cannot prove performance or accessibility.

## Deliverables and validation

B2-desktop.png and B2-mobile.png are revised design previews. Exact prompts are recorded in B2-prompts.json; B2-manifest.json records generated originals, copied assets and inspection results. Review visible labels, Indian currency grouping, cost arithmetic, information priority and theme continuity. No application tests are needed for this documentation/raster-only round.
