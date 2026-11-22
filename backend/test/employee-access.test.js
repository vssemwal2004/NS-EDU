import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ObjectId } from 'mongodb';
import { attachAccess, serializeStaff } from '../src/modules/access/access-service.js';

test('employee access is fixed even for accounts with an old role', async () => {
  const employee = await attachAccess({ _id: new ObjectId(), role: 'employee', roleId: 'analyst' });
  assert.equal(employee.roleName, 'Employee');
  assert.equal(employee.leadScope, 'own');
  for (const permission of ['leads.create', 'leads.edit', 'leads.notes', 'leads.bulk']) assert(employee.permissions.includes(permission));
  for (const permission of ['leads.assign', 'leads.delete', 'leads.export', 'team.manage']) assert(!employee.permissions.includes(permission));
});

test('admin retains full access and staff display has no custom roles', async () => {
  const admin = await attachAccess({ _id: new ObjectId(), role: 'admin' });
  assert.equal(admin.leadScope, 'all');
  assert(admin.permissions.includes('team.manage'));
  const [person] = await serializeStaff([{ _id: new ObjectId(), role: 'employee', roleId: 'team-lead', email: 'person@example.com' }]);
  assert.equal(person.roleName, 'Employee');
  assert.equal(person.roleId, 'executive');
});
