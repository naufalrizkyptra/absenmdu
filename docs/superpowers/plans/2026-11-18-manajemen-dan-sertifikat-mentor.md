# Manajemen Akun & Sertifikat Mentor di Admin Utama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fitur manajemen akun mentor dan sistem penilaian kinerja serta penerbitan sertifikat resmi mentor di dashboard Admin Utama (`/admin`), sekaligus menyediakan akses unduh sertifikat di dashboard mentor (`/mentor`).

**Architecture:** Mengintegrasikan tab navigasi terpadu di dashboard Admin untuk CRUD akun mentor dan evaluasi 5 pilar bimbingan. Penilaian disimpan di tabel `mentor_grades` dan dicetak ke sertifikat resmi dua halaman (Piagam Apresiasi + Transkrip Evaluasi) menggunakan `html2canvas` dan `jspdf`. Dashboard mentor menampilkan kartu unduh sertifikat jika sudah diterbitkan oleh Admin.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (PostgreSQL + Supabase Admin Auth), Tailwind CSS v4, SweetAlert2, Sonner toast, html2canvas, jspdf.

**Spec:** [docs/superpowers/specs/2026-11-18-manajemen-dan-sertifikat-mentor-design.md](file:///c:/Users/naufa/mdu-app/docs/superpowers/specs/2026-11-18-manajemen-dan-sertifikat-mentor-design.md)

## Global Constraints
- Framework: Next.js 16.2.4 (App Router) + React 19.
- OJT Flow Untouched: Pembuatan akun OJT di `/mentor/data-ojt` dan penilaian OJT di `/mentor/penilaian` tidak boleh diubah alurnya.
- Supabase Auth: Pembuatan akun mentor menggunakan `supabaseAdmin.auth.admin.createUser` dengan email utama.
- Data Integrity: Penghapusan mentor yang masih memiliki anak bimbingan aktif dicegah demi mencegah *orphaned mentees*.

## Review Focus
1. Mentor login: Memastikan mentor dapat login dengan NIP maupun Email di `/login`.
2. Safe deletion: Mencegah penghapusan akun mentor yang masih memiliki anak OJT aktif.
3. Date period: Tanggal mulai dan selesai bimbingan mentor tercetak akurat di sertifikat.
4. Auto-calculation: Nilai rata-rata dan predikat (Sangat Memuaskan / Memuaskan / Baik) terhitung otomatis.
5. High-res PDF rendering: Desain sertifikat dua halaman ter-render sempurna tanpa elemen terpotong.

---

### Task 1: Database Migration untuk `mentor_grades`

**Files:**
- Create: `supabase/migrations/20261118_create_mentor_grades.sql`
- Test: `tests/mentor-grades.test.mjs`

**Interfaces:**
- Produces: Tabel `mentor_grades` (id, mentor_id, admin_id, no_sertifikat, start_period, end_period, nilai_kepemimpinan, nilai_kedisiplinan, nilai_komunikasi, nilai_teknis, nilai_efektivitas, predikat, catatan, created_at, updated_at).

- [ ] **Step 1: Tulis file migrasi SQL `supabase/migrations/20261118_create_mentor_grades.sql`**
- [ ] **Step 2: Tulis unit test `tests/mentor-grades.test.mjs` untuk verifikasi koneksi dan operasi tabel `mentor_grades`**
- [ ] **Step 3: Jalankan test untuk memverifikasi struktur tabel**
  Run: `node --test tests/mentor-grades.test.mjs`
  Expected: PASS
- [ ] **Step 4: Commit**
  ```bash
  git add supabase/migrations/20261118_create_mentor_grades.sql tests/mentor-grades.test.mjs
  git commit -m "feat(db): add mentor_grades table migration and test"
  ```

---

### Task 2: Server Actions Admin di `app/admin/actions.ts`

**Files:**
- Create: `app/admin/actions.ts`
- Test: `tests/admin-mentor-actions.test.mjs`

**Interfaces:**
- Produces:
  - `createMentorAccount(formData)`: `{ success: boolean, message?: string }`
  - `updateMentorProfile(mentorId, data)`: `{ success: boolean, message?: string }`
  - `resetMentorPasswordByAdmin(mentorId, newPassword)`: `{ success: boolean, message?: string }`
  - `deleteMentorAccount(mentorId)`: `{ success: boolean, message?: string }`
  - `archiveMentorAccount(mentorId)`: `{ success: boolean, message?: string }`
  - `submitMentorEvaluation(gradeData)`: `{ success: boolean, message?: string }`
  - `deleteMentorEvaluation(mentorId)`: `{ success: boolean, message?: string }`
  - `getMentorCertificateData(mentorId)`: `{ success: boolean, data?: any, message?: string }`

- [ ] **Step 1: Tulis unit test `tests/admin-mentor-actions.test.mjs` mencakup CRUD mentor, proteksi anak bimbingan aktif, dan penilaian**
- [ ] **Step 2: Jalankan test untuk memastikan test gagal (karena `app/admin/actions.ts` belum ada)**
  Run: `node --test tests/admin-mentor-actions.test.mjs`
  Expected: FAIL (cannot find module)
- [ ] **Step 3: Implementasikan fungsi-fungsi server actions di `app/admin/actions.ts`**
  - Sertakan guard: cek apakah mentor memiliki mentee dengan `role = 'ojt'` dan `status_ojt != 'selesai'` sebelum menghapus.
- [ ] **Step 4: Jalankan test untuk memastikan semua fungsi lolos**
  Run: `node --test tests/admin-mentor-actions.test.mjs`
  Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add app/admin/actions.ts tests/admin-mentor-actions.test.mjs
  git commit -m "feat(admin): add server actions for mentor management and evaluation"
  ```

---

### Task 3: Login Resolver Fleksibel (NIP / Email) di `app/login/page.tsx`

**Files:**
- Modify: `app/login/page.tsx:65-90`
- Test: `tests/login-resolver.test.mjs`

**Interfaces:**
- Consumes: NIP / Email dari input user, tabel `users`.
- Produces: Email auth yang valid untuk `supabase.auth.signInWithPassword`.

- [ ] **Step 1: Tulis unit test `tests/login-resolver.test.mjs` untuk menguji resolusi input login (email biasa, NIP mentor, dan NIP OJT)**
- [ ] **Step 2: Jalankan test untuk verifikasi ekspektasi**
  Run: `node --test tests/login-resolver.test.mjs`
- [ ] **Step 3: Perbarui logic `handleLogin` di `app/login/page.tsx`**
  - Jika input tidak mengandung `@`, cek apakah NIP cocok dengan user di tabel `users`. Jika ada, gunakan `user.email`. Jika tidak ditemukan, fallback ke `${loginId}@ojt.mdu.com`.
- [ ] **Step 4: Jalankan test untuk memastikan resolusi berjalan benar**
  Run: `node --test tests/login-resolver.test.mjs`
  Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add app/login/page.tsx tests/login-resolver.test.mjs
  git commit -m "fix(login): support NIP lookup for mentor and OJT accounts"
  ```

---

### Task 4: Tab "Manajemen Mentor" di Dashboard Admin (`app/admin/page.tsx`)

**Files:**
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `createMentorAccount`, `updateMentorProfile`, `resetMentorPasswordByAdmin`, `deleteMentorAccount`, `archiveMentorAccount` dari `app/admin/actions.ts`.

- [ ] **Step 1: Tambahkan state tab `activeTab` ('absensi' | 'performa' | 'mentors' | 'sertifikat') dan state data mentor di `app/admin/page.tsx`**
- [ ] **Step 2: Tambahkan navigasi tab di sidebar desktop dan drawer mobile Admin**
- [ ] **Step 3: Bangun tampilan tab "Manajemen Mentor"**
  - Statistik mentor: Total Mentor, Mentor Aktif, Selesai Bimbingan.
  - Search input & filter status.
  - Tombol "+ Daftarkan Mentor Baru" dengan modal pendaftaran (Nama, NIP, Email, Password, Divisi, Kantor, Telp).
  - Tabel daftar mentor dengan badge jumlah mentee yang dibimbing dan aksi (Edit Profil, Reset Password, Arsip, Hapus).
- [ ] **Step 4: Verifikasi interaksi modal dan notifikasi konfirmasi SweetAlert2**
- [ ] **Step 5: Commit**
  ```bash
  git add app/admin/page.tsx
  git commit -m "feat(admin): add mentor management tab and modals in admin dashboard"
  ```

---

### Task 5: Tab "Penilaian & Sertifikat Mentor" & Generator PDF di Admin (`app/admin/page.tsx`)

**Files:**
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `submitMentorEvaluation`, `deleteMentorEvaluation` dari `app/admin/actions.ts`, `mentor_grades`, `html2canvas`, `jspdf`.

- [ ] **Step 1: Tambahkan tab "Penilaian & Sertifikat Mentor" di `app/admin/page.tsx`**
  - Menampilkan daftar mentor dengan status evaluasi: *Belum Dinilai* vs *Sertifikat Terbit*, nomor sertifikat, dan nilai akhir.
  - Tombol "Beri Penilaian" / "Edit Nilai" dan tombol "Cetak Sertifikat PDF".
- [ ] **Step 2: Bangun Modal Form Evaluasi Mentor**
  - Form penilaian 5 pilar (0-100): Kepemimpinan, Kedisiplinan, Komunikasi, Penguasaan Teknis, Efektivitas Pembinaan.
  - Input Tanggal Periode Bimbingan (Mulai - Selesai).
  - Input Nomor Sertifikat (format: `XXX/MDU-MENTOR/BULAN/TAHUN` dengan auto-suggestion).
  - Input Catatan Evaluasi & auto-hitung Nilai Rata-rata + Predikat Kelulusan.
- [ ] **Step 3: Bangun Desain Template DOM Sertifikat Mentor (Hidden Rendering)**
  - Halaman 1 (`#mentor-cert-page-1`): Piagam Apresiasi Resmi Mentor Pembimbing dengan Nomor Sertifikat, Nama Lengkap Mentor, Divisi, Periode Bimbingan, dan tanda tangan resmi MDU.
  - Halaman 2 (`#mentor-cert-page-2`): Lembar Transkrip Nilai Evaluasi Kinerja Pembimbingan MDU.
- [ ] **Step 4: Implementasikan fungsi unduh PDF resolusi tinggi via html2canvas & jspdf**
- [ ] **Step 5: Commit**
  ```bash
  git add app/admin/page.tsx
  git commit -m "feat(admin): add mentor evaluation and high-res certificate generation in admin"
  ```

---

### Task 6: Kartu / Banner "Sertifikat Mentor" di Dashboard Mentor (`app/mentor/page.tsx`)

**Files:**
- Modify: `app/mentor/page.tsx`

**Interfaces:**
- Consumes: `mentor_grades` dari Supabase, `html2canvas`, `jspdf`.

- [ ] **Step 1: Ambil data nilai/sertifikat mentor yang sedang login dari `mentor_grades` saat mount dashboard**
- [ ] **Step 2: Tampilkan Banner / Kartu Khusus "Sertifikat Mentor Pembimbing" di dashboard `/mentor`**
  - Jika sertifikat sudah terbit: Tampilkan badge emas "Sertifikat Resmi Terbit", nomor sertifikat, dan tombol "Unduh Sertifikat PDF Resmi".
  - Jika belum: Tampilkan status informatif bahwa sertifikat akan diterbitkan oleh Admin Utama setelah masa bimbingan selesai dievaluasi.
- [ ] **Step 3: Hubungkan generator download PDF di sisi mentor agar mentor dapat mengunduh dokumen sertifikat mereka sendiri**
- [ ] **Step 4: Commit**
  ```bash
  git add app/mentor/page.tsx
  git commit -m "feat(mentor): show certificate card and download action on mentor dashboard"
  ```

---

### Task 7: Verifikasi Menyeluruh & Build Test

**Files:**
- Review: `tests/*.test.mjs`

- [ ] **Step 1: Jalankan seluruh automated tests**
  Run: `node --test tests/mentor-grades.test.mjs tests/admin-mentor-actions.test.mjs tests/login-resolver.test.mjs`
  Expected: ALL PASS
- [ ] **Step 2: Jalankan Next.js build check**
  Run: `npm run build`
  Expected: Build succeeds with 0 errors
- [ ] **Step 3: Commit final polish & verification**
  ```bash
  git add .
  git commit -m "chore: complete verification and build checks for mentor management and certificate"
  ```
