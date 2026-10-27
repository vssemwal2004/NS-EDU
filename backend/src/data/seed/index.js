import { seedCourses } from './courses.js';
import { seedExams } from './exams.js';
import { seedInstitutions, seedProgrammes } from './colleges.js';
import { seedCities, seedStates } from './locations.js';
import { seedScholarships } from './scholarships.js';
import { seedCareerFields } from './career-fields.js';

// Order matters: programmes reference institutions and courses.
export const seedSets = [
  { collection: 'courses', key: 'slug', docs: seedCourses },
  { collection: 'exams', key: 'slug', docs: seedExams },
  { collection: 'institutions', key: 'slug', docs: seedInstitutions },
  { collection: 'programmes', key: 'slug', docs: seedProgrammes },
  { collection: 'cities', key: 'name', docs: seedCities },
  { collection: 'states', key: 'name', docs: seedStates },
  { collection: 'scholarships', key: 'slug', docs: seedScholarships },
  { collection: 'career_fields', key: 'slug', docs: seedCareerFields },
];
