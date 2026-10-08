# Eligibility and budget visual refinement

7 October 2026 (IST)

The student requested more engaging backgrounds and headings for Sections 4 and 5 while retaining the recently reduced sizing and NSEDU's wine/taupe theme. This revision is implemented in the working Next.js frontend.

## Eligibility

- A warm, curved paper wash, restrained dot field, orbital lines and academic icon stamps replace the sparse contours.
- A compact illustrated path connects a notebook, certificate and graduation cap beside the introduction on desktop. Tablet/mobile hide this secondary artwork to preserve space.
- The title combines a small sans-serif introduction with serif display words, an italic accent and a fine underline. The active question uses stronger sans-serif typography and a topic icon.
- Stage cards use bordered paper gradients, circular artwork frames and a rose selection treatment. The progress rail now displays step numbers before completion checkmarks.

## Budget

- A different diagonal ivory/rose surface, savings icon details and restrained campus linework distinguish the section while matching the eligibility palette.
- The heading combines a sans-serif question with a serif accent on “your budget?”. Notebook, wallet, rupee and sparkle details form a compact decorative cluster.
- The result panel has a small wallet medallion, corner surface and rose border. Amounts reserve room for the artwork, including long amounts on mobile.
- Cost-group icons use the same shaped tile recipe as the academic question icon. Funding remains a small support strip.

## Implementation and constraints

`frontend/src/styles/index.css` owns the new colours, gradients, font selections and visual surface recipes. `SectionVisuals.js` and its CSS module provide reusable native SVG/CSS artwork; the shared icon component gains wallet and sparkle paths. No additional fonts, raster assets, dependencies, decorative timers or animation libraries are introduced. Existing WebP assets remain lazy-loaded.

Decoration is excluded from the accessibility tree and pointer interaction. Small screens reduce decorative density and omit the campus sketch so footnotes remain clear. Form labels, calculation rules, static data, eligibility flow and fixed-header behavior are retained. Editable mobile inputs remain at least 16px and action targets remain at least 44px.

## Browser evidence

The `before/` and `after/` folders contain actual website screenshots, including desktop, tablet and mobile entries, viewport captures with the fixed header, later eligibility questions/review and expanded budget details. `capture.mjs` checks 14 widths from 320px to 1920px. Isolated captures preserve width but extend viewport height and temporarily hide the header to avoid cropped painting.

`validation.json` records the final responsive measurements and relevant tests, lint and build outcomes.
