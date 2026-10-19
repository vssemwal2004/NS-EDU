import { notFound } from 'next/navigation';
import ExamDetail from '@/features/courses/ExamDetail';
import { getCatalog } from '@/lib/api/catalog';

async function findExam(params) {
  const [{ id }, catalog] = await Promise.all([params, getCatalog()]);
  return { exam: catalog.exams.find((item) => item.id === id), catalog };
}

export async function generateMetadata({ params }) {
  const { exam } = await findExam(params);
  if (!exam) return { title: 'Exam guide not found | Gyaan Vidhya' };
  return { title: `${exam.name} — official source & related courses | Gyaan Vidhya`, description: exam.summary };
}

export default async function ExamPage({ params }) {
  const { exam, catalog } = await findExam(params);
  if (!exam) notFound();
  return <ExamDetail exam={exam} catalog={catalog} />;
}
