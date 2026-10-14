'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';

const AdminSessionContext = createContext(null);

export function AdminSessionProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState('loading');

  const toLogin = useCallback(async (reason) => {
    // Clear a stale or expired cookie so the route guard does not bounce back here.
    await api('/admin/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace(reason === 'expired' ? `/admin?next=${encodeURIComponent(pathname)}` : '/admin');
  }, [pathname, router]);

  useEffect(() => {
    const controller = new AbortController();
    api('/admin/auth/me', { signal: controller.signal })
      .then((data) => { setAdmin(data.admin); setStatus('ready'); })
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
    logout: () => toLogin('logout'),
    // Admin API calls: a 401 means the 8-hour session ended mid-visit.
    request: async (path, options) => {
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
