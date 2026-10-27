'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import { clearServerListCache } from '@/features/admin/table/useServerList';
import { GENDERS, labelOf, QUALIFICATIONS, STUDY_MODES } from '@/features/apply/apply-options';
import { answerText, channelLabel, channelOf, classLabel, courseText, formatDate, formatDateTime, isQuick, LEAD_STATUSES, LEADS_QUERY_KEY, leadStatusLabel, statusTone, streamLabel } from './lead-format';
import styles from './Leads.module.css';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
function age(dateOfBirth) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth || '')) return null;
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  const today = new Date();
  return today.getFullYear() - y - (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d) ? 1 : 0);
}

function Section({ id, title, icon, children }) {
  return <section className={styles.section} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}><span><Icon name={icon} /></span>{title}</h3>
    {children}
  </section>;
}
// rows: [label, value, key?]; the key defaults to the label (custom form questions pass their field id).
function Facts({ rows, wide = false }) {
  return <dl className={styles.facts} data-wide={wide || undefined}>{rows.map(([label, value, key]) => <div key={key ?? label}><dt>{label}</dt><dd data-empty={value === '' || value === null || value === undefined || undefined}>{value === '' || value === null || value === undefined ? 'Not provided' : value}</dd></div>)}</dl>;
}
const Verified = ({ on }) => (on ? <span className={styles.verified}><Icon name="loginBadge" />Matches login</span> : null);

