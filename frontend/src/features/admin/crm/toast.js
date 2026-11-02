'use client';
// One toast stack for the whole admin console (mounted in AdminShell).
//
//   const toast = useToaster();
//   toast.success('Lead moved to Contacted', { action: { label: 'Undo', onClick: undo } });
//   toast.error(error.message);
//
// Success and info fade after 5 s (8 s when there is an Undo); errors stay for 10 s. Hovering or
// focusing a toast pauses it. Errors are announced assertively, the rest politely.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './toast.module.css';

const ToastContext = createContext(null);
const ICONS = { success: 'checkCircle', error: 'alert', info: 'bell', warn: 'alert' };
let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const dismiss = useCallback((id) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const arm = useCallback((toast) => {
    window.clearTimeout(timers.current.get(toast.id));
    timers.current.set(toast.id, window.setTimeout(() => dismiss(toast.id), toast.duration));
  }, [dismiss]);
  const push = useCallback((tone, message, { action, duration } = {}) => {
    counter += 1;
    const toast = { id: counter, tone, message, action, duration: duration ?? (tone === 'error' ? 10_000 : action ? 8_000 : 5_000) };
    setToasts((current) => [...current.slice(-3), toast]);
    arm(toast);
    return toast.id;
  }, [arm]);
  useEffect(() => { const map = timers.current; return () => map.forEach((timer) => window.clearTimeout(timer)); }, []);

  const api = useMemo(() => ({
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    info: (message, options) => push('info', message, options),
    warn: (message, options) => push('warn', message, options),
    dismiss,
  }), [push, dismiss]);

  return <ToastContext.Provider value={api}>
    {children}
    <div className={styles.stack} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <div key={toast.id} className={`crm-tone ${styles.toast}`} data-tone={toast.tone === 'success' ? 'good' : toast.tone === 'error' ? 'bad' : toast.tone === 'warn' ? 'warn' : 'info'}
        role={toast.tone === 'error' ? 'alert' : 'status'}
        onMouseEnter={() => window.clearTimeout(timers.current.get(toast.id))} onMouseLeave={() => arm(toast)}
        onFocus={() => window.clearTimeout(timers.current.get(toast.id))} onBlur={() => arm(toast)}>
        <span className={styles.icon}><Icon name={ICONS[toast.tone]} /></span>
        <span className={styles.message}>{toast.message}</span>
        {toast.action && <button type="button" className={styles.action} onClick={() => { toast.action.onClick(); dismiss(toast.id); }}>{toast.action.label}</button>}
        <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => dismiss(toast.id)}><Icon name="close" /></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

/** Outside a provider (e.g. in a test) the calls are harmless no-ops. */
const SILENT = { success() {}, error() {}, info() {}, warn() {}, dismiss() {} };
export const useToaster = () => useContext(ToastContext) ?? SILENT;
