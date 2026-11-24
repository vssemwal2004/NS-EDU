// Add only the configured web origins. Preserve the shared bucket's other CORS rules.
import { XMLParser } from 'fast-xml-parser';
import { readBucketCors, writeBucketCors } from '../lib/r2.js';

const input = process.argv.slice(2);
const addresses = input.filter((arg) => !arg.startsWith('--'));
const origins = new Set((addresses.length ? addresses : [process.env.PUBLIC_SITE_URL]).map((address) => {
  const url = new URL(address);
  if (url.username || url.password || !(url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) {
    throw new Error('Use an HTTPS site origin or a local development origin.');
  }
  return url.origin;
}));
const asList = (v) => v === undefined ? [] : [v].flat();
const headers = ['content-type', 'cache-control', 'if-none-match'];
const xml = await readBucketCors();
const rules = asList(new XMLParser().parse(xml || '<CORSConfiguration/>')?.CORSConfiguration?.CORSRule);
const missing = [...origins].filter((origin) => !rules.some((rule) => {
  const allowed = asList(rule.AllowedHeader).map((h) => h.toLowerCase());
  return asList(rule.AllowedOrigin).some((o) => o === '*' || o === origin) &&
    asList(rule.AllowedMethod).includes('PUT') && headers.every((h) => allowed.includes('*') || allowed.includes(h));
}));
if (missing.length && input.includes('--apply')) {
  const rule = '<CORSRule>' + missing.map((origin) => `<AllowedOrigin>${origin}</AllowedOrigin>`).join('') +
    '<AllowedMethod>PUT</AllowedMethod>' + headers.map((h) => `<AllowedHeader>${h}</AllowedHeader>`).join('') +
    '<MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule>';
  const base = xml.trim() || '<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"></CORSConfiguration>';
  const full = base.replace(/<CORSConfiguration([^>]*?)\s*\/>/, '<CORSConfiguration$1></CORSConfiguration>');
  if (!/<\/CORSConfiguration>/.test(full)) throw new Error('Unrecognised bucket CORS response.');
  await writeBucketCors(full.replace('</CORSConfiguration>', rule + '</CORSConfiguration>'));
}
console.log(JSON.stringify({ origins: [...origins], existingRules: rules.length, added: input.includes('--apply') ? missing : [], needed: input.includes('--apply') ? [] : missing }));
