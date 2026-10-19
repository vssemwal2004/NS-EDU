// HTML fixtures for the scraper tests: a fictional institution on a fictional domain. Never fetched.
export const SITE = 'https://www.dvit-example.ac.in';
export const DOMAIN = 'dvit-example.ac.in';
export const LONG_ABOUT = `Doon Valley Institute of Technology (DVIT) was established in 1998 by the Doon Education Society. The institute is accredited by NAAC with 'A+' grade and is ranked 87th in NIRF 2024 (Engineering). It is recognised by UGC under Section 2(f) and its programmes are approved by AICTE and the Pharmacy Council of India. ${'Students learn in modern laboratories and take part in research projects with industry partners across the region. '.repeat(6)}`;

export const fixtures = {
  home: `<!doctype html><html><head>
<title>Home | Doon Valley Institute of Technology, Dehradun</title>
<meta name="description" content="Doon Valley Institute of Technology is a private institute in Dehradun offering engineering, management and computer application programmes.">
<meta property="og:image" content="/assets/banner.jpg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"DVIT"},{"@type":"CollegeOrUniversity","name":"Doon Valley Institute of Technology","logo":{"@type":"ImageObject","url":"${SITE}/img/logo.png"},"address":{"@type":"PostalAddress","streetAddress":"12 Rajpur Road","addressLocality":"Dehradun","addressRegion":"Uttarakhand","postalCode":"248001"}}]}</script>
<script>var tracking = "B.Tech in Hacking";</script>
</head><body>
<header><img src="/img/naac-logo.png" alt="NAAC logo"><img src="/img/logo.png" alt="DVIT logo">
<nav><a href="/about-us">About Us</a><a href="/academics/programmes">Programmes</a><a href="/admissions">Admissions 2026</a><a href="/contact">Contact</a>
<a href="/naac">NAAC</a><a href="/faculty-directory">Faculty Directory</a><a href="https://twitter.com/dvit">Twitter</a><a href="/prospectus.pdf">Prospectus</a>
<a href="https://portal.other-site.example.com/apply">Apply online admission</a><a href="javascript:void(0)">Menu</a></nav></header>
<main><h2>School of Engineering</h2><h2>School of Management</h2>
<p>Approved by AICTE and affiliated to Example Technical University.</p>
<p>UGC NET coaching classes start soon.</p></main></body></html>`,
  about: `<html><head><title>About Us - DVIT</title><meta name="description" content="Short"></head><body>
<h1>About DVIT</h1><p>Cookie notice: we use cookies to improve your experience on this website and for analytics purposes, as described in our policy page.</p>
<p>${LONG_ABOUT}</p></body></html>`,
  contact: `<html><body><h1>Contact Us</h1>
<div class="address"><h4>Address</h4><p>Doon Valley Institute of Technology,<br>12 Rajpur Road,<br>Dehradun - 248001, Uttarakhand, India</p></div>
<p>Phone: <a href="tel:01352000000">0135-2000000</a></p>
<p>Email: <a href="mailto:info@dvit-example.ac.in">info@dvit-example.ac.in</a> | admissions [at] dvit-example.ac.in</p>
<h3>Key contacts</h3>
<p>Dr. Ramesh Kumar, Registrar — <a href="mailto:ramesh.kumar@dvit-example.ac.in">ramesh.kumar@dvit-example.ac.in</a>, Mobile <a href="tel:+919999999999">99999 99999</a></p>
<p>Office: dvit.office@gmail.com</p></body></html>`,
  programmes: `<html><body><h1>Programmes</h1><ul>
<li>B.Tech in Computer Science and Engineering</li><li><a href="/btech-me">B.Tech in Mechanical Engineering</a></li>
<li>M.Tech (Structural Engineering)</li><li>MBA</li><li>BBA</li><li>BCA</li><li>B.Pharm</li><li>B.Sc. Nursing</li>
<li>B.Tech Admission 2026</li><li>Bachelor of Design (B.Des)</li><li>Basketball court</li><li>MAIN MENU</li></ul>
<table><tr><td>MCA</td><td>2 years</td></tr></table></body></html>`,
};

// In-memory web: url → { status, body, headers }. Records every request with the fake clock time.
export function fakeWeb(routes) {
  const requests = [];
  let clock = 0;
  const fetchImpl = async (url, init) => {
    requests.push({ url, at: clock, userAgent: init.headers['user-agent'], redirect: init.redirect });
    const route = routes[url];
    if (!route) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } });
    if (route.error) throw Object.assign(new TypeError('fetch failed'), { cause: { code: route.error } });
    return new Response(route.body ?? null, { status: route.status ?? 200, headers: { 'content-type': 'text/html; charset=utf-8', ...route.headers } });
  };
  const wait = async (ms) => { clock += ms; };
  return { fetchImpl, wait, now: () => clock, requests };
}
