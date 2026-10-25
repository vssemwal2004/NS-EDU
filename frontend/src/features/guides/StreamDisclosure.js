'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './CareerGuidance.module.css';

// One field card on the career guide. Phones show only the header row and open the course list on tap
// (22 fields would otherwise run to ~10,000px); wider screens never render the toggle (a ≤640px rule).
export default function StreamDisclosure({ className, label, controls, children }) {
  const [open, setOpen] = useState(false);
  return <li className={className} data-open={open || undefined}>
    <button type="button" className={styles.streamToggle} aria-expanded={open} aria-controls={controls} onClick={() => setOpen(!open)}>
      <span className="sr-only">{label}</span><Icon name="chevron" />
    </button>
    {children}
  </li>;
}
