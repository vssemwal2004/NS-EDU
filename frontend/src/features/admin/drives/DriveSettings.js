'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import { formatCount } from '@/features/admin/leads/lead-format';
import rm from '@/features/admin/ResourceManager.module.css';
import { driveStatusLabel } from './drive-format';
import { SchoolFields, schoolErrors } from './NewDriveDrawer';
import styles from './Drives.module.css';

const detailsOf = (item) => ({ ...item.school, title: item.title, campaign: item.campaign, notes: item.notes });
const rulesOf = (item) => ({ maxSubmissions: item.maxSubmissions ? String(item.maxSubmissions) : '', guardianConsent: item.guardianConsent, consentText: item.consentText });

export default function DriveSettings({ item, request, onSaved, notify }) {
  const router = useRouter();
  const [details, setDetails] = useState(() => detailsOf(item));
  const [rules, setRules] = useState(() => rulesOf(item));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState('');

  async function patch(body, section, message) {
    setBusy(section); setErrors({});
    try {
      const { item: saved } = await request(`/drives/${item.id}`, { method: 'PATCH', body });
      onSaved(saved); setDetails(detailsOf(saved)); setRules(rulesOf(saved));
      notify(message);
    } catch (failure) {
      setErrors({ ...schoolErrors(failure.fields ?? {}), section, message: failure.fields?.status || failure.message });
    } finally { setBusy(''); }
  }

  async function remove(permanent) {
    setBusy('remove');
    try {
      const result = await request(`/drives/${item.id}${permanent ? '?permanent=1' : ''}`, { method: 'DELETE' });
      setConfirm('');
      if (result.deleted) { notify('Drive deleted.'); router.push('/admin/drives'); return; }
      onSaved(result.item); notify('Drive archived. Its link now says “Registration closed”.');
    } catch (failure) {
      setConfirm(''); notify(failure.message, 'error');
    } finally { setBusy(''); }
  }

  const sectionError = (section) => errors.section === section && <p className={rm.formError} role="alert"><Icon name="shield" />{errors.message}</p>;
  const saveDetails = (event) => {
    event.preventDefault();
    patch({ school: { name: details.name, district: details.district, state: details.state, city: details.city }, title: details.title, campaign: details.campaign, notes: details.notes }, 'details', 'School details saved.');
  };
  const saveRules = (event) => {
    event.preventDefault();
    patch({ maxSubmissions: rules.maxSubmissions.trim() ? rules.maxSubmissions.trim() : null, guardianConsent: rules.guardianConsent, consentText: rules.consentText }, 'rules', 'Registration rules saved.');
  };

  return <div className={styles.settings}>
    <form className={styles.panel} onSubmit={saveDetails} noValidate aria-labelledby="details-heading">
      <h2 id="details-heading" className={styles.panelTitle}>School details</h2>
      <p className={rm.help}>Shown at the top of the form. New registrations store the details as they are at that moment.</p>
      <SchoolFields value={details} onChange={setDetails} errors={errors.section === 'details' ? errors : {}} idPrefix="drive-settings" />
      <div className={rm.formGrid}>
        <div className={rm.formField}>
          <label className={rm.fieldLabel} htmlFor="drive-title">Form title</label>
          <input id="drive-title" className={rm.input} value={details.title} maxLength={150} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
          {errors.section === 'details' && errors.title && <span className={rm.fieldError}>{errors.title}</span>}
        </div>
        <div className={rm.formField}>
          <label className={rm.fieldLabel} htmlFor="drive-campaign">Campaign</label>
          <input id="drive-campaign" className={rm.input} value={details.campaign} maxLength={120} onChange={(event) => setDetails({ ...details, campaign: event.target.value })} />
        </div>
        <div className={rm.formField} data-wide="true">
          <label className={rm.fieldLabel} htmlFor="drive-notes">Internal notes</label>
          <textarea id="drive-notes" className={rm.input} rows={3} maxLength={2000} value={details.notes} placeholder="Contact teacher, visit date… (never shown to students)" onChange={(event) => setDetails({ ...details, notes: event.target.value })} />
        </div>
      </div>
      {sectionError('details')}
      <div className={styles.panelActions}><button type="submit" className="button button--primary" disabled={busy === 'details'}>{busy === 'details' ? 'Saving…' : 'Save details'}</button></div>
    </form>

    <form className={styles.panel} onSubmit={saveRules} noValidate aria-labelledby="rules-heading">
      <h2 id="rules-heading" className={styles.panelTitle}>Registration rules</h2>
      <div className={rm.formField}>
        <label className={rm.fieldLabel} htmlFor="drive-max">Registration limit</label>
        <input id="drive-max" className={rm.input} type="number" inputMode="numeric" min={1} max={1000000} placeholder="No limit" value={rules.maxSubmissions} onChange={(event) => setRules({ ...rules, maxSubmissions: event.target.value })} />
        <span className={rm.help}>The form closes by itself when this many students have registered. Leave empty for no limit.</span>
        {errors.section === 'rules' && errors.maxSubmissions && <span className={rm.fieldError}>{errors.maxSubmissions}</span>}
      </div>
      <label className={rm.switch}><input type="checkbox" checked={rules.guardianConsent} onChange={(event) => setRules({ ...rules, guardianConsent: event.target.checked })} /><span /><span>Ask for parent or guardian consent</span></label>
      <p className={rm.help}>Most school students are under 18. India’s DPDP Act 2023 requires verifiable parental consent for children’s data, so keep this on unless every student is an adult. Have the wording reviewed by your legal adviser.</p>
      <div className={rm.formField}>
        <label className={rm.fieldLabel} htmlFor="drive-consent">Contact consent wording</label>
        <textarea id="drive-consent" className={rm.input} rows={3} minLength={20} maxLength={600} value={rules.consentText} onChange={(event) => setRules({ ...rules, consentText: event.target.value })} />
        <span className={rm.help}>Students tick this box. The exact text is stored with each registration. Leave empty to restore the default.</span>
        {errors.section === 'rules' && errors.consentText && <span className={rm.fieldError}>{errors.consentText}</span>}
      </div>
      {sectionError('rules')}
      <div className={styles.panelActions}><button type="submit" className="button button--primary" disabled={busy === 'rules'}>{busy === 'rules' ? 'Saving…' : 'Save rules'}</button></div>
    </form>

    <section className={styles.panel} aria-labelledby="status-heading">
      <h2 id="status-heading" className={styles.panelTitle}>Status</h2>
      <p className={styles.statusLine}><span className={styles.pill} data-status={item.status}>{driveStatusLabel(item.status)}</span>
        {item.status === 'active' && 'Students can register with the link and QR code.'}
        {item.status === 'closed' && (item.closedReason === 'limit' ? 'Closed automatically: the registration limit was reached.' : 'The link shows “Registration closed”.')}
        {item.status === 'archived' && 'Hidden from the drive list. The link shows “Registration closed”; registrations stay in Leads.'}
      </p>
      {sectionError('status')}
      <div className={styles.panelActions}>
        {item.status === 'active' && <button type="button" className="button button--outline" disabled={Boolean(busy)} onClick={() => patch({ status: 'closed' }, 'status', 'Registration closed.')}><Icon name="lock" />Close registration</button>}
        {item.status === 'closed' && <button type="button" className="button button--primary" disabled={Boolean(busy)} onClick={() => patch({ status: 'active' }, 'status', 'Registration reopened.')}>Reopen registration</button>}
        {item.status === 'archived' && <button type="button" className="button button--outline" disabled={Boolean(busy)} onClick={() => patch({ status: 'closed' }, 'status', 'Drive restored as closed.')}>Restore drive</button>}
        {item.status !== 'archived' && <button type="button" className="button button--ghost" disabled={Boolean(busy)} onClick={() => setConfirm('archive')}><Icon name="trash" />Archive</button>}
        {item.submissionCount === 0 && <button type="button" className={`button ${rm.dangerButton}`} disabled={Boolean(busy)} onClick={() => setConfirm('delete')}><Icon name="trash" />Delete permanently</button>}
      </div>
    </section>

    <AdminDrawer open={Boolean(confirm)} onClose={() => setConfirm('')} variant="confirm" title={confirm === 'delete' ? 'Delete this drive?' : 'Archive this drive?'}>
      <div className={rm.confirm}>
        <p>{confirm === 'delete'
          ? `${item.school.name} has no registrations. The drive, its link and its QR code are removed for good.`
          : `The link and QR code for ${item.school.name} will show “Registration closed”. ${formatCount(item.submissionCount)} registrations stay in Leads, and you can restore the drive later.`}</p>
        <div className={rm.formActions}>
          <button type="button" className="button button--ghost" onClick={() => setConfirm('')}>Cancel</button>
          <button type="button" className={`button ${rm.dangerButton}`} disabled={busy === 'remove'} onClick={() => remove(confirm === 'delete')}>{busy === 'remove' ? 'Working…' : confirm === 'delete' ? 'Delete drive' : 'Archive drive'}</button>
        </div>
      </div>
    </AdminDrawer>
  </div>;
}
