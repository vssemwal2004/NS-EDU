import { courses, exams } from '@/data/landing';
export function searchCatalog(type, query) {
  const catalog = type === 'Courses' ? courses : type === 'Exams' ? exams : [];
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return catalog.filter((item) => {
    const text = [item.name, item.fullName, item.field, item.summary].filter(Boolean).join(' ').toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
