import StudentActivity from '@/features/admin/insights/StudentActivity';

export const metadata = { title: 'Student activity' };

// params is a Promise in this Next.js version.
export default async function StudentActivityPage({ params }) {
  const { id } = await params;
  return <StudentActivity id={id} />;
}
