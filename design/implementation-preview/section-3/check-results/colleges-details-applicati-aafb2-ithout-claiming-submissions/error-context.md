# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: colleges.spec.js >> details, application checklist and directory are usable without claiming submissions
- Location: tests\colleges.spec.js:102:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('dialog', { name: 'Northfield Institute of Technology', exact: true })
Expected substring: "Annual tuition · 2026–27"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByRole('dialog', { name: 'Northfield Institute of Technology', exact: true }) with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'Northfield Institute of Technology', exact: true })

```

```yaml
- banner:
  - link "Skip to main content":
    - /url: "#main"
  - link "NSEDU home":
    - /url: /
    - text: NSEDU Discover Learn Belong
  - search:
    - button "Search NSEDU"
    - text: Search NSEDU
    - textbox "Search NSEDU":
      - /placeholder: Search colleges, courses, exams or anything...
  - text: Preferred city
  - combobox "Preferred city":
    - option "Select city" [selected]
    - option "Bengaluru"
    - option "Pune"
    - option "Delhi NCR"
    - option "Mumbai"
    - option "Hyderabad"
    - option "Chennai"
    - option "Ahmedabad"
    - option "Kolkata"
  - button "Log in"
  - button "Create account"
  - navigation "Main navigation":
    - group: Colleges
    - group: Courses
    - group: Exams
    - button "Compare"
    - button "Scholarships"
    - button "Career guidance"
    - group: Resources
