// Editable design fixtures, not verified college fees or scholarship awards.
export const budgetDefaults = {
  collegeId: 'northfield-tech-btech', budgetInr: 400000, livingId: 'hostel',
  admissionYear: '2026–27', maxAmountInr: 100000000,
};
export const livingOptions = [
  { id: 'hostel', label: 'College hostel', accommodation: 60000, meals: 36000 },
  { id: 'rental', label: 'Shared rental', accommodation: 84000, meals: 36000 },
  { id: 'home', label: 'At home', accommodation: 0, meals: 24000 },
];
export const budgetCostFields = [
  { id: 'accommodation', label: 'Accommodation', group: 'living', note: 'First-year estimate' },
  { id: 'meals', label: 'Meals', group: 'living', note: 'First-year estimate' },
  { id: 'booksTravel', label: 'Books & travel', group: 'other', note: 'First-year estimate', defaultInr: 24000 },
  { id: 'joiningFees', label: 'Joining fees', group: 'other', note: 'One-time estimate', defaultInr: 10000 },
  { id: 'deposit', label: 'Refundable deposit', group: 'other', note: 'Included upfront; refundable', defaultInr: 5000 },
];
export const scholarshipResources = [
  { label: 'National Scholarship Portal', href: 'https://scholarships.gov.in/', description: 'Browse government schemes and their official requirements.' },
  { label: 'Buddy4Study', href: 'https://www.buddy4study.com/', description: 'Discover scholarship listings; confirm terms with the provider.' },
];
