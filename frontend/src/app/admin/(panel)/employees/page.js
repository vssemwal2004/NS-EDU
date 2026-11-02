import { redirect } from 'next/navigation';

// "Add employee" became part of Team & access, where staff also get a role and a mentor.
export default function EmployeesPage() {
  redirect('/admin/access');
}
