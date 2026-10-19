import ExamsIndex from '@/features/courses/ExamsIndex';
import { firstParam } from '@/features/courses/data';
import { getCatalog } from '@/lib/api/catalog';

export const metadata = { title: 'Entrance exam guides — official sources & related courses | Gyaan Vidhya', description: 'Official links and starting points for major entrance exams in India, with the courses each exam is commonly used for.' };

export default async function ExamsPage({ searchParams }) {
  const [params, catalog] = await Promise.all([searchParams, getCatalog()]);
  return <ExamsIndex catalog={catalog} field={firstParam(params.field)} query={firstParam(params.q)} />;
}
