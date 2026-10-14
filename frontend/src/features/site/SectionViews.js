'use client';
import { useRouter } from 'next/navigation';
import CollegeExplorer from '@/features/landing/CollegeExplorer';
import EligibilityChecker from '@/features/landing/EligibilityChecker';
import BudgetPlanner from '@/features/landing/BudgetPlanner';
import { useCatalog } from '@/providers/CatalogProvider';
import { useCourseSelection } from './useCourseSelection';

export function CollegesView({ initialCourse, initialLocation }) {
  const { colleges } = useCatalog();
  const [course, setCourse] = useCourseSelection(initialCourse);
  return <CollegeExplorer records={colleges} course={course} onCourseChange={setCourse} initialLocation={initialLocation} />;
}

export function EligibilityView({ initialCourse }) {
  const router = useRouter();
  const { colleges } = useCatalog();
  const [course, setCourse] = useCourseSelection(initialCourse);
  return <EligibilityChecker records={colleges} course={course} onCourseChange={setCourse} onExplore={(id) => router.push(`/colleges?course=${id}`)} />;
}

export function BudgetView({ initialCourse }) {
  const router = useRouter();
  const { colleges } = useCatalog();
  const [course, setCourse] = useCourseSelection(initialCourse);
  return <BudgetPlanner records={colleges} course={course} onCourseChange={setCourse} onScholarships={() => router.push('/scholarships')} />;
}
