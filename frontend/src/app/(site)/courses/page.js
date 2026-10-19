import CoursesIndex from '@/features/courses/CoursesIndex';
import { firstParam } from '@/features/courses/data';
import { getCatalog } from '@/lib/api/catalog';

export const metadata = { title: 'Courses by stream & level — fees, colleges & exams | Gyaan Vidhya', description: 'Explore undergraduate and postgraduate courses by stream, see sample fees and colleges, and the entrance exams linked to each course.' };

export default async function CoursesPage({ searchParams }) {
  const [params, catalog] = await Promise.all([searchParams, getCatalog()]);
  return <CoursesIndex catalog={catalog} field={firstParam(params.field)} level={firstParam(params.level)} query={firstParam(params.q)} />;
}
