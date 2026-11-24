// Pure unit tests: no database. Run with an unreachable MONGODB_URI.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ObjectId } from 'mongodb';
import {
  canRevealAll, canSeeFullContact, isMaskedContact, maskAnswers, maskContactObject, maskEmail, maskLeadContact, maskPhone, revealedContact, stripMaskedContact,
} from '../src/modules/applications/contact-mask.js';

test('maskPhone keeps the country code and the first and last two digits', () => {
  assert.equal(maskPhone('+919876543210'), '+91 98XXXXXX10');
  assert.equal(maskPhone('9876543210'), '98XXXXXX10');
  assert.equal(maskPhone('+91 98765-43210'), '+91 98XXXXXX10');
  assert.equal(maskPhone('12345'), 'XXXX');
  assert.equal(maskPhone(''), '');
  assert.equal(maskPhone(null), '');
  assert.equal(maskPhone(undefined), '');
});

test('maskEmail keeps the first letter and the domain', () => {
  assert.equal(maskEmail('asha.rao@gmail.com'), 'a***@gmail.com');
  assert.equal(maskEmail('A@x.in'), 'A***@x.in');
  assert.equal(maskEmail('not-an-email'), '***');
  assert.equal(maskEmail('@gmail.com'), '***');
  assert.equal(maskEmail('trailing@'), '***');
  assert.equal(maskEmail(''), '');
  assert.equal(maskEmail(null), '');
});

test('masked values are recognised, real ones are not', () => {
  assert.ok(isMaskedContact(maskPhone('+919876543210')));
  assert.ok(isMaskedContact(maskPhone('9876543210')));
  assert.ok(isMaskedContact(maskEmail('asha@gmail.com')));
  assert.ok(isMaskedContact('XXXX'));
  assert.ok(!isMaskedContact('+919876543210'));
  assert.ok(!isMaskedContact('asha@gmail.com'));
  assert.ok(!isMaskedContact(''));
  assert.ok(!isMaskedContact(undefined));
});

test('every phone/email-named field is masked, one level deep, other fields untouched', () => {
  const out = maskContactObject({
    fullName: 'Asha Rao', phone: '+919876543210', email: 'asha@gmail.com', guardianPhone: '+919811111122', city: 'Dehradun',
    guardian: { name: 'R. Rao', mobile: '+919822222233', eMail: 'r@rao.in' },
  });
  assert.deepEqual(out, {
    fullName: 'Asha Rao', phone: '+91 98XXXXXX10', email: 'a***@gmail.com', guardianPhone: '+91 98XXXXXX22', city: 'Dehradun',
    guardian: { name: 'R. Rao', mobile: '+91 98XXXXXX33', eMail: 'r***@rao.in' },
  });
});

test('phone and email answers of drive forms are masked; other answers are not', () => {
  const answers = [
    { id: 'phone', type: 'phone', value: '+919876543210' },
    { id: 'email', type: 'email', value: 'asha@gmail.com' },
    { id: 'parentMobile', type: 'text', value: '+919800000011' },
    { id: 'stream', type: 'select', value: 'pcm' },
    { id: 'extra', type: 'email', value: ['a@b.in', 'c@d.in'] },
  ];
  assert.deepEqual(maskAnswers(answers).map((answer) => answer.value), ['+91 98XXXXXX10', 'a***@gmail.com', '+91 98XXXXXX11', 'pcm', ['a***@b.in', 'c***@d.in']]);
  assert.equal(answers[0].value, '+919876543210', 'the input is not changed');
});

test('who sees full contact: assignee, owner, reveal-all permission; everyone else masked; no staff fails closed', () => {
  const me = new ObjectId();
  const other = new ObjectId();
  assert.ok(canSeeFullContact({ _id: me, permissions: ['leads.view_team'] }, [other, me]));
  assert.ok(!canSeeFullContact({ _id: me, permissions: ['leads.view_all'] }, [other]));
  assert.ok(!canSeeFullContact({ _id: me, permissions: ['leads.view_all'] }, []));
  assert.ok(canSeeFullContact({ _id: me, isOwner: true }, [other]));
  assert.ok(canSeeFullContact({ _id: me, role: 'admin' }, []), 'bare owner documents (scripts) fall back to role');
  assert.ok(canSeeFullContact({ _id: me, permissions: ['leads.contact_reveal_all'] }, [other]));
  assert.ok(!canSeeFullContact(null, [me]));
  assert.ok(!canSeeFullContact(undefined, []));
  assert.ok(canSeeFullContact({ _id: String(me) }, [me]), 'ids compare by value');
  assert.ok(canRevealAll({ isOwner: true }));
  assert.ok(!canRevealAll({ isOwner: false, permissions: ['leads.view_all'] }));
});

test('maskLeadContact masks applicant, guardian, callback and answers and flags the lead', () => {
  const me = new ObjectId();
  const doc = {
    _id: new ObjectId(), ref: 'GV-2026-000001', assignedEmployeeIds: [new ObjectId()],
    applicant: { fullName: 'Asha Rao', phone: '+919876543210', email: 'asha@gmail.com', guardianPhone: '+919811111122', city: 'Pune' },
    guardian: { phone: '+919833333344' },
    answers: [{ id: 'phone', type: 'phone', value: '+919876543210' }],
  };
  const masked = maskLeadContact(doc, { _id: me, permissions: ['leads.view_all'] });
  assert.equal(masked.contactMasked, true);
  assert.equal(masked.applicant.phone, '+91 98XXXXXX10');
  assert.equal(masked.applicant.email, 'a***@gmail.com');
  assert.equal(masked.applicant.guardianPhone, '+91 98XXXXXX22');
  assert.equal(masked.applicant.fullName, 'Asha Rao');
  assert.equal(masked.guardian.phone, '+91 98XXXXXX44');
  assert.equal(masked.answers[0].value, '+91 98XXXXXX10');
  assert.equal(doc.applicant.phone, '+919876543210', 'the stored document is not changed');
  // Own lead: the same object back, unmasked.
  const own = { ...doc, assignedEmployeeIds: [me] };
  assert.equal(maskLeadContact(own, { _id: me, permissions: [] }), own);
});

test('a reveal returns only the contact fields, unmasked', () => {
  const doc = {
    _id: new ObjectId(),
    applicant: { fullName: 'Asha Rao', phone: '+919876543210', email: 'asha@gmail.com', guardianPhone: '+919811111122', city: 'Pune', dateOfBirth: '2008-01-01' },
    answers: [{ id: 'phone', type: 'phone', value: '+919876543210' }, { id: 'stream', type: 'select', value: 'pcm' }],
  };
  assert.deepEqual(revealedContact(doc), {
    applicant: { phone: '+919876543210', email: 'asha@gmail.com', guardianPhone: '+919811111122' },
    answers: [{ id: 'phone', value: '+919876543210' }],
  });
});

test('masked phone/email sent back in an edit are dropped; real changes are kept', () => {
  assert.deepEqual(stripMaskedContact({ fullName: 'Asha', phone: '+91 98XXXXXX10', email: 'a***@gmail.com', city: 'Pune' }), { fullName: 'Asha', city: 'Pune' });
  assert.deepEqual(stripMaskedContact({ phone: '9876543210', email: 'new@gmail.com' }), { phone: '9876543210', email: 'new@gmail.com' });
});
