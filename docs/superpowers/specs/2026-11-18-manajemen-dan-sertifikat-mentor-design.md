# Desain Fitur: Manajemen Akun & Sertifikat Mentor di Admin Utama

**Tanggal:** 2026-11-18  
**Status:** Disetujui Pengguna (Pendekatan 1 - Revisi Pasca-Review Arsitektur)  

---

## 1. Intent & The Why
Dalam ekosistem aplikasi MDU, Mentor memegang peran krusial dalam mendampingi dan membimbing anak-anak OJT/magang. Setelah masa penugasan mentor selesai, mentor berhak memperoleh apresiasi resmi berupa evaluasi kinerja dan penerbitan **Sertifikat Mentor**.

Fitur ini memusatkan kendali hierarki di mana Admin Utama (sebagai peran di atas mentor) dapat membuat akun mentor, mengelola data mentor, mengevaluasi kinerja bimbingan mentor, serta menerbitkan dan mengelola sertifikat resmi untuk mentor. Sementara itu, fungsionalitas mentor dalam mengelola akun dan sertifikat OJT tetap berjalan mandiri seperti sedia kala.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
1. **Manajemen Akun Mentor di Dashboard Admin (`/admin`):**
   - Menampilkan daftar seluruh mentor dengan informasi: Nama, Email, NIP, Divisi, Asal Kantor, No. HP, Jumlah Mentee OJT aktif, dan Status Sertifikat.
   - Form Tambah Akun Mentor Baru (nama, NIP, email aktif, default password, divisi, asal kantor, no telepon).
   - Form Edit Profil Mentor & Fitur Reset Password Mentor oleh Admin Utama.
   - Fitur Hapus/Arsip status akun mentor dengan proteksi integritas data mentee (peringatan jika masih ada OJT aktif).
2. **Evaluasi & Penilaian Mentor oleh Admin:**
   - Form penilaian kinerja mentor dengan kriteria profesional bimbingan:
     - Kepemimpinan & Pembimbingan Mentee (*Mentorship & Leadership*)
     - Tanggung Jawab & Kedisiplinan (*Responsibility & Discipline*)
     - Komunikasi & Kerjasama (*Communication & Collaboration*)
     - Penguasaan Teknis & Manajerial (*Technical & Managerial Competence*)
     - Efektivitas Pembinaan & Capaian Tim (*Team Development Effectiveness*)
   - Input tanggal **Periode Bimbingan** (*Start Period* & *End Period*) langsung pada form penilaian untuk dicetak ke sertifikat.
   - Perhitungan otomatis Nilai Rata-rata & Predikat Kelulusan (Sangat Memuaskan / Memuaskan / Baik).
   - Input nomor sertifikat resmi (format: `XXX/MDU-MENTOR/BULAN/TAHUN`).
3. **Penerbitan & Cetak Sertifikat PDF Resmi Mentor:**
   - Desain sertifikat resmi MDU untuk peran "Mentor Pembimbing" dengan nomor sertifikat, periode bimbingan, divisi, dan legalitas stempel/tanda tangan MDU.
   - Halaman 2: Lembar Transkrip Evaluasi Kinerja Mentor oleh Manajemen MDU.
   - Tombol unduh langsung PDF resolusi tinggi dari dashboard Admin.
4. **Akses Sertifikat di Dashboard Mentor (`/mentor`):**
   - Menambahkan kartu/banner interaktif "Sertifikat Mentor" di dashboard mentor yang aktif jika status mentor telah dinilai & diterbitkan sertifikatnya oleh Admin.

### Non-Goals
- Tidak mengubah alur pembuatan akun OJT maupun penilaian/sertifikat OJT yang sudah berjalan di level mentor (`/mentor/data-ojt` dan `/mentor/penilaian`).

### Anti-Goals
- Tidak merombak sistem auth yang sudah berjalan: Mentor login menggunakan Email utama mereka (atau NIP yang otomatis diarahkan ke email terkait).
- Mentor tidak diizinkan mengubah nilai evaluasi atau nomor sertifikat mentor mereka sendiri.

---

