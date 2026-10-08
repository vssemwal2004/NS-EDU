# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: eligibility.spec.js >> range validation, changing format and entrance-rank distinction remain usable
- Location: tests\eligibility.spec.js:121:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('#course-eligibility').getByLabel('Entrance exam', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e4]:
      - link "Skip to main content" [ref=e5] [cursor=pointer]:
        - /url: "#main"
      - generic [ref=e6]:
        - link "NSEDU home" [ref=e7] [cursor=pointer]:
          - /url: /
          - generic [ref=e8]: NSEDU
        - search [ref=e9]:
          - button "Search NSEDU" [ref=e10] [cursor=pointer]
          - generic [ref=e13]: Search NSEDU
          - textbox "Search NSEDU" [ref=e14]:
            - /placeholder: Search colleges, courses, exams or anything...
        - generic [ref=e16]:
          - generic [ref=e19]: Preferred city
          - combobox "Preferred city" [ref=e20] [cursor=pointer]:
            - option "Select city" [selected]
            - option "Bengaluru"
            - option "Pune"
            - option "Delhi NCR"
            - option "Mumbai"
            - option "Hyderabad"
            - option "Chennai"
            - option "Ahmedabad"
            - option "Kolkata"
        - generic [ref=e21]:
          - button "Log in" [ref=e22] [cursor=pointer]
          - button "Create account" [ref=e23] [cursor=pointer]
      - navigation "Main navigation" [ref=e24]:
        - generic [ref=e25]:
          - link "Locations" [ref=e26] [cursor=pointer]:
            - /url: "#study-destinations"
          - link "Eligibility check" [ref=e27] [cursor=pointer]:
            - /url: "#course-eligibility"
        - group [ref=e28]:
          - generic "Colleges" [ref=e29] [cursor=pointer]
        - group [ref=e32]:
          - generic "Courses" [ref=e33] [cursor=pointer]
        - group [ref=e36]:
          - generic "Exams" [ref=e37] [cursor=pointer]
        - button "Compare" [ref=e40] [cursor=pointer]
        - button "Scholarships" [ref=e41] [cursor=pointer]
        - button "Career guidance" [ref=e44] [cursor=pointer]
        - group [ref=e47]:
          - generic "Resources" [ref=e48] [cursor=pointer]
    - main [ref=e51]:
      - generic [ref=e52]:
        - region [ref=e53]:
          - img "Three students exploring their next chapter together in a university library"
          - generic [ref=e54]:
            - generic [ref=e55]:
              - heading "Find a college that fits your future." [level=1] [ref=e56]
              - paragraph [ref=e57]: Explore India’s top colleges, courses and career paths — with clarity, not confusion.
              - generic [ref=e58]:
                - tablist "What would you like to explore?" [ref=e59]:
                  - tab "Colleges" [selected] [ref=e60] [cursor=pointer]
                  - tab "Courses" [ref=e61] [cursor=pointer]
                  - tab "Exams" [ref=e62] [cursor=pointer]
                - tabpanel "Colleges" [ref=e63]:
                  - search [ref=e64]:
                    - generic [ref=e65]:
                      - generic [ref=e68]: Search colleges
                      - textbox "Search colleges" [ref=e69]:
                        - /placeholder: Search by college name, course or city
                    - button "Search" [ref=e70] [cursor=pointer]
              - navigation "Explore by field" [ref=e71]:
                - button "Engineering" [ref=e72] [cursor=pointer]
                - button "Management" [ref=e77] [cursor=pointer]
                - button "Medical" [ref=e82] [cursor=pointer]
                - button "Design" [ref=e87] [cursor=pointer]
                - button "Law" [ref=e92] [cursor=pointer]
                - button "Commerce" [ref=e97] [cursor=pointer]
            - paragraph [aria-hidden] [ref=e102]: A brighter India begins with you.
            - paragraph [aria-hidden] [ref=e104]: Different Journeys A Brighter India
            - paragraph [aria-hidden] [ref=e105]: Knowledge today. A brighter tomorrow.
        - region "Popular courses and student resources" [ref=e107]:
          - generic [ref=e108]:
            - generic [ref=e109]:
              - heading "Explore popular courses" [level=2] [ref=e110]
              - paragraph [ref=e111]: Start with a course that interests you.
            - navigation "Popular courses" [ref=e112]:
              - button "B.Tech" [ref=e113] [cursor=pointer]
              - button "MBA" [ref=e116] [cursor=pointer]
              - button "B.Com" [ref=e119] [cursor=pointer]
              - button "BCA" [ref=e122] [cursor=pointer]
              - button "MBBS" [ref=e125] [cursor=pointer]
              - button "B.Des" [ref=e128] [cursor=pointer]
            - button "All courses" [ref=e131] [cursor=pointer]
          - navigation "Tools for your college journey" [ref=e134]:
            - button "Compare colleges Fees, courses and facilities" [ref=e135] [cursor=pointer]:
              - generic [ref=e138]:
                - heading "Compare colleges" [level=3] [ref=e139]
                - generic [ref=e140]: Fees, courses and facilities
            - button "Check eligibility Understand admission requirements" [ref=e143] [cursor=pointer]:
              - generic [ref=e146]:
                - heading "Check eligibility" [level=3] [ref=e147]
                - generic [ref=e148]: Understand admission requirements
            - button "Explore scholarships Find funding options" [ref=e151] [cursor=pointer]:
              - generic [ref=e154]:
                - heading "Explore scholarships" [level=3] [ref=e155]
                - generic [ref=e156]: Find funding options
            - button "Career guidance Explore suitable career paths" [ref=e159] [cursor=pointer]:
              - generic [ref=e162]:
                - heading "Career guidance" [level=3] [ref=e163]
                - generic [ref=e164]: Explore suitable career paths
      - region [ref=e167]:
        - generic [ref=e168]:
          - generic [ref=e169]:
            - generic [ref=e170]:
              - heading "Explore where you want to study" [level=2] [ref=e171]
              - generic [ref=e172]:
                - generic [ref=e173]: "Course:"
                - generic [ref=e174]: Choose a course for location browsing
                - 'combobox "Course: Choose a course for location browsing" [ref=e175] [cursor=pointer]':
                  - option "All courses"
                  - option "B.Tech" [selected]
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
            - paragraph [ref=e176]: Choose a city or state to explore colleges, courses and fees.
            - button "View all locations" [ref=e177] [cursor=pointer]
          - navigation "Study destinations by city" [ref=e180]:
            - button "Explore colleges in Delhi NCR" [ref=e181] [cursor=pointer]:
              - img "India Gate — illustrative Delhi NCR landmark" [ref=e182]
              - generic [ref=e184]: Delhi NCR
              - generic [ref=e187]: Explore colleges
            - button "Explore colleges in Bengaluru" [ref=e190] [cursor=pointer]:
              - img "Vidhana Soudha — illustrative Bengaluru landmark" [ref=e191]
              - generic [ref=e193]: Bengaluru
              - generic [ref=e196]: Explore colleges
            - button "Explore colleges in Mumbai" [ref=e199] [cursor=pointer]:
              - img "Gateway of India — illustrative Mumbai landmark" [ref=e200]
              - generic [ref=e202]: Mumbai
              - generic [ref=e205]: Explore colleges
            - button "Explore colleges in Hyderabad" [ref=e208] [cursor=pointer]:
              - img "Charminar — illustrative Hyderabad landmark" [ref=e209]
              - generic [ref=e211]: Hyderabad
              - generic [ref=e214]: Explore colleges
            - button "Explore colleges in Pune" [ref=e217] [cursor=pointer]:
              - img "Shaniwar Wada — illustrative Pune landmark" [ref=e218]
              - generic [ref=e220]: Pune
              - generic [ref=e223]: Explore colleges
            - button "Explore colleges in Chennai" [ref=e226] [cursor=pointer]:
              - img "Chennai Central Station — illustrative Chennai landmark" [ref=e227]
              - generic [ref=e229]: Chennai
              - generic [ref=e232]: Explore colleges
          - region [ref=e235]:
            - generic [ref=e236]:
              - heading "Explore states to study in India" [level=2] [ref=e237]
              - paragraph [ref=e238]: Browse colleges across cities within your preferred state.
              - button "View all states" [ref=e239] [cursor=pointer]
            - navigation "Study destinations by state" [ref=e242]:
              - button "Explore colleges in Madhya Pradesh" [ref=e243] [cursor=pointer]:
                - img "Sanchi Stupa — illustrative Madhya Pradesh landmark" [ref=e244]
                - generic [ref=e246]: Madhya Pradesh
              - button "Explore colleges in Karnataka" [ref=e249] [cursor=pointer]:
                - img "Mysore Palace — illustrative Karnataka landmark" [ref=e250]
                - generic [ref=e252]: Karnataka
              - button "Explore colleges in Maharashtra" [ref=e255] [cursor=pointer]:
                - img "Ajanta caves — illustrative Maharashtra landmark" [ref=e256]
                - generic [ref=e258]: Maharashtra
              - button "Explore colleges in Uttar Pradesh" [ref=e261] [cursor=pointer]:
                - img "Taj Mahal — illustrative Uttar Pradesh landmark" [ref=e262]
                - generic [ref=e264]: Uttar Pradesh
              - button "Explore colleges in Telangana" [ref=e267] [cursor=pointer]:
                - img "Golconda Fort — illustrative Telangana landmark" [ref=e268]
                - generic [ref=e270]: Telangana
              - button "Explore colleges in Tamil Nadu" [ref=e273] [cursor=pointer]:
                - img "Mahabalipuram Shore Temple — illustrative Tamil Nadu landmark" [ref=e274]
                - generic [ref=e276]: Tamil Nadu
          - paragraph [ref=e279]: Your course choice carries into location results.
      - region [ref=e280]:
        - generic [ref=e281]:
          - generic [ref=e282]:
            - generic [ref=e283]:
              - heading "Course-wise colleges in India" [level=2] [ref=e284]
              - paragraph [ref=e285]: Explore fees, placements and reviews for your preferred course.
            - generic [ref=e286]:
              - button "View all colleges" [ref=e287] [cursor=pointer]
              - generic [ref=e290]: Static demo data
          - generic [ref=e291]:
            - tablist "College courses" [ref=e292]:
              - tab "B.Tech" [selected] [ref=e293] [cursor=pointer]
              - tab "MBA" [ref=e294] [cursor=pointer]
              - tab "MBBS" [ref=e295] [cursor=pointer]
              - tab "B.Com" [ref=e296] [cursor=pointer]
              - tab "BBA" [ref=e297] [cursor=pointer]
              - tab "BCA" [ref=e298] [cursor=pointer]
              - tab "B.Des" [ref=e299] [cursor=pointer]
              - tab "M.Tech" [ref=e300] [cursor=pointer]
              - tab "B.Pharm" [ref=e301] [cursor=pointer]
              - tab "Law" [ref=e302] [cursor=pointer]
              - tab "Nursing" [ref=e303] [cursor=pointer]
            - button "More" [ref=e304] [cursor=pointer]
          - generic [ref=e307]:
            - generic [ref=e308]:
              - heading "B.Tech colleges" [level=3] [ref=e309]
              - generic [ref=e310]: 5 sample colleges
            - generic [ref=e311]:
              - generic [ref=e312]:
                - generic [ref=e313]: "Location:"
                - combobox "College location" [ref=e314]:
                  - option "All India" [selected]
                  - option "Bengaluru"
                  - option "Chennai"
                  - option "Delhi NCR"
                  - option "Hyderabad"
                  - option "Pune"
                  - option "Karnataka"
                  - option "Maharashtra"
                  - option "Tamil Nadu"
                  - option "Telangana"
              - generic [ref=e315]:
                - generic [ref=e316]: "Annual fee:"
                - combobox "Maximum annual tuition" [ref=e317]:
                  - option "Any budget" [selected]
                  - option "Up to ₹1,00,000"
                  - option "Up to ₹1,50,000"
                  - option "Up to ₹2,00,000"
                  - option "Up to ₹3,00,000"
                  - option "Up to ₹8,00,000"
              - generic [ref=e318]:
                - generic [ref=e319]: "Sort:"
                - combobox "Sort colleges" [ref=e320]:
                  - option "Default" [selected]
                  - 'option "Fee: low to high"'
                  - 'option "Fee: high to low"'
                  - option "Median salary"
                  - option "Demo rating"
          - tabpanel "B.Tech sample colleges" [ref=e321]:
            - table "B.Tech college comparison preview" [ref=e322]:
              - rowgroup [ref=e323]:
                - row [ref=e324]:
                  - columnheader "#" [ref=e325]
                  - columnheader "College" [ref=e326]
                  - columnheader "Annual tuition 2026–27" [ref=e327]:
                    - text: Annual tuition
                    - generic [ref=e328]: 2026–27
                  - columnheader "Placements 2024–25" [ref=e329]:
                    - text: Placements
                    - generic [ref=e330]: 2024–25
                  - columnheader "Demo rating" [ref=e331]
                  - columnheader "Actions" [ref=e332]
              - rowgroup [ref=e333]:
                - row [ref=e334]:
                  - cell "List position 1" [ref=e335]: "1"
                  - cell [ref=e336]:
                    - generic [ref=e337]:
                      - img "Illustrative campus image for Northfield Institute of Technology" [ref=e338]
                      - generic [ref=e340]:
                        - button "Northfield Institute of Technology" [ref=e341] [cursor=pointer]
                        - paragraph [ref=e342]: Bengaluru, Karnataka·B.Tech
                      - button "Save Northfield Institute of Technology" [ref=e343] [cursor=pointer]
                  - cell [ref=e346]:
                    - strong [ref=e347]: ₹2,40,000
                    - text: per year
                  - cell "Median ₹8.4 LPA Highest ₹22 LPA" [ref=e348]:
                    - generic [ref=e349]:
                      - generic [ref=e350]:
                        - generic [ref=e351]: Median
                        - strong [ref=e352]: ₹8.4 LPA
                      - generic [ref=e353]:
                        - generic [ref=e354]: Highest
                        - strong [ref=e355]: ₹22 LPA
                  - cell "4.3 / 5" [ref=e356]:
                    - generic [ref=e357]:
                      - strong [ref=e360]: "4.3"
                      - generic [ref=e361]: / 5
                  - cell [ref=e362]:
                    - generic [ref=e363]:
                      - generic [ref=e364] [cursor=pointer]:
                        - checkbox "Compare Northfield Institute of Technology" [checked] [ref=e365]
                        - text: Compare
                      - button "View details" [ref=e366] [cursor=pointer]
                      - button "Apply now" [ref=e367] [cursor=pointer]
                - row [ref=e368]:
                  - cell "List position 2" [ref=e369]: "2"
                  - cell [ref=e370]:
                    - generic [ref=e371]:
                      - img "Illustrative campus image for Meadow Engineering College" [ref=e372]
                      - generic [ref=e374]:
                        - button "Meadow Engineering College" [ref=e375] [cursor=pointer]
                        - paragraph [ref=e376]: Pune, Maharashtra·B.Tech
                      - button "Save Meadow Engineering College" [ref=e377] [cursor=pointer]
                  - cell [ref=e380]:
                    - strong [ref=e381]: ₹1,80,000
                    - text: per year
                  - cell "Median ₹6.8 LPA Highest ₹18 LPA" [ref=e382]:
                    - generic [ref=e383]:
                      - generic [ref=e384]:
                        - generic [ref=e385]: Median
                        - strong [ref=e386]: ₹6.8 LPA
                      - generic [ref=e387]:
                        - generic [ref=e388]: Highest
                        - strong [ref=e389]: ₹18 LPA
                  - cell "4.2 / 5" [ref=e390]:
                    - generic [ref=e391]:
                      - strong [ref=e394]: "4.2"
                      - generic [ref=e395]: / 5
                  - cell [ref=e396]:
                    - generic [ref=e397]:
                      - generic [ref=e398] [cursor=pointer]:
                        - checkbox "Compare Meadow Engineering College" [ref=e399]
                        - text: Compare
                      - button "View details" [ref=e400] [cursor=pointer]
                      - button "Apply now" [ref=e401] [cursor=pointer]
                - row [ref=e402]:
                  - cell "List position 3" [ref=e403]: "3"
                  - cell [ref=e404]:
                    - generic [ref=e405]:
                      - img "Illustrative campus image for Central Institute of Technology" [ref=e406]
                      - generic [ref=e408]:
                        - button "Central Institute of Technology" [ref=e409] [cursor=pointer]
                        - paragraph [ref=e410]: Hyderabad, Telangana·B.Tech
                      - button "Save Central Institute of Technology" [ref=e411] [cursor=pointer]
                  - cell [ref=e414]:
                    - strong [ref=e415]: ₹2,10,000
                    - text: per year
                  - cell "Median ₹7.6 LPA Highest ₹20 LPA" [ref=e416]:
                    - generic [ref=e417]:
                      - generic [ref=e418]:
                        - generic [ref=e419]: Median
                        - strong [ref=e420]: ₹7.6 LPA
                      - generic [ref=e421]:
                        - generic [ref=e422]: Highest
                        - strong [ref=e423]: ₹20 LPA
                  - cell "4.4 / 5" [ref=e424]:
                    - generic [ref=e425]:
                      - strong [ref=e428]: "4.4"
                      - generic [ref=e429]: / 5
                  - cell [ref=e430]:
                    - generic [ref=e431]:
                      - generic [ref=e432] [cursor=pointer]:
                        - checkbox "Compare Central Institute of Technology" [checked] [ref=e433]
                        - text: Compare
                      - button "View details" [ref=e434] [cursor=pointer]
                      - button "Apply now" [ref=e435] [cursor=pointer]
                - row [ref=e436]:
                  - cell "List position 4" [ref=e437]: "4"
                  - cell [ref=e438]:
                    - generic [ref=e439]:
                      - img "Illustrative campus image for Riverside University" [ref=e440]
                      - generic [ref=e442]:
                        - button "Riverside University" [ref=e443] [cursor=pointer]
                        - paragraph [ref=e444]: Chennai, Tamil Nadu·B.Tech
                      - button "Save Riverside University" [ref=e445] [cursor=pointer]
                  - cell [ref=e448]:
                    - strong [ref=e449]: ₹1,60,000
                    - text: per year
                  - cell "Median ₹6.2 LPA Highest ₹16 LPA" [ref=e450]:
                    - generic [ref=e451]:
                      - generic [ref=e452]:
                        - generic [ref=e453]: Median
                        - strong [ref=e454]: ₹6.2 LPA
                      - generic [ref=e455]:
                        - generic [ref=e456]: Highest
                        - strong [ref=e457]: ₹16 LPA
                  - cell "4.1 / 5" [ref=e458]:
                    - generic [ref=e459]:
                      - strong [ref=e462]: "4.1"
                      - generic [ref=e463]: / 5
                  - cell [ref=e464]:
                    - generic [ref=e465]:
                      - generic [ref=e466] [cursor=pointer]:
                        - checkbox "Compare Riverside University" [ref=e467]
                        - text: Compare
                      - button "View details" [ref=e468] [cursor=pointer]
                      - button "Apply now" [ref=e469] [cursor=pointer]
                - row [ref=e470]:
                  - cell "List position 5" [ref=e471]: "5"
                  - cell [ref=e472]:
                    - generic [ref=e473]:
                      - img "Illustrative campus image for Hillside Engineering Institute" [ref=e474]
                      - generic [ref=e476]:
                        - button "Hillside Engineering Institute" [ref=e477] [cursor=pointer]
                        - paragraph [ref=e478]: Delhi NCR·B.Tech
                      - button "Save Hillside Engineering Institute" [ref=e479] [cursor=pointer]
                  - cell [ref=e482]:
                    - strong [ref=e483]: ₹2,20,000
                    - text: per year
                  - cell "Median ₹7.8 LPA Highest ₹21 LPA" [ref=e484]:
                    - generic [ref=e485]:
                      - generic [ref=e486]:
                        - generic [ref=e487]: Median
                        - strong [ref=e488]: ₹7.8 LPA
                      - generic [ref=e489]:
                        - generic [ref=e490]: Highest
                        - strong [ref=e491]: ₹21 LPA
                  - cell "4.3 / 5" [ref=e492]:
                    - generic [ref=e493]:
                      - strong [ref=e496]: "4.3"
                      - generic [ref=e497]: / 5
                  - cell [ref=e498]:
                    - generic [ref=e499]:
                      - generic [ref=e500] [cursor=pointer]:
                        - checkbox "Compare Hillside Engineering Institute" [ref=e501]
                        - text: Compare
                      - button "View details" [ref=e502] [cursor=pointer]
                      - button "Apply now" [ref=e503] [cursor=pointer]
          - generic [ref=e504]:
            - generic [ref=e508]:
              - strong [ref=e509]: 2 colleges selected
              - generic [ref=e510]: Northfield · Central
            - generic [ref=e511]:
              - button "Clear" [ref=e512] [cursor=pointer]
              - button "Compare colleges" [ref=e513] [cursor=pointer]
          - paragraph [ref=e516]: Illustrative colleges and values · Not a ranking · Tuition excludes hostel/living costs.
          - status [ref=e517]
      - region [ref=e518]:
        - generic [ref=e519]:
          - complementary [ref=e520]:
            - paragraph [ref=e521]: NSEDU / Eligibility
            - heading "Your next step starts here." [level=2] [ref=e522]
            - paragraph [ref=e523]: Check course requirements, one simple question at a time.
            - list "Eligibility journey" [ref=e524]:
              - listitem [ref=e525]: Your studies
              - listitem [ref=e529]: Course details
              - listitem [ref=e531]: Requirements
            - generic [ref=e534]:
              - text: One step at a time
              - paragraph [ref=e535]: B.Tech · 2026–27
          - generic [ref=e536]:
            - generic [ref=e537]:
              - generic [ref=e538]: Question 7
              - heading "What does your scorecard say?" [active] [level=3] [ref=e539]
              - paragraph [ref=e540]: Keep the exam and result type together.
            - form "What does your scorecard say?" [ref=e541]:
              - generic [ref=e543]:
                - generic [ref=e544]:
                  - generic [ref=e545]:
                    - text: Entrance exam
                    - combobox "Entrance exam" [ref=e546]:
                      - option "Choose your exam" [selected]
                      - option "JEE Main"
                      - option "NEET UG"
                      - option "CUET UG"
                      - option "CAT"
                      - option "Another entrance exam"
                  - generic [ref=e547]:
                    - text: Result type
                    - combobox "Result type" [ref=e548]:
                      - option "Percentile" [selected]
                      - option "Score / marks"
                      - option "All India / general rank"
                      - option "Category rank"
                  - generic [ref=e549]:
                    - text: Value on your scorecard
                    - textbox "Value on your scorecard" [ref=e550]:
                      - /placeholder: e.g. 92.4
                - paragraph [ref=e551]: The result is recorded as entered. Admission chances need verified exam-year and counselling cutoff data.
              - generic [ref=e552]:
                - button "Back" [ref=e553] [cursor=pointer]
                - button "Review requirements" [ref=e556] [cursor=pointer]
            - paragraph [ref=e561]:
              - generic [ref=e562]: No sign-up to begin.
              - generic [ref=e563]: Requirements vary by course, institution and admission year.
  - alert [ref=e564]
