'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Panel } from '@/features/admin/ui/Page';
import { DriveStatus } from './DrivesManager';
import { SchoolFields, schoolErrors, TextField } from './NewDriveDrawer';
import styles from './Drives.module.css';

const detailsOf = (item) => ({ ...item.school, title: item.title, campaign: item.campaign, notes: item.notes });
const rulesOf = (item) => ({ maxSubmissions: item.maxSubmissions ? String(item.maxSubmissions) : '', guardianConsent: item.guardianConsent, consentText: item.consentText });

export default function DriveSettings({ item, request, onSaved, toast, onArchive, onDelete, onStep }) {
  const [details, setDetails] = useState(() => detailsOf(item));
  const [rules, setRules] = useState(() => rulesOf(item));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const detailsDirty = JSON.stringify(details) !== JSON.stringify(detailsOf(item));
  const rulesDirty = JSON.stringify(rules) !== JSON.stringify(rulesOf(item));

  async function patch(body, section, message) {
    setBusy(section); setErrors({});
    try {
      const { item: saved } = await request(`/drives/${item.id}`, { method: 'PATCH', body });
      onSaved(saved); setDetails(detailsOf(saved)); setRules(rulesOf(saved));
      toast.success(message);
    } catch (failure) {
      setErrors({ ...schoolErrors(failure.fields ?? {}), section, message: failure.message });
    } finally { setBusy(''); }
  }

  const sectionError = (section) => errors.section === section && <p className={styles.formError} role="alert"><Icon name="alert" />{errors.message}</p>;
  const fieldErrors = (section) => (errors.section === section ? errors : {});
  const saveDetails = (event) => {
    event.preventDefault();
    patch({ school: { name: details.name, district: details.district, state: details.state, city: details.city }, title: details.title, campaign: details.campaign, notes: details.notes }, 'details', 'School details saved.');
  };
  const saveRules = (event) => {
    event.preventDefault();
    patch({ maxSubmissions: rules.maxSubmissions.trim() ? rules.maxSubmissions.trim() : null, guardianConsent: rules.guardianConsent, consentText: rules.consentText }, 'rules', 'Registration rules saved.');
  };

  return <div className={styles.settings}>
    <Panel title="School details" description="Shown at the top of the form. New registrations store the details as they are at that moment.">
      <form className={styles.form} onSubmit={saveDetails} noValidate>
        <SchoolFields value={details} onChange={setDetails} errors={fieldErrors('details')} idPrefix="drive-settings" />
        <div className={styles.grid}>
          <TextField id="drive-title" label="Form title" value={details.title} onChange={(title) => setDetails({ ...details, title })} error={fieldErrors('details').title} maxLength={150} />
          <TextField id="drive-campaign" label="Campaign" value={details.campaign} onChange={(campaign) => setDetails({ ...details, campaign })} error={fieldErrors('details').campaign} maxLength={120} />
          <TextField id="drive-notes" label="Internal notes" textarea wide rows={3} value={details.notes} onChange={(notes) => setDetails({ ...details, notes })} error={fieldErrors('details').notes} maxLength={2000}
            placeholder="Contact teacher, visit date… (never shown to students)" />
        </div>
        {sectionError('details')}
        <div className={styles.panelFooter}>
          {detailsDirty && <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setDetails(detailsOf(item))}>Discard</button>}
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy === 'details' || !detailsDirty}>{busy === 'details' ? 'Saving…' : 'Save details'}</button>
        </div>
      </form>
    </Panel>

    <Panel title="Registration rules">
      <form className={styles.form} onSubmit={saveRules} noValidate>
        <TextField id="drive-max" label="Registration limit" type="number" inputMode="numeric" min={1} max={1000000} placeholder="No limit" value={rules.maxSubmissions}
          onChange={(maxSubmissions) => setRules({ ...rules, maxSubmissions })} error={fieldErrors('rules').maxSubmissions}
          help="The form closes by itself when this many students have registered. Leave empty for no limit." />
        <div className={styles.field}>
          <label className={styles.switch}><input type="checkbox" checked={rules.guardianConsent} onChange={(event) => setRules({ ...rules, guardianConsent: event.target.checked })} /><span aria-hidden="true" /><span>Ask for parent or guardian consent</span></label>
          <span className="adm-hint">Most school students are under 18. India’s DPDP Act 2023 requires verifiable parental consent for children’s data, so keep this on unless every student is an adult. Have the wording reviewed by your legal adviser.</span>
        </div>
        <TextField id="drive-consent" label="Contact consent wording" textarea rows={3} minLength={20} maxLength={600} value={rules.consentText}
          onChange={(consentText) => setRules({ ...rules, consentText })} error={fieldErrors('rules').consentText}
          help="Students tick this box. The exact text is stored with each registration. Leave empty to restore the default." />
        {sectionError('rules')}
        <div className={styles.panelFooter}>
          {rulesDirty && <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setRules(rulesOf(item))}>Discard</button>}
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy === 'rules' || !rulesDirty}>{busy === 'rules' ? 'Saving…' : 'Save rules'}</button>
        </div>
      </form>
    </Panel>

    <Panel title="Status">
      <p className={styles.statusLine}><DriveStatus status={item.status} closedReason={item.closedReason} />
        <span>{item.status === 'active' && 'Students can register with the link and QR code.'}
          {item.status === 'closed' && (item.closedReason === 'limit' ? 'Closed automatically: the registration limit was reached.' : 'The link shows “Registration closed”.')}
          {item.status === 'archived' && 'Hidden from the drive list. The link shows “Registration closed”; registrations stay in Leads.'}</span>
      </p>
      <div className={styles.panelFooter} data-start="true">
        {item.status === 'active' && <button type="button" className="adm-btn" onClick={() => onStep('close')}><Icon name="lock" />Close registration</button>}
        {item.status === 'closed' && <button type="button" className="adm-btn adm-btn--primary" onClick={() => onStep('reopen')}><Icon name="refresh" />Reopen registration</button>}
        {item.status === 'archived' && <button type="button" className="adm-btn" onClick={() => onStep('restore')}><Icon name="undo" />Restore drive</button>}
        {item.status !== 'archived' && <button type="button" className="adm-btn" onClick={onArchive}><Icon name="archive" />Archive…</button>}
        <button type="button" className="adm-btn adm-btn--danger" disabled={item.submissionCount > 0} title={item.submissionCount > 0 ? 'Drives with registrations can only be archived' : undefined} onClick={onDelete}><Icon name="trash" />Delete permanently…</button>
      </div>
    </Panel>
  </div>;
}
