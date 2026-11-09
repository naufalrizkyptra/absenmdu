import assert from 'node:assert';
import { test } from 'node:test';

// Helper fungsi kalkulasi hari sisa
function calculateRemainingDays(endDateStr, currentDate = new Date()) {
  if (!endDateStr) return null;
  const end = new Date(endDateStr);
  const today = new Date(currentDate);
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper cek apakah mentee masih aktif magang (belum selesai/lewat end_period)
function isMenteeActive(m, currentDate = new Date()) {
  if (m.status_ojt && m.status_ojt !== 'aktif') return false;
  if (m.end_period) {
    const days = calculateRemainingDays(m.end_period, currentDate);
    if (days !== null && days < 0) return false;
  }
  return true;
}

// Helper filter peserta belum hadir
function getAbsentMentees({ mentees, attendances, izinList, isToday, currentHour, currentMinute, currentDate = new Date() }) {
  const isPastMorningCutoff = (currentHour > 8) || (currentHour === 8 && currentMinute >= 15);
  if (!isToday || !isPastMorningCutoff) return [];

  const attendedIds = new Set(attendances.map(a => a.user_id));
  const izinIds = new Set(izinList.map(i => i.user_id));

  return mentees.filter(m => isMenteeActive(m, currentDate) && !attendedIds.has(m.id) && !izinIds.has(m.id));
}

// Helper filter sering terlambat
function getFrequentLateMentees(mentees, lateCounts, threshold = 3, currentDate = new Date()) {
  return mentees.filter(m => isMenteeActive(m, currentDate) && (lateCounts[m.id] || 0) >= threshold);
}

test('calculateRemainingDays accurately counts remaining internship days', () => {
  const base = new Date('2026-11-09T08:00:00');
  
  // 5 hari lagi
  assert.strictEqual(calculateRemainingDays('2026-11-14', base), 5);
  
  // Hari ini
  assert.strictEqual(calculateRemainingDays('2026-11-09', base), 0);
  
  // Sudah lewat 3 hari
  assert.strictEqual(calculateRemainingDays('2026-11-06', base), -3);
  
  // Null string
  assert.strictEqual(calculateRemainingDays('', base), null);
  assert.strictEqual(calculateRemainingDays(null, base), null);
});

test('Early Warning correctly flags absent mentees after 08:15 WIB', () => {
  const mentees = [
    { id: 'u1', name: 'Budi' },
    { id: 'u2', name: 'Siti' },
    { id: 'u3', name: 'Rian' },
    { id: 'u4', name: 'Dewi' }
  ];

  const attendances = [{ user_id: 'u1' }]; // Budi hadir
  const izinList = [{ user_id: 'u2' }];    // Siti izin

  // Kasus 1: Pukul 07.45 (Belum melewati batas masuk) -> Jangan panik / false alarm
  const beforeCutoff = getAbsentMentees({
    mentees,
    attendances,
    izinList,
    isToday: true,
    currentHour: 7,
    currentMinute: 45
  });
  assert.strictEqual(beforeCutoff.length, 0, 'No warning before 08:15');

  // Kasus 2: Pukul 08.30 (Sudah lewat batas masuk) -> Rian dan Dewi harus terdeteksi
  const afterCutoff = getAbsentMentees({
    mentees,
    attendances,
    izinList,
    isToday: true,
    currentHour: 8,
    currentMinute: 30
  });
  assert.strictEqual(afterCutoff.length, 2);
  assert.deepStrictEqual(afterCutoff.map(m => m.id), ['u3', 'u4']);

  // Kasus 3: Jika tanggal yang dipilih bukan hari ini (melihat arsip kemarin) -> Jangan trigger
  const pastDate = getAbsentMentees({
    mentees,
    attendances,
    izinList,
    isToday: false,
    currentHour: 9,
    currentMinute: 0
  });
  assert.strictEqual(pastDate.length, 0);
});

test('Early Warning correctly flags frequent late mentees (>= 3 times)', () => {
  const mentees = [
    { id: 'u1', name: 'Budi' },
    { id: 'u2', name: 'Siti' },
    { id: 'u3', name: 'Rian' }
  ];

  const lateCounts = {
    'u1': 4, // 4x terlambat -> trigger
    'u2': 2, // 2x terlambat -> aman
    'u3': 3  // 3x terlambat -> trigger
  };

  const flagged = getFrequentLateMentees(mentees, lateCounts, 3);
  assert.strictEqual(flagged.length, 2);
  assert.deepStrictEqual(flagged.map(m => m.id), ['u1', 'u3']);
});

test('Early Warning excludes mentees whose internship has ended (past end_period or status_ojt=selesai)', () => {
  const base = new Date('2026-11-09T09:00:00');
  const mentees = [
    { id: 'u1', name: 'Aktif 1', end_period: '2026-12-01', status_ojt: 'aktif' },
    { id: 'u2', name: 'Aktif 2', end_period: '2026-11-15', status_ojt: null },
    { id: 'u3', name: 'Sudah Selesai Periode', end_period: '2026-11-01', status_ojt: 'aktif' }, // lewat tgl
    { id: 'u4', name: 'Status Selesai', end_period: '2026-12-01', status_ojt: 'selesai' }, // status arsip/selesai
  ];

  // Kasus: Tidak ada yang absen
  const absent = getAbsentMentees({
    mentees,
    attendances: [],
    izinList: [],
    isToday: true,
    currentHour: 9,
    currentMinute: 0,
    currentDate: base
  });

  // Hanya u1 dan u2 yang boleh muncul di warning "Belum Hadir"
  assert.strictEqual(absent.length, 2, 'Only active mentees should be flagged as absent');
  assert.deepStrictEqual(absent.map(m => m.id), ['u1', 'u2']);

  // Kasus: Sering terlambat
  const lateCounts = { u1: 3, u2: 0, u3: 5, u4: 4 };
  const frequentLate = getFrequentLateMentees(mentees, lateCounts, 3, base);
  // u3 dan u4 sudah selesai magang, jadi tidak boleh muncul
  assert.strictEqual(frequentLate.length, 1, 'Finished mentees must not be flagged in frequent late');
  assert.strictEqual(frequentLate[0].id, 'u1');
});

