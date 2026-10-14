'use client';
import { useState } from 'react';
import { usePreferences } from '@/providers/PreferencesProvider';

// URL ?course= wins on arrival, then the stored preference. Changes update both
// the preference and the address bar (without a server round trip) so links stay shareable.
export function useCourseSelection(initialCourse = '') {
  const preferences = usePreferences();
  const [selected, setSelected] = useState(null);
  const course = selected ?? (initialCourse || preferences.course || '');
  function setCourse(id) {
    setSelected(id);
    preferences.setCourse(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('course', id); else url.searchParams.delete('course');
    window.history.replaceState(window.history.state, '', url);
  }
  return [course, setCourse];
}
