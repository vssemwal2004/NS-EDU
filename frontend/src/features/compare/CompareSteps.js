import styles from './Compare.module.css';

const steps = ['Pick a course', 'Add up to 3 colleges', 'Share or print'];

export default function CompareSteps() {
  return <ol className={styles.steps} aria-label="How comparing works">
    {steps.map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span>{step}</li>)}
  </ol>;
}
