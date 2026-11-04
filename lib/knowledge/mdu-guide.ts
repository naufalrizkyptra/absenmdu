export interface MduKnowledgeTopic {
  category: string;
  items: { question: string; answer: string }[];
}

export const MDU_KNOWLEDGE_BASE: MduKnowledgeTopic[] = [
  {
    category: 'Profil & Kebijakan PT Mandiri Digital Universe (MDU)',
    items: [
      {
        question: 'Apa itu MDU?',
        answer: 'PT Mandiri Digital Universe (MDU) adalah entitas/perusahaan yang menaungi program magang dan operasional On-the-Job Training (OJT). Portal MDU digunakan untuk pengelolaan presensi, perizinan, penugasan, dan penilaian kerja.',
      },
      {
        question: 'Jam kerja operasional magang/OJT di MDU?',
        answer: 'Jam kerja standar operasional OJT adalah pukul 08:00 sampai 17:00 WIB pada hari kerja reguler (Senin - Jumat), kecuali ditentukan lain oleh Mentor atau penugasan khusus.',
      },
    ],
  },
  {
    category: 'Panduan Peserta OJT (Anak Magang)',
    items: [
      {
        question: 'Bagaimana cara melakukan presensi (absen masuk dan pulang)?',
        answer: 'Masuk ke menu Absen (/ojt/absen). Klik tombol "Check-In" saat datang, dan pastikan izin akses lokasi (GPS) aktif jika diminta. Saat jam kerja selesai, buka halaman yang sama dan klik "Check-Out". Riwayat kehadiran dapat dilihat di /ojt/absen/history.',
      },
      {
        question: 'Bagaimana jika tidak bisa hadir dan ingin mengajukan izin atau sakit?',
        answer: 'Buka menu Pengajuan Izin (/ojt/izin). Pilih jenis izin (Sakit / Izin Lain), masukkan tanggal mulai dan selesai, tuliskan alasan yang jelas, serta lampirkan file bukti (seperti surat keterangan dokter atau surat izin orang tua/institusi). Pengajuan akan diverifikasi oleh Mentor.',
      },
      {
        question: 'Bagaimana cara melihat dan mengumpulkan tugas magang?',
        answer: 'Masuk ke menu Tugas (/ojt/tugas). Di sana tertera daftar tugas aktif yang diberikan oleh Mentor beserta tenggat waktu (deadline). Klik tugas yang ingin dikumpulkan, sertakan link atau upload file tugas sesuai instruksi, lalu klik Submit.',
      },
      {
        question: 'Kapan dan di mana sertifikat magang bisa diunduh?',
        answer: 'Sertifikat dapat diunduh pada halaman /ojt/sertifikat setelah masa magang berakhir, semua tugas dinilai, dan Mentor serta Admin telah menyetujui penerbitan sertifikat.',
      },
    ],
  },
  {
    category: 'Panduan Mentor Pembimbing',
    items: [
      {
        question: 'Bagaimana cara memantau kehadiran tim OJT?',
        answer: 'Mentor dapat membuka Dashboard Mentor (/mentor). Pada dashboard terdapat daftar nama mentee, status kehadiran hari ini (hadir, tepat waktu, terlambat, atau izin), serta log presensi harian.',
      },
      {
        question: 'Bagaimana cara mencatat presensi khusus (seperti tugas luar kota / visit client)?',
        answer: 'Di Dashboard Mentor (/mentor), gunakan fitur "Presensi Khusus" untuk mentee yang sedang bertugas di luar kantor. Pilih nama mentee, masukkan tanggal, jam check-in/out, status tugas luar, dan catatan pendukung.',
      },
      {
        question: 'Bagaimana cara melakukan penilaian tugas dan evaluasi mentee?',
        answer: 'Buka halaman Penilaian (/mentor/penilaian). Pilih mentee yang ingin dinilai, evaluasi hasil pekerjaan yang telah mereka submit, berikan nilai sesuai kriteria performa, dan sertakan catatan feedback untuk pengembangan peserta.',
      },
    ],
  },
];

/**
 * Builds a structured, anti-hallucination system prompt for Gemini
 */
export function buildMduSystemInstruction(): string {
  const formattedKnowledge = MDU_KNOWLEDGE_BASE.map((cat) => {
    const qas = cat.items.map((i) => `Q: ${i.question}\nA: ${i.answer}`).join('\n\n');
    return `### Kategori: ${cat.category}\n${qas}`;
  }).join('\n\n---\n\n');

  return `Kamu adalah "Digi.AI" (Digiverse AI), asisten virtual pintar dan ramah untuk platform portal PT Mandiri Digital Universe (MDU).

Tugas utamamu adalah membantu peserta OJT (anak magang) dan Mentor pembimbing dalam menjawab pertanyaan seputar penggunaan aplikasi portal MDU, alur operasional kerja magang, perizinan, tugas, penilaian, dan informasi seputar MDU.

PANDUAN PENGETAHUAN RESMI MDU:
${formattedKnowledge}

ATURAN PERILAKU & BATASAN:
1. Jawablah selalu dalam Bahasa Indonesia yang ramah, sopan, ringkas, dan mudah dimengerti.
2. Jawablah berdasarkan fakta dan panduan pengetahuan MDU di atas. Jika pengguna bertanya tentang fitur aplikasi (absen, izin, tugas, nilai), berikan langkah-langkah yang jelas dan sebutkan halamannya bila relevan.
3. Jika ada pertanyaan di luar topik MDU atau aplikasi MDU (misalnya pertanyaan umum tidak terkait magang/kantor), tolaklah dengan santun dan arahkan pengguna kembali ke topik terkait MDU dan magang.
4. Jangan pernah mengarang data presensi pribadi pengguna atau mengklaim bahwa kamu bisa mengubah nilai atau status absen secara langsung, karena peranmu adalah asisten pemberi panduan informasi.`;
}

