import assert from 'node:assert';
import { test } from 'node:test';

test('Login identifier resolution resolves email and NIP correctly', async () => {
  // Mock users database
  const mockUsers = [
    { nip: 'MTR001', email: 'budi.mentor@mdu.com', role: 'mentor' },
    { nip: '202601001', email: '202601001@ojt.mdu.com', role: 'ojt' }
  ];

  const resolveLoginEmail = async (input, lookupFn) => {
    let clean = input.trim();
    if (clean.includes('@')) {
      return clean;
    }
    const found = await lookupFn(clean);
    if (found?.email) {
      return found.email;
    }
    return `${clean}@ojt.mdu.com`;
  };

  const mockLookup = async (nip) => {
    return mockUsers.find(u => u.nip.toLowerCase() === nip.toLowerCase());
  };

  // Case 1: Standard Email
  const res1 = await resolveLoginEmail('admin@mdu.com', mockLookup);
  assert.strictEqual(res1, 'admin@mdu.com');

  // Case 2: Mentor NIP found in users table
  const res2 = await resolveLoginEmail('MTR001', mockLookup);
  assert.strictEqual(res2, 'budi.mentor@mdu.com');

  // Case 3: OJT NIP with dummy email in users table
  const res3 = await resolveLoginEmail('202601001', mockLookup);
  assert.strictEqual(res3, '202601001@ojt.mdu.com');

  // Case 4: Unregistered NIP fallback to @ojt.mdu.com
  const res4 = await resolveLoginEmail('9999999', mockLookup);
  assert.strictEqual(res4, '9999999@ojt.mdu.com');
});
