'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import { kindOf, monogram, nirfOf, ownershipOf } from '@/features/universities/labels';
import InstitutionPicker from './InstitutionPicker';
import { UNI_COMPARE_MAX } from './institutionStore';
import styles from './InstitutionCompare.module.css';

const applyTarget = (item) => ({ id: item.id, name: item.name, city: item.city || '', state: item.state || '', logoUrl: item.logoUrl || '' });

function FilledSlot({ facts, index, onRemove }) {
  const { item } = facts;
  const chips = [
    item.naacGrade && `NAAC ${item.naacGrade}`,
    item.nirfRank && `NIRF ${nirfOf(item)}`,
    item.establishedYear && `Est. ${item.establishedYear}`,
    ownershipOf(item),
  ].filter(Boolean).slice(0, 3);
  return <article className={styles.slotCard} aria-labelledby={`vs-slot-${facts.id}`}>
    <button type="button" className={styles.slotRemove} aria-label={`Remove ${facts.name} from the comparison`} onClick={() => onRemove(facts.id)}><Icon name="close" /></button>
    <span className={styles.slotIndex} aria-hidden="true">{index + 1}</span>
    <span className={styles.slotMark} aria-hidden="true">{item.logoUrl
      ? <img src={item.logoUrl} alt="" width={52} height={52} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      : monogram(facts.name)}</span>
    <h3 id={`vs-slot-${facts.id}`} className={styles.slotName}>{facts.name}</h3>
    <p className={styles.slotPlace}><Icon name="uniMapPin" />{facts.place || 'Location not listed'}</p>
    <p className={styles.slotKind}>{kindOf(item)}</p>
    {chips.length > 0 && <ul className={styles.slotChips}>{chips.map((chip) => <li key={chip}>{chip}</li>)}</ul>}
    {facts.illustrative && <p className={styles.slotFlag}><Icon name="compareInfo" />Illustrative sample record</p>}
    <div className={styles.slotActions}>
      <ApplyButton university={applyTarget(item)} variant="light" block />
      <Link className={styles.slotLink} href={`/universities/${facts.id}`}>View profile<span className="sr-only">: {facts.name}</span><Icon name="arrow" /></Link>
    </div>
  </article>;
}

function PendingSlot({ slug, failed, onRemove, onRetry }) {
  if (!failed) return <div className={styles.slotLoading} aria-busy="true" aria-label={`Loading ${slug}`} />;
  return <div className={styles.slotError} role="alert">
    <Icon name="compareInfo" />
    <p><strong>{failed === 'missing' ? 'No longer listed' : 'Could not load'}</strong><small>{slug}</small></p>
    <div className={styles.slotErrorActions}>
      {failed !== 'missing' && <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={() => onRetry(slug)}>Try again</button>}
      <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={() => onRemove(slug)}>Remove</button>
    </div>
  </div>;
}

/** The versus arena: up to three slots with a VS medallion between them; only the first gap takes a pick. */
export default function InstitutionStage({ slugs, facts, errors, ready, onAdd, onRemove, onRetry, pickerRef }) {
  const total = slugs.length;
  const factBySlug = new Map(facts.map((entry) => [entry.id, entry]));

  return <div className={styles.arena} id="compare-slots">
    <div className={styles.arenaHead}>
      <h2 className={styles.arenaTitle}>{total ? <>In the <em>arena</em></> : <>Put two or three institutions <em>head to head</em></>}</h2>
      <p className={styles.arenaMeta}>
        <span className={styles.meter} aria-hidden="true">{Array.from({ length: UNI_COMPARE_MAX }, (_, index) => <i key={index} data-on={index < total || undefined} />)}</span>
        <span>{total} of {UNI_COMPARE_MAX} selected</span>
      </p>
    </div>

    {!ready
      ? <div className={styles.ring}>{Array.from({ length: UNI_COMPARE_MAX }, (_, index) => <Fragment key={index}>
        {index > 0 && <span className={styles.vs} aria-hidden="true"><span>vs</span></span>}
        <div className={styles.slot}><div className={styles.slotLoading} aria-hidden="true" /></div>
      </Fragment>)}</div>
      : <div className={styles.ring}>
        {Array.from({ length: UNI_COMPARE_MAX }, (_, index) => {
          const slug = slugs[index];
          const entry = slug ? factBySlug.get(slug) : null;
          const state = slug ? 'filled' : index === total ? 'open' : 'waiting';
          return <Fragment key={slug || `empty-${index}`}>
            {index > 0 && <span className={styles.vs} data-live={index < total || undefined} data-state={state} aria-hidden="true"><span>vs</span></span>}
            <div className={styles.slot} data-state={state}>
              {slug && (entry
                ? <FilledSlot facts={entry} index={index} onRemove={onRemove} />
                : <PendingSlot slug={slug} failed={errors[slug]} onRemove={onRemove} onRetry={onRetry} />)}
              {state === 'open' && <div className={styles.slotOpen}>
                <p className={styles.openHead}>
                  <span className={styles.plusDisc} aria-hidden="true"><Icon name="plus" /></span>
                  <span><strong>{total ? 'Add another' : 'Choose an institution'}</strong><small>Slot {index + 1} of {UNI_COMPARE_MAX} · 9,000+ listed</small></span>
                </p>
                <InstitutionPicker inputRef={index === total ? pickerRef : undefined} exclude={slugs}
                  label={`Add an institution to slot ${index + 1} of ${UNI_COMPARE_MAX}`} onSelect={onAdd} />
              </div>}
              {state === 'waiting' && <div className={styles.slotWait}>
                <span className={styles.plusDisc} aria-hidden="true"><Icon name="plus" /></span>
                <span>Slot {index + 1}<small>Optional · fills after slot {index}</small></span>
              </div>}
            </div>
          </Fragment>;
        })}
      </div>}
  </div>;
}
