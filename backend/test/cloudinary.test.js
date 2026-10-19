import test from 'node:test';
import assert from 'node:assert/strict';
import { signParams } from '../src/lib/cloudinary.js';

test('Cloudinary signatures follow the documented algorithm', () => {
  // Example from https://cloudinary.com/documentation/authentication_signatures
  assert.equal(signParams({ public_id: 'sample_image', timestamp: 1315060510 }, 'abcd'), 'b4ad47fb4e25c7bf5f92a20089f9db59bc302313');
  // Empty values are not signed, and keys are sorted.
  assert.equal(signParams({ timestamp: 1315060510, tags: '', public_id: 'sample_image' }, 'abcd'), 'b4ad47fb4e25c7bf5f92a20089f9db59bc302313');
});
