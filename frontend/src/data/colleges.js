// Fictional static records for the approved Section 3 design.
// Figures, ratings and generated campus art are illustrative, not institution claims.
export const collegeCourseTabs = ['btech', 'mba', 'mbbs', 'bcom', 'bba', 'bca', 'bdes', 'mtech', 'bpharm', 'llb', 'nursing'];
export const collegeDemo = {
  tuitionYear: '2026–27', placementYear: '2024–25', maxComparison: 3,
  initialComparison: ['northfield-tech-btech', 'central-tech-btech'],
};

const institutions = [
  { id: 'northfield-tech', name: 'Northfield Institute of Technology', shortName: 'Northfield', city: 'Bengaluru', state: 'Karnataka', demoRating: 4.3, art: [130, 327, 130, 69] },
  { id: 'meadow-engineering', name: 'Meadow Engineering College', shortName: 'Meadow', city: 'Pune', state: 'Maharashtra', demoRating: 4.2, art: [130, 424, 130, 69] },
  { id: 'central-tech', name: 'Central Institute of Technology', shortName: 'Central', city: 'Hyderabad', state: 'Telangana', demoRating: 4.4, art: [130, 524, 130, 69] },
  { id: 'riverside-university', name: 'Riverside University', shortName: 'Riverside', city: 'Chennai', state: 'Tamil Nadu', demoRating: 4.1, art: [130, 624, 130, 69] },
  { id: 'hillside-engineering', name: 'Hillside Engineering Institute', shortName: 'Hillside', city: 'Delhi NCR', state: null, demoRating: 4.3, art: [130, 726, 130, 69] },
  { id: 'meadow-management', name: 'Meadow School of Management', shortName: 'Meadow Management', city: 'Pune', state: 'Maharashtra', demoRating: 4.2, art: [130, 424, 130, 69] },
  { id: 'central-health', name: 'Central College of Health Sciences', shortName: 'Central Health', city: 'Hyderabad', state: 'Telangana', demoRating: 4.1, art: [130, 524, 130, 69] },
  { id: 'northfield-design', name: 'Northfield School of Design and Law', shortName: 'Northfield Design', city: 'Bengaluru', state: 'Karnataka', demoRating: 4.3, art: [130, 327, 130, 69] },
  { id: 'riverside-arts', name: 'Riverside College of Arts and Commerce', shortName: 'Riverside Arts', city: 'Chennai', state: 'Tamil Nadu', demoRating: 4.0, art: [130, 624, 130, 69] },
  { id: 'hillside-hospitality', name: 'Hillside Institute of Hospitality', shortName: 'Hillside Hospitality', city: 'Delhi NCR', state: null, demoRating: 4.1, art: [130, 726, 130, 69] },
  { id: 'meadow-pharmacy', name: 'Meadow Institute of Pharmacy', shortName: 'Meadow Pharmacy', city: 'Pune', state: 'Maharashtra', demoRating: 4.2, art: [130, 424, 130, 69] },
];

// Course-specific values are explicit: changing a course never relabels B.Tech data.
const programmes = [
  ['northfield-tech', 'btech', 240000, 8.4, 22],
  ['meadow-engineering', 'btech', 180000, 6.8, 18],
  ['central-tech', 'btech', 210000, 7.6, 20],
  ['riverside-university', 'btech', 160000, 6.2, 16],
  ['hillside-engineering', 'btech', 220000, 7.8, 21],
  ['meadow-management', 'mba', 260000, 8.0, 20],
  ['riverside-university', 'mba', 220000, 7.2, 18],
  ['central-health', 'mbbs', 650000, null, null],
  ['riverside-arts', 'bcom', 90000, 3.8, 9],
  ['riverside-university', 'bcom', 110000, 4.2, 11],
  ['meadow-management', 'bba', 130000, 4.6, 12],
  ['riverside-university', 'bba', 120000, 4.3, 10],
  ['northfield-tech', 'bca', 140000, 4.8, 12],
  ['central-tech', 'bca', 120000, 4.5, 11],
  ['riverside-university', 'bca', 100000, 4.0, 10],
  ['northfield-design', 'bdes', 280000, 5.8, 15],
  ['riverside-university', 'bdes', 200000, 4.8, 12],
  ['northfield-tech', 'mtech', 160000, 9.2, 24],
  ['central-tech', 'mtech', 140000, 8.5, 22],
  ['meadow-pharmacy', 'bpharm', 150000, 4.2, 10],
  ['central-health', 'bpharm', 160000, null, null],
  ['northfield-design', 'llb', 120000, null, null],
  ['riverside-university', 'llb', 100000, null, null],
  ['central-health', 'nursing', 110000, null, null],
  ['riverside-arts', 'ba', 70000, null, null],
  ['central-health', 'bams', 220000, null, null],
  ['central-health', 'bhms', 180000, null, null],
  ['central-health', 'bds', 350000, null, null],
  ['hillside-hospitality', 'bhm', 170000, 4.2, 10],
];
const institutionById = new Map(institutions.map((item) => [item.id, item]));
export const staticCollegeRecords = programmes.map(([collegeId, courseId, annualTuitionInr, medianSalaryLpa, highestSalaryLpa]) => ({
  ...institutionById.get(collegeId), id: `${collegeId}-${courseId}`, collegeId, courseId,
  annualTuitionInr, medianSalaryLpa, highestSalaryLpa,
  tuitionYear: collegeDemo.tuitionYear, placementYear: collegeDemo.placementYear,
  isIllustrative: true,
}));
