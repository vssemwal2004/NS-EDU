// Budget planner defaults and living-cost estimates (editable fixtures, not verified fees).
export default {
  defaults: { collegeId: 'northfield-tech-btech', budgetInr: 400000, livingId: 'hostel' },
  livingOptions: [
    { id: 'hostel', label: 'College hostel', accommodation: 60000, meals: 36000 },
    { id: 'rental', label: 'Shared rental', accommodation: 84000, meals: 36000 },
    { id: 'home', label: 'At home', accommodation: 0, meals: 24000 },
  ],
  costFields: [
    { id: 'accommodation', label: 'Accommodation', group: 'living', note: 'First-year estimate' },
    { id: 'meals', label: 'Meals', group: 'living', note: 'First-year estimate' },
    { id: 'booksTravel', label: 'Books & travel', group: 'other', note: 'First-year estimate', defaultInr: 24000 },
    { id: 'joiningFees', label: 'Joining fees', group: 'other', note: 'One-time estimate', defaultInr: 10000 },
    { id: 'deposit', label: 'Refundable deposit', group: 'other', note: 'Included upfront; refundable', defaultInr: 5000 },
  ],
};
