# Desain Fitur: Asisten Chatbot AI MDU (Floating Widget)

**Tanggal:** 2026-11-03  
**Status:** Menunggu Persetujuan Pengguna  

---

## 1. Intent & The Why
Peserta OJT dan Mentor di aplikasi MDU sering memerlukan panduan cepat mengenai alur operasional aplikasi (seperti ketentuan absensi, prosedur pengajuan izin, pengumpulan dan verifikasi tugas, serta kriteria penilaian) maupun *product knowledge* dasar MDU.

Fitur ini bertujuan menghadirkan asisten chatbot AI interaktif yang ringan, ramah, dan selalu siap sedia di sudut layar aplikasi. Pengguna dapat langsung bertanya dan mendapatkan solusi instan tanpa perlu meninggalkan halaman yang sedang mereka kerjakan atau bertanya manual berulang kali ke admin/pembimbing.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- **Floating Chat Widget:** Tombol melayang (*Floating Action Button*) di sudut kanan bawah yang dapat membuka dan menutup jendela obrolan (*pop-up dialog*) dengan mulus di perangkat desktop maupun mobile (PWA).
- **Integrasi AI Responsif & Cerdas:** Menggunakan Google Gemini API (*Flash tier* gratis) yang dipanggil secara aman dari backend Next.js.
- **Basis Pengetahuan Terstruktur:** Modul data pengetahuan mandiri (`mdu-knowledge`) yang mencakup SOP aplikasi (OJT & Mentor) serta placeholder terstruktur untuk *product knowledge* MDU yang mudah diperbarui kapan saja.
- **Quick Prompt Chips:** Tombol saran pertanyaan cepat (contoh: *"Cara izin sakit"*, *"Cara kumpul tugas"*, *"Panduan penilaian mentor"*) untuk memudahkan pengguna langsung berinteraksi.
- **Multi-turn Session Context:** Mempertahankan riwayat obrolan sementara selama sesi percakapan aktif di memori klien.

### Non-Goals
- **Otomasi Transaksional:** Chatbot tidak mengeksekusi perubahan data atau submit data langsung ke database Supabase (misal: bot tidak melakukan input absensi untuk user, melainkan memandu langkah-langkahnya).
- **Penyimpanan Permanen Riwayat Chat:** Percakapan tidak disimpan permanen ke database PostgreSQL/Supabase untuk menjaga performa tetap ringan dan hemat penyimpanan.

### Anti-Goals
- **Halusinasi di Luar Konteks:** Chatbot dilarang mengarang informasi umum yang tidak relevan dengan MDU atau aplikasi MDU (*strict system prompt guardrails*).
- **Mengganggu UI/UX Kerja:** Widget tidak boleh menutupi tombol navigasi penting atau form input saat posisi diminimalkan, dan harus mudah ditutup kapan saja.

---

## 3. Constraints & Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19.
- **Styling:** Tailwind CSS v4, selaras dengan skema warna MDU (Navy/Slate/Blue).
- **AI Service:** Google Gemini API (model `gemini-2.5-flash` atau `gemini-1.5-flash`) via Google AI Studio Free Tier (menggunakan `GEMINI_API_KEY` di `.env.local`).
- **PWA Compatibility:** Memastikan layout pop-up chat pas dan nyaman saat dibuka di mode layar penuh ponsel (PWA).

---

## 4. Approaches Considered

1. **Floating Action Button & Chat Pop-up (DIPILIH):**
   - *Alasan:* Sangat praktis, dapat diakses dari dashboard OJT maupun Mentor tanpa navigasi halaman, tidak memutus alur pengisian form, dan ringan.
2. **Dedicated Full-page Chat (`/bantuan` atau `/chat`) (DITOLAK):**
   - *Alasan:* Mengharuskan pengguna berpindah halaman hanya untuk mengajukan pertanyaan singkat, memutus konteks kerja yang sedang berlangsung.

---

## 5. Keputusan Desain & Arsitektur

### A. Komponen Antarmuka (`components/MduChatWidget.tsx`)
- Terletak melayang di kanan bawah (`fixed bottom-5 right-5 z-50`).
- Terdiri dari dua status:
  1. **Minimized:** Ikon asisten AI yang menarik dengan badge status.
  2. **Expanded:** Jendela chat berukuran ringkas (~380px lebar di desktop, responsif di mobile) dengan header, area pesan (user vs bot), quick action chips, indikator *typing*, dan kolom input pesan + tombol kirim.

### B. Basis Pengetahuan (`lib/knowledge/mdu-guide.ts`)
Berisi data teks komprehensif yang dirangkum ke dalam *system instruction*:
1. **Peran Bot:** Asisten Virtual MDU yang sopan, solutif, ringkas, dan jelas dalam Bahasa Indonesia.
2. **Panduan Alur OJT:**
   - Jam kerja, cara absen masuk/pulang (`/ojt/absen`), riwayat kehadiran.
   - Prosedur pengajuan izin sakit/keperluan lain (`/ojt/izin`) beserta dokumen pendukung.
   - Pengumpulan tugas OJT (`/ojt/tugas`) dan unduh sertifikat (`/ojt/sertifikat`).
3. **Panduan Alur Mentor:**
   - Pemantauan tim/mentee dan rekapitulasi kehadiran di dashboard (`/mentor`).
   - Penanganan presensi khusus (tugas luar/visit).
   - Pengisian nilai dan evaluasi mentee (`/mentor/penilaian`).
4. **Product Knowledge MDU:**
   - Informasi profil MDU dan seksi catatan terbuka yang siap ditambah sewaktu-waktu.

### C. Backend API Endpoint (`app/api/chat/route.ts`)
- Menerima riwayat percakapan dari klien (`messages: { role: 'user' | 'model', parts: string }[]`).
- Menggabungkan *system instruction* + *knowledge base* dengan riwayat pesan.
- Memanggil Gemini API secara aman di sisi server.
- Mengembalikan teks jawaban atau respons *fallback* yang ramah jika terjadi kendala jaringan/API key.

---

## 6. Detail yang Diserahkan ke Pembangun (Builder Call)
- Pilihan metode pemanggilan Gemini API (menggunakan HTTP REST langsung `fetch` ke endpoint `generativelanguage.googleapis.com` atau library `@google/genai` resmi). Direkomendasikan direct `fetch` agar dependensi tetap ramping tanpa menambah bundle size.
- Desain mikro visual: animasi buka/tutup jendela chat, warna avatar bot, dan animasi gelembung saat bot mengetik.
- Penempatan widget ke layout utama OJT (`app/ojt/layout.tsx` atau wrapper) dan Mentor (`app/mentor/layout.tsx`).

