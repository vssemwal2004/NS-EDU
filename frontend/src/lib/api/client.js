// Browser-side API helper. Requests go to the same-origin /api proxy, so the
// httpOnly session cookies set by Express are sent automatically.
export class ApiError extends Error {
  constructor(message, status, fields = null, details = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.details = details;
  }
}

// Fired when a student request comes back 401 so StudentAuthProvider can drop the stale session.
export const SESSION_EXPIRED_EVENT = 'gv:session-expired';
const silent401 = /^\/(auth\/|admin\/)/;

export async function api(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Unable to reach Gyaan Vidhya. Check your connection and try again.', 0);
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !silent401.test(path)) window.dispatchEvent(new window.Event(SESSION_EXPIRED_EVENT));
    const fallback = response.status >= 500 ? 'Something went wrong on our side. Please try again.' : 'The request could not be completed.';
    throw new ApiError(data?.error || fallback, response.status, data?.fields || null, data || {});
  }
  return data;
}
