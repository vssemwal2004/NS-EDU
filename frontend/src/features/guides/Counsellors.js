'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import { formatPhone } from '@/features/auth/login-helpers';
import { api } from '@/lib/api/client';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import CallbackDialog from './CallbackDialog';
import { plural } from './data';
import styles from './Counsellors.module.css';

const LOGIN_REASON = 'Log in to see counsellors’ phone and WhatsApp numbers. It takes a one-time code, no password.';
const initials = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('');
const localDigits = (phone = '') => phone.replace(/^\+91/, '');

function Avatar({ person }) {
  return <span className={styles.avatar} aria-hidden="true">
    {person.photoUrl ? <Image src={person.photoUrl} alt="" width={72} height={72} sizes="72px" /> : initials(person.name)}
  </span>;
}

function ContactActions({ person, state, onLogin }) {
  if (state === 'contacts') {
    if (!person.phone) return null;
    return <div className={styles.actions}>
      <a className="lux-button lux-button--primary lux-button--sm" href={`tel:${person.phone}`}><Icon name="phone" />Call<span className="sr-only"> {person.name} on</span> +91 {formatPhone(localDigits(person.phone))}</a>
      {person.whatsapp && <a className="lux-button lux-button--outline lux-button--sm" href={`https://wa.me/91${localDigits(person.whatsapp)}`} target="_blank" rel="noopener noreferrer">
        <Icon name="loginChat" />WhatsApp<span className="sr-only"> {person.name} (opens in a new tab)</span>
      </a>}
    </div>;
  }
  if (state === 'checking') return <p className={styles.actionNote}>Loading contact details…</p>;
  if (state === 'unavailable') return null; // the section shows the error once, above the cards
  return <div className={styles.actions}>
    <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={onLogin}><Icon name="lock" />Log in to see contact details</button>
  </div>;
}

function CounsellorCard({ person, contactState, onLogin }) {
  return <li className={styles.card} data-lead={person.isMaster || undefined}>
    <div className={styles.person}>
      <Avatar person={person} />
      <div className={styles.who}>
        {person.isMaster && <span className={styles.badge}><Icon name="star" />Lead counsellor</span>}
        <h4 className={styles.name}>{person.name}</h4>
        {person.title && <p className={styles.role}>{person.title}</p>}
      </div>
    </div>
    {(person.languages.length > 0 || person.availability) && <dl className={styles.facts}>
      {person.languages.length > 0 && <div><dt><Icon name="guidesGlobe" /><span className="sr-only">Languages</span></dt><dd>{person.languages.join(', ')}</dd></div>}
      {person.availability && <div><dt><Icon name="guidesClock" /><span className="sr-only">Available</span></dt><dd>{person.availability}</dd></div>}
    </dl>}
    <ContactActions person={person} state={contactState} onLogin={onLogin} />
  </li>;
}

/**
 * "Talk to a counsellor": admin-defined career fields as tabs, each with its counsellors.
 * `initial` is the public directory rendered on the server (no phone numbers). Once the browser knows the
 * visitor is signed in it re-fetches the directory with the session cookie to get the numbers.
 */
