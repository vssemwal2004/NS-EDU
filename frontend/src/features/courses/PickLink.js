'use client';
import Link from 'next/link';
import { usePreferences } from '@/providers/PreferencesProvider';

// Link that also remembers the course, so downstream tools (colleges, compare, budget) preselect it.
export default function PickLink({ course, children, ...props }) {
  const { setCourse } = usePreferences();
  return <Link {...props} onClick={() => setCourse(course)}>{children}</Link>;
}