export default function LeadDetail({ id }) {
  const router = useRouter();
  const { admin, request } = useAdminSession();
  const isAdmin = admin?.role === 'admin';
  const [state, setState] = useState({ item: null, error: '', status: 0 });
  const [notes, setNotes] = useState({ items: [], total: 0, page: 1, loaded: false });
  const [employees, setEmployees] = useState([]);
  const [nextStatus, setNextStatus] = useState('');
  const [assigned, setAssigned] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ text: '', error: false });

  useEffect(() => {
    const controller = new AbortController();
    request(`/leads/${id}`, { signal: controller.signal })
      .then(({ item }) => { setState({ item, error: '', status: 200 }); setNextStatus(item.status); setAssigned(item.assignedEmployeeIds); })
      .catch((failure) => { if (failure.name !== 'AbortError') setState({ item: null, error: failure.message, status: failure.status }); });
    request(`/leads/${id}/notes?limit=50`, { signal: controller.signal })
      .then((data) => setNotes({ items: data.items, total: data.total, page: 1, loaded: true }))
      .catch(() => {});
    return () => controller.abort();
  }, [id, request]);
  useEffect(() => {
    if (!isAdmin) return;
    request('/employees').then(({ items }) => setEmployees(items)).catch(() => {});
  }, [isAdmin, request]);

  function back(event) {
    let saved = '';
    try { saved = window.sessionStorage.getItem(LEADS_QUERY_KEY) || ''; } catch { /* storage unavailable */ }
    if (saved) { event.preventDefault(); router.push(`/admin/leads${saved}`); }
  }
  function done(text, error = false) { setBusy(''); setMessage({ text, error }); }
  // The list caches pages per tab; after a write, "All leads" must not flash the old status or counts.
  function changed(text) { clearServerListCache('/leads?'); clearServerListCache('/leads/stats'); done(text); }

  async function saveStatus(event) {
    event.preventDefault();
    if (nextStatus === state.item.status) return;
    setBusy('status'); setMessage({ text: '', error: false });
    try {
      const { item } = await request(`/leads/${id}/status`, { method: 'PATCH', body: { status: nextStatus } });
      setState((current) => ({ ...current, item }));
      changed(`Status changed to ${leadStatusLabel(item.status)}.`);
    } catch (failure) { done(failure.message, true); }
  }
  async function saveAssignments() {
    setBusy('assign'); setMessage({ text: '', error: false });
    try {
      const { item } = await request(`/leads/${id}/assignments`, { method: 'PATCH', body: { employeeIds: assigned } });
      setState((current) => ({ ...current, item })); setAssigned(item.assignedEmployeeIds);
      changed('Assignments saved.');
    } catch (failure) { done(failure.message, true); }
  }
  async function addNote(event) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy('note'); setMessage({ text: '', error: false });
    try {
      const { item } = await request(`/leads/${id}/notes`, { method: 'POST', body: { text } });
      setNotes((current) => ({ ...current, items: [item, ...current.items], total: current.total + 1 })); setText('');
      changed('Note added.');
    } catch (failure) { done(failure.message, true); }
  }
  async function olderNotes() {
    setBusy('more');
    try {
      const data = await request(`/leads/${id}/notes?limit=50&page=${notes.page + 1}`);
      setNotes((current) => ({ items: [...current.items, ...data.items.filter((note) => !current.items.some((existing) => existing.id === note.id))], total: data.total, page: current.page + 1, loaded: true }));
      setBusy('');
    } catch (failure) { done(failure.message, true); }
  }

  if (state.error) return <div className={styles.detailError} role="alert">
    <Icon name="shield" /><div><h2>{state.status === 404 ? 'Lead not found' : 'Could not load this lead'}</h2><p>{state.status === 404 ? 'It may not exist, or it is not assigned to you.' : state.error}</p></div>
    <Link className="button button--outline" href="/admin/leads" onClick={back}>Back to leads</Link>
  </div>;
  if (!state.item) return <div className={styles.skeletonGrid} aria-busy="true" aria-label="Loading lead">{[0, 1, 2, 3].map((index) => <span key={index} />)}</div>;

  const { item } = state;
  // Quick-apply leads carry only a few fields; school-drive and callback leads have no university
  // preference and no student account. Anything missing reads "Not provided".
  const channel = channelOf(item);
  const web = channel === 'web-apply';
  const quick = isQuick(item);
  const applicant = item.applicant ?? {};
  const academics = item.academics ?? {};
  const preference = item.preference ?? {};
  const school = item.school ?? {};
  const callback = item.callback ?? {};
  const answers = item.answers ?? [];
  const consent = item.consent ?? {};
  const source = item.source ?? {};
  const exams = item.exams ?? [];
  const years = age(applicant.dateOfBirth);
  const hasScore = academics.score !== null && academics.score !== undefined && academics.score !== '';
  const utm = [['Source', source.utmSource], ['Medium', source.utmMedium], ['Campaign', source.utmCampaign], ['Term', source.utmTerm], ['Content', source.utmContent]].filter(([, value]) => value);
  const course = courseText(preference);
  const meta = web ? [preference.institutionName || 'University not specified', course === 'Not specified' ? 'Course not specified' : course]
    : channel === 'school-drive' ? [school.name || 'School not recorded', [school.district, school.state].filter(Boolean).join(', ')]
      : [item.careerField?.name ? `Callback about ${item.careerField.name}` : 'Callback request', callback.preferredTime && `prefers ${callback.preferredTime}`];
  // The exact consent wording shown at submit time, whatever keys that form stored it under.
  const consentTexts = Object.entries(consent.text ?? {}).filter(([, text]) => typeof text === 'string' && text.trim());
  const formText = web ? (quick ? 'Quick apply (one screen)' : 'Detailed form') : channel === 'school-drive' ? 'School drive registration (QR form)' : 'Counsellor callback request';
  return <div className={styles.detail}>
    <header className={styles.detailHead}>
      <Link className={styles.backLink} href="/admin/leads" onClick={back}><Icon name="arrow" />All leads</Link>
      <div className={styles.headMain}>
        <div className={styles.headText}>
          <p className={styles.headRef}>{item.ref}<span className={styles.status} data-tone={statusTone(item.status)}>{leadStatusLabel(item.status)}</span>
            <span className={styles.channel} data-channel={channel} title="Where this lead came from">{channelLabel(channel)}</span>
            {quick && <span className={styles.mode} title="Submitted with the one-screen quick apply form">Quick apply</span>}</p>
          <h2>{applicant.fullName || 'Name not provided'}</h2>
          <p className={styles.headMeta}>{[...meta, `Submitted ${formatDateTime(item.createdAt)}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className={styles.headActions}>
          {applicant.phone && <a className="button button--primary" href={`tel:${applicant.phone}`}><Icon name="phone" />Call</a>}
          {applicant.email && <a className="button button--outline" href={`mailto:${applicant.email}?subject=${encodeURIComponent(`${web ? 'Your application' : 'Your Gyaan Vidhya enquiry'} ${item.ref}`)}`}><Icon name="mail" />Email</a>}
        </div>
      </div>
      {message.text && <p className={message.error ? styles.flashError : styles.flash} role={message.error ? 'alert' : 'status'}><Icon name={message.error ? 'shield' : 'check'} />{message.text}</p>}
    </header>

    <div className={styles.detailGrid}>
      <div className={styles.sections}>
        {channel === 'school-drive' && <Section id="lead-school" title="School drive" icon="cap">
          <Facts rows={[
            ['School', school.name], ['District', school.district], ['State', school.state], ['City / town', school.city],
            ['Class', classLabel(academics.classLevel)], ['Stream', streamLabel(academics.schoolStream)],
          ]} />
          <h4 className={styles.subhead}>Form answers</h4>
          {answers.length ? <Facts wide rows={answers.map((answer, index) => [answer.label || `Question ${index + 1}`, answerText(answer.value), answer.id || index])} />
            : <p className={styles.muted}>This form asked no extra questions.</p>}
        </Section>}
        {channel === 'callback' && <Section id="lead-callback" title="Callback request" icon="phone">
          <Facts rows={[
            ['Career field', item.careerField?.name], ['Preferred time', callback.preferredTime],
            ['Message', callback.message && <span className={styles.message}>{callback.message}</span>],
          ]} />
        </Section>}
        {(web || preference.institutionName) && <Section id="lead-programme" title="University & course" icon="building">
          <Facts rows={[
            ['University', preference.institutionName && <>{preference.institutionName}<small>{preference.institutionSlug}</small></>],
            ['Location', [preference.city, preference.state].filter(Boolean).join(', ')],
            ['Course', preference.courseName], ['Programme / specialisation', preference.programmeName],
            ['Intake year', preference.intakeYear], ['Study mode', labelOf(STUDY_MODES, preference.studyMode)],
          ]} />
        </Section>}
        <Section id="lead-applicant" title={channel === 'school-drive' ? 'Student' : 'Applicant'} icon="user">
          <Facts rows={[
            ['Full name', applicant.fullName],
            ['Email', applicant.email && <><a href={`mailto:${applicant.email}`}>{applicant.email}</a><Verified on={item.contactVerified?.email} /></>],
            ['Mobile', applicant.phone && <><a href={`tel:${applicant.phone}`}>{applicant.phone}</a><Verified on={item.contactVerified?.phone} /></>],
            ...(web ? [
              ['Date of birth', applicant.dateOfBirth && `${formatDate(`${applicant.dateOfBirth}T12:00:00Z`)}${years !== null ? ` (age ${years})` : ''}`],
              ['Gender', labelOf(GENDERS, applicant.gender)],
            ] : []),
            ['City / town', applicant.city], ['State', applicant.state],
            ...(web ? [
              ['PIN code', applicant.pincode],
              ['Parent or guardian', applicant.guardianName], ['Guardian mobile', applicant.guardianPhone && <a href={`tel:${applicant.guardianPhone}`}>{applicant.guardianPhone}</a>],
            ] : []),
          ]} />
        </Section>
        {web && <Section id="lead-academics" title="Academics" icon="cap">
          <Facts rows={[
            ['Highest qualification', labelOf(QUALIFICATIONS, academics.highestQualification)],
            ['Board / university', academics.board], ['Passing year', academics.passingYear],
            ['Result', hasScore ? `${academics.score}${academics.scoreType === 'cgpa' ? ' CGPA (out of 10)' : '%'}` : ''],
            ['Stream / subjects', (academics.stream ?? []).join(', ')],
            ['Class 12', academics.class12 && `${academics.class12.board} · ${academics.class12.year} · ${academics.class12.percentage}%`],
          ]} />
        </Section>}
        {web && <Section id="lead-exams" title="Entrance exams" icon="document">
          {exams.length ? <table className={styles.miniTable}>
            <thead><tr><th scope="col">Exam</th><th scope="col">Year</th><th scope="col">Score or rank</th></tr></thead>
            <tbody>{exams.map((exam, index) => <tr key={index}><td>{exam.name}</td><td>{exam.year}</td><td>{exam.scoreOrRank || '—'}</td></tr>)}</tbody>
          </table> : <p className={styles.muted}>{quick ? 'Not provided (the quick form does not ask for exams).' : 'No exams added.'}</p>}
        </Section>}
        {web && <Section id="lead-preferences" title="Preferences" icon="wallet">
          <Facts rows={[
            ['Hostel', preference.hostelRequired === true ? 'Needed' : preference.hostelRequired === false ? 'Not needed' : ''],
            ['Budget per year', preference.budgetPerYearInr !== null && preference.budgetPerYearInr !== undefined ? inr.format(preference.budgetPerYearInr) : ''],
            ['Message', preference.message && <span className={styles.message}>{preference.message}</span>],
          ]} />
        </Section>}
        <Section id="lead-consent" title="Consent & source" icon="shield">
          <ul className={styles.consentList}>
            {consentTexts.length ? consentTexts.map(([key, text]) => <li key={key}><Icon name="check" /><p>{text}</p></li>) : <>
              <li><Icon name="check" /><p>Agreed to be contacted by Gyaan Vidhya’s team.</p></li>
              <li><Icon name="check" /><p>Accepted the privacy terms.</p></li>
            </>}
          </ul>
          <Facts rows={[
            ['Form', formText],
            ['Consent given', consent.at ? `${formatDateTime(consent.at)} · wording ${consent.version || 'unknown'}` : ''],
            ['Came from', source.path],
            ...utm.map(([label, value]) => [`UTM ${label.toLowerCase()}`, value]),
            ...(isAdmin ? [['Browser', consent.userAgent && <small className={styles.agent}>{consent.userAgent}</small>]] : []),
          ]} />
        </Section>
      </div>

      <aside className={styles.rail} aria-label="Follow-up">
        <section className={styles.railCard} aria-labelledby="lead-status-title">
          <h3 id="lead-status-title">Status</h3>
          <form className={styles.statusForm} onSubmit={saveStatus}>
            <label className="sr-only" htmlFor="lead-status">Lead status</label>
            <select id="lead-status" className={styles.select} value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              {LEAD_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
            <button type="submit" className="button button--primary" disabled={busy === 'status' || nextStatus === item.status}>{busy === 'status' ? 'Saving…' : 'Update'}</button>
          </form>
          <ol className={styles.timeline} aria-label="Status history">
            {item.statusHistory.toReversed().map((entry, index) => <li key={`${entry.status}-${entry.at}-${index}`} data-current={index === 0 || undefined}>
              <strong>{leadStatusLabel(entry.status)}</strong>
              <small>{formatDateTime(entry.at)} · {entry.by ? entry.by.email : 'Submitted by student'}</small>
            </li>)}
          </ol>
        </section>

        <section className={styles.railCard} aria-labelledby="lead-assign-title">
          <h3 id="lead-assign-title">Assigned employees</h3>
          {isAdmin ? <>
            {employees.length ? <div className={styles.assignList}>{employees.map((employee) => <label key={employee.id}>
              <input type="checkbox" checked={(assigned ?? []).includes(employee.id)} onChange={(event) => setAssigned((current) => event.target.checked ? [...(current ?? []), employee.id] : (current ?? []).filter((value) => value !== employee.id))} />
              <span>{employee.email}</span>
            </label>)}</div> : <p className={styles.muted}>No employees yet. <Link href="/admin/employees">Add an employee</Link>.</p>}
            {employees.length > 0 && <button type="button" className="button button--outline" disabled={busy === 'assign'} onClick={saveAssignments}>{busy === 'assign' ? 'Saving…' : 'Save assignments'}</button>}
          </> : item.assignedEmployees.length ? <ul className={styles.plainList}>{item.assignedEmployees.map((person) => <li key={person.id}>{person.email}</li>)}</ul> : <p className={styles.muted}>Unassigned</p>}
        </section>

        <section className={styles.railCard} aria-labelledby="lead-notes-title">
          <h3 id="lead-notes-title">Notes &amp; follow-ups <span className={styles.badge}>{notes.total}</span></h3>
          <form className={styles.noteForm} onSubmit={addNote}>
            <label className="sr-only" htmlFor="lead-note">Add a note</label>
            <textarea id="lead-note" className={styles.textarea} rows={3} maxLength={2000} required value={text} onChange={(event) => setText(event.target.value)} placeholder="Record the call, what was agreed and the next step…" />
            <button type="submit" className="button button--primary" disabled={busy === 'note' || !text.trim()}>{busy === 'note' ? 'Saving…' : 'Add note'}</button>
          </form>
          <ol className={styles.notes}>
            {notes.items.map((note) => <li key={note.id}><p>{note.text}</p><small>{note.authorEmail}{note.authorRole === 'admin' ? ' (admin)' : ''} · {formatDateTime(note.createdAt)}</small></li>)}
          </ol>
          {notes.loaded && !notes.items.length && <p className={styles.muted}>No notes yet. Add one after each conversation.</p>}
          {notes.items.length < notes.total && <button type="button" className="button button--ghost" disabled={busy === 'more'} onClick={olderNotes}>{busy === 'more' ? 'Loading…' : 'Load older notes'}</button>}
        </section>
      </aside>
    </div>
  </div>;
}
