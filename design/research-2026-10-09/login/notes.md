# Login / account research — 2026-10-09

Method: Playwright (system Chrome, headless, `navigator.webdriver` masked, en-IN locale, Asia/Kolkata TZ),
desktop 1440x900 (Windows Chrome UA) and mobile 390x844 (Android Pixel UA, touch). Scripts kept in the session
scratchpad (`scratchpad/login/probe*.mjs`, `nsedu.mjs`). Raw extracted dialog text + input attributes are in the
`probe*.json` files next to this note.

Ethics: I never submitted a valid phone number or email on any competitor site, so no OTP was sent to a real person.
Validation states were triggered only with the invalid string `12345`. As a result **no competitor OTP-entry / resend /
success screens and no logged-in dashboards were observed**; statements about those below come from search snippets
only and are marked as such.

## Access log (every URL)

| Site | URL | Device | Result |
|---|---|---|---|
| Careers360 | https://www.careers360.com/ | desktop + mobile | 200. Corner "Sign In/Sign Up" nudge auto-opens ~5 s after load (bottom-right desktop, bottom card mobile) |
| Careers360 | https://www.careers360.com/user/login | desktop + mobile | 200. Full-page split layout (benefits left / form right); mobile = benefits header + rounded white sheet |
| Careers360 | https://www.careers360.com/user/register | desktop (+ mobile via header avatar redirect `/user/register?destination=…&click_location=header`) | 200 |
| CollegeDekho | https://www.collegedekho.com/ | desktop + mobile | 200. Desktop: hover popover from account icon, then centred modal. Mobile: full-screen interstitial, then full-screen form |
| Shiksha | https://www.shiksha.com/ | desktop + mobile | First attempt `net::ERR_NETWORK_CHANGED` (no 403 this round); retry 200. Centred modal desktop; full-screen modal mobile |
| Collegedunia | https://collegedunia.com/ | desktop + mobile | 200. Mobile account icon → guest "Profile" page; desktop menu → "Login/Register" → full-page split login |
| Collegedunia | https://collegedunia.com/exams/cbse-class-xii/syllabus | desktop | 200. Gated "Login" in comments opens a modal (benefit list + Register/Login tabs) |
| NSEDU (local) | http://127.0.0.1:3001/account | desktop + mobile | 200; 401 from /api/auth/me (expected signed-out); no page errors; no horizontal overflow |

WebSearch for login/dashboards on all four portals returned mostly community Q&A / app-store copy. Nothing official
documents the logged-in dashboards (Shiksha app-store copy mentions shortlist + compare + deadline tracking;
Collegedunia Study Abroad app lists "Dashboard" and "Profile" sections; CollegeDekho press mentions profile-based
recommendations and a Common Application Form). **Not verified visually.**

## Screenshots (what each actually shows)

- `careers360-desktop-login-open.png`, `careers360-desktop-nudge.png`, `careers360-mobile-login.png`: auto "Sign In/Sign Up" corner nudge: tinted header with value copy, single "Enter Mobile" field, Skip / Sign In. Mobile version shows a red "Please enter your mobile number" error before any input.
- `careers360-desktop-userlogin.png`: split page. Left = pale gradient brand panel, logo, "Unlock your future…", 8-item tick benefit list, orbit illustration. Right = Sign Up / Login underline tabs, "Continue with Google" pill, Mobile Number field, disabled grey "Get OTP", "Don't have an account? Sign Up".
- `careers360-desktop-userlogin-error.png`: floating label, India flag + "+91" prefix appears on focus, inline specific error "Mobile number should start with 6,7,8,9.", button stays disabled.
- `careers360-desktop-register.png`, `careers360-mobile-login-open.png`: sign-up = Full name, Email, Mobile, "Studying In", City + **pre-ticked** consent that bundles T&C with promotional contact "via mail, sms, whatsapp, rcs".
- `careers360-mobile-userlogin.png`: mobile = benefits block at top, then white sheet with rounded top corners overlapping it (sheet metaphor on a full page).
- `collegedekho-desktop-login-open.png`: hover popover: "Login to your account" primary, "By creating an account you can -" 3 ticks, "Create an account" outline.
- `collegedekho-desktop-login.png` / `collegedekho-desktop-login-invalid.png` (same state, mislabelled): centred 400px modal, phone illustration, "Log in to Continue", "+91" underline input, Generate OTP, Login via Password, Signup link.
- `collegedekho-desktop-login-error.png`: input "12345" → "Mobile number is not a registered user" (account-enumeration leak + wrong diagnosis; the number is simply invalid).
- `collegedekho-desktop-signup.png`, `collegedekho-mobile-login.png`: sign-up form with Name, Email, +91 Mobile, Stream, State, Level, Password (7 fields).
- `collegedekho-mobile-login-open.png`: full-screen interstitial: large illustration, "After Login, you can" 4 ticks, one "Login / Register" button.
- `shiksha-desktop-login-open.png`, `shiksha-desktop-login-email.png`, `shiksha-mobile-login.png`: "Login to get started!", Google button, OR divider, Email / Mobile **radio** toggle, "IND +91" select + number, small orange Get OTP, "New to Shiksha? Sign Up". Modal ~360x550 with large empty lower half; cookie bar overlaps. (`shiksha-desktop-signup.png` did not change state; ignore.)
- `collegedunia-desktop-login-invalid.png` (gated modal; name is misleading, no error was triggered): 4 benefit rows with small illustrated icons, Register / Login tabs, flag + "+91" select, Mobile Number*, **pre-ticked** Terms checkbox, full-width orange Get OTP.
- `collegedunia-desktop-login-home.png` (and identical `collegedunia-desktop-register.png`): full-page split, blue gradient left with "Why Sign Up?" list (brochures, fees, shortlist & apply, counsellors, deadlines), grey right with Login card (+91, Request OTP, "Not a member yet! Join us", "Login as College Admin").
- `collegedunia-mobile-login.png`: guest Profile page: avatar placeholder, "Hello, Welcome To Collegedunia", "Select Goal" editable field, "Login/Register Now", promo card for writing reviews.
- `collegedunia-desktop-login-error.png`: did not capture an error state (scrolled page). Ignore.
- `nsedu-*`: current NSEDU implementation (see below).

