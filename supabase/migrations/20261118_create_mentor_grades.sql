-- ========================================================
-- MIGRASI TABEL PENILAIAN & SERTIFIKAT MENTOR (MENTOR_GRADES)
-- Jalankan query ini di Supabase SQL Editor
-- ========================================================

CREATE TABLE IF NOT EXISTS public.mentor_grades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  mentor_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  no_sertifikat text,
  start_period text,
  end_period text,
  nilai_kepemimpinan numeric DEFAULT 0,
  nilai_kedisiplinan numeric DEFAULT 0,
  nilai_komunikasi numeric DEFAULT 0,
  nilai_teknis numeric DEFAULT 0,
  nilai_efektivitas numeric DEFAULT 0,
  predikat text,
  catatan text
);

-- Indexing untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_mentor_grades_mentor_id ON public.mentor_grades(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_grades_no_sertifikat ON public.mentor_grades(no_sertifikat);

-- Enable RLS
ALTER TABLE public.mentor_grades ENABLE ROW LEVEL SECURITY;

-- Kebijakan akses (Bisa dibaca oleh semua yang login, modifikasi via server action service role)
DROP POLICY IF EXISTS "Public view mentor_grades" ON public.mentor_grades;
CREATE POLICY "Public view mentor_grades" ON public.mentor_grades FOR SELECT USING (true);