- main:
  - region "Find a college that fits your future.":
    - img "Three students exploring their next chapter together in a university library"
    - heading "Find a college that fits your future." [level=1]
    - paragraph: Explore India’s top colleges, courses and career paths — with clarity, not confusion.
    - tablist "What would you like to explore?":
      - tab "Colleges" [selected]
      - tab "Courses"
      - tab "Exams"
    - tabpanel "Colleges":
      - search:
        - text: Search colleges
        - textbox "Search colleges":
          - /placeholder: Search by college name, course or city
        - button "Search"
    - navigation "Explore by field":
      - button "Engineering"
      - button "Management"
      - button "Medical"
      - button "Design"
      - button "Law"
      - button "Commerce"
  - region "Popular courses and student resources":
    - heading "Explore popular courses" [level=2]
    - paragraph: Start with a course that interests you.
    - navigation "Popular courses":
      - button "B.Tech"
      - button "MBA"
      - button "B.Com"
      - button "BCA"
      - button "MBBS"
      - button "B.Des"
    - button "All courses"
    - navigation "Tools for your college journey":
      - button "Compare colleges Fees, courses and facilities":
        - heading "Compare colleges" [level=3]
        - text: Fees, courses and facilities
      - button "Check eligibility Understand admission requirements":
        - heading "Check eligibility" [level=3]
        - text: Understand admission requirements
      - button "Explore scholarships Find funding options":
        - heading "Explore scholarships" [level=3]
        - text: Find funding options
      - button "Career guidance Explore suitable career paths":
        - heading "Career guidance" [level=3]
        - text: Explore suitable career paths
  - region "Explore where you want to study":
    - heading "Explore where you want to study" [level=2]
    - text: "Course: Choose a course for location browsing"
    - 'combobox "Course: Choose a course for location browsing"':
      - option "All courses" [selected]
      - option "B.Tech"
      - option "MBA"
      - option "B.Com"
      - option "BCA"
      - option "MBBS"
      - option "B.Des"
      - option "LL.B"
      - option "BBA"
      - option "M.Tech"
      - option "B.Pharm"
      - option "B.Sc Nursing"
      - option "BA"
      - option "BAMS"
      - option "BHMS"
      - option "BDS"
      - option "BHM"
    - paragraph: Choose a city or state to explore colleges, courses and fees.
    - button "View all locations"
    - navigation "Study destinations by city":
      - button "Explore colleges in Delhi NCR":
        - img "India Gate — illustrative Delhi NCR landmark"
        - text: Delhi NCR Explore colleges
      - button "Explore colleges in Bengaluru":
        - img "Vidhana Soudha — illustrative Bengaluru landmark"
        - text: Bengaluru Explore colleges
      - button "Explore colleges in Mumbai":
        - img "Gateway of India — illustrative Mumbai landmark"
        - text: Mumbai Explore colleges
      - button "Explore colleges in Hyderabad":
        - img "Charminar — illustrative Hyderabad landmark"
        - text: Hyderabad Explore colleges
      - button "Explore colleges in Pune":
        - img "Shaniwar Wada — illustrative Pune landmark"
        - text: Pune Explore colleges
      - button "Explore colleges in Chennai":
        - img "Chennai Central Station — illustrative Chennai landmark"
        - text: Chennai Explore colleges
    - region "Explore states to study in India":
      - heading "Explore states to study in India" [level=2]
      - paragraph: Browse colleges across cities within your preferred state.
      - button "View all states"
      - navigation "Study destinations by state":
        - button "Explore colleges in Madhya Pradesh":
          - img "Sanchi Stupa — illustrative Madhya Pradesh landmark"
          - text: Madhya Pradesh
        - button "Explore colleges in Karnataka":
          - img "Mysore Palace — illustrative Karnataka landmark"
          - text: Karnataka
        - button "Explore colleges in Maharashtra":
          - img "Ajanta caves — illustrative Maharashtra landmark"
          - text: Maharashtra
        - button "Explore colleges in Uttar Pradesh":
          - img "Taj Mahal — illustrative Uttar Pradesh landmark"
          - text: Uttar Pradesh
        - button "Explore colleges in Telangana":
          - img "Golconda Fort — illustrative Telangana landmark"
          - text: Telangana
        - button "Explore colleges in Tamil Nadu":
          - img "Mahabalipuram Shore Temple — illustrative Tamil Nadu landmark"
          - text: Tamil Nadu
    - paragraph: Your course choice carries into location results.
  - region "Course-wise colleges in India":
    - heading "Course-wise colleges in India" [level=2]
    - paragraph: Explore fees, placements and reviews for your preferred course.
    - button "View all colleges"
    - text: Static demo data
    - tablist "College courses":
      - tab "B.Tech" [selected]
      - tab "MBA"
      - tab "MBBS"
      - tab "B.Com"
      - tab "BBA"
      - tab "BCA"
      - tab "B.Des"
      - tab "M.Tech"
      - tab "B.Pharm"
      - tab "Law"
      - tab "Nursing"
    - button "More"
    - heading "B.Tech colleges" [level=3]
    - text: "5 sample colleges Location:"
    - combobox "College location":
      - option "All India" [selected]
    - text: "Annual fee:"
    - combobox "Maximum annual tuition":
      - option "Any budget" [selected]
      - option "Up to ₹1,00,000"
      - option "Up to ₹1,50,000"
      - option "Up to ₹2,00,000"
      - option "Up to ₹3,00,000"
      - option "Up to ₹8,00,000"
    - text: "Sort:"
    - combobox "Sort colleges":
      - option "Default" [selected]
      - 'option "Fee: low to high"'
      - 'option "Fee: high to low"'
      - option "Median salary"
      - option "Demo rating"
    - tabpanel "B.Tech sample colleges":
      - table "B.Tech college comparison preview":
        - rowgroup:
          - row "# College Annual tuition 2026–27 Placements 2024–25 Demo rating Actions":
            - columnheader "#"
            - columnheader "College"
            - columnheader "Annual tuition 2026–27"
            - columnheader "Placements 2024–25"
            - columnheader "Demo rating"
            - columnheader "Actions"
        - rowgroup:
          - row "List position 1 Illustrative campus image for Northfield Institute of Technology Northfield Institute of Technology Bengaluru, Karnataka B.Tech Save Northfield Institute of Technology ₹2,40,000 per year Median ₹8.4 LPA Highest ₹22 LPA 4.3 / 5 Compare Northfield Institute of Technology Compare View details Apply now":
            - cell "List position 1": "1"
            - cell "Illustrative campus image for Northfield Institute of Technology Northfield Institute of Technology Bengaluru, Karnataka B.Tech Save Northfield Institute of Technology":
              - img "Illustrative campus image for Northfield Institute of Technology"
              - button "Northfield Institute of Technology"
              - paragraph: Bengaluru, Karnataka
              - text: B.Tech
              - button "Save Northfield Institute of Technology": Save
            - cell "₹2,40,000 per year":
              - strong: ₹2,40,000
              - text: per year
            - cell "Median ₹8.4 LPA Highest ₹22 LPA":
              - text: Median
              - strong: ₹8.4 LPA
              - text: Highest ₹22 LPA
            - cell "4.3 / 5":
              - strong: "4.3"
              - text: / 5
            - cell "Compare Northfield Institute of Technology Compare View details Apply now":
              - checkbox "Compare Northfield Institute of Technology" [checked]
              - text: Compare
              - button "View details"
              - button "Apply now"
          - row "List position 2 Illustrative campus image for Meadow Engineering College Meadow Engineering College Pune, Maharashtra B.Tech Save Meadow Engineering College ₹1,80,000 per year Median ₹6.8 LPA Highest ₹18 LPA 4.2 / 5 Compare Meadow Engineering College Compare View details Apply now":
            - cell "List position 2": "2"
            - cell "Illustrative campus image for Meadow Engineering College Meadow Engineering College Pune, Maharashtra B.Tech Save Meadow Engineering College":
              - img "Illustrative campus image for Meadow Engineering College"
              - button "Meadow Engineering College"
              - paragraph: Pune, Maharashtra
              - text: B.Tech
              - button "Save Meadow Engineering College": Save
            - cell "₹1,80,000 per year":
              - strong: ₹1,80,000
              - text: per year
            - cell "Median ₹6.8 LPA Highest ₹18 LPA":
              - text: Median
              - strong: ₹6.8 LPA
              - text: Highest ₹18 LPA
            - cell "4.2 / 5":
              - strong: "4.2"
              - text: / 5
            - cell "Compare Meadow Engineering College Compare View details Apply now":
              - checkbox "Compare Meadow Engineering College"
              - text: Compare
              - button "View details"
              - button "Apply now"
          - row "List position 3 Illustrative campus image for Central Institute of Technology Central Institute of Technology Hyderabad, Telangana B.Tech Save Central Institute of Technology ₹2,10,000 per year Median ₹7.6 LPA Highest ₹20 LPA 4.4 / 5 Compare Central Institute of Technology Compare View details Apply now":
            - cell "List position 3": "3"
            - cell "Illustrative campus image for Central Institute of Technology Central Institute of Technology Hyderabad, Telangana B.Tech Save Central Institute of Technology":
              - img "Illustrative campus image for Central Institute of Technology"
              - button "Central Institute of Technology"
              - paragraph: Hyderabad, Telangana
              - text: B.Tech
              - button "Save Central Institute of Technology": Save
            - cell "₹2,10,000 per year":
              - strong: ₹2,10,000
              - text: per year
            - cell "Median ₹7.6 LPA Highest ₹20 LPA":
              - text: Median
              - strong: ₹7.6 LPA
              - text: Highest ₹20 LPA
            - cell "4.4 / 5":
              - strong: "4.4"
              - text: / 5
            - cell "Compare Central Institute of Technology Compare View details Apply now":
              - checkbox "Compare Central Institute of Technology" [checked]
              - text: Compare
              - button "View details"
              - button "Apply now"
          - row "List position 4 Illustrative campus image for Riverside University Riverside University Chennai, Tamil Nadu B.Tech Save Riverside University ₹1,60,000 per year Median ₹6.2 LPA Highest ₹16 LPA 4.1 / 5 Compare Riverside University Compare View details Apply now":
            - cell "List position 4": "4"
            - cell "Illustrative campus image for Riverside University Riverside University Chennai, Tamil Nadu B.Tech Save Riverside University":
              - img "Illustrative campus image for Riverside University"
              - button "Riverside University"
              - paragraph: Chennai, Tamil Nadu
              - text: B.Tech
              - button "Save Riverside University": Save
            - cell "₹1,60,000 per year":
              - strong: ₹1,60,000
              - text: per year
            - cell "Median ₹6.2 LPA Highest ₹16 LPA":
              - text: Median
              - strong: ₹6.2 LPA
              - text: Highest ₹16 LPA
            - cell "4.1 / 5":
              - strong: "4.1"
              - text: / 5
            - cell "Compare Riverside University Compare View details Apply now":
              - checkbox "Compare Riverside University"
              - text: Compare
              - button "View details"
              - button "Apply now"
          - row "List position 5 Illustrative campus image for Hillside Engineering Institute Hillside Engineering Institute Delhi NCR B.Tech Save Hillside Engineering Institute ₹2,20,000 per year Median ₹7.8 LPA Highest ₹21 LPA 4.3 / 5 Compare Hillside Engineering Institute Compare View details Apply now":
            - cell "List position 5": "5"
            - cell "Illustrative campus image for Hillside Engineering Institute Hillside Engineering Institute Delhi NCR B.Tech Save Hillside Engineering Institute":
              - img "Illustrative campus image for Hillside Engineering Institute"
              - button "Hillside Engineering Institute"
              - paragraph: Delhi NCR
              - text: B.Tech
              - button "Save Hillside Engineering Institute": Save
            - cell "₹2,20,000 per year":
              - strong: ₹2,20,000
              - text: per year
            - cell "Median ₹7.8 LPA Highest ₹21 LPA":
              - text: Median
              - strong: ₹7.8 LPA
              - text: Highest ₹21 LPA
            - cell "4.3 / 5":
              - strong: "4.3"
              - text: / 5
            - cell "Compare Hillside Engineering Institute Compare View details Apply now":
              - checkbox "Compare Hillside Engineering Institute"
              - text: Compare
              - button "View details"
              - button "Apply now"
    - strong: 2 colleges selected
    - text: Northfield · Central
    - button "Clear"
    - button "Compare colleges"
    - paragraph: Illustrative colleges and values · Not a ranking · Tuition excludes hostel/living costs.
    - status
