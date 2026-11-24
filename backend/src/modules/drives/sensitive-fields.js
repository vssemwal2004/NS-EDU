// School-drive forms are filled in by (mostly under-18) students on a public QR link. Custom questions must not
// ask for identity numbers, financial details or sensitive categories of data: we have no purpose for them and
// the privacy policy promises we do not collect them. Pure: unit-tested without a database.

const RULES = [
  { topic: 'Aadhaar numbers', pattern: /\b(aa?dh?aa?r|adhar|uidai|uid\s*(no|number))\b|आधार/i },
  { topic: 'PAN numbers', pattern: /^\s*pan\s*[.:#]?\s*$|\bpan\s*(card|no\b|number|#)|permanent\s+account\s+number/i },
  { topic: 'bank, UPI or card details', pattern: /\b(bank|ifsc|micr|account\s*(no|number|#)|a\/c|upi|vpa|g\s*pay\s*id|paytm\s*(no|number|id)|credit\s*card|debit\s*card|card\s*(no|number|details)|cvv|atm\s*pin|net\s*banking)\b/i },
  { topic: 'health or medical information', pattern: /\b(health|medical\s*(history|condition|record|report|issue|problem|certificate)s?|diseases?|disabilit(y|ies)|illness(es)?|diagnos\w*|blood\s*group|medications?|allerg\w*|hiv|pregnan\w*|mental\s*health)\b/i },
  { topic: 'caste or religion', pattern: /\b(caste|sub-?caste|jati|gotra|religion|religious|sc\s*\/\s*st|obc|scheduled\s*(caste|tribe))\b/i },
  { topic: 'biometric data', pattern: /\b(biometrics?|finger\s*prints?|thumb\s*(print|impression)|iris|retina|face\s*scan)\b/i },
];

/** The sensitive topic a question touches ("Aadhaar numbers", …), from its label, help and choices; or null. */
export function sensitiveTopicOf({ label = '', help = '', options = [] } = {}) {
  const text = [label, help, ...(Array.isArray(options) ? options : [])].filter((item) => typeof item === 'string').join(' \n ');
  return RULES.find((rule) => rule.pattern.test(text))?.topic ?? null;
}

export const sensitiveFieldMessage = (topic) => `Drive forms cannot ask for ${topic}. Remove this question: it is sensitive personal data we do not collect from students.`;
