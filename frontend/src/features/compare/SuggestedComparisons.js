'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { feeRange, joinNames } from './compare-data';
import styles from './Compare.module.css';

export function SuggestionCard({ card }) {
  return <li>
    <Link href={`${card.href}#comparison`} className={styles.suggestion}>
      <span className={styles.suggestionArt} aria-hidden="true">
        {card.rows.map((row, index) => <Fragment key={row.id}>
          {index > 0 && <span className={styles.vsDisc}>vs</span>}
          <CollegeArtwork row={row} className={styles.suggestionThumb} />
        </Fragment>)}
      </span>
      <span className={styles.suggestionReason}>{card.reason}</span>
      <strong className={styles.suggestionTitle}>{joinNames(card.rows)}</strong>
      <span className={styles.suggestionMeta}><Icon name={card.course.icon || 'cap'} />{card.course.name} · {card.rows.map((row) => row.city).filter((city, index, list) => list.indexOf(city) === index).join(', ')}</span>
      <span className={styles.suggestionFee}><Icon name="wallet" />{feeRange(card.rows)} /yr</span>
      <span className={styles.suggestionCta}>Compare {card.rows.length} colleges<Icon name="arrow" /></span>
    </Link>
  </li>;
}

const LIMIT = 8;

export default function SuggestedComparisons({ cards, title = 'Suggested comparisons', id = 'compare-suggestions' }) {
  const [expanded, setExpanded] = useState(false);
  if (!cards.length) return null;
  const visible = expanded ? cards : cards.slice(0, LIMIT);
  return <section className={styles.suggestions} aria-labelledby={id}>
    <div className={styles.suggestionsHead}>
      <div>
        <p className={styles.kicker}><Icon name="compareColumns" />Ready-made</p>
        <h2 id={id}>{title}</h2>
        <p className={styles.subtle}>Generated from the illustrative catalogue, not from popularity.</p>
      </div>
    </div>
    <ul className={styles.suggestionGrid}>{visible.map((card) => <SuggestionCard key={card.key} card={card} />)}</ul>
    {cards.length > LIMIT && <button type="button" className={`button button--ghost ${styles.moreButton}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? 'Show fewer' : `Show ${cards.length - LIMIT} more`}<Icon name="chevron" />
    </button>}
  </section>;
}
