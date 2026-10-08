export function filterCollegeRecords(records, { courseId, location = '', maxFee = '', sort = 'default', query = '' }) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = records.filter((row) => {
    const search = `${row.name} ${row.city} ${row.state || ''}`.toLocaleLowerCase();
    return (!courseId || row.courseId === courseId)
      && (!location || row.city === location || row.state === location)
      && (!maxFee || row.annualTuitionInr <= Number(maxFee))
      && terms.every((term) => search.includes(term));
  });
  const comparators = {
    'fee-asc': (a, b) => a.annualTuitionInr - b.annualTuitionInr,
    'fee-desc': (a, b) => b.annualTuitionInr - a.annualTuitionInr,
    salary: (a, b) => (b.medianSalaryLpa ?? -1) - (a.medianSalaryLpa ?? -1),
    rating: (a, b) => b.demoRating - a.demoRating,
  };
  return comparators[sort] ? matches.toSorted(comparators[sort]) : matches;
}

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export function formatTuition(value) { return rupees.format(value); }
export function formatSalary(value) { return value == null ? 'Not provided' : `₹${value} LPA`; }