export default function Counsellors({ id, initial }) {
  const baseId = useId();
  const { student, status, openLogin } = useStudentAuth();
  const [publicData, setPublicData] = useState(initial);
  const [contactData, setContactData] = useState(null);
  const [contactError, setContactError] = useState(null);
  const [retryFailed, setRetryFailed] = useState(false);
  const [selected, setSelected] = useState('');
  const [callbackField, setCallbackField] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const tabRefs = useRef(new Map());

  // The server render could not reach the API: try once more from the browser, but only for visitors who
  // are not signed in. A signed-in student's contacts fetch returns the same directory, and a second
  // cookie-carrying read would count twice against their hourly contact limit.
  const needsRetry = !initial && !publicData && status !== 'loading' && status !== 'signed-in';
  useEffect(() => {
    if (!needsRetry) return undefined;
    const controller = new AbortController();
    api('/career/fields', { signal: controller.signal }).then(setPublicData)
      .catch((failure) => { if (failure.name !== 'AbortError') setRetryFailed(true); });
    return () => controller.abort();
  }, [needsRetry]);

  const studentId = student?.id ?? '';
  useEffect(() => {
    if (status !== 'signed-in') return undefined;
    const controller = new AbortController();
    api('/career/fields', { signal: controller.signal })
      .then((data) => { setContactData({ data, studentId }); setContactError(null); })
      .catch((failure) => {
        if (failure.name === 'AbortError') return;
        setContactError({ studentId, message: failure.status === 429 ? failure.message : 'Contact details could not be loaded. Refresh the page to try again.' });
      });
    return () => controller.abort();
  }, [status, studentId, attempt]);

  const loaded = status === 'signed-in' && contactData?.studentId === studentId ? contactData.data : null;
  // An expired session reads as anonymous on the API (contacts: false): offer the login again.
  const contacts = loaded?.contacts ? loaded : null;
  // Errors belong to the student who saw them: never shown after logout, to someone else, or beside working contacts.
  const shownError = status === 'signed-in' && !contacts && contactError?.studentId === studentId ? contactError.message : '';
  const data = contacts || publicData || loaded;
  const fields = data?.items ?? [];
  const current = fields.find((field) => field.slug === selected) ?? fields[0];
  const contactState = contacts ? 'contacts' : status === 'signed-in' && !loaded ? (shownError ? 'unavailable' : 'checking') : status === 'loading' ? 'checking' : 'login';
  // Re-fetch after login even when the status was already "signed-in" (an expired session).
  const login = () => openLogin({ reason: LOGIN_REASON, onSuccess: () => setAttempt((count) => count + 1) });
  const tabId = (slug) => `${baseId}-tab-${slug}`;

  function onTabKey(event) {
    const index = fields.findIndex((field) => field.slug === current.slug);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: fields.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const field = fields[(next + fields.length) % fields.length];
    setSelected(field.slug);
    tabRefs.current.get(field.slug)?.focus();
  }

  return <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
    <div className="lux-container">
      <div className={styles.head}>
        <p className="lux-eyebrow lux-eyebrow--rule"><Icon name="support" />Free counselling</p>
        <h2 id={`${id}-title`} className="lux-display-3">Talk to a counsellor</h2>
        <p className="lux-lead">Gyaan Vidhya counsellors know their field’s courses, entrance routes and careers. Log in to call or WhatsApp them, or ask for a callback without logging in.</p>
      </div>

      {!data && <p className={styles.notice} role="status"><Icon name="support" />{retryFailed || shownError
        ? 'The counsellor list is unavailable right now. Please try again in a few minutes.'
        : 'Loading counsellors…'}</p>}
      {data && !fields.length && <div className={styles.empty}>
        <Icon name="people" />
        <p><strong>Counsellors are being added.</strong> Check back soon to speak with someone about your field.</p>
      </div>}
      {shownError && <p className={styles.notice} role="alert"><Icon name="shield" />{shownError}</p>}

      {current && <>
        {fields.length > 1 && <div className={styles.tabs} role="tablist" aria-label="Career fields">
          {fields.map((field) => <button key={field.slug} ref={(node) => { if (node) tabRefs.current.set(field.slug, node); else tabRefs.current.delete(field.slug); }}
            type="button" role="tab" id={tabId(field.slug)} className="lux-chip" aria-selected={field.slug === current.slug} aria-controls={`${baseId}-panel`}
            tabIndex={field.slug === current.slug ? 0 : -1} onClick={() => setSelected(field.slug)} onKeyDown={onTabKey}>
            <Icon name={field.icon} />{field.name}
          </button>)}
        </div>}

        <div className={styles.panel} id={`${baseId}-panel`} {...(fields.length > 1 ? { role: 'tabpanel', 'aria-labelledby': tabId(current.slug), tabIndex: 0 } : {})}>
          <header className={styles.panelHead}>
            <span className={styles.fieldIcon} aria-hidden="true"><Icon name={current.icon} /></span>
            <div className={styles.fieldText}>
              <h3 className="lux-title">{current.name}</h3>
              {current.description && <p>{current.description}</p>}
              <small>{current.counsellors.length ? plural(current.counsellors.length, 'counsellor') : 'Counsellors coming soon'}</small>
            </div>
            <button type="button" className="lux-button lux-button--primary" onClick={() => setCallbackField(current.slug)}><Icon name="phone" />Request a callback</button>
          </header>

          {current.counsellors.length > 0
            ? <ul className={styles.grid}>{current.counsellors.map((person) => <CounsellorCard key={person.id} person={person} contactState={contactState} onLogin={login} />)}</ul>
            : <div className={styles.empty}>
              <Icon name="people" />
              <p><strong>No {current.name} counsellors are listed yet.</strong> Request a callback and the right person from our team will call you.</p>
            </div>}

          {contactState === 'login' && current.counsellors.length > 0 && <p className={styles.footnote}><Icon name="lock" />Phone and WhatsApp numbers are shown only to logged-in students, to keep counsellors’ numbers safe from spam.</p>}
        </div>
      </>}
    </div>

    {data && <CallbackDialog fieldSlug={callbackField} fields={fields} callback={data.callback} onClose={() => setCallbackField(null)} />}
  </section>;
}
