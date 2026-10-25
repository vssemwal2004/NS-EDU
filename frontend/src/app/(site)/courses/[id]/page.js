import { notFound } from 'next/navigation';
import CourseDetail from '@/features/courses/CourseDetail';
import { firstParam } from '@/features/courses/data';
import { getCatalog, getCourseOfferings } from '@/lib/api/catalog';

// Rendered on demand (no generateStaticParams): admins can add courses at any time.
async function findCourse(params) {
  const [{ id }, catalog] = await Promise.all([params, getCatalog()]);
  return { course: catalog.courses.find((item) => item.id === id), catalog };
}

export async function generateMetadata({ params }) {
  const { course } = await findCourse(params);
  if (!course) return { title: 'Course not found | Gyaan Vidhya' };
  const name = course.fullName ? `${course.name} (${course.fullName})` : course.name;
  return { title: `${name} — colleges, fees & exams | Gyaan Vidhya`, description: course.summary };
}

const OFFERING_KEYS = ['state', 'sort', 'page'];

export default async function CoursePage({ params, searchParams }) {
  const [{ course, catalog }, search] = await Promise.all([findCourse(params), searchParams]);
  if (!course) notFound();
  const filters = Object.fromEntries(OFFERING_KEYS.map((key) => [key, firstParam(search[key])]).filter(([, value]) => value));
  const offerings = await getCourseOfferings(course.id, new URLSearchParams(filters).toString());
  return <CourseDetail course={course} catalog={catalog} offerings={offerings} filters={filters} />;
}
