import { HttpError } from '../../lib/http-error.js';

export function assertEmployeePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 200 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^A-Za-z0-9\s]/.test(password)) {
    throw new HttpError(400, 'Password must be 8–200 characters and contain an uppercase letter, a lowercase letter, and a special character.', { fields: { password: 'Use 8–200 characters with uppercase, lowercase, and a special character.' } });
  }
}
