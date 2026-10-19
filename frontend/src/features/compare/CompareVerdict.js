import Icon from '@/components/ui/Icon';
import { formatSalary, formatTuition } from '@/lib/college-catalog';
import { bestIds } from './compare-data';
import styles from './Compare.module.css';

const METRICS = [
  { key: 'annualTuitionInr', mode: 'min', label: 'Lowest tuition', icon: 'compareTrophy', format: (value) => `${formatTuition(value)} / yr` },
  { key: 'medianSalaryLpa', mode: 'max', label: 'Highest median package', icon: 'compareGauge', format: formatSalary },
  { key: 'highestSalaryLpa', mode: 'max', label: 'Highest single offer', icon: 'compareSparkle', format: formatSalary },
  { key: 'demoRating', mode: 'max', label: 'Highest demo rating', icon: 'star', format: (value) => `${value.toFixed(1)} / 5`, note: 'Sample value, not reviews' },
];

// Who leads each metric among the selected colleges only. Ties list every leader; equal values show nothing.
export default function CompareVerdict({ selected }) {
  const items = METRICS.map((metric) => {
    const best = bestIds(selected, metric.key, metric.mode);
    return best && { ...metric, value: best.target, names: selected.filter((row) => best.ids.has(row.id)).map((row) => row.shortName || row.name) };
  }).filter(Boolean);
  if (!items.length) return null;
  return <section className={styles.verdict} aria-labelledby="compare-verdict-title">
    <h2 id="compare-verdict-title" className={styles.verdictTitle}>Where each college leads</h2>
    <ul>{items.map((item) => <li key={item.key}>
      <span className={styles.verdictIcon}><Icon name={item.icon} /></span>
      <span className={styles.verdictLabel}>{item.label}</span>
      <strong className={styles.verdictName}>{item.names.join(' & ')}</strong>
      <span className={styles.verdictValue}>{item.format(item.value)}{item.note && <small>{item.note}</small>}</span>
    </li>)}</ul>
  </section>;
}