- alert
```

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 42

- Array []
+ Array [
+   "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:
+
+ - A server/client branch `if (typeof window !== 'undefined')`.
+ - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
+ - Date formatting in a user's locale which doesn't match the server.
+ - External changing data without sending a snapshot of it along with the HTML.
+ - Invalid HTML tag nesting.
+
+ It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.
+
+ https://react.dev/link/hydration-mismatch
+
+   ...
+     <RenderFromTemplateContext>
+       <ScrollAndMaybeFocusHandler cacheNode={{rsc:Promise, ...}}>
+         <InnerScrollHandlerNew focusAndScrollRef={{scrollRef:null, ...}} cacheNode={{rsc:Promise, ...}}>
+           <ErrorBoundary errorComponent={undefined} errorStyles={undefined} errorScripts={undefined}>
+             <LoadingBoundary name=\"/\" loading={null}>
+               <HTTPAccessFallbackBoundary notFound={<SegmentViewNode>} forbidden={undefined} unauthorized={undefined}>
+                 <HTTPAccessFallbackErrorBoundary pathname=\"/\" notFound={<SegmentViewNode>} forbidden={undefined} ...>
+                   <RedirectBoundary>
+                     <RedirectErrorBoundary router={{...}}>
+                       <InnerLayoutRouter url=\"/\" tree={[...]} params={{}} cacheNode={{rsc:Promise, ...}} ...>
+                         <SegmentViewNode type=\"page\" pagePath=\"page.js\">
+                           <SegmentTrieNode>
+                           <Home>
+                             <LandingPage collegeRecords={[...]}>
+                               <div
+ +                               className=\"Landing-module__H_TZ-W__shell\"
+ -                               className={null}
+ -                               hidden=\"\"
+                               >
+                                 <Header city=\"\" onCityChange={function bound dispatchSetState} ...>
+ +                                 <header className=\"Header-module__5lwFSW__header\" ref={{current:null}}>
+ -                                 <Suspense>
+                                 ...
+                         ...
+                       ...
+           ...
+ ",
+ ]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const explorer = (page) => page.locator('#course-colleges');
  4   | const rows = (page) => explorer(page).locator('tbody tr');
  5   | const northfield = 'Northfield Institute of Technology';
  6   | const central = 'Central Institute of Technology';
  7   | 
  8   | test.beforeEach(async ({ page }) => {
  9   |   page.browserErrors = [];
  10  |   page.on('pageerror', (error) => page.browserErrors.push(error.message));
  11  |   await page.goto('/');
  12  |   await explorer(page).scrollIntoViewIfNeeded();
  13  | });
> 14  | test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });
      |                                                                 ^ Error: expect(received).toEqual(expected) // deep equality
  15  | 
  16  | test('approved preview has five course-specific rows and honest data labels', async ({ page }) => {
  17  |   const section = explorer(page);
  18  |   await expect(rows(page)).toHaveCount(5);
  19  |   await expect(rows(page).first()).toContainText('₹2,40,000');
  20  |   await expect(rows(page).first()).toContainText('₹8.4 LPA');
  21  |   await expect(section).toContainText('Static demo data');
  22  |   await expect(section).toContainText('Not a ranking');
  23  |   await expect(section).toContainText('2026–27');
  24  |   await expect(section).toContainText('2024–25');
  25  |   await expect(section.getByRole('checkbox', { checked: true })).toHaveCount(2);
  26  |   await expect(section).toContainText('Northfield · Central');
  27  | });
  28  | 
  29  | test('courses share context with destinations and use different programme records', async ({ page }) => {
  30  |   const section = explorer(page);
  31  |   await section.getByRole('tab', { name: 'MBA', exact: true }).click();
  32  |   await expect(page.locator('#destination-course')).toHaveValue('mba');
  33  |   await expect(rows(page)).toHaveCount(2);
  34  |   await expect(rows(page).first()).toContainText('Meadow School of Management');
  35  |   await expect(rows(page).first()).toContainText('₹2,60,000');
  36  |   await expect(section.getByRole('checkbox', { checked: true })).toHaveCount(0);
  37  |   await section.getByRole('tab', { name: 'MBBS', exact: true }).click();
  38  |   await expect(rows(page)).toHaveCount(1);
  39  |   await expect(rows(page)).toContainText('Not provided');
  40  |   await expect(rows(page)).not.toContainText('LPA');
  41  |   await section.getByRole('button', { name: 'More', exact: true }).click();
  42  |   await page.getByRole('dialog', { name: 'Explore more courses' }).getByRole('button', { name: 'BA', exact: true }).click();
  43  |   await expect(page.getByRole('dialog')).not.toBeVisible();
  44  |   await expect(rows(page)).toContainText('Riverside College of Arts and Commerce');
  45  |   await expect(rows(page)).toContainText('₹70,000');
  46  |   await page.locator('#destination-course').selectOption('bca');
  47  |   await expect(rows(page)).toHaveCount(3);
  48  |   await expect(section.getByRole('tab', { name: 'BCA', exact: true })).toHaveAttribute('aria-selected', 'true');
  49  | });
  50  | 
  51  | test('keyboard tabs, intersection filters, sorting and empty recovery work', async ({ page }) => {
  52  |   const section = explorer(page);
  53  |   await section.getByRole('tab', { name: 'B.Tech', exact: true }).focus();
  54  |   await page.keyboard.press('ArrowRight');
  55  |   await expect(section.getByRole('tab', { name: 'MBA', exact: true })).toBeFocused();
  56  |   await page.keyboard.press('Home');
  57  |   await expect(section.getByRole('tab', { name: 'B.Tech', exact: true })).toBeFocused();
  58  |   await section.getByLabel('Sort colleges').selectOption('fee-asc');
  59  |   await expect(rows(page).first()).toContainText('Riverside University');
  60  |   await section.getByLabel('Sort colleges').selectOption('salary');
  61  |   await expect(rows(page).first()).toContainText(northfield);
  62  |   await section.getByLabel('Sort colleges').selectOption('rating');
  63  |   await expect(rows(page).first()).toContainText(central);
  64  |   await section.getByLabel('Maximum annual tuition').selectOption('200000');
  65  |   await expect(rows(page)).toHaveCount(2);
  66  |   await section.getByLabel('College location').selectOption('Maharashtra');
  67  |   await expect(rows(page)).toHaveCount(1);
  68  |   await expect(rows(page)).toContainText('Meadow Engineering College');
  69  |   await section.getByLabel('Maximum annual tuition').selectOption('100000');
  70  |   await expect(section.getByRole('heading', { name: 'No sample colleges match these filters' })).toBeVisible();
  71  |   await section.getByRole('button', { name: 'Reset filters', exact: true }).click();
  72  |   await expect(rows(page)).toHaveCount(5);
  73  |   await expect(section.getByRole('tab', { name: 'B.Tech', exact: true })).toHaveAttribute('aria-selected', 'true');
  74  | });
  75  | 
  76  | test('saving is retained across courses and comparison enforces three same-course choices', async ({ page }) => {
  77  |   const section = explorer(page);
  78  |   await section.getByRole('button', { name: `Save ${northfield}`, exact: true }).click();
  79  |   await expect(section.getByRole('status')).toContainText('saved for this visit');
  80  |   await section.getByRole('tab', { name: 'BCA', exact: true }).click();
  81  |   await expect(section.getByRole('button', { name: `Save ${northfield}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  82  |   await section.getByRole('tab', { name: 'B.Tech', exact: true }).click();
  83  |   await section.getByRole('checkbox', { name: 'Compare Meadow Engineering College', exact: true }).check();
  84  |   await section.getByRole('checkbox', { name: 'Compare Riverside University', exact: true }).click();
  85  |   await expect(section.getByRole('checkbox', { name: 'Compare Riverside University', exact: true })).not.toBeChecked();
  86  |   await expect(section.getByRole('status')).toContainText('up to 3 colleges');
  87  |   await section.getByLabel('College location').selectOption('Bengaluru');
  88  |   await expect(rows(page)).toHaveCount(1);
  89  |   await section.getByRole('button', { name: 'Compare colleges', exact: true }).click();
  90  |   const dialog = page.getByRole('dialog', { name: 'Compare selected colleges' });
  91  |   await expect(dialog.getByRole('article')).toHaveCount(3);
  92  |   await expect(dialog).toContainText('₹2,40,000');
  93  |   await expect(dialog).toContainText('₹1,80,000');
  94  |   await dialog.getByRole('button', { name: 'Remove Meadow Engineering College from comparison' }).click();
  95  |   await expect(dialog.getByRole('article')).toHaveCount(2);
  96  |   await page.keyboard.press('Escape');
  97  |   await expect(section.getByRole('button', { name: 'Compare colleges', exact: true })).toBeFocused();
  98  |   await section.getByRole('button', { name: 'Clear', exact: true }).click();
  99  |   await expect(section.getByRole('button', { name: 'Compare colleges', exact: true })).toBeDisabled();
  100 | });
  101 | 
  102 | test('details, application checklist and directory are usable without claiming submissions', async ({ page }) => {
  103 |   const section = explorer(page);
  104 |   const trigger = rows(page).first().getByRole('button', { name: 'View details', exact: true });
  105 |   await trigger.click();
  106 |   const details = page.getByRole('dialog', { name: northfield, exact: true });
  107 |   await expect(details).toContainText('Annual tuition · 2026–27');
  108 |   await details.getByRole('button', { name: 'Application checklist', exact: true }).click();
  109 |   const application = page.getByRole('dialog', { name: 'Application checklist', exact: true });
  110 |   await expect(application.locator('li')).toHaveCount(4);
  111 |   await expect(application).toContainText('Applications cannot be submitted here yet');
  112 |   await application.getByRole('button', { name: 'Back to college details' }).click();
  113 |   await expect(details).toBeVisible();
  114 |   await page.keyboard.press('Escape');
```