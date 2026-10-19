// URL helpers. "Registrable domain" uses a small suffix list that covers Indian academic and
// government hosts; it decides which links count as the institution's own site.
const MULTI_PART_SUFFIXES = new Set([
  'ac.in', 'edu.in', 'res.in', 'gov.in', 'nic.in', 'ernet.in', 'co.in', 'org.in', 'net.in', 'gen.in', 'firm.in', 'ind.in',
  'ac.uk', 'co.uk', 'org.uk', 'edu.au', 'com.au',
  // Free hosts. Small colleges publish on these, and without them every other site on the host
  // would count as "the same institution" — including the provider's own image CDNs.
  'blogspot.com', 'blogspot.in', 'wordpress.com', 'wixsite.com', 'weebly.com', 'github.io', 'webs.com', '000webhostapp.com', 'yolasite.com',
]);

export function registrableDomain(hostname) {
  const host = String(hostname ?? '').toLowerCase().replace(/\.$/, '');
  if (!host || /^[\d.]+$/.test(host) || host.includes(':')) return host;
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join('.');
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

// Adds a scheme to bare hosts ("www.xyz.ac.in") from directory lists and rejects anything not http(s).
export function normalizeWebsite(raw) {
  let text = String(raw ?? '').trim();
  if (!text) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text.replace(/^\/+/, '')}`;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) return '';
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return '';
  }
}

// Identity of a crawl source: host without www + path, so http/https/trailing-slash variants collapse.
export function websiteKey(website) {
  try {
    const url = new URL(website);
    return `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

export function resolveUrl(href, base) {
  try {
    const url = new URL(String(href ?? '').trim(), base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

export const isSameSite = (url, domain) => {
  const host = (url instanceof URL ? url : resolveUrl(url))?.hostname.toLowerCase();
  return Boolean(host && domain && (host === domain || host.endsWith(`.${domain}`)));
};

export const originOf = (url) => new URL(url).origin;
