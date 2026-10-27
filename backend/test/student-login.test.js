import { after, before, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { ObjectId } from 'mongodb';

// env.js reads process.env at import time, so configure before importing the app.
const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.OTP_DELIVERY = 'console';
process.env.SMS_PROVIDER = 'console';
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.PUBLIC_SITE_URL = 'https://gv.example';

// A local stand-in for Google's token + JWKS endpoints and MSG91's flow endpoint.
function startFakeProviders() {
  const state = { tokenRequests: [], smsRequests: [], token: null, sms: () => ({ status: 200, body: { type: 'success', message: 'req-1' } }) };
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      const send = ({ status, body }) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
      if (request.url === '/certs') return send({ status: 200, body: { keys: [state.jwk] } });
      if (request.url === '/token') {
        const form = Object.fromEntries(new URLSearchParams(raw));
        state.tokenRequests.push(form);
        return send(state.token(form));
      }
      if (request.url === '/flow') {
        state.smsRequests.push({ headers: request.headers, body: JSON.parse(raw) });
        return send(state.sms());
      }
      send({ status: 404, body: {} });
    });
  });
  return { state, server };
}

describe('student login: Google, MSG91 and linking', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits; let env; let fake; let fakeServer; let keys; let otp; let safeReturnTo; let studentBy;

  async function api(path, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${base}${path}`, {
      method, redirect: 'manual',
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const json = response.headers.get('content-type')?.includes('json');
    return { status: response.status, body: text && json ? JSON.parse(text) : text, location: response.headers.get('location'), setCookies: response.headers.getSetCookie() };
  }
  const cookieFrom = (result, name) => result.setCookies.find((item) => item.startsWith(`${name}=`))?.split(';')[0];
  const join = (...cookies) => cookies.filter(Boolean).join('; ');

  async function signInWithCode(channel, identifier) {
    const requested = await api('/api/auth/otp/request', { method: 'POST', body: { channel, identifier } });
    assert.equal(requested.status, 200, JSON.stringify(requested.body));
    const verified = await api('/api/auth/otp/verify', { method: 'POST', body: { channel, identifier, code: requested.body.devCode } });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    return { cookie: cookieFrom(verified, 'nsedu_student'), student: verified.body.student };
  }

  async function startGoogle(query = 'returnTo=%2Fapply%3Funiversity%3Dtest-university', cookie) {
    const started = await api(`/api/auth/google/start?${query}`, { cookie });
    assert.equal(started.status, 302);
    const url = new URL(started.location);
    return { started, url, params: url.searchParams, flowCookie: cookieFrom(started, 'nsedu_oauth') };
  }

  const idToken = (claims, { key = keys.privateKey, kid = 'test-key' } = {}) => new SignJWT({ email_verified: true, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid }).setIssuer('https://accounts.google.com').setAudience(claims.aud ?? CLIENT_ID)
    .setIssuedAt().setExpirationTime('5m').sign(key);

  async function finishGoogle(flow, claims, { cookie, query } = {}) {
    const token = await idToken({ nonce: flow.params.get('nonce'), ...claims });
    fake.token = () => ({ status: 200, body: { id_token: token, access_token: 'ignored', token_type: 'Bearer' } });
    return api(`/api/auth/google/callback?${query ?? `code=auth-code&state=${flow.params.get('state')}`}`, { cookie: join(flow.flowCookie, cookie) });
  }

  before(async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    ({ state: fake, server: fakeServer } = startFakeProviders());
    await new Promise((resolve) => fakeServer.listen(0, '127.0.0.1', resolve));
    const fakeBase = `http://127.0.0.1:${fakeServer.address().port}`;
    process.env.GOOGLE_TOKEN_URL = `${fakeBase}/token`;
    process.env.GOOGLE_JWKS_URL = `${fakeBase}/certs`;
    process.env.MSG91_FLOW_URL = `${fakeBase}/flow`;
    keys = await generateKeyPair('RS256');
    fake.jwk = { ...await exportJWK(keys.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };

    const [{ app }, collections, rateLimit, config, otpModule, routes] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/config/env.js'),
      import('../src/modules/student-auth/otp.js'), import('../src/modules/student-auth/student-auth.routes.js'),
    ]);
    ({ closeDb } = collections);
    ({ resetRateLimits } = rateLimit);
    ({ env } = config);
    otp = otpModule;
    ({ safeReturnTo, studentBy } = routes);
    db = await collections.getDb();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (fakeServer) await new Promise((resolve) => fakeServer.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => { resetRateLimits(); otp.resetSmsBudget(); });

  test('config advertises Google; start redirects to Google with PKCE and a short-lived flow cookie', async () => {
    assert.equal((await api('/api/auth/config')).body.google, true);
    const { started, url, params, flowCookie } = await startGoogle();
    assert.equal(`${url.origin}${url.pathname}`, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(params.get('client_id'), CLIENT_ID);
    assert.equal(params.get('redirect_uri'), 'https://gv.example/api/auth/google/callback');
    assert.deepEqual([params.get('response_type'), params.get('scope'), params.get('code_challenge_method'), params.get('prompt')], ['code', 'openid email profile', 'S256', 'select_account']);
    assert.ok(params.get('state') && params.get('nonce') && params.get('code_challenge'));
    assert.ok(flowCookie);
    const raw = started.setCookies.find((item) => item.startsWith('nsedu_oauth='));
    assert.match(raw, /Path=\/api\/auth\/google/);
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /SameSite=Lax/i);
    assert.match(raw, /Max-Age=600/);
  });

  test('Google sign-in creates an account, checks PKCE and returns to the sanitized page', async () => {
    const flow = await startGoogle();
    const done = await finishGoogle(flow, { sub: 'google-1', email: 'Priya.Sharma@Gmail.com', name: 'Priya  Sharma', picture: 'https://lh3.googleusercontent.com/a/photo' });
    assert.equal(done.status, 302);
    assert.equal(done.location, '/apply?university=test-university');
    assert.match(done.setCookies.find((item) => item.startsWith('nsedu_oauth=')), /nsedu_oauth=;/);
    const session = cookieFrom(done, 'nsedu_student');
    assert.ok(session);

    const sent = fake.tokenRequests.at(-1);
    assert.equal(sent.grant_type, 'authorization_code');
    assert.equal(sent.code, 'auth-code');
    assert.equal(sent.redirect_uri, 'https://gv.example/api/auth/google/callback');
    assert.equal(createHash('sha256').update(sent.code_verifier).digest('base64url'), flow.params.get('code_challenge'));

    const me = (await api('/api/auth/me', { cookie: session })).body.student;
    assert.deepEqual([me.email, me.name, me.picture, me.methods, me.phone], ['priya.sharma@gmail.com', 'Priya Sharma', 'https://lh3.googleusercontent.com/a/photo', ['google', 'email'], null]);

    const again = await finishGoogle(await startGoogle('returnTo=%2Fcompare'), { sub: 'google-1', email: 'priya.sharma@gmail.com' });
    assert.equal(again.location, '/compare');
    const stored = await db.collection('students').findOne({ googleSub: 'google-1' });
    assert.deepEqual([stored.loginCount, stored.lastLoginMethod, stored.authMethods], [2, 'google', ['google']]);
    assert.equal(await db.collection('students').countDocuments({ email: 'priya.sharma@gmail.com' }), 1);
  });

  test('Google auto-links an existing email-code account by verified email', async () => {
    const { student } = await signInWithCode('email', 'ravi.k@example.com');
    const done = await finishGoogle(await startGoogle(''), { sub: 'google-ravi', email: 'ravi.k@example.com', name: 'Ravi Kumar' });
    assert.equal(done.location, '/account');
    const me = (await api('/api/auth/me', { cookie: cookieFrom(done, 'nsedu_student') })).body.student;
    assert.equal(me.id, student.id);
    assert.equal(me.name, 'Ravi Kumar');
    assert.deepEqual(me.methods, ['google', 'email']);
    // A different Google account claiming the same (already linked) email is refused.
    const clash = await finishGoogle(await startGoogle(''), { sub: 'google-impostor', email: 'ravi.k@example.com' });
    assert.equal(clash.location, '/login?error=google-in-use&next=%2Faccount');
  });

  test('callback failures redirect to /login with a code and never sign in', async () => {
    const flow = await startGoogle('returnTo=%2Fcompare');
    const wrongState = await api('/api/auth/google/callback?code=x&state=forged', { cookie: flow.flowCookie });
    assert.equal(wrongState.location, '/login?error=state&next=%2Fcompare');
    assert.equal((await api(`/api/auth/google/callback?code=x&state=${flow.params.get('state')}`)).location, '/login?error=state');
    const forgedCookie = await api(`/api/auth/google/callback?code=x&state=${flow.params.get('state')}`, { cookie: 'nsedu_oauth=a.b.c' });
    assert.equal(forgedCookie.location, '/login?error=state');
    const cancelled = await api(`/api/auth/google/callback?error=access_denied&state=${flow.params.get('state')}`, { cookie: flow.flowCookie });
    assert.equal(cancelled.location, '/login?error=cancelled&next=%2Fcompare');

    const cases = [
      [{ sub: 'g-nonce', email: 'n@example.com', nonce: 'other' }, 'state'],
      [{ sub: 'g-unverified', email: 'u@example.com', email_verified: false }, 'email-unverified'],
      [{ sub: 'g-aud', email: 'a@example.com', aud: 'someone-else' }, 'google-unavailable'],
    ];
    for (const [claims, code] of cases) {
      const result = await finishGoogle(await startGoogle(''), claims);
      assert.equal(result.location, `/login?error=${code}&next=%2Faccount`, JSON.stringify(claims));
      assert.equal(cookieFrom(result, 'nsedu_student'), undefined);
    }
    const otherKey = await generateKeyPair('RS256');
    const flowB = await startGoogle('');
    const forged = await idToken({ sub: 'g-forged', email: 'f@example.com', nonce: flowB.params.get('nonce') }, { key: otherKey.privateKey });
    fake.token = () => ({ status: 200, body: { id_token: forged } });
    assert.equal((await api(`/api/auth/google/callback?code=c&state=${flowB.params.get('state')}`, { cookie: flowB.flowCookie })).location, '/login?error=google-unavailable&next=%2Faccount');
    const flowC = await startGoogle('');
    fake.token = () => ({ status: 400, body: { error: 'invalid_grant' } });
    assert.equal((await api(`/api/auth/google/callback?code=c&state=${flowC.params.get('state')}`, { cookie: flowC.flowCookie })).location, '/login?error=google-unavailable&next=%2Faccount');
    assert.equal(await db.collection('students').countDocuments({ googleSub: { $in: ['g-nonce', 'g-unverified', 'g-aud', 'g-forged'] } }), 0);

    await db.collection('students').insertOne({ email: 'blocked@example.com', name: 'B', status: 'blocked', createdAt: new Date(), loginCount: 0 });
    const blocked = await finishGoogle(await startGoogle(''), { sub: 'g-blocked', email: 'blocked@example.com' });
    assert.equal(blocked.location, '/login?error=blocked&next=%2Faccount');
    assert.equal(cookieFrom(blocked, 'nsedu_student'), undefined);
  });

  test('a flow cookie works once, and Google sign-ins are rate limited per network', async () => {
    const flow = await startGoogle('returnTo=%2Fcompare');
    const first = await finishGoogle(flow, { sub: 'google-once', email: 'once@example.com', name: 'Once' });
    assert.equal(first.location, '/compare');
    const tokenCalls = fake.tokenRequests.length;
    const replay = await finishGoogle(flow, { sub: 'google-once', email: 'once@example.com' });
    assert.equal(replay.location, '/login?error=state&next=%2Fcompare');
    assert.equal(cookieFrom(replay, 'nsedu_student'), undefined);
    assert.equal(fake.tokenRequests.length, tokenCalls, 'a replayed flow must not reach Google');

    resetRateLimits();
    for (let count = 0; count < 60; count += 1) assert.equal((await api('/api/auth/google/start?returnTo=%2Fcompare')).status, 302);
    assert.equal((await api('/api/auth/google/start?returnTo=%2Fcompare')).location, '/login?error=busy&next=%2Fcompare');
    resetRateLimits();
    for (let count = 0; count < 60; count += 1) await api('/api/auth/google/callback?code=x&state=y');
    assert.equal((await api('/api/auth/google/callback?code=x&state=y')).location, '/login?error=busy');
  });

  test('a Google account without a name is sent back with the name prompt flag', async () => {
    const done = await finishGoogle(await startGoogle('returnTo=%2Fcolleges%3Fcity%3DPune'), { sub: 'google-nameless', email: 'nameless@example.com', name: '' });
    assert.equal(done.location, '/colleges?city=Pune&welcome=name');
    assert.ok(cookieFrom(done, 'nsedu_student'));
  });

  test('student lookups by email, phone and Google id use their partial unique indexes', async () => {
    const students = db.collection('students');
    const plan = async (filter) => JSON.stringify((await students.find(filter).explain('queryPlanner')).queryPlanner.winningPlan);
    for (const [field, value] of [['email', 'x@example.com'], ['phone', '+919800000000'], ['googleSub', 'g-x']]) {
      const winning = await plan(studentBy(field, value));
      assert.match(winning, new RegExp(`"indexName":"${field}_1"`), `${field}: ${winning}`);
      assert.doesNotMatch(winning, /COLLSCAN/);
    }
    // The shape linkGoogle uses to find another owner of the Google account or its email.
    const owner = await plan({ _id: { $ne: new ObjectId() }, $or: [studentBy('googleSub', 'g-x'), studentBy('email', 'x@example.com')] });
    assert.match(owner, /"indexName":"googleSub_1"/);
    assert.match(owner, /"indexName":"email_1"/);
  });

  test('return paths only stay on this site', async () => {
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', '/api/admin', '/login?next=/x', '', 'account', '/a\nb']) {
      assert.equal(safeReturnTo(bad), '/account', JSON.stringify(bad));
    }
    assert.equal(safeReturnTo('/colleges?city=Pune#top'), '/colleges?city=Pune');
    const original = env.google.clientId;
    env.google.clientId = '';
    try {
      assert.equal((await api('/api/auth/config')).body.google, false);
      assert.equal((await api('/api/auth/google/start?returnTo=%2Fcompare')).location, '/login?error=google-unavailable&next=%2Fcompare');
    } finally { env.google.clientId = original; }
  });

  test('a signed-in student can connect Google; conflicts come back to the account page', async () => {
    const { cookie, student } = await signInWithCode('phone', '9812345678');
    assert.deepEqual(student.methods, ['phone']);
    assert.equal((await api('/api/auth/google/start?link=1&returnTo=%2Faccount')).location, '/login?next=%2Faccount');

    const flow = await startGoogle('link=1&returnTo=%2Faccount', cookie);
    const linked = await finishGoogle(flow, { sub: 'google-phone-user', email: 'meera@example.com', name: 'Meera' }, { cookie });
    assert.equal(linked.location, '/account?linked=google');
    const me = (await api('/api/auth/me', { cookie })).body.student;
    assert.deepEqual([me.id, me.email, me.name, me.methods], [student.id, 'meera@example.com', 'Meera', ['google', 'email', 'phone']]);

    // Another student cannot take that Google account, nor one whose email is someone else's.
    const other = await signInWithCode('phone', '9812345679');
    const taken = await finishGoogle(await startGoogle('link=1&returnTo=%2Faccount', other.cookie), { sub: 'google-phone-user', email: 'meera@example.com' }, { cookie: other.cookie });
    assert.equal(taken.location, '/account?error=google-in-use');
    const emailTaken = await finishGoogle(await startGoogle('link=1&returnTo=%2Faccount', other.cookie), { sub: 'google-new', email: 'meera@example.com' }, { cookie: other.cookie });
    assert.equal(emailTaken.location, '/account?error=google-in-use');
    // The flow belongs to the session that started it.
    const swapped = await finishGoogle(await startGoogle('link=1&returnTo=%2Faccount', other.cookie), { sub: 'google-x', email: 'x@example.com' }, { cookie });
    assert.equal(swapped.location, '/account?error=state');
    assert.equal((await db.collection('students').findOne({ phone: '+919812345679' })).googleSub, undefined);
  });

  test('link endpoints add a missing email or mobile and refuse ones owned by another account', async () => {
    assert.equal((await api('/api/auth/link/otp/request', { method: 'POST', body: { channel: 'phone', identifier: '9700000001' } })).status, 401);
    const { cookie } = await signInWithCode('email', 'linker@example.com');
    assert.equal((await api('/api/auth/link/otp/request', { method: 'POST', cookie, body: { channel: 'email', identifier: 'second@example.com' } })).status, 400);

    const requested = await api('/api/auth/link/otp/request', { method: 'POST', cookie, body: { channel: 'phone', identifier: '97000 00001' } });
    assert.equal(requested.status, 200);
    const wrong = await api('/api/auth/link/otp/verify', { method: 'POST', cookie, body: { channel: 'phone', identifier: '9700000001', code: requested.body.devCode === '000000' ? '111111' : '000000' } });
    assert.equal(wrong.status, 400);
    const verified = await api('/api/auth/link/otp/verify', { method: 'POST', cookie, body: { channel: 'phone', identifier: '9700000001', code: requested.body.devCode } });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.deepEqual([verified.body.student.phone, verified.body.student.methods], ['+919700000001', ['email', 'phone']]);
    // The linked number now signs in to the same account.
    resetRateLimits();
    assert.equal((await signInWithCode('phone', '9700000001')).student.id, verified.body.student.id);

    resetRateLimits();
    const owner = await signInWithCode('phone', '9700000002');
    const { cookie: second } = await signInWithCode('email', 'second.linker@example.com');
    resetRateLimits(); // the owner's sign-in just used this number's resend slot
    const ask = await api('/api/auth/link/otp/request', { method: 'POST', cookie: second, body: { channel: 'phone', identifier: '9700000002' } });
    const conflict = await api('/api/auth/link/otp/verify', { method: 'POST', cookie: second, body: { channel: 'phone', identifier: '9700000002', code: ask.body.devCode } });
    assert.equal(conflict.status, 409);
    assert.match(conflict.body.error, /another Gyaan Vidhya account/);
    assert.equal((await db.collection('students').findOne({ email: 'second.linker@example.com' })).phone, undefined);
    assert.ok(owner.student.id);
  });

  test('MSG91 delivers the code through the DLT template; failures become a 503', async () => {
    const original = { provider: env.smsProvider, msg91: { ...env.msg91 } };
    Object.assign(env, { smsProvider: 'msg91' });
    Object.assign(env.msg91, { authKey: 'test-auth-key', templateId: 'template-123', otpVar: 'otp' });
    try {
      assert.deepEqual((await api('/api/auth/config')).body.channels, ['email', 'phone']);
      const requested = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'phone', identifier: '9811112222' } });
      assert.equal(requested.status, 200);
      assert.equal(requested.body.devCode, undefined);
      const sent = fake.smsRequests.at(-1);
      assert.equal(sent.headers.authkey, 'test-auth-key');
      assert.deepEqual(Object.keys(sent.body).sort(), ['recipients', 'short_url', 'template_id']);
      assert.deepEqual([sent.body.template_id, sent.body.short_url, sent.body.recipients[0].mobiles], ['template-123', '0', '919811112222']);
      const code = sent.body.recipients[0].otp;
      assert.match(code, /^\d{6}$/);
      const verified = await api('/api/auth/otp/verify', { method: 'POST', body: { channel: 'phone', identifier: '9811112222', code } });
      assert.equal(verified.status, 200);

      for (const reply of [{ status: 200, body: { type: 'error', message: 'Template 9811112222 not approved' } }, { status: 500, body: {} }]) {
        fake.sms = () => reply;
        const failed = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'phone', identifier: '9811113333' } });
        assert.equal(failed.status, 503);
        assert.equal(await db.collection('otp_codes').countDocuments({ identifier: '+919811113333' }), 0);
      }
    } finally {
      fake.sms = () => ({ status: 200, body: { type: 'success', message: 'req-1' } });
      env.smsProvider = original.provider;
      Object.assign(env.msg91, original.msg91);
    }
  });

  test('phone codes stop at the daily SMS cap; failed sends do not use it up', async () => {
    const originalCap = env.smsDailyCap;
    const originalMsg91 = { ...env.msg91 };
    env.smsDailyCap = 2;
    try {
      for (const number of ['9822220001', '9822220002']) {
        assert.equal((await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'phone', identifier: number } })).status, 200);
      }
      const capped = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'phone', identifier: '9822220003' } });
      assert.equal(capped.status, 503);
      assert.match(capped.body.error, /paused for today/);
      assert.equal(capped.body.smsPaused, true);
      assert.equal((await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'email', identifier: 'still.works@example.com' } })).status, 200);

      otp.resetSmsBudget();
      Object.assign(env, { smsProvider: 'msg91' });
      Object.assign(env.msg91, { authKey: 'k', templateId: 't' });
      fake.sms = () => ({ status: 500, body: {} });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        resetRateLimits();
        assert.equal((await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'phone', identifier: '9822220004' } })).status, 503);
      }
      fake.sms = () => ({ status: 200, body: { type: 'success', message: 'ok' } });
      assert.equal((await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'phone', identifier: '9822220005' } })).status, 200);
    } finally {
      env.smsDailyCap = originalCap;
      env.smsProvider = 'console';
      Object.assign(env.msg91, originalMsg91);
    }
  });
});
