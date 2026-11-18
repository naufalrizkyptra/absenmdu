import assert from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

test('Mentor grades migration SQL file exists and contains required fields', () => {
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20261118_create_mentor_grades.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration SQL file must exist');

  const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

  // Verify essential table creation and columns
  assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.mentor_grades'), 'Must create mentor_grades table');
  assert.ok(sqlContent.includes('mentor_id uuid'), 'Must reference mentor_id');
  assert.ok(sqlContent.includes('no_sertifikat text'), 'Must have no_sertifikat');
  assert.ok(sqlContent.includes('start_period text'), 'Must have start_period');
  assert.ok(sqlContent.includes('end_period text'), 'Must have end_period');
  assert.ok(sqlContent.includes('nilai_kepemimpinan numeric'), 'Must have nilai_kepemimpinan');
  assert.ok(sqlContent.includes('nilai_kedisiplinan numeric'), 'Must have nilai_kedisiplinan');
  assert.ok(sqlContent.includes('nilai_komunikasi numeric'), 'Must have nilai_komunikasi');
  assert.ok(sqlContent.includes('nilai_teknis numeric'), 'Must have nilai_teknis');
  assert.ok(sqlContent.includes('nilai_efektivitas numeric'), 'Must have nilai_efektivitas');
  assert.ok(sqlContent.includes('predikat text'), 'Must have predikat');
  assert.ok(sqlContent.includes('catatan text'), 'Must have catatan');
  assert.ok(sqlContent.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
});
