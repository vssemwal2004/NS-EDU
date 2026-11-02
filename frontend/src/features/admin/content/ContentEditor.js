'use client';
// Editor for one site_content key. Edit = a form generated from the JSON with section navigation;
// JSON = the raw text with parse errors; Versions = the last five saves. Saves are optimistic-concurrency
// checked (updatedAt): a 409 offers to load the latest version.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import { relativeTime } from '@/features/admin/crm/format';
import { useToaster } from '@/features/admin/crm/toast';
import { useUnsavedGuard } from '@/features/admin/drives/useUnsavedGuard';
import { PageToolbar, ViewTabs } from '@/features/admin/ui/Page';
import { ValueEditor } from './ContentForm';
import { describeValue, formatSize, formatWhen, humanize, kindOf, parseJson, pretty, sameData } from './content-format';
import styles from './Content.module.css';

const TABS = ['edit', 'json', 'versions'];
const LEAVE = 'This content has unsaved changes. Leave without saving?';

function EditorSkeleton() {
  return <div className={styles.editorSkeleton} aria-hidden="true">
    <span className={styles.skelBar} style={{ width: '40%' }} />
    <div className={styles.skelColumns}><span className={styles.skelBlock} /><span className={styles.skelBlock} data-tall="true" /></div>
  </div>;
}

