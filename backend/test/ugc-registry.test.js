import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRegistryRow, normalizeRegistryRows, registryMatchScore } from '../src/scraper/ugc-registry.js';

const rows = normalizeRegistryRows({ List: [
  { ID: 1, uni_name: 'Acharya Nagarjuna University', state: 'Andhra Pradesh ', address: 'NH16, Nagarjuna Nagar, Guntur', Zip: '522510', uni_type: 'State', status: '2(f)', url: 'https://nagarjunauniversity.ac.in/' },
  { ID: 2, uni_name: 'Amity University', state: 'Haryana ', address: 'Panchgaon, Manesar, Gurgaon', Zip: '122413', uni_type: 'Private', status: '2(f)', url: 'https://www.amity.edu/gurugram/' },
  { ID: 3, uni_name: 'Amity University', state: 'Uttar Pradesh ', address: 'Noida', Zip: '201313', uni_type: 'Private', status: '2(f)', url: 'https://www.amity.edu/noida/' },
] });

test('UGC rows are normalized and invalid websites are omitted', () => {
  const result = normalizeRegistryRows({ List: [
    { ID: 1, uni_name: ' Alpha University ', state: ' Delhi ', address: ' Main Road ', Zip: '110001', url: 'alpha.example.edu' },
    { ID: 2, uni_name: 'Missing Site', state: 'Delhi', url: '' },
  ] });
  assert.deepEqual(result, [{ id: '1', name: 'Alpha University', state: 'Delhi', address: 'Main Road', pincode: '110001', type: '', status: '', website: 'https://alpha.example.edu/' }]);
});

test('matching accepts a directory location suffix and requires the same state', () => {
  const institution = { name: 'Acharya Nagarjuna University, Guntur', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522510' };
  const match = matchRegistryRow(institution, rows);
  assert.equal(match.status, 'matched');
  assert.equal(match.row.website, 'https://nagarjunauniversity.ac.in/');
  assert.equal(registryMatchScore({ ...institution, state: 'Telangana' }, rows[0]), 0);
});

test('same university name in another state does not steal the match', () => {
  const match = matchRegistryRow({ name: 'Amity University Haryana, Gurgaon', city: 'Gurgaon', state: 'Haryana', pincode: '122413' }, rows);
  assert.equal(match.status, 'matched');
  assert.equal(match.row.website, 'https://www.amity.edu/gurugram/');
});

test('close candidates remain for review instead of being guessed', () => {
  const candidates = [
    { name: 'Example Skills University North Campus', state: 'Delhi', address: 'North Delhi', pincode: '', website: 'https://north.example.edu/' },
    { name: 'Example Skills University South Campus', state: 'Delhi', address: 'South Delhi', pincode: '', website: 'https://south.example.edu/' },
  ];
  const match = matchRegistryRow({ name: 'Example Skills University Campus', state: 'Delhi' }, candidates, { threshold: 0.7 });
  assert.equal(match.status, 'ambiguous');
});