```

# Test source

```ts
  27  |   if (grading !== 'pending') await section(page).locator('#eligibility-marks').fill(marks);
  28  |   await next(page);
  29  |   await choose(section(page).locator(`input[name="entrance-status"][value="${exam}"]`));
  30  |   await next(page);
  31  | }
  32  | 
  33  | test.beforeEach(async ({ page }) => {
  34  |   page.browserErrors = [];
  35  |   page.on('pageerror', (error) => page.browserErrors.push(error.message));
  36  |   await page.goto('/');
  37  |   await section(page).evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  38  | });
  39  | test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });
  40  | 
  41  | test('entry has no assumed qualification, accessible choices and lazy small artwork', async ({ page }) => {
  42  |   const check = section(page);
  43  |   await expect(check.getByRole('radio')).toHaveCount(3);
  44  |   await expect(check.locator('input:checked')).toHaveCount(0);
  45  |   await next(page);
  46  |   await expect(check.getByRole('alert')).toContainText('Choose your study stage');
  47  |   const radio = check.locator('input[value="school-studying"]');
  48  |   await radio.focus();
  49  |   await page.keyboard.press('ArrowRight');
  50  |   await expect(check.locator('input[value="school-completed"]')).toBeChecked();
  51  |   for (const asset of ['notebook', 'certificate', 'graduation']) {
  52  |     const img = check.locator(`img[src*="${asset}"]`);
  53  |     await expect(img).toHaveAttribute('loading', 'lazy');
  54  |     const response = await page.request.get(`/images/eligibility/${asset}.webp`);
  55  |     expect(response.headers()['content-type']).toContain('image/webp');
  56  |     expect((await response.body()).byteLength).toBeLessThan(30000);
  57  |   }
  58  | });
  59  | 
  60  | test('matching fictional B.Tech rules gives an explained academic review, not an admission prediction', async ({ page }) => {
  61  |   await begin(page); await subjects(page); await complete(page);
  62  |   const check = section(page);
  63  |   await expect(check.locator('[data-result="match"]')).toContainText('Sample academic criteria match');
  64  |   await expect(check.locator('[data-requirement-state="match"]')).toHaveCount(3);
  65  |   await expect(check).toContainText('Entrance-route requirements are not checked');
  66  |   await expect(check).toContainText('Sample rules are fictional');
  67  |   await check.getByRole('button', { name: 'Save for this visit', exact: true }).click();
  68  |   await expect(check.getByRole('status')).toContainText('while this page stays open');
  69  |   await check.getByRole('button', { name: 'Explore B.Tech colleges', exact: true }).click();
  70  |   await expect(page.locator('#college-tab-btech')).toHaveAttribute('aria-selected', 'true');
  71  | });
  72  | 
  73  | test('subjects missing and percentage below the sample minimum remain distinct unmet requirements', async ({ page }) => {
  74  |   await begin(page); await subjects(page, ['Physics', 'Chemistry']); await complete(page, { marks: '40' });
  75  |   await expect(section(page).locator('[data-result="not-met"]')).toBeVisible();
  76  |   await expect(section(page).locator('[data-requirement-state="not-met"]')).toHaveCount(2);
  77  |   await expect(section(page)).toContainText('40%');
  78  | });
  79  | 
  80  | test('pending school completion and awaited marks are reported as pending rather than accepted', async ({ page }) => {
  81  |   await begin(page, { stage: 'school-studying' });
  82  |   await section(page).getByRole('checkbox', { name: 'I do not have these details yet' }).check();
  83  |   await next(page); await complete(page, { grading: 'pending', exam: 'awaited' });
  84  |   await expect(section(page).locator('[data-result="pending"]')).toBeVisible();
  85  |   await expect(section(page).locator('[data-requirement-state="pending"]')).toHaveCount(3);
  86  | });
  87  | 
  88  | test('CGPA stays unverified without an official conversion rather than becoming an assumed percentage', async ({ page }) => {
  89  |   await begin(page); await subjects(page); await complete(page, { grading: 'cgpa', marks: '8.1' });
  90  |   await expect(section(page).locator('[data-result="unverified"]')).toBeVisible();
  91  |   await expect(section(page)).toContainText('8.1 / 10 CGPA · official conversion needed');
  92  |   await expect(section(page)).not.toContainText('81%');
  93  | });
  94  | 
  95  | test('postgraduate route asks degree and completion, and uses degree aggregate rather than PCM marks', async ({ page }) => {
  96  |   await begin(page, { stage: 'college', qualification: 'degree', course: 'mba' });
  97  |   await expect(section(page)).toHaveAttribute('data-step', 'marks');
  98  |   await expect(section(page).getByLabel('Bachelor’s degree aggregate (%)')).toBeVisible();
  99  |   await complete(page, { marks: '65' });
  100 |   await expect(section(page).locator('[data-result="match"]')).toBeVisible();
  101 |   await expect(section(page).locator('[data-requirement-state="match"]')).toHaveCount(2);
  102 | });
  103 | 
  104 | test('diploma route needs a programme-specific review even when marks and subjects match', async ({ page }) => {
  105 |   await begin(page, { stage: 'other', qualification: 'diploma' });
  106 |   await subjects(page); await complete(page);
  107 |   await expect(section(page).locator('[data-result="unverified"]')).toBeVisible();
  108 |   await expect(section(page)).toContainText('Diploma · completed');
  109 | });
  110 | 
  111 | test('medical courses and another year do not reuse invented or outdated academic rules', async ({ page }) => {
  112 |   await begin(page, { course: 'mbbs' }); await complete(page);
  113 |   await expect(section(page).locator('[data-result="unverified"]')).toBeVisible();
  114 |   await expect(section(page).locator('[data-requirement-state]')).toHaveCount(0);
  115 |   await section(page).getByRole('button', { name: 'Start a new check', exact: true }).click();
  116 |   await begin(page, { year: '2027–28' }); await subjects(page); await complete(page);
  117 |   await expect(section(page).locator('[data-result="unverified"]')).toBeVisible();
  118 |   await expect(section(page)).toContainText('2027–28');
  119 | });
  120 | 
  121 | test('range validation, changing format and entrance-rank distinction remain usable', async ({ page }) => {
  122 |   await begin(page); await subjects(page);
  123 |   await section(page).locator('#eligibility-marks').fill('101'); await next(page);
  124 |   await expect(section(page).getByRole('alert')).toContainText('0 to 100');
  125 |   await section(page).locator('#eligibility-marks').fill('78'); await next(page);
  126 |   await choose(section(page).locator('input[name="entrance-status"][value="result"]')); await next(page);
> 127 |   await section(page).getByLabel('Entrance exam', { exact: true }).selectOption('jee');
      |                                                                    ^ Error: locator.selectOption: Test timeout of 60000ms exceeded.
  128 |   await section(page).getByLabel('Result type').selectOption('rank');
  129 |   await section(page).getByLabel('Value on your scorecard').fill('12.5'); await next(page);
  130 |   await expect(section(page).getByRole('alert')).toContainText('whole number');
  131 |   await section(page).getByLabel('Value on your scorecard').fill('12500'); await next(page);
  132 |   await expect(section(page)).toContainText('JEE Main · general rank: 12500');
  133 |   await expect(section(page)).toContainText('Entrance-route requirements are not checked');
  134 | });
  135 | 
  136 | test('editing preserves answers, while changing courses clears the old subject and mark basis', async ({ page }) => {
  137 |   await begin(page); await subjects(page); await complete(page);
  138 |   await section(page).getByRole('button', { name: 'Edit answers', exact: true }).click();
  139 |   await expect(section(page).locator('input[value="school-completed"]')).toBeChecked();
  140 |   await next(page);
  141 |   await section(page).getByLabel('Search eligibility courses').fill('B.Com');
  142 |   await choose(section(page).locator('input[name="eligibility-course"][value="bcom"]')); await next(page); await next(page);
  143 |   await expect(section(page)).toHaveAttribute('data-step', 'marks');
  144 |   await expect(section(page).locator('#eligibility-marks')).toHaveValue('');
  145 |   await expect(section(page).getByLabel('Class 12 aggregate (%)')).toBeVisible();
  146 | });
  147 | 
  148 | for (const width of [320, 390, 768, 1101, 1672]) {
  149 |   test(`eligibility flow and fixed header fit ${width}px with reduced motion`, async ({ page }) => {
  150 |     await page.setViewportSize({ width, height: 900 });
  151 |     await page.emulateMedia({ reducedMotion: 'reduce' });
  152 |     await section(page).evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  153 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  154 |     await expect(page.getByRole('banner')).toHaveAttribute('data-section', 'eligibility');
  155 |     await begin(page); await subjects(page); await complete(page);
  156 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  157 |     for (const button of await section(page).getByRole('button').all()) {
  158 |       if (!await button.isVisible()) continue;
  159 |       const bounds = await button.boundingBox();
  160 |       expect(bounds.x).toBeGreaterThanOrEqual(0);
  161 |       expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  162 |       expect(bounds.height).toBeGreaterThanOrEqual(44);
  163 |     }
  164 |     expect(await section(page).locator('form').count()).toBe(0);
  165 |     expect(await section(page).locator('[data-result]').evaluate((node) => window.getComputedStyle(node).animationName)).toBe('none');
  166 |   });
  167 | }
  168 | 
```