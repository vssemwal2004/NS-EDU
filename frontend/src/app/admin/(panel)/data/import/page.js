import ImportCourses from '@/features/admin/data/ImportCourses';
import ImportUniversities from '@/features/admin/data/ImportUniversities';

export const metadata = { title: 'Import universities and courses' };

export default function ImportUniversitiesPage() {
  return <>
    <ImportUniversities />
    <ImportCourses />
  </>;
}
