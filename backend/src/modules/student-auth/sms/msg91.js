import { env } from '../../../config/env.js';

// MSG91 only carries the text: the code is generated, hashed and checked by otp.js, so the
// single-use and attempt limits stay ours. The DLT-approved template holds the wording and the
// sender; the code fills its variable (MSG91_OTP_VAR).
const FLOW_URL = 'https://control.msg91.com/api/v5/flow';
const TIMEOUT_MS = 8000;

// Tests point this at a local fake; production always talks to MSG91.
const flowUrl = () => (process.env.NODE_ENV === 'test' && process.env.MSG91_FLOW_URL) || FLOW_URL;

function failure(code, detail) {
  const error = new Error(`MSG91 send failed (${code})`);
  error.code = code;
  // MSG91 error texts can echo the number; keep the reason, drop long digit runs.
  if (detail) error.responseCode = String(detail).replace(/\d{6,}/g, '…').slice(0, 120);
  return error;
}

export async function sendMsg91Otp({ phone, code }) {
  const { authKey, templateId, otpVar } = env.msg91;
  if (!authKey || !templateId) throw failure('MSG91_NOT_CONFIGURED');
  let response;
  try {
    response = await fetch(flowUrl(), {
      method: 'POST',
      headers: { authkey: authKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles: phone.replace(/^\+/, ''), [otpVar]: code }] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw failure(error?.name === 'TimeoutError' ? 'MSG91_TIMEOUT' : 'MSG91_NETWORK');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.type === 'error') throw failure(`MSG91_HTTP_${response.status}`, body?.message);
  return { requestId: typeof body?.message === 'string' ? body.message : null };
}
