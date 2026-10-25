'use client';
import { useState } from 'react';
import styles from './Profile.module.css';

// The institution's own about text runs to three long paragraphs. Phones show the opening lines with
// "Read more"; wider screens ignore the clamp and the button (both are ≤640px rules in the module).
export default function AboutText({ text }) {
  const [open, setOpen] = useState(false);
  const paragraphs = text.split(/\n{2,}/);
  const long = text.length > 420;
  return <div className={styles.aboutText} data-clamped={long && !open ? true : undefined}>
    {paragraphs.map((paragraph, index) => <p key={index} className={index ? styles.aboutMore : styles.about}>{paragraph}</p>)}
    {long && <button type="button" className={styles.aboutToggle} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read more'}</button>}
  </div>;
}
