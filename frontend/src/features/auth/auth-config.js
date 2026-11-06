'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';

// GET /api/auth/config, fetched once per page load. The login form always shows Google, mobile and
// email; this says which of them work today. Until it answers only email is usable (`loaded` false
// lets the form hold its channel choice instead of flashing one tab and then the other). A failed
// request settles as "loaded" with that email-only answer and is retried on the next page load.
export const FALLBACK_AUTH_CONFIG = { channels: ['email'], google: false, otpTtlSeconds: 300, resendSeconds: 30, loaded: false };
let request = null;
let resolved = null;

function loadConfig() {
  request ??= api('/auth/config')
    .then((data) => {
      const channels = (Array.isArray(data?.channels) ? data.channels : []).filter((channel) => channel === 'email' || channel === 'phone');
      resolved = {
        channels: channels.length ? channels : FALLBACK_AUTH_CONFIG.channels,
        google: data?.google === true,
        otpTtlSeconds: Number(data?.otpTtlSeconds) || FALLBACK_AUTH_CONFIG.otpTtlSeconds,
        resendSeconds: Number(data?.resendSeconds) || FALLBACK_AUTH_CONFIG.resendSeconds,
        loaded: true,
      };
      return resolved;
    })
    .catch(() => { request = null; return { ...FALLBACK_AUTH_CONFIG, loaded: true, failed: true }; });
  return request;
}

export function useAuthConfig(enabled = true) {
  const [config, setConfig] = useState(() => resolved ?? FALLBACK_AUTH_CONFIG);
  useEffect(() => {
    if (!enabled || config.loaded) return undefined;
    let live = true;
    loadConfig().then((next) => { if (live) setConfig(next); });
    return () => { live = false; };
  }, [enabled, config.loaded]);
  return config;
}
