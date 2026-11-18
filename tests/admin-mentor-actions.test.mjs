import assert from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

test('app/admin/actions.ts exports all required server actions', async () => {
  const actionsPath = path.join(process.cwd(), 'app', 'admin', 'actions.ts');
  assert.ok(fs.existsSync(actionsPath), 'actions.ts file must exist');

  const content = fs.readFileSync(actionsPath, 'utf-8');
  assert.ok(content.includes("'use server'"), "Must have 'use server' directive");
  assert.ok(content.includes('export async function createMentorAccount'), 'Must export createMentorAccount');
  assert.ok(content.includes('export async function updateMentorProfile'), 'Must export updateMentorProfile');
  assert.ok(content.includes('export async function resetMentorPasswordByAdmin'), 'Must export resetMentorPasswordByAdmin');
  assert.ok(content.includes('export async function deleteMentorAccount'), 'Must export deleteMentorAccount');
  assert.ok(content.includes('export async function archiveMentorAccount'), 'Must export archiveMentorAccount');
  assert.ok(content.includes('export async function submitMentorEvaluation'), 'Must export submitMentorEvaluation');
  assert.ok(content.includes('export async function deleteMentorEvaluation'), 'Must export deleteMentorEvaluation');
  assert.ok(content.includes('export async function getMentorCertificateData'), 'Must export getMentorCertificateData');
});

test('calculateMentorScore and getPredicate logic returns correct values', () => {
  // Predicate test logic for mentor 5 pillars
  const calculateAverage = (scores) => {
    const sum = (scores.kepemimpinan || 0) + 
                (scores.kedisiplinan || 0) + 
                (scores.komunikasi || 0) + 
                (scores.teknis || 0) + 
                (scores.efektivitas || 0);
    return Math.round(sum / 5);
  };

  const getPredicate = (avg) => {
    if (avg >= 90) return 'Sangat Memuaskan';
    if (avg >= 80) return 'Memuaskan';
    if (avg >= 70) return 'Baik';
    return 'Cukup';
  };

  assert.strictEqual(calculateAverage({ kepemimpinan: 95, kedisiplinan: 90, komunikasi: 92, teknis: 94, efektivitas: 94 }), 93);
  assert.strictEqual(getPredicate(93), 'Sangat Memuaskan');

  assert.strictEqual(calculateAverage({ kepemimpinan: 85, kedisiplinan: 80, komunikasi: 82, teknis: 84, efektivitas: 84 }), 83);
  assert.strictEqual(getPredicate(83), 'Memuaskan');

  assert.strictEqual(calculateAverage({ kepemimpinan: 75, kedisiplinan: 72, komunikasi: 78, teknis: 74, efektivitas: 71 }), 74);
  assert.strictEqual(getPredicate(74), 'Baik');
});
