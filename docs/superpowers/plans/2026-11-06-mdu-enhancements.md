# MDU App 4 Prioritas Fitur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan 4 fitur prioritas MDU App: Papan Pengumuman Tim (Broadcast), Peringatan Dini Tim (Early Warning), Penyelarasan Mobile UI/UX, dan Pengingat Absen Web/PWA (Jam Pulang 15.00 WIB).

**Architecture:** 
- Database Supabase: Tabel baru `announcements` untuk pesan broadcast mentor ke anak OJT bimbingan.
- Dashboard Mentor: Panel Early Warning otomatis (belum absen, sering terlambat, masa magang $\le 7$ hari) + antarmuka broadcast pengumuman.
- Dashboard OJT: Banner hero pengumuman aktif + banner pengingat absen interaktif (07.45-08.30 & $\ge 15.00$).
- Mobile UI: Card-based view responsif untuk tabel data OJT dan presensi.
- PWA/Web Notification: Web Notification API & Service Worker untuk pengingat otomatis.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL & Auth), SweetAlert2, Sonner, Service Worker.

**Spec:** [feature-enhancement-design.md](file:///C:/Users/naufa/.gemini/antigravity/brain/e4f686af-8670-4d0f-86d0-9c61eb622086/feature-enhancement-design.md)

## Global Constraints
- Jam Pulang standar OJT adalah **15.00 WIB** (bukan 17.00).
- Jam Masuk standar OJT adalah **08.00 WIB** (toleransi keterlambatan sesuai sistem).
- Pengumuman mentor hanya boleh dilihat oleh anak OJT bimbingannya (atau divisi mentor terkait).
- Responsive breakpoint standar: `< 768px` (mobile card view) vs `≥ 768px` (desktop table).
- TypeScript strict checking harus selalu lulus (`tsc --noEmit`).

## Review Focus
1. Kondisi OJT belum absen hari ini: tidak boleh menghitung OJT yang sudah mengajukan izin/sakit yang telah disetujui hari ini.
2. Kondisi jam pulang 15.00: tidak boleh memunculkan banner check-out jika OJT belum melakukan check-in hari ini atau sudah berhasil check-out.
3. Kueri pengumuman: jika mentor memiliki lebih dari 1 pengumuman aktif, tampilkan yang paling baru dan sediakan navigasi/riwayat.
4. Tampilan mobile: tidak boleh terjadi horizontal scrollbar overflow pada layar ponsel (360px - 430px).
5. Izin notifikasi browser: jika user menolak (`denied`), aplikasi harus tetap ramah dan beralih ke in-app visual banner tanpa error.

---

### Task 1: Supabase Announcements Migration & Server Actions

**Files:**
- Create: `tests/announcements.test.mjs`
- Modify: `app/mentor/actions.ts`

- [ ] **Step 1: Write test for announcement server actions**
  Buat `tests/announcements.test.mjs` yang menguji fungsi CRUD pengumuman (`createAnnouncement`, `getMentorAnnouncements`, `getActiveAnnouncementForOJT`, `deleteAnnouncement`, `toggleAnnouncementStatus`).
- [ ] **Step 2: Run test to confirm failure**
  Jalankan `node tests/announcements.test.mjs` dan pastikan fungsi belum ada / gagal.
- [ ] **Step 3: Create table `announcements` in Supabase**
  Jalankan script pembuatan tabel `public.announcements` di database Supabase dengan kolom: `id`, `created_at`, `mentor_id`, `title`, `content`, `category`, `is_active`.
- [ ] **Step 4: Implement announcement server actions in `app/mentor/actions.ts`**
  Implementasikan fungsi-fungsi CRUD pengumuman dengan validasi mentor_id dan sanitasi input.
- [ ] **Step 5: Run test to confirm pass**
  Jalankan `node tests/announcements.test.mjs` dan pastikan semua pengujian lulus.
- [ ] **Step 6: Commit changes**
  Commit dengan pesan: `feat(announcements): add supabase table and server actions for team broadcast`

---

### Task 2: Papan Pengumuman Tim UI (Mentor & OJT)

**Files:**
- Modify: `app/mentor/page.tsx`
- Modify: `app/ojt/page.tsx`

- [ ] **Step 1: Tambahkan UI Papan Pengumuman di Dashboard Mentor**
  Tambahkan tombol "Buat Pengumuman Tim" dan daftar pengumuman aktif dengan badge kategori (`Penting`, `Info`, `Evaluasi`) serta tombol hapus/nonaktifkan di [app/mentor/page.tsx](file:///c:/Users/naufa/mdu-app/app/mentor/page.tsx).
- [ ] **Step 2: Tambahkan Banner Pengumuman di Dashboard OJT**
  Di [app/ojt/page.tsx](file:///c:/Users/naufa/mdu-app/app/ojt/page.tsx), ambil pengumuman aktif dari mentor pembimbing (`userData.mentor_id`) dan tampilkan di banner hero paling atas dengan visual menarik dan waktu posting.
- [ ] **Step 3: Verifikasi TypeScript & UI flow**
  Jalankan `node ./node_modules/typescript/bin/tsc --noEmit`.
- [ ] **Step 4: Commit changes**
  Commit dengan pesan: `feat(announcements): implement broadcast ui in mentor and ojt dashboards`

---

### Task 3: Peringatan Dini Tim (Early Warning System) di Dashboard Mentor

**Files:**
- Create: `tests/early-warning.test.mjs`
- Modify: `app/mentor/page.tsx`

- [ ] **Step 1: Write logic test for early warning calculations**
  Buat `tests/early-warning.test.mjs` untuk menguji logika:
  - OJT belum hadir (jam > 08.15 & belum ada di presensi/izin hari ini)
  - OJT sering terlambat ($\ge 3$ kali dalam 30 hari terakhir)
  - OJT sisa magang $\le 7$ hari
- [ ] **Step 2: Run test to confirm logic correctness**
  Jalankan `node tests/early-warning.test.mjs`.
- [ ] **Step 3: Integrasikan modul Peringatan Dini di `app/mentor/page.tsx`**
  Tampilkan section "🚨 Peringatan Dini Tim" di atas ringkasan absensi dengan 3 kartu alert interaktif (merah, kuning, biru) lengkap dengan tombol aksi cepat (WhatsApp reminder & shortcut isi sertifikat).
- [ ] **Step 4: Verifikasi build & TypeScript**
  Jalankan `node ./node_modules/typescript/bin/tsc --noEmit`.
- [ ] **Step 5: Commit changes**
  Commit dengan pesan: `feat(mentor): add team early warning system for attendance and internship period`

---

### Task 4: Penyelarasan Tampilan Mobile (UI/UX Responsif)

**Files:**
- Modify: `app/mentor/page.tsx`
- Modify: `app/mentor/data-ojt/page.tsx`
- Modify: `app/ojt/absen/history/page.tsx`

- [ ] **Step 1: Mobile Card View untuk Presensi Tim di `app/mentor/page.tsx`**
  Ganti tabel desktop pada viewport `< md` (`hidden md:table` vs `block md:hidden`) dengan kartu presensi mobile (avatar, nama, jam masuk/keluar rapi, badge status tebal, tombol detail).
- [ ] **Step 2: Mobile Card View untuk Data OJT di `app/mentor/data-ojt/page.tsx`**
  Sempurnakan kartu data peserta OJT untuk mobile dengan tombol aksi (tukar, alih, edit, reset) dalam grid/flex yang ramah sentuhan.
- [ ] **Step 3: Mobile Card View untuk Riwayat Presensi OJT di `app/ojt/absen/history/page.tsx`**
  Tampilkan riwayat absensi OJT dalam kartu harian yang bersih dengan indikator jam kerja yang jelas.
- [ ] **Step 4: Verifikasi TypeScript & Responsivitas**
  Jalankan `node ./node_modules/typescript/bin/tsc --noEmit`.
- [ ] **Step 5: Commit changes**
  Commit dengan pesan: `feat(ui): enhance mobile responsive card views for mentor and ojt tables`

---

### Task 5: Pengingat Check-In & Check-Out (Notifikasi Web / PWA)

**Files:**
- Create: `tests/reminder.test.mjs`
- Modify: `public/sw.js`
- Modify: `app/ojt/page.tsx`

- [ ] **Step 1: Write unit test for reminder time window calculation**
  Buat `tests/reminder.test.mjs` untuk menguji kondisi trigger:
  - Jam masuk: 07.45 s.d. 08.30 (jika belum check-in)
  - Jam pulang: $\ge 15.00$ s.d. 18.00 (jika sudah check-in dan belum check-out)
- [ ] **Step 2: Tambahkan notification handler di `public/sw.js`**
  Dukung event `notificationclick` dan push alert pada Service Worker.
- [ ] **Step 3: Tambahkan In-App Interactive Banner & Toggle Notifikasi di `app/ojt/page.tsx`**
  - Banner interaktif dinamis: mengingatkan absen masuk di pagi hari dan absen pulang tepat pada jam 15.00.
  - Tombol aksi langsung "Absen Sekarang" yang mengarah ke `/ojt/absen`.
  - Opsi toggle Web Notification dengan `Notification.requestPermission()`.
- [ ] **Step 4: Run test to confirm pass**
  Jalankan `node tests/reminder.test.mjs`.
- [ ] **Step 5: Commit changes**
  Commit dengan pesan: `feat(pwa): add check-in and 15.00 check-out reminder notifications`

---

### Task 6: Verifikasi Menyeluruh & Finalisasi

**Files:**
- Run all test suites
- `tsc --noEmit`

- [ ] **Step 1: Jalankan semua test suite**
  `node tests/announcements.test.mjs`
  `node tests/early-warning.test.mjs`
  `node tests/reminder.test.mjs`
  `node tests/chat-api.test.mjs`
- [ ] **Step 2: Kompilasi TypeScript akhir**
  `node ./node_modules/typescript/bin/tsc --noEmit`
- [ ] **Step 3: Git push ke GitHub**
  Push semua commit ke `main` dan verifikasi deployment.