## Observed patterns

1. **Mobile-OTP first, +91 fixed prefix.** All four default to mobile; three show "+91" (CollegeDekho, Collegedunia, Careers360 on focus); Shiksha uses an "IND +91" dropdown. The CTA verb is always "Get OTP" / "Generate OTP" / "Request OTP".
2. **Email as a secondary option.** Shiksha offers Email/Mobile radios. Others push email into sign-up only.
3. **Benefit list next to the form.** All four use tick lists: Careers360 (8 items, left panel), Collegedunia (4–5 items, top of modal or left half), CollegeDekho (3–4 items, popover/interstitial). Many of the claims are features those platforms actually have (alerts, mock tests, counselling, brochures).
4. **Split layout on desktop** (Careers360 /user/login, Collegedunia login page): brand/benefit panel left, form right. Modals (Shiksha, CollegeDekho, Collegedunia gate) are single-column and small.
5. **Mobile = full-screen or sheet.** No portal used a side drawer. Careers360 = full page with an overlapping rounded-top white sheet; CollegeDekho and Shiksha = full-screen modal; Collegedunia = guest profile page then login.
6. **Illustration** usage is generic: phone + tick (CollegeDekho), orbit icons (Careers360), small 3D icons per benefit (Collegedunia).
7. **Separate Login vs Sign-up tabs** everywhere, with sign-up asking for 5–7 fields (name, email, mobile, stream/level, state/city, sometimes password).
8. **Validation.** Careers360: specific inline rule ("should start with 6,7,8,9"), disabled button until valid. CollegeDekho: "not a registered user" (enumeration). Careers360 nudge: error shown before the user typed.
9. **Consent.** Collegedunia and Careers360 pre-tick consent. Careers360 bundles promotional calls/WhatsApp consent into the T&C checkbox.
10. **Interruptions.** Careers360 auto-opens a sign-in nudge ~5 s after landing; Shiksha shows a cookie bar over the modal; Collegedunia gates comments behind login.
11. **Guest account page** (Collegedunia mobile): greeting, goal selector usable signed-out, single login CTA.

## Current NSEDU (screenshots `nsedu-*`)

- 460px right-side floating drawer (desktop) / near full-height bottom sheet (≤520px). Wine header panel with graduation.webp + linework, title "Your college journey, organised."
- Email default tab, Mobile second; segmented tabs (role=tab, but no tabpanel / arrow-key handling).
- Initial focus lands on the **Close** button, not the input (`nsedu-capture.json`).
- Benefits copy is **not supported by the product**: "Save colleges and comparisons", "Keep your eligibility checks", "Get admission and exam updates", and the success copy "Your saved colleges and checks will follow you across NSEDU". Compare picks, preferences and saved news are browser localStorage only (`nsedu:compare`, `nsedu:preferences`, `nsedu.education.saved.v1`); there is no server-side save, eligibility history or notification feature.
- Verify step: masked identifier, dev-code notice with "Use code", 6 boxes, resend countdown. About 200px of empty space below on desktop.
- /account signed-out = a single dashed empty card; signed-in = two cards (profile form + preferences/quick links) using Directory.module.css.
- Phone validation is server-side only (input "12345" → round-trip → "Enter a valid 10-digit Indian mobile number").
