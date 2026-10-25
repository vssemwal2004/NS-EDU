import { foldText } from '../modules/universities/normalize.js';
import { canonicalState } from './india.js';
import { normalizeWebsite } from './urls.js';

export const UGC_REGISTRY_URL = 'https://www.ugc.gov.in/universitydetails/university?type=0wBmFB1Rb4JGVzq9UP%2FiOg%3D%3D';
export const UGC_REGISTRY_API = 'https://www.ugc.gov.in/universitydetails/Getuniversity_details?unitypeID=0';

// Newly established institutions sometimes appear in the UGC JSON before its URL column is
// populated. These exact-slug overrides were reviewed against the institution and/or government
// page. Keeping the evidence beside the URL makes additions auditable instead of heuristic.
export const OFFICIAL_WEBSITE_OVERRIDES = Object.freeze({
  'bidar-university': { website: 'https://bidaruniversity.karnataka.gov.in/', evidence: 'https://bidaruniversity.karnataka.gov.in/' },
  'captain-williamson-sangma-state-university': { website: 'https://cwssu.ac.in/home/', evidence: 'https://www.meghalaya.gov.in/' },
  'karnataka-sanskrit-university': { website: 'https://ksu.ac.in/', evidence: 'https://ksu.ac.in/' },
  'major-dhyan-chand-sports-university': { website: 'https://sportsuniup.com/', evidence: 'https://www.khelsathi.in/' },
  'national-institute-of-pharmaceutical-education-and-research-raebareli': { website: 'https://niperraebareli.edu.in/', evidence: 'https://niperraebareli.edu.in/' },
  'pannadhay-university': { website: 'https://sikkimpu.com/', evidence: 'https://www.sikkim.gov.in/media/press-release/press-info?id=165628&name=Press+Release+from+Sikkim+Private+Universities+Regulatory+Commission' },
  'sikkim-national-law-university': { website: 'https://www.sikkimnlu.ac.in/', evidence: 'https://sikkim.nalsa.gov.in/' },
  'tribhuvan-sahkari-university': { website: 'https://tsu.ac.in/', evidence: 'https://cooperation.gov.in/' },
  'trident-university-of-applied-sciences': { website: 'https://www.tridentuniversity.ac.in/', evidence: 'https://www.sikkim.gov.in/media/news-announcement/news-info?name=The+Second+Session+of+the+Eleventh+Sikkim+Legislative+Assembly+Convenes+to+Success' },
});

const LOCATION_WORDS = new Set([
  'campus', 'city', 'district', 'dist', 'rural', 'urban', 'north', 'south', 'east', 'west',
]);

const words = (value) => foldText(value).split(' ').filter(Boolean);

// Directory names often append a campus location ("University, Guntur") while UGC keeps the
// institution name alone. Only trim a suffix when every meaningful word is a known location word.
function comparableName(name, institution = {}) {
  const raw = String(name ?? '').trim();
  const parts = raw.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return foldText(raw);
  const locations = new Set([
    ...words(institution.city), ...words(institution.district), ...words(institution.state), ...LOCATION_WORDS,
  ]);
  while (parts.length > 1) {
    const suffix = words(parts.at(-1));
    if (!suffix.length || !suffix.every((word) => locations.has(word))) break;
    parts.pop();
  }
  return foldText(parts.join(' '));
}

function editSimilarity(left, right) {
  if (left === right) return 1;
  if (!left || !right) return 0;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function tokenDice(left, right) {
  const a = new Set(words(left));
  const b = new Set(words(right));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

const digits = (value) => String(value ?? '').replace(/\D/g, '');

export function registryMatchScore(institution, registryRow) {
  const state = canonicalState(institution.state) || String(institution.state ?? '').trim();
  const registryState = canonicalState(registryRow.state) || String(registryRow.state ?? '').trim();
  if (!state || !registryState || state !== registryState) return 0;

  const own = comparableName(institution.name, institution);
  const registered = comparableName(registryRow.name, institution);
  if (!own || !registered) return 0;
  let score;
  if (own === registered) score = 1;
  else if (own.startsWith(`${registered} `) || registered.startsWith(`${own} `)) score = 0.97;
  else score = editSimilarity(own, registered) * 0.55 + tokenDice(own, registered) * 0.45;

  const ownPin = digits(institution.pincode);
  const registryPin = digits(registryRow.pincode);
  if (ownPin.length === 6 && registryPin.length === 6) score += ownPin === registryPin ? 0.03 : -0.04;
  const placeTokens = words(`${institution.city ?? ''} ${institution.district ?? ''}`);
  const registryPlace = foldText(`${registryRow.name} ${registryRow.address}`);
  if (placeTokens.some((token) => token.length >= 4 && words(registryPlace).includes(token))) score += 0.015;
  return Math.max(0, Math.min(1, score));
}

/**
 * Returns one conservative UGC match. A close second candidate is deliberately treated as
 * ambiguous: campus groups frequently share a name within one state.
 */
export function matchRegistryRow(institution, rows, { threshold = 0.86, minimumGap = 0.035 } = {}) {
  const override = OFFICIAL_WEBSITE_OVERRIDES[institution.slug];
  if (override) return { status: 'matched', score: 1, row: { name: institution.name, state: institution.state, ...override } };
  const ranked = rows
    .map((row) => ({ row, score: registryMatchScore(institution, row) }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { status: 'unmatched', score: 0, row: null };
  const [best, second] = ranked;
  if (best.score < 0.995 && second && best.score - second.score < minimumGap) {
    return { status: 'ambiguous', score: best.score, row: null, candidates: ranked.slice(0, 3) };
  }
  return { status: 'matched', ...best };
}

export function normalizeRegistryRows(payload) {
  const list = Array.isArray(payload) ? payload : payload?.List;
  if (!Array.isArray(list)) throw new Error('UGC registry returned an unexpected response');
  return list.map((row) => ({
    id: String(row.ID ?? ''),
    name: String(row.uni_name ?? '').trim(),
    state: canonicalState(row.state) || String(row.state ?? '').trim(),
    address: String(row.address ?? '').replace(/\s+/g, ' ').trim(),
    pincode: digits(row.Zip).slice(0, 6),
    type: String(row.uni_type ?? '').trim(),
    status: String(row.status ?? '').trim(),
    website: normalizeWebsite(row.url),
  })).filter((row) => row.name && row.state && row.website);
}

export async function fetchUgcRegistry({ fetchImpl = fetch, userAgent = 'GyaanVidhyaBot/1.0' } = {}) {
  const response = await fetchImpl(UGC_REGISTRY_API, {
    headers: { accept: 'application/json', 'user-agent': userAgent },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`UGC registry request failed with HTTP ${response.status}`);
  return normalizeRegistryRows(await response.json());
}
