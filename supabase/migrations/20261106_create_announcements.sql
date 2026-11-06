-- ========================================================
-- MIGRASI TABEL PENGUMUMAN TIM (ANNOUNCEMENTS) MDU APP
-- Jalankan query ini di Supabase SQL Editor jika ingin menggunakan
-- tabel relational murni untuk pengumuman tim.
-- ========================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  mentor_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'info' NOT NULL, -- 'info' | 'penting' | 'evaluasi'
  is_active boolean DEFAULT true NOT NULL
);

-- Indexing untuk pencarian cepat berdasarkan mentor_id
CREATE INDEX IF NOT EXISTS idx_announcements_mentor_id ON public.announcements(mentor_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Kebijakan akses (Bisa dibaca oleh semua yang login, modifikasi via server action service role)
DROP POLICY IF EXISTS "Public view announcements" ON public.announcements;
CREATE POLICY "Public view announcements" ON public.announcements FOR SELECT USING (true);
