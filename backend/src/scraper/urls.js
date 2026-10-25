import { isIP } from 'node:net';

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
  // Directory spreadsheets sometimes contain `www.https//host` (or our previously normalised
  // `https://www.https//host`): the intended scheme is present, just in the wrong column/order.
  text = text.replace(/^(?:https?:\/\/)?www\.(https?)\:?\/{2}/i, (_match, scheme) => `${scheme.toLowerCase()}://`);
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text.replace(/^\/+/, '')}`;
  try {
    const url = new URL(text);
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.') || isIP(hostname)) return '';
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

// Commercial CDNs institutions rent to serve their own files (Azure Front Door, CloudFront, S3,
// Azure Blob, Cloudinary, Bunny, Akamai, DigitalOcean Spaces).
const CDN_HOSTS = /\.(azurefd\.net|azureedge\.net|cloudfront\.net|amazonaws\.com|blob\.core\.windows\.net|b-cdn\.net|akamaized\.net|digitaloceanspaces\.com)$|^res\.cloudinary\.com$/;
/**
 * An image host that is the institution's own CDN: a known CDN service whose host name (or, for a
 * shared host such as Cloudinary, first path segment) carries the institution's domain label —
 * "upeswebsitecdn-prod….azurefd.net" for upes.ac.in. Only used for photographs the institution's
 * own pages reference; pages themselves are never crawled off-site.
 */
export function isInstitutionCdn(url, domain) {
  const parsed = url instanceof URL ? url : resolveUrl(url);
  const label = String(domain ?? '').split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!parsed || label.length < 3 || !CDN_HOSTS.test(parsed.hostname.toLowerCase())) return false;
  const host = parsed.hostname.toLowerCase().replace(/[^a-z0-9]/g, '');
  const firstSegment = parsed.pathname.split('/')[1]?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  return host.includes(label) || firstSegment.includes(label);
}
