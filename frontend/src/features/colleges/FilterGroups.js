'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { FEE_LIMITS, RATING_FLOORS, SORT_OPTIONS, formatLakh } from '@/lib/college-catalog';
import styles from './Listing.module.css';

const COURSE_PREVIEW = 6;
const FIELD_PREVIEW = 6;

function Option({ name, checked, onSelect, label, count, icon }) {
  return <label className={styles.option} data-checked={checked || undefined}>
    <input type="radio" name={name} checked={checked} onChange={onSelect} />
    {icon && <Icon name={icon} />}
    <span className={styles.optionLabel}>{label}</span>
    {count != null && <span className={styles.count} aria-label={`${count} ${count === 1 ? 'college' : 'colleges'}`}>{count}</span>}
  </label>;
}

// Keeps the selected option visible even when it sits beyond the preview.
function usePreview(items, limit, isSelected) {
  const [open, setOpen] = useState(false);
  const hidden = Math.max(0, items.length - limit);
  const shown = open || !hidden ? items : items.filter((item, index) => index < limit || isSelected(item));
  return { shown, hidden: open ? 0 : items.length - shown.length, open, toggle: () => setOpen((value) => !value), canToggle: hidden > 0 };
}

function MoreToggle({ preview, noun }) {
  if (!preview.canToggle) return null;
  return <button type="button" className={styles.moreToggle} aria-expanded={preview.open} onClick={preview.toggle}>
    {preview.open ? `Show fewer ${noun}` : `+${preview.hidden} more ${noun}`}<Icon name="chevron" />
  </button>;
}

const visible = (count, selected) => selected || count > 0;

export function FieldGroup({ name, value, counts, options, onChange }) {
  const items = options.fields.filter((field) => visible(counts.field.get(field) || 0, value.field === field));
  const preview = usePreview(items, FIELD_PREVIEW, (field) => field === value.field);
  return <fieldset className={styles.group}>
    <legend>Stream / field</legend>
    <Option name={`${name}-field`} checked={!value.field} onSelect={() => onChange('field', '')} label="All fields" count={counts.field.get('any') || 0} />
    {preview.shown.map((field) => <Option key={field} name={`${name}-field`} checked={value.field === field} onSelect={() => onChange('field', field)} label={field} count={counts.field.get(field) || 0} />)}
    <MoreToggle preview={preview} noun="fields" />
  </fieldset>;
}

export function CourseGroup({ name, value, counts, options, onChange }) {
  const items = options.courses.filter((course) => (!value.field || course.field === value.field) && visible(counts.courseId.get(course.id) || 0, value.course === course.id));
  const preview = usePreview(items, COURSE_PREVIEW, (course) => course.id === value.course);
  return <fieldset className={styles.group}>
    <legend>Course{value.field && <small> · {value.field}</small>}</legend>
    <Option name={`${name}-course`} checked={!value.course} onSelect={() => onChange('course', '')} label={value.field ? `Any ${value.field} course` : 'Any course'} count={counts.courseId.get('any') || 0} />
    {preview.shown.map((course) => <Option key={course.id} name={`${name}-course`} checked={value.course === course.id} onSelect={() => onChange('course', course.id)} label={course.name} icon={course.icon} count={counts.courseId.get(course.id) || 0} />)}
    <MoreToggle preview={preview} noun="courses" />
  </fieldset>;
}

export function LocationGroup({ name, value, counts, options, onChange, unknown }) {
  const states = options.states.filter((item) => visible(counts.location.get(item) || 0, value.location === item));
  const cities = options.cities.filter((item) => visible(counts.location.get(item) || 0, value.location === item));
  const option = (item) => <Option key={item} name={`${name}-location`} checked={value.location === item} onSelect={() => onChange('location', item)} label={item} count={counts.location.get(item) || 0} />;
  return <fieldset className={styles.group}>
    <legend>Location</legend>
    <Option name={`${name}-location`} checked={!value.location} onSelect={() => onChange('location', '')} label="All India" count={counts.location.get('any') || 0} />
    {unknown && <Option name={`${name}-location`} checked onSelect={() => {}} label={`${value.location} (none listed)`} count={0} />}
    {states.length > 0 && <p className={styles.subgroup}>States</p>}
    {states.map(option)}
    {cities.length > 0 && <p className={styles.subgroup}>Cities &amp; regions</p>}
    {cities.map(option)}
  </fieldset>;
}

export function FeeGroup({ name, value, counts, onChange }) {
  return <fieldset className={styles.group}>
    <legend>Annual tuition</legend>
    <Option name={`${name}-fee`} checked={!value.fee} onSelect={() => onChange('fee', '')} label="Any budget" count={counts.maxFee.get('any') || 0} />
    {FEE_LIMITS.map((fee) => <Option key={fee} name={`${name}-fee`} checked={value.fee === String(fee)} onSelect={() => onChange('fee', String(fee))} label={`Up to ${formatLakh(fee)} / year`} count={counts.maxFee.get(String(fee)) || 0} />)}
  </fieldset>;
}

export function RatingGroup({ name, value, counts, onChange }) {
  return <fieldset className={styles.group}>
    <legend>Demo rating</legend>
    <Option name={`${name}-rating`} checked={!value.rating} onSelect={() => onChange('rating', '')} label="Any rating" count={counts.minRating.get('any') || 0} />
    {RATING_FLOORS.map((floor) => <Option key={floor} name={`${name}-rating`} checked={value.rating === floor} onSelect={() => onChange('rating', floor)} label={`${floor} & above`} icon="star" count={counts.minRating.get(floor) || 0} />)}
  </fieldset>;
}

export function SortGroup({ name, value, onChange }) {
  return <fieldset className={styles.group}>
    <legend>Sort results</legend>
    {SORT_OPTIONS.map((item) => <Option key={item.value} name={`${name}-sort`} checked={value.sort === item.value} onSelect={() => onChange('sort', item.value)} label={item.label} />)}
  </fieldset>;
}

export const GROUPS = [
  { id: 'field', label: 'Field', Component: FieldGroup, active: (value) => (value.field && !value.course ? 1 : 0) },
  { id: 'course', label: 'Course', Component: CourseGroup, active: (value) => (value.course ? 1 : 0) },
  { id: 'location', label: 'Location', Component: LocationGroup, active: (value) => (value.location ? 1 : 0) },
  { id: 'fee', label: 'Tuition', Component: FeeGroup, active: (value) => (value.fee ? 1 : 0) },
  { id: 'rating', label: 'Rating', Component: RatingGroup, active: (value) => (value.rating ? 1 : 0) },
];
