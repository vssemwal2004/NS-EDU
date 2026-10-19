import { foldText } from '../modules/universities/normalize.js';

export const STATES_AND_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];

const STATE_ALIASES = {
  orissa: 'Odisha', uttaranchal: 'Uttarakhand', pondicherry: 'Puducherry', tamilnadu: 'Tamil Nadu', chattisgarh: 'Chhattisgarh',
  'new delhi': 'Delhi', 'nct of delhi': 'Delhi', 'national capital territory of delhi': 'Delhi', 'delhi ncr': 'Delhi',
  'j and k': 'Jammu and Kashmir', 'andaman and nicobar': 'Andaman and Nicobar Islands', 'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
};

const STATE_KEYS = [
  ...STATES_AND_UTS.map((name) => [foldText(name), name]),
  ...Object.entries(STATE_ALIASES).map(([alias, name]) => [foldText(alias), name]),
].sort((a, b) => b[0].length - a[0].length);

// Exact state/UT name for free text such as "uttar pradesh" or "Orissa"; '' when unknown.
export function canonicalState(value) {
  const folded = foldText(value);
  if (!folded) return '';
  return STATE_KEYS.find(([key]) => key === folded)?.[1] ?? '';
}

// State/UT implied by a PIN code's postal circle. Only used when the address names no state;
// prefixes shared by two states (e.g. 160 Chandigarh/Mohali, 247, 605) return '' rather than guess.
const PIN_3 = {
  194: 'Ladakh', 403: 'Goa', 737: 'Sikkim', 744: 'Andaman and Nicobar Islands',
  248: 'Uttarakhand', 249: 'Uttarakhand', 263: 'Uttarakhand', 246: 'Uttarakhand',
  790: 'Arunachal Pradesh', 791: 'Arunachal Pradesh', 792: 'Arunachal Pradesh', 793: 'Meghalaya', 794: 'Meghalaya',
  795: 'Manipur', 796: 'Mizoram', 797: 'Nagaland', 798: 'Nagaland', 799: 'Tripura',
  814: 'Jharkhand', 815: 'Jharkhand', 816: 'Jharkhand', 822: 'Jharkhand', 825: 'Jharkhand', 826: 'Jharkhand', 827: 'Jharkhand',
  828: 'Jharkhand', 829: 'Jharkhand', 831: 'Jharkhand', 832: 'Jharkhand', 833: 'Jharkhand', 834: 'Jharkhand', 835: 'Jharkhand',
};
const PIN_3_AMBIGUOUS = new Set([160, 244, 247, 262, 396, 605]);
const PIN_2 = {
  11: 'Delhi', 12: 'Haryana', 13: 'Haryana', 14: 'Punjab', 15: 'Punjab', 16: 'Punjab', 17: 'Himachal Pradesh', 18: 'Jammu and Kashmir', 19: 'Jammu and Kashmir',
  20: 'Uttar Pradesh', 21: 'Uttar Pradesh', 22: 'Uttar Pradesh', 23: 'Uttar Pradesh', 24: 'Uttar Pradesh', 25: 'Uttar Pradesh', 26: 'Uttar Pradesh', 27: 'Uttar Pradesh', 28: 'Uttar Pradesh',
  30: 'Rajasthan', 31: 'Rajasthan', 32: 'Rajasthan', 33: 'Rajasthan', 34: 'Rajasthan', 36: 'Gujarat', 37: 'Gujarat', 38: 'Gujarat', 39: 'Gujarat',
  40: 'Maharashtra', 41: 'Maharashtra', 42: 'Maharashtra', 43: 'Maharashtra', 44: 'Maharashtra', 45: 'Madhya Pradesh', 46: 'Madhya Pradesh', 47: 'Madhya Pradesh', 48: 'Madhya Pradesh', 49: 'Chhattisgarh',
  50: 'Telangana', 51: 'Andhra Pradesh', 52: 'Andhra Pradesh', 53: 'Andhra Pradesh', 56: 'Karnataka', 57: 'Karnataka', 58: 'Karnataka', 59: 'Karnataka',
  60: 'Tamil Nadu', 61: 'Tamil Nadu', 62: 'Tamil Nadu', 63: 'Tamil Nadu', 64: 'Tamil Nadu', 67: 'Kerala', 68: 'Kerala', 69: 'Kerala',
  70: 'West Bengal', 71: 'West Bengal', 72: 'West Bengal', 73: 'West Bengal', 74: 'West Bengal', 75: 'Odisha', 76: 'Odisha', 77: 'Odisha', 78: 'Assam',
  80: 'Bihar', 81: 'Bihar', 82: 'Bihar', 84: 'Bihar', 85: 'Bihar',
};
export function stateFromPin(pin) {
  if (!/^[1-9]\d{5}$/.test(String(pin ?? ''))) return '';
  const three = Number(String(pin).slice(0, 3));
  if (PIN_3[three]) return PIN_3[three];
  if (PIN_3_AMBIGUOUS.has(three)) return '';
  return PIN_2[Math.floor(three / 10)] ?? '';
}

