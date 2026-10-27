'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import LoginArt from './LoginArt';
import OtpLoginForm from './OtpLoginForm';
import styles from './LoginDrawer.module.css';

// Copy for openLogin({ reason }). Any other string is shown as the lead line.
const reasons = {
  apply: { title: 'Log in to apply', lead: 'Sign in once. Your quick-apply form opens right after.' },
  compare: { title: 'Log in to compare', lead: 'Comparisons use the full university directory, which is open to signed-in students.' },
  directory: { title: 'Log in to explore', lead: 'The full university directory is open to signed-in students. Signing in takes a minute.' },
  account: { title: 'Your student space', lead: 'Log in to see your applications and saved preferences.' },
};

// The one login surface on the site: always this popup, over whatever page the student is on
// (/login itself opens it over the homepage). A centred dialog on larger screens, a bottom sheet
// on phones. Native <dialog> + showModal() gives the focus trap, Escape and an inert page behind it.
export default function LoginDrawer() {
  const { student, loginOpen, loginReason, loginReturnTo, loginNotice, loginAskName, closeLogin, completeLogin } = useStudentAuth();
  const id = useId();
  const dialog = useRef(null);
  const timer = useRef(0);
  const verifiedStudent = useRef(null);
  const pressedBackdrop = useRef(false);
  const [session, setSession] = useState({ open: false, count: 0 });

  // A fresh form every time the popup opens (adjusting state during render, not in an effect).
  if (session.open !== loginOpen) setSession({ open: loginOpen, count: session.count + (loginOpen ? 1 : 0) });

  useEffect(() => {
    const node = dialog.current;
    if (loginOpen && !node.open) node.showModal();
    if (!loginOpen && node.open) node.close();
  }, [loginOpen]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Let the "Verified" tick show for a moment, then hand over to the caller's next step.
  // Closing during that moment still completes the login: the session cookie is already set.
  function finish() {
    window.clearTimeout(timer.current);
    const student = verifiedStudent.current;
    verifiedStudent.current = null;
    if (student) completeLogin(student); else closeLogin();
  }
  const close = finish;
  // Remembered as soon as the code checks out, so closing on the optional name step still signs in.
  function verifiedCode(student) { verifiedStudent.current = student; }
  function verified(student) { verifiedStudent.current = student; timer.current = window.setTimeout(finish, 650); }

  const copy = reasons[loginReason] ?? (loginReason ? { title: 'Log in to continue', lead: loginReason } : {});
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`}
    onCancel={(event) => { event.preventDefault(); close(); }}
    onPointerDown={(event) => { pressedBackdrop.current = event.target === event.currentTarget; }}
    onClick={(event) => { if (pressedBackdrop.current && event.target === event.currentTarget) close(); pressedBackdrop.current = false; }}>
    {session.count > 0 && <div className={styles.shell}>
      <LoginArt />
      <div className={styles.main}>
        <OtpLoginForm key={session.count} active={loginOpen} titleId={`${id}-title`} title={copy.title} lead={copy.lead}
          onVerified={verifiedCode} onSuccess={verified} onLinkClick={close} doneText="Continuing where you left off…"
          returnTo={loginReturnTo || undefined} notice={loginNotice} askNameFor={loginAskName ? student : null} />
      </div>
      {/* Pinned to the dialog's corner: over the form on desktop, over the drawing on a phone sheet. */}
      <span className={styles.handle} aria-hidden="true" />
      <button type="button" className={styles.close} aria-label="Close login" onClick={close}><Icon name="close" /></button>
    </div>}
  </dialog>;
}
