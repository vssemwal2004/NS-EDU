'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';

const AdminSessionContext = createContext(null);

export function AdminSessionProvider({ children }) {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState('loading');

  const toLogin = useCallback(async (reason) => {
    const pathname = window.location.pathname;
    // Clear a stale or expired cookie so the route guard does not bounce back here.
    await api('/admin/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace(reason === 'expired' ? `/admin?next=${encodeURIComponent(pathname)}` : '/admin');
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    api('/admin/auth/me', { signal: controller.signal })
      .then((data) => {
        if (data.admin.mustChangePassword) { router.replace('/admin/change-password'); return; }
        setAdmin(data.admin); setStatus('ready');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        if (error.status === 401) toLogin('expired');
        else setStatus('unavailable');
      });
    return () => controller.abort();
    // Session is checked once per console visit; individual requests handle later expiry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    admin, status,
    refreshAdmin: async () => { const data = await api('/admin/auth/me'); setAdmin(data.admin); return data.admin; },
    logout: () => toLogin('logout'),
    // Refresh reads when the admin session changes. Navigating between pages keeps this callback stable.
    request: async (path, options) => {
      const signal = options?.signal;
      if (signal) {
        // Let a replaced effect cancel its request before invoking fetch.
        await Promise.resolve();
        signal.throwIfAborted();
      }
      try { return await api(`/admin${path}`, options); } catch (error) {
        if (error.status === 401) toLogin('expired');
        throw error;
      }
    },
  }), [admin, status, toLogin]);
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error('useAdminSession must be used inside AdminSessionProvider');
  return value;
}
