import assert from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
process.env.NEXT_PUBLIC_SUPABASE_URL = urlMatch[1].trim();
process.env.SUPABASE_SERVICE_ROLE_KEY = keyMatch[1].trim();

const { createClient } = await import('@supabase/supabase-js');
const { 
  createAnnouncement, 
  getMentorAnnouncements, 
  getActiveAnnouncementForOJT, 
  toggleAnnouncementStatus, 
  deleteAnnouncement 
} = await import('../app/mentor/actions.ts');

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

test('Announcement server actions full lifecycle (create, fetch, toggle, delete)', async () => {
  // 1. Ambil 1 mentor untuk testing
  const { data: mentors } = await supabaseAdmin.from('users').select('id, name').eq('role', 'mentor').limit(1);
  assert.ok(mentors && mentors.length > 0, 'Harus ada setidaknya 1 mentor');
  const mentorId = mentors[0].id;

  // 2. Test createAnnouncement
  const createRes = await createAnnouncement({
    mentor_id: mentorId,
    title: 'Evaluasi Mingguan Tim Desain',
    content: 'Briefing evaluasi proyek magang akan dilaksanakan jam 14.00 WIB di ruang meeting.',
    category: 'evaluasi'
  });

  assert.strictEqual(createRes.success, true, 'createAnnouncement must succeed: ' + createRes.message);
  assert.ok(createRes.item, 'Must return created announcement item');
  const createdId = createRes.item.id;
  assert.strictEqual(createRes.item.title, 'Evaluasi Mingguan Tim Desain');
  assert.strictEqual(createRes.item.category, 'evaluasi');

  // 3. Test getMentorAnnouncements
  const listRes = await getMentorAnnouncements(mentorId);
  assert.strictEqual(listRes.success, true);
  assert.ok(listRes.announcements.some(a => a.id === createdId), 'Created item should be in mentor announcement list');

  // 4. Test getActiveAnnouncementForOJT
  const ojtRes = await getActiveAnnouncementForOJT(mentorId);
  assert.strictEqual(ojtRes.success, true);
  assert.ok(ojtRes.announcement, 'Active announcement must exist');
  assert.strictEqual(ojtRes.announcement.id, createdId);

  // 5. Test toggleAnnouncementStatus to inactive
  const toggleRes = await toggleAnnouncementStatus(createdId, mentorId, false);
  assert.strictEqual(toggleRes.success, true);

  const ojtAfterInactive = await getActiveAnnouncementForOJT(mentorId);
  assert.strictEqual(ojtAfterInactive.success, true);
  if (ojtAfterInactive.announcement) {
    assert.notStrictEqual(ojtAfterInactive.announcement.id, createdId, 'Inactive announcement must not be active for OJT');
  }

  // 6. Test deleteAnnouncement
  const delRes = await deleteAnnouncement(createdId, mentorId);
  assert.strictEqual(delRes.success, true);

  const listAfterDel = await getMentorAnnouncements(mentorId);
  assert.ok(!listAfterDel.announcements.some(a => a.id === createdId), 'Deleted announcement must not be in list');
  console.log('All Announcement Server Action tests passed successfully!');
});