## 3. Constraints & Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19.
- **Styling:** Tailwind CSS v4, Palet MDU (Indigo `#1e1b4b`, Slate, Blue).
- **Database & Auth:** Supabase (PostgreSQL + Supabase Admin Auth API).
- **PDF Generation:** `html2canvas` + `jspdf` (konsisten dengan generator sertifikat beresolusi tinggi di `/mentor/penilaian`).
- **Icons & UI Feedback:** Heroicons / Lucide SVG + SweetAlert2 + Sonner toast.

---

## 4. Approaches Considered
- **Pendekatan 1 (DIPILIH):** Dashboard Tab Terpadu di Admin (`/admin`), mengintegrasikan *Live Absensi*, *Performa Kinerja*, *Manajemen Mentor*, dan *Penilaian & Sertifikat Mentor* dalam satu antarmuka SPA tanpa reload halaman.
- **Pendekatan 2 (DITOLAK):** Halaman terpisah multi-route (`/admin/mentors` & `/admin/sertifikat-mentor`) karena membebani navigasi harian admin.

---

## 5. Keputusan Desain & Detail Arsitektur (Pasca-Review)

### A. Autentikasi & Login Mentor
- Saat membuat akun mentor, Admin mengisi **Email** dan **NIP**.
- Akun dibuat di Supabase Auth menggunakan **Email** utama mentor (password default dapat ditentukan admin atau otomatis `mentormdu2026!`).
- Pada `/login`: Jika login identifier berisi `@`, sistem langsung login via Email. Jika berupa angka/NIP, sistem mengecek kecocokan NIP di tabel `users` untuk mengambil email akun auth terkait sehingga mentor bisa login baik dengan NIP maupun Email.

### B. Integritas Relasi Mentee Saat Hapus/Arsip Mentor
- Jika Admin menghapus akun mentor yang masih memiliki anak bimbingan aktif, sistem akan menampilkan peringatan dan mencegah penghapusan langsung sampai anak bimbingan dipindahkan ke mentor lain (menggunakan fitur transfer yang sudah ada).
- Status arsip (`status_mentor = 'selesai'`) menandakan masa bimbingan telah usai tanpa menghapus akun, sehingga riwayat bimbingan dan sertifikat tetap aman.

### C. Periode Bimbingan & Database Schema (`mentor_grades`)
- Form evaluasi di Admin menyediakan input **Tanggal Mulai Bimbingan** dan **Tanggal Selesai Bimbingan**, dengan nilai default otomatis diambil dari periode mentee atau periode mentor.
- Tabel Supabase / payload `mentor_grades`:
  - `id` (UUID)
  - `mentor_id` (UUID references users.id, unique per mentor)
  - `admin_id` (UUID references users.id)
  - `no_sertifikat` (VARCHAR)
  - `start_period` (DATE / VARCHAR)
  - `end_period` (DATE / VARCHAR)
  - `nilai_kepemimpinan` (NUMERIC)
  - `nilai_kedisiplinan` (NUMERIC)
  - `nilai_komunikasi` (NUMERIC)
  - `nilai_teknis` (NUMERIC)
  - `nilai_efektivitas` (NUMERIC)
  - `predikat` (VARCHAR)
  - `catatan` (TEXT)
  - `created_at`, `updated_at`

### D. Server Actions (`app/admin/actions.ts`)
1. `createMentorAccount(formData)`: Memanggil `supabaseAdmin.auth.admin.createUser` dan insert ke `users` (`role = 'mentor'`).
2. `updateMentorProfile(mentorId, data)`: Update profil di `users` dan email auth jika ada perubahan.
3. `resetMentorPassword(mentorId, newPassword)`: Reset password via Supabase Admin Auth API.
4. `deleteMentorAccount(mentorId)`: Hapus akun setelah verifikasi tidak ada mentee aktif.
5. `archiveMentorAccount(mentorId)`: Set `status_mentor = 'selesai'`.
6. `submitMentorEvaluation(evaluationData)`: Upsert ke `mentor_grades`.
7. `deleteMentorEvaluation(mentorId)`: Hapus nilai / batalkan penerbitan sertifikat mentor.

---

## 6. What's Left to the Builder
- Penyesuaian layout sertifikat penghargaan "Mentor Pembimbing" agar proporsional dan elegan saat di-render ke PDF (canvas portrait A4, landscape rotated -90deg atau landscape A4).
