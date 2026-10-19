// Pure budget maths. `config` is the admin-edited `budget` content entry (living options and cost rows).
export const MAX_AMOUNT_INR = 100_000_000;

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const digits = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export const formatBudgetCurrency = (value) => currency.format(value);
export const formatBudgetInput = (value) => digits.format(value);

// Accept ungrouped, Indian-grouped or western-grouped whole rupees. Invalid/empty
// values remain null so missing costs are never silently treated as zero.
export function parseBudgetAmount(raw, { allowZero = false } = {}) {
  const text = String(raw ?? '').trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})$/.test(text)) return null;
  const value = Number(text.replaceAll(',', ''));
  return Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= MAX_AMOUNT_INR ? value : null;
}

export function getBudgetAssumptions(config, livingId, overrides = {}) {
  const living = config.livingOptions.find((option) => option.id === livingId) || config.livingOptions[0];
  return Object.fromEntries(config.costFields.map((field) => [field.id,
    Object.hasOwn(overrides, field.id) ? overrides[field.id] : String(living?.[field.id] ?? field.defaultInr ?? ''),
  ]));
}

export function calculateBudgetEstimate(config, record, assumptions, budgetRaw) {
  const tuition = Number.isSafeInteger(record?.annualTuitionInr) && record.annualTuitionInr >= 0 ? record.annualTuitionInr : null;
  const values = Object.fromEntries(config.costFields.map((field) => [field.id, parseBudgetAmount(assumptions[field.id], { allowZero: true })]));
  const invalidFields = config.costFields.filter((field) => values[field.id] === null).map((field) => field.id);
  const complete = tuition !== null && invalidFields.length === 0;
  // Cost rows are summed by their `group` ('living' or 'other'); an invalid row leaves its group incomplete.
  const sum = (group) => {
    const ids = config.costFields.filter((field) => field.group === group).map((field) => field.id);
    return ids.every((id) => values[id] !== null) ? ids.reduce((total, id) => total + values[id], 0) : null;
  };
  const living = sum('living');
  const other = sum('other');
  const total = complete ? tuition + living + other : null;
  const budget = parseBudgetAmount(budgetRaw);
  const difference = total !== null && budget !== null ? budget - total : null;
  const state = !complete ? 'incomplete' : budget === null ? 'no-budget' : difference > 0 ? 'within' : difference === 0 ? 'exact' : 'over';
  return { tuition, values, living, other, total, budget, difference, state, invalidFields };
}

export function findAffordableColleges(config, records, { courseId, tuitionYear, assumptions, budget }) {
  if (parseBudgetAmount(budget) === null) return [];
  return records.filter((row) => row.courseId === courseId && row.tuitionYear === tuitionYear)
    .map((record) => ({ record, estimate: calculateBudgetEstimate(config, record, assumptions, budget) }))
    .filter(({ estimate }) => estimate.total !== null && estimate.difference >= 0)
    .toSorted((a, b) => a.estimate.total - b.estimate.total);
}
