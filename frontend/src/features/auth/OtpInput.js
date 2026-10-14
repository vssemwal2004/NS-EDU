'use client';
import { useRef } from 'react';
import styles from './LoginDrawer.module.css';

const LENGTH = 6;

// Six single-digit boxes backed by one string. Paste or SMS autofill of the
// whole code into any box fills every box and calls onComplete once.
export default function OtpInput({ value, onChange, onComplete, invalid, disabled, fieldRef, describedBy }) {
  const inputs = useRef([]);
  const digits = Array.from({ length: LENGTH }, (_, index) => value[index] || '');

  function commit(next, focusIndex) {
    const clean = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(clean);
    // Never land past the next free box, so the code stays contiguous.
    inputs.current[Math.min(focusIndex, clean.length, LENGTH - 1)]?.focus();
    if (clean.length === LENGTH) onComplete?.(clean);
  }
  function handleInput(index, raw) {
    let typed = raw.replace(/\D/g, '');
    if (!typed) return;
    // Typing over a filled box gives two characters; keep the new one.
    if (typed.length === 2 && digits[index] && typed.includes(digits[index])) typed = typed[0] === digits[index] ? typed[1] : typed[0];
    if (typed.length >= LENGTH) { commit(typed, LENGTH - 1); return; }
    commit(value.slice(0, index) + typed + value.slice(index + typed.length), index + typed.length);
  }
  function handleKey(index, event) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index]) commit(value.slice(0, index) + value.slice(index + 1), index);
      else if (index > 0) commit(value.slice(0, index - 1) + value.slice(index), index - 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); inputs.current[index - 1].focus(); }
    if (event.key === 'ArrowRight' && index < LENGTH - 1) { event.preventDefault(); inputs.current[index + 1].focus(); }
  }
  // Clicking an empty box beyond the gap sends focus to the next free box.
  function handleClick(index) { if (index > value.length) inputs.current[value.length]?.focus(); }

  return <fieldset ref={fieldRef} className={styles.otp} data-invalid={invalid} disabled={disabled} aria-describedby={describedBy}>
    <legend className="sr-only">6-digit one-time code</legend>
    {digits.map((digit, index) => <input key={index} ref={(node) => { inputs.current[index] = node; }}
      aria-label={`Digit ${index + 1} of ${LENGTH}`} aria-invalid={invalid || undefined} inputMode="numeric" pattern="[0-9]*" maxLength={LENGTH}
      autoComplete={index === 0 ? 'one-time-code' : 'off'} data-filled={Boolean(digit)}
      value={digit} onChange={(event) => handleInput(index, event.target.value)} onKeyDown={(event) => handleKey(index, event)}
      onPaste={(event) => { event.preventDefault(); const text = event.clipboardData.getData('text').replace(/\D/g, ''); if (text) commit(text.length >= LENGTH ? text : value.slice(0, index) + text, text.length >= LENGTH ? LENGTH - 1 : index + text.length); }}
      onFocus={(event) => event.target.select()} onClick={() => handleClick(index)} />)}
  </fieldset>;
}
