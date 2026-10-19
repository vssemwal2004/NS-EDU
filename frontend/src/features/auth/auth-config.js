'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';

// GET /api/auth/config, fetched once per page load. Until it answers (or if it fails) only email
// is offered: there is no SMS provider yet, so the phone channel appears only when the API lists it.
export const FALLBACK_AUTH_CONFIG = { channels: ['email'], otpTtlSeconds: 300, resendSeconds: 30, loaded: false };
let request = null;
let resolved = null;

function loadConfig() {
  request ??= api('/auth/config')
    .then((data) => {
      const channels = (Array.isArray(data?.channels) ? data.channels : []).filter((channel) => channel === 'email' || channel === 'phone');
      resolved = {
        channels: channels.length ? channels : FALLBACK_AUTH_CONFIG.channels,
        otpTtlSeconds: Number(data?.otpTtlSeconds) || FALLBACK_AUTH_CONFIG.otpTtlSeconds,
        resendSeconds: Number(data?.resendSeconds) || FALLBACK_AUTH_CONFIG.resendSeconds,
        loaded: true,
      };
      return resolved;
    })
    .catch(() => { request = null; return FALLBACK_AUTH_CONFIG; });
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
