import assert from 'node:assert';
import { test } from 'node:test';

// Logika jendela waktu pengingat absen
export function checkReminderStatus({ currentHour, currentMinute, hasCheckIn, hasCheckOut }) {
  // Jam Masuk: 07.45 - 09.00 WIB jika belum check-in
  const isMorningWindow = (currentHour === 7 && currentMinute >= 45) || (currentHour === 8) || (currentHour === 9 && currentMinute === 0);
  const triggerCheckInReminder = isMorningWindow && !hasCheckIn;

  // Jam Pulang: Mulai tepat 15.00 WIB jika sudah check-in dan belum check-out
  const isAfternoonWindow = currentHour >= 15 && currentHour <= 21;
  const triggerCheckOutReminder = isAfternoonWindow && hasCheckIn && !hasCheckOut;

  return {
    isMorningWindow,
    isAfternoonWindow,
    triggerCheckInReminder,
    triggerCheckOutReminder
  };
}

test('Check-in reminder triggers between 07.45 and 09.00 WIB when not checked in', () => {
  // Pukul 07:45 belum check-in
  const res1 = checkReminderStatus({ currentHour: 7, currentMinute: 45, hasCheckIn: false, hasCheckOut: false });
  assert.strictEqual(res1.triggerCheckInReminder, true);

  // Pukul 08:00 belum check-in
  const res2 = checkReminderStatus({ currentHour: 8, currentMinute: 0, hasCheckIn: false, hasCheckOut: false });
  assert.strictEqual(res2.triggerCheckInReminder, true);

  // Pukul 08:00 sudah check-in -> tidak perlu pengingat
  const res3 = checkReminderStatus({ currentHour: 8, currentMinute: 0, hasCheckIn: true, hasCheckOut: false });
  assert.strictEqual(res3.triggerCheckInReminder, false);

  // Pukul 07:30 (terlalu pagi) -> tidak boleh trigger
  const res4 = checkReminderStatus({ currentHour: 7, currentMinute: 30, hasCheckIn: false, hasCheckOut: false });
  assert.strictEqual(res4.triggerCheckInReminder, false);
});

test('Check-out reminder triggers starting at 15.00 WIB when checked in but not checked out', () => {
  // Pukul 14:59 (belum jam pulang 15.00) -> tidak boleh trigger
  const res1 = checkReminderStatus({ currentHour: 14, currentMinute: 59, hasCheckIn: true, hasCheckOut: false });
  assert.strictEqual(res1.triggerCheckOutReminder, false);

  // Pukul 15:00 tepat jam pulang -> trigger pengingat check-out
  const res2 = checkReminderStatus({ currentHour: 15, currentMinute: 0, hasCheckIn: true, hasCheckOut: false });
  assert.strictEqual(res2.triggerCheckOutReminder, true);

  // Pukul 15:30 sudah check-out -> tidak trigger lagi
  const res3 = checkReminderStatus({ currentHour: 15, currentMinute: 30, hasCheckIn: true, hasCheckOut: true });
  assert.strictEqual(res3.triggerCheckOutReminder, false);

  // Pukul 15:30 belum pernah check-in hari ini -> tidak trigger check-out
  const res4 = checkReminderStatus({ currentHour: 15, currentMinute: 30, hasCheckIn: false, hasCheckOut: false });
  assert.strictEqual(res4.triggerCheckOutReminder, false);
});

