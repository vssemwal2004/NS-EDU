import styles from './Intro.module.css';

// Small catalogue-scale panel for the PageIntro aside. Numbers are counts from the catalogue only.
export default function IntroStats({ items, note }) {
  return <div className={styles.panel}>
    <dl>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    {note && <p>{note}</p>}
  </div>;
}
