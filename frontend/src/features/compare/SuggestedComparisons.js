'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { feeRange, joinNames } from './compare-data';
import styles from './Compare.module.css';

function SuggestionCard({ card }) {
  const cities = [...new Set(card.rows.map((row) => row.city))].join(', ');
  return <li>
    <Link href={`${card.href}#comparison`} className={styles.suggestion}>
      <span className={styles.suggestionArt} aria-hidden="true">
        {card.rows.map((row, index) => <Fragment key={row.id}>
          {index > 0 && <span className={styles.vsMini}>vs</span>}
          <CollegeArtwork row={row} className={styles.suggestionThumb} />
        </Fragment>)}
      </span>
      <span className={styles.suggestionReason}>{card.reason}</span>
      <strong className={styles.suggestionTitle}>{joinNames(card.rows)}</strong>
      <span className={styles.suggestionMeta}><Icon name={card.course.icon || 'cap'} />{card.course.name} · {cities}</span>
      <span className={styles.suggestionFee}>{feeRange(card.rows)} <small>/ yr</small></span>
      <span className={styles.suggestionCta}>Compare {card.rows.length} colleges<Icon name="arrow" /></span>
    </Link>
  </li>;
}

const LIMIT = 6;

export default function SuggestedComparisons({ cards }) {
  const [expanded, setExpanded] = useState(false);
  if (!cards.length) return null;
  const visible = expanded ? cards : cards.slice(0, LIMIT);
  return <section className={`lux-container ${styles.suggestions}`} aria-labelledby="compare-suggestions">
    <div className={styles.suggestionsHead}>
      <p className="lux-eyebrow lux-eyebrow--rule">Ready-made match-ups</p>
      <h2 id="compare-suggestions" className="lux-display-3">Suggested comparisons</h2>
      <p className={styles.subtle}>Generated from the illustrative catalogue by city, fee and placement figures, not from popularity.</p>
    </div>
    <ul className={styles.suggestionGrid}>{visible.map((card) => <SuggestionCard key={card.key} card={card} />)}</ul>
    {cards.length > LIMIT && <button type="button" className={`lux-button lux-button--ghost ${styles.moreButton}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? 'Show fewer' : `Show ${cards.length - LIMIT} more`}<Icon name="chevron" />
    </button>}
  </section>;
}