// States mentioned in a text, longest names first so "West Bengal" never matches as "Bengal".
export function statesIn(text) {
  const folded = ` ${foldText(text)} `;
  const found = [];
  for (const [key, name] of STATE_KEYS) {
    if (folded.includes(` ${key} `) && !found.includes(name)) found.push(name);
  }
  return found;
}

// Degree abbreviations as printed by Indian institutions. Case-sensitive on purpose: "BA", "MA",
// "BE" and "MS" are only degrees in capitals.
export const DEGREE_PATTERN = new RegExp(String.raw`^(?:${[
  String.raw`B\.?\s?Tech`, String.raw`M\.?\s?Tech`, String.raw`B\.?\s?E\.?(?=\s|\(|$)`, String.raw`M\.?\s?E\.?(?=\s|\(|$)`,
  String.raw`B\.?\s?Sc\.?`, String.raw`M\.?\s?Sc\.?`, String.raw`B\.?\s?Com\.?`, String.raw`M\.?\s?Com\.?`,
  String.raw`B\.?\s?A\.?(?=\s|\(|$|,)`, String.raw`M\.?\s?A\.?(?=\s|\(|$|,)`, 'BBA', 'MBA', 'BCA', 'MCA', 'PGDM', String.raw`PG\s?Diploma`,
  String.raw`B\.?\s?Des\.?`, String.raw`M\.?\s?Des\.?`, String.raw`B\.?\s?Arch\.?`, String.raw`M\.?\s?Arch\.?`, String.raw`B\.?\s?Plan\.?`, String.raw`M\.?\s?Plan\.?`,
  String.raw`B\.?\s?Pharm(?:a|acy)?\.?`, String.raw`M\.?\s?Pharm(?:a|acy)?\.?`, String.raw`Pharm\.?\s?D\.?`, String.raw`D\.?\s?Pharm(?:a|acy)?\.?`,
  'MBBS', 'BDS', 'MDS', String.raw`M\.?D\.?(?=\s|\(|$)`, String.raw`M\.?S\.?(?=\s|\(|$)`, 'BAMS', 'BHMS', 'BUMS', 'BNYS', 'BPT', 'MPT', 'BMLT', 'DMLT', 'BOT',
  String.raw`B\.?\s?Ed\.?`, String.raw`M\.?\s?Ed\.?`, String.raw`B\.?\s?P\.?\s?Ed\.?`, String.raw`D\.?\s?El\.?\s?Ed\.?`,
  String.raw`LL\.?\s?B\.?`, String.raw`LL\.?\s?M\.?`, String.raw`B\.?A\.?\s?LL\.?\s?B`, String.raw`BBA\s?LL\.?\s?B`,
  'GNM', 'ANM', 'BHM', 'BHMCT', 'BJMC', 'MJMC', String.raw`B\.?\s?Voc\.?`, String.raw`M\.?\s?Voc\.?`, 'BFA', 'MFA', 'BSW', 'MSW',
  String.raw`B\.?\s?Lib`, String.raw`M\.?\s?Lib`, String.raw`Ph\.?\s?D\.?`, String.raw`M\.?\s?Phil\.?`, 'Diploma', String.raw`Bachelor\s+of`, String.raw`Master\s+of`, String.raw`Doctor\s+of`,
].join('|')})(?![a-z])`);

// Stream detection from programme names, headings and link labels (never from body prose).
// Acronyms match case-sensitively, subject words case-insensitively.
const terms = (acronyms, words) => [
  acronyms.length ? new RegExp(String.raw`(?<![\w.])(?:${acronyms.join('|')})(?!\w)`) : null,
  words.length ? new RegExp(String.raw`\b(?:${words.join('|')})\b`, 'i') : null,
].filter(Boolean);

export const STREAM_RULES = [
  ['Engineering', terms([String.raw`B\.?\s?Tech`, String.raw`M\.?\s?Tech`, String.raw`B\.\s?E\.?`, 'BE'], ['Engineering'])],
  ['Management', terms(['MBA', 'BBA', 'PGDM'], ['Management Studies', 'School of Management', 'Business Administration', 'Business School'])],
  ['Medical', terms(['MBBS', 'BAMS', 'BHMS', 'BUMS', 'BNYS'], ['Medical College', 'Medical Sciences', 'Medicine'])],
  ['Pharmacy', terms([String.raw`B\.?\s?Pharm\w*\.?`, String.raw`M\.?\s?Pharm\w*\.?`, String.raw`Pharm\.?\s?D`, String.raw`D\.?\s?Pharm\w*\.?`], ['Pharmacy', 'Pharmaceutical Sciences'])],
  ['Nursing', terms(['GNM', 'ANM'], ['Nursing'])],
  ['Dental', terms(['BDS', 'MDS'], ['Dental'])],
  ['Law', terms([String.raw`LL\.?\s?B\.?`, String.raw`LL\.?\s?M\.?`], ['School of Law', 'Faculty of Law', 'Law School', 'Legal Studies'])],
  ['Design', terms([String.raw`B\.?\s?Des\.?`, String.raw`M\.?\s?Des\.?`], ['School of Design', 'Fashion Design', 'Interior Design', 'Fashion Technology'])],
  ['Architecture', terms([String.raw`B\.?\s?Arch\.?`, String.raw`M\.?\s?Arch\.?`, String.raw`B\.?\s?Plan\.?`], ['Architecture'])],
  ['Science', terms([String.raw`B\.?\s?Sc(?!\.?\s?Nursing)\.?`, String.raw`M\.?\s?Sc\.?`], ['Basic Sciences', 'School of Sciences', 'Applied Sciences'])],
  ['Commerce', terms([String.raw`B\.?\s?Com\.?`, String.raw`M\.?\s?Com\.?`], ['Commerce'])],
  ['Arts & Humanities', terms([String.raw`B\.?\s?A\.?`, String.raw`M\.?\s?A\.?`], ['Humanities', 'Liberal Arts', 'Social Sciences'])],
  ['Computer Applications', terms(['BCA', 'MCA'], ['Computer Applications'])],
  ['Education', terms([String.raw`B\.?\s?Ed\.?`, String.raw`M\.?\s?Ed\.?`, String.raw`B\.?\s?P\.?\s?Ed\.?`, String.raw`D\.?\s?El\.?\s?Ed\.?`], ['Teacher Education', 'College of Education'])],
  ['Agriculture', terms([], ['Agriculture', 'Agricultural', 'Horticulture', 'Forestry'])],
  ['Hospitality', terms(['BHM', 'BHMCT'], ['Hotel Management', 'Hospitality'])],
  ['Media & Journalism', terms(['BJMC', 'MJMC'], ['Journalism', 'Mass Communication'])],
  ['Paramedical', terms(['BPT', 'MPT', 'BMLT', 'DMLT'], ['Paramedical', 'Physiotherapy', 'Allied Health'])],
  ['Vocational', terms([String.raw`B\.?\s?Voc\.?`, String.raw`M\.?\s?Voc\.?`], ['Vocational'])],
];

// Regulators whose approval an institution states about itself. Acronyms are case-sensitive.
export const APPROVAL_RULES = [
  ['UGC', /\bUGC\b|University Grants Commission/],
  ['AICTE', /\bAICTE\b|All India Council for Technical Education/i],
  ['NMC', /\bNMC\b|National Medical Commission/],
  ['DCI', /\bDCI\b|Dental Council of India/],
  ['INC', /\bINC\b|Indian Nursing Council/],
  ['PCI', /\bPCI\b|Pharmacy Council of India/],
  ['BCI', /\bBCI\b|Bar Council of India/],
  ['NCTE', /\bNCTE\b|National Council for Teacher Education/],
  ['COA', /\bCOA\b|\bCoA\b|Council of Architecture/],
  ['ICAR', /\bICAR\b|Indian Council of Agricultural Research/],
  ['NCHM', /\bNCHM(CT)?\b|National Council for Hotel Management/],
  ['AIU', /\bAIU\b|Association of Indian Universities/],
];
