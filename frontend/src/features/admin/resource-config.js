const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const yesNo = (value) => value ? 'Yes' : 'No';

// Table columns per resource. Forms are generated from the backend field metadata instead.
export const resourceColumns = {
  institutions: [
    { field: 'name', label: 'College', primary: true, secondary: (item) => item.shortName },
    { field: 'city', label: 'Location', format: (_, item) => [item.city, item.state].filter(Boolean).join(', ') },
    { field: 'demoRating', label: 'Rating', format: (value) => Number(value).toFixed(1) },
    { field: 'active', label: 'Visible', badge: true },
  ],
  programmes: [
    { field: 'institutionSlug', label: 'Programme', primary: true, refLabel: 'institutions', secondary: (item, refs) => refs.courses?.[item.courseSlug] || item.courseSlug },
    { field: 'annualTuitionInr', label: 'Tuition / yr', format: (value) => inr.format(value) },
    { field: 'medianSalaryLpa', label: 'Median', format: (value) => value === null || value === undefined ? '—' : `${value} LPA` },
    { field: 'tuitionYear', label: 'Year' },
    { field: 'active', label: 'Visible', badge: true },
  ],
  courses: [
    { field: 'name', label: 'Course', primary: true, secondary: (item) => item.fullName },
    { field: 'field', label: 'Field' },
    { field: 'popular', label: 'Popular', format: yesNo },
    { field: 'order', label: 'Order' },
    { field: 'active', label: 'Visible', badge: true },
  ],
  exams: [
    { field: 'name', label: 'Exam', primary: true, secondary: (item) => item.href },
    { field: 'field', label: 'Field' },
    { field: 'order', label: 'Order' },
    { field: 'active', label: 'Visible', badge: true },
  ],
  cities: [
    { field: 'name', label: 'City', primary: true, secondary: (item) => item.landmark },
    { field: 'featured', label: 'Featured tile', format: yesNo },
    { field: 'order', label: 'Order' },
    { field: 'active', label: 'Visible', badge: true },
  ],
  states: [
    { field: 'name', label: 'State', primary: true, secondary: (item) => item.landmark },
    { field: 'featured', label: 'Featured tile', format: yesNo },
    { field: 'order', label: 'Order' },
    { field: 'active', label: 'Visible', badge: true },
  ],
  scholarships: [
    { field: 'label', label: 'Scholarship', primary: true, secondary: (item) => item.description },
    { field: 'href', label: 'Website' },
    { field: 'order', label: 'Order' },
    { field: 'active', label: 'Visible', badge: true },
  ],
};

export const resourceIcons = { institutions: 'building', programmes: 'layers', courses: 'book', exams: 'document', cities: 'location', states: 'map', scholarships: 'cap' };
export const manageableResources = Object.keys(resourceColumns);
