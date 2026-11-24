import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ObjectId } from 'mongodb';
import { attachAccess, serializeStaff } from '../src/modules/access/access-service.js';

test('an old role cannot grant an employee permissions beyond their defaults', async () => {
  const employee = await attachAccess({ _id: new ObjectId(), role: 'employee', roleId: 'analyst' });
  assert.equal(employee.roleName, 'Employee');
  assert.equal(employee.leadScope, 'own');
  for (const permission of ['leads.view_own', 'leads.change_status', 'leads.notes']) assert(employee.permissions.includes(permission));
  for (const permission of ['leads.create', 'leads.edit', 'leads.bulk', 'leads.assign', 'leads.delete', 'leads.export', 'team.manage']) assert(!employee.permissions.includes(permission));

  const granted = await attachAccess({ _id: new ObjectId(), role: 'employee', roleId: 'analyst', access: { permissions: ['leads.view_own', 'leads.create'] } });
  assert(granted.permissions.includes('leads.create'));
  assert(!granted.permissions.includes('leads.edit'));
});

test('admin retains full access and staff display has no custom roles', async () => {
  const admin = await attachAccess({ _id: new ObjectId(), role: 'admin' });
  assert.equal(admin.leadScope, 'all');
  assert(admin.permissions.includes('team.manage'));
  const [person] = await serializeStaff([{ _id: new ObjectId(), role: 'employee', roleId: 'team-lead', email: 'person@example.com' }]);
  assert.equal(person.roleName, 'Employee');
  assert.equal(person.roleId, 'executive');
});
