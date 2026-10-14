import { notFound } from 'next/navigation';
import CourseDetail from '@/features/courses/CourseDetail';
import { getCatalog } from '@/lib/api/catalog';

// Rendered on demand (no generateStaticParams): admins can add courses at any time.
async function findCourse(params) {
  const [{ id }, catalog] = await Promise.all([params, getCatalog()]);
  return { course: catalog.courses.find((item) => item.id === id), catalog };
}

export async function generateMetadata({ params }) {
  const { course } = await findCourse(params);
  if (!course) return { title: 'Course not found | NSEDU' };
  const name = course.fullName ? `${course.name} (${course.fullName})` : course.name;
  return { title: `${name} — colleges, fees & exams | NSEDU`, description: course.summary };
}

export default async function CoursePage({ params }) {
  const { course, catalog } = await findCourse(params);
  if (!course) notFound();
  return <CourseDetail course={course} catalog={catalog} />;
}
