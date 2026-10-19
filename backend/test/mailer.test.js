import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { env } from '../src/config/env.js';
import { buildOtpEmail, describeMailError, sendOtpEmail, setMailTransport, smtpTransport } from '../src/lib/mailer.js';

const saved = { ...env.smtp };
after(() => {
  Object.assign(env.smtp, saved);
  setMailTransport(null);
});

test('OTP email is branded, self-contained and carries the code in both parts', () => {
  const { subject, text, html } = buildOtpEmail({ code: '042917' });
  assert.equal(subject, '042917 is your Gyaan Vidhya sign-in code');
  for (const part of [text, html]) {
    assert.match(part, /Gyaan Vidhya/);
    assert.match(part, /5 minutes/);
    assert.match(part, /If you didn't request this, ignore this email/);
  }
  assert.match(text, /042 917/);
  assert.match(html, />042917</);
  assert.match(html, /#72243B/);
  assert.doesNotMatch(html, /<img|<link|<script|https?:\/\/|url\(/i, 'no remote resources or tracking');
  assert.throws(() => buildOtpEmail({ code: '12345' }), /6 digits/);
});

test('sendOtpEmail sends through the configured transport with a branded sender', async () => {
  Object.assign(env.smtp, { from: 'no-reply@nsedu.test' });
  setMailTransport(nodemailer.createTransport({ jsonTransport: true }));
  const info = await sendOtpEmail({ to: 'student@example.com', code: '123456' });
  const message = JSON.parse(info.message);
  assert.ok(info.messageId);  assert.deepEqual(message.from, { address: 'no-reply@nsedu.test', name: 'Gyaan Vidhya' });
  assert.deepEqual(message.to, [{ address: 'student@example.com', name: '' }]);
  assert.equal(message.headers['Auto-Submitted'], 'auto-generated');
  assert.ok(message.text.includes('123 456') && message.html.includes('123456'));

  Object.assign(env.smtp, { from: '' });
  await assert.rejects(sendOtpEmail({ to: 'student@example.com', code: '123456' }), /SMTP_FROM/);
});

test('port 465 uses implicit TLS, other ports require STARTTLS', () => {
  for (const [port, secure, requireTLS] of [[465, true, false], [587, false, true]]) {
    setMailTransport(null);
    Object.assign(env.smtp, { host: 'smtp.nsedu.test', port, user: 'user', pass: 'pass' });
    const transport = smtpTransport();
    assert.deepEqual([transport.options.secure, transport.options.requireTLS], [secure, requireTLS], String(port));
    transport.close();
  }
  setMailTransport(null);
  Object.assign(env.smtp, { host: '' });
  assert.throws(() => smtpTransport(), /SMTP_HOST/);
});

test('mail errors are summarised without server text', () => {
  const error = Object.assign(new Error('535 5.7.8 Username and Password not accepted secret@example.com'), { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' });
  assert.equal(describeMailError(error), 'EAUTH 535 AUTH PLAIN');
  assert.equal(describeMailError(new TypeError('x')), 'TypeError');
});
