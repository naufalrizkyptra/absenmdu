import assert from 'node:assert/strict';
import { POST } from '../app/api/chat/route.ts';

// Test 1: Reject empty body
{
  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const res = await POST(req);
  assert.equal(res.status, 400, 'Empty messages must return 400');
  const data = await res.json();
  assert.ok(data.error, 'Must include error field');
}

// Test 2: Reject whitespace-only prompt
{
  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '    ' }],
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 400, 'Whitespace-only content must return 400');
}

// Test 3: Reject excessively long message (> 4000 chars)
{
  const longPrompt = 'a'.repeat(4001);
  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: longPrompt }],
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 400, 'Excessively long content must return 400');
  const data = await res.json();
  assert.ok(data.error.includes('panjang'), 'Must explain message is too long');
}

// Test 4: Reject malformed message array items
{
  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [null, { role: 'user', content: 'Valid question' }],
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 400, 'Malformed message item must return 400');
}

// Test 5: Fallback when GEMINI_API_KEY is not set
{
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'model', content: 'Halo! Ada yang bisa dibantu?' },
        { role: 'user', content: 'Halo' },
      ],
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 200, 'Missing key should return graceful 200');
  const data = await res.json();
  assert.ok(data.reply.includes('GEMINI_API_KEY'), 'Must mention GEMINI_API_KEY in fallback reply');

  if (oldKey) process.env.GEMINI_API_KEY = oldKey;
}

console.log('Chat API tests passed!');