export default function ContentEditor({ contentKey, initialTab = 'edit' }) {
  const { request } = useAdminSession();
  const toast = useToaster();
  const [item, setItem] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState('');
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : 'edit');
  const [section, setSection] = useState('');
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [confirmError, setConfirmError] = useState('');
  const [viewing, setViewing] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const textRef = useRef(null);

  const apply = useCallback((next) => { setItem(next); setText(pretty(next.data)); setServerError(null); }, []);
  useEffect(() => {
    const controller = new AbortController();
    request(`/content/${contentKey}`, { signal: controller.signal })
      .then(({ item: next }) => { apply(next); setLoadError(''); })
      .catch((error) => { if (error.name !== 'AbortError') setLoadError(error.status === 404 ? 'This content key does not exist.' : error.message); });
    return () => controller.abort();
  }, [apply, contentKey, request, attempt]);
  const reload = () => { setLoadError(''); setAttempt((value) => value + 1); };

  const parsed = useMemo(() => parseJson(text), [text]);
  const dirty = Boolean(item) && (parsed.error ? true : !sameData(parsed.value, item.data));
  useUnsavedGuard(dirty, LEAVE);
  const value = parsed.value;
  const sections = useMemo(() => (value && kindOf(value) === 'object' ? Object.keys(value) : []), [value]);
  const current = sections.includes(section) ? section : sections[0];
  const fieldErrors = serverError?.fields ?? {};
  const sectionHasError = (key) => Object.keys(fieldErrors).some((path) => path === key || path.startsWith(`${key}.`));

  const choose = (next) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'edit') url.searchParams.delete('tab'); else url.searchParams.set('tab', next);
    window.history.replaceState(window.history.state, '', url);
  };

  async function run(action, success) {
    setBusy(true); setServerError(null); setConfirmError('');
    try {
      const { item: next } = await action();
      apply(next);
      toast.success(success);
      setConfirm(null);
    } catch (error) {
      if (confirm) setConfirmError(error.message);
      else setServerError({ message: error.message, fields: error.fields, conflict: error.status === 409 });
    } finally { setBusy(false); }
  }
  const save = () => {
    if (parsed.error || !dirty || busy) return;
    run(() => request(`/content/${contentKey}`, { method: 'PUT', body: { data: parsed.value, updatedAt: item.updatedAt } }), 'Saved. The site shows the change within about a minute.');
  };
  const discard = () => { setText(pretty(item.data)); setServerError(null); };
  const setSectionValue = (next) => setText(pretty({ ...value, [current]: next }));
  const jumpToError = () => {
    const node = textRef.current;
    if (!node || !parsed.error?.line) return;
    const offset = text.split('\n').slice(0, parsed.error.line - 1).join('\n').length + (parsed.error.line > 1 ? 1 : 0) + (parsed.error.column || 1) - 1;
    node.focus(); node.setSelectionRange(offset, offset + 1);
  };

  if (loadError) return <div className={`adm-panel ${styles.state}`} role="alert">
    <span className={styles.stateIcon} data-tone="bad"><Icon name="alert" /></span>
    <strong>Could not open this content</strong><p>{loadError}</p>
    <div className={styles.stateActions}><Link className="adm-btn" href="/admin/content">All site content</Link><button type="button" className="adm-btn adm-btn--primary" onClick={reload}>Try again</button></div>
  </div>;
  if (!item) return <EditorSkeleton />;

  const status = parsed.error ? { state: 'error', label: 'Invalid JSON' } : dirty ? { state: 'dirty', label: 'Unsaved changes' } : { state: 'clean', label: 'All changes saved' };

  return <div className={styles.editor}>
    <PageToolbar start={<div className={styles.editorStart}>
      <Link href="/admin/content" className={styles.back}><Icon name="arrow" className={styles.flip} />All site content</Link>
      <p className={styles.editorTitle} title={`Key: ${item.key}`}><strong>{item.label}</strong></p>
      <p className={styles.editorMeta}><span title={formatWhen(item.updatedAt)}>{item.updatedBy ? `Last saved ${relativeTime(item.updatedAt)} by ${item.updatedBy}` : 'Default content, never edited'}</span><span aria-hidden="true">·</span><span className="crm-tabnum">{formatSize(item.size)}</span></p>
    </div>}>
      <button type="button" className="adm-btn" onClick={() => { setConfirmError(''); setConfirm({ type: 'reset' }); }} disabled={busy || !item.updatedBy}
        title={item.updatedBy ? undefined : 'Already the default content'}><Icon name="undo" />Reset to default…</button>
    </PageToolbar>

    <p className={styles.description}>{item.description}</p>

    <div className={styles.tabsRow}>
      <ViewTabs label="Editor views" value={tab} onChange={choose} items={[
        { key: 'edit', label: 'Edit', icon: 'edit' },
        { key: 'json', label: 'JSON', icon: 'document' },
        { key: 'versions', label: 'Versions', icon: 'history', count: item.history.length },
      ]} />
    </div>

    {serverError && tab !== 'versions' && <div className={styles.alert} role="alert">
      <Icon name="alert" />
      <div>
        <p><strong>{serverError.message}</strong>{serverError.conflict && <> <button type="button" className={styles.linkButton} onClick={reload}>Load the latest version</button> (your edits will be replaced).</>}</p>
        {serverError.fields && <ul>{Object.entries(serverError.fields).map(([field, message]) => <li key={field}><code>{field === '_' ? 'content' : field}</code> {message}</li>)}</ul>}
      </div>
    </div>}

    {tab === 'edit' && (parsed.error ? <div className={`adm-panel ${styles.state}`}>
      <span className={styles.stateIcon} data-tone="warn"><Icon name="alert" /></span>
      <strong>The JSON has an error</strong><p>Fix it in the JSON tab, or discard your changes, to use the form.</p>
      <div className={styles.stateActions}><button type="button" className="adm-btn" onClick={discard}>Discard changes</button><button type="button" className="adm-btn adm-btn--primary" onClick={() => choose('json')}>Open JSON</button></div>
    </div> : <div className={styles.formLayout}>
      <nav className={styles.sectionNav} aria-label="Sections">
        <div className={styles.sectionSelect}><label className="adm-label" htmlFor="content-section">Section</label>
          <select id="content-section" className="adm-select" value={current} onChange={(event) => setSection(event.target.value)}>
            {sections.map((key) => <option key={key} value={key}>{humanize(key)}{sectionHasError(key) ? ' (error)' : ''}</option>)}
          </select>
        </div>
        <div className={`adm-panel ${styles.sectionBox}`}>
          <p className={styles.navLabel}>Sections <span className="crm-tabnum">{sections.length}</span></p>
          <ul className={styles.sectionList}>
            {sections.map((key) => <li key={key}>
              <button type="button" aria-current={key === current ? 'true' : undefined} onClick={() => setSection(key)} title={key}>
                <span className={styles.sectionName}>{humanize(key)}</span>
                {sectionHasError(key) ? <span className={styles.sectionError}><Icon name="alert" />Error</span> : <small className="crm-tabnum">{describeValue(value[key])}</small>}
              </button>
            </li>)}
          </ul>
        </div>
      </nav>
      <section className={`adm-panel ${styles.sectionPanel}`} aria-labelledby="content-section-title">
        <header className={styles.sectionHead}>
          <h2 id="content-section-title" title={current}>{humanize(current)}<small className={styles.sectionCount}>{current !== undefined && describeValue(value[current])}</small></h2>
          <span className={styles.fixedNote} title="Field names are read by the site’s code, so they are fixed here. Add or rename fields in the JSON tab. Links are site paths (/about) or https:// URLs."><Icon name="lock" />Field names are fixed</span>
        </header>
        <div className={styles.sectionBody}>
          {current !== undefined && <ValueEditor key={current} value={value[current]} path={[current]} label={humanize(current)} bare={['object', 'array'].includes(kindOf(value[current]))} errors={fieldErrors} onChange={setSectionValue} />}
        </div>
      </section>
    </div>)}

    {tab === 'json' && <section className={`adm-panel ${styles.jsonPanel}`} aria-labelledby="content-json-title">
      <header className={styles.sectionHead}>
        <h2 id="content-json-title"><label htmlFor="content-json">JSON</label></h2>
        <button type="button" className="adm-btn adm-btn--sm" onClick={() => { if (!parsed.error) setText(pretty(parsed.value)); }} disabled={Boolean(parsed.error)}>Format</button>
      </header>
      <div className={styles.sectionBody}>
        <textarea ref={textRef} id="content-json" className={styles.code} value={text} spellCheck={false} autoCapitalize="off" autoComplete="off" wrap="off"
          rows={Math.min(32, Math.max(12, text.split('\n').length + 1))} aria-invalid={Boolean(parsed.error)} aria-describedby="content-json-help"
          onChange={(event) => setText(event.target.value)} />
        <p id="content-json-help" className="adm-hint">Keep property names and ids unchanged unless you know what reads them; edit the text values.</p>
        {parsed.error && <p className={styles.alert} role="alert"><Icon name="alert" /><span>{parsed.error.line ? `Line ${parsed.error.line}, column ${parsed.error.column}: ` : ''}{parsed.error.message}{parsed.error.line && <> <button type="button" className={styles.linkButton} onClick={jumpToError}>Go to line</button></>}</span></p>}
      </div>
    </section>}

    {tab === 'versions' && <section className="adm-panel" aria-labelledby="content-versions-title">
      <header className={styles.sectionHead}>
        <h2 id="content-versions-title">Previous versions<small className={styles.sectionCount}>last five saves</small></h2>
      </header>
      {item.history.length ? <ol className={styles.history}>{item.history.map((version) => <li key={version.index}>
        <div className={styles.historyRow}>
          <div className={styles.historyText}><span className="crm-tabnum">{formatWhen(version.updatedAt)}</span><small>{version.updatedBy || 'Default content'} · <span className="crm-tabnum">{formatSize(version.size)}</span></small></div>
          <div className={styles.historyActions}>
            <button type="button" className="adm-btn adm-btn--sm" aria-expanded={viewing === version.index} onClick={() => setViewing((open) => (open === version.index ? null : version.index))}><Icon name="eye" />{viewing === version.index ? 'Hide' : 'View'}</button>
            <button type="button" className="adm-btn adm-btn--sm" disabled={busy} onClick={() => { setConfirmError(''); setConfirm({ type: 'restore', version }); }}><Icon name="undo" />Restore…</button>
          </div>
        </div>
        {viewing === version.index && <pre className={styles.code}>{pretty(version.data)}</pre>}
      </li>)}</ol> : <p className={styles.emptyLine}>No earlier versions yet. Each save keeps the one before it here.</p>}
    </section>}

    {tab !== 'versions' && <div className={styles.saveBar} data-state={status.state}>
      <span className={styles.saveStatus} role="status"><span className={styles.saveDot} aria-hidden="true" />{status.label}</span>
      <div className={styles.saveActions}>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={discard} disabled={!dirty || busy}>Discard</button>
        <button type="button" className="adm-btn adm-btn--primary" onClick={save} disabled={!dirty || Boolean(parsed.error) || busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>}

    <ConfirmDialog open={Boolean(confirm)} tone={confirm?.type === 'reset' ? 'danger' : 'primary'} icon="undo" busy={busy} error={confirmError}
      title={confirm?.type === 'reset' ? `Reset “${item.label}” to default?` : 'Restore this version?'}
      confirmLabel={confirm?.type === 'reset' ? 'Reset to default' : 'Restore version'}
      onCancel={() => setConfirm(null)}
      onConfirm={() => (confirm.type === 'reset'
        ? run(() => request(`/content/${contentKey}/reset`, { method: 'POST' }), 'Reset to the default content.')
        : run(() => request(`/content/${contentKey}/restore`, { method: 'POST', body: { index: confirm.version.index } }), 'Version restored.'))}>
      {confirm?.type === 'reset'
        ? 'The original default copy goes live within about a minute. The current version is kept in Previous versions.'
        : `The version saved ${formatWhen(confirm?.version?.updatedAt)} goes live. The current version is kept in Previous versions.`}
      {dirty && ' Unsaved edits in the editor will be lost.'}
    </ConfirmDialog>
  </div>;
}
