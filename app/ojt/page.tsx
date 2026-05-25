'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'

export default function BerandaOJT() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mentorName, setMentorName] = useState<string>('Memuat...')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      // 1. Tarik Data Anak OJT
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (userData) {
        setProfile(userData)
        
        // 2. Tarik Nama Mentor Berdasarkan mentor_id
        if (userData.mentor_id) {
          const { data: mentorData } = await supabase
            .from('users')
            .select('name')
            .eq('id', userData.mentor_id)
            .single()
            
          if (mentorData) {
            setMentorName(mentorData.name)
          } else {
            setMentorName('Belum Ditugaskan')
          }
        } else {
          setMentorName('Belum Ditugaskan')
        }
      }
      setLoading(false)
    }

    fetchUserData()
  }, [router])

  // Rumus hitung sisa hari untuk tampilan informasi
  const calculateRemainingDays = (endDateStr: string) => {
    if (!endDateStr) return 0
    const end = new Date(endDateStr)
    const today = new Date()
    end.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    const diffTime = end.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8faff]">Memuat Dasbor Peserta...</div>

  return (
    <div className="min-h-[100dvh] bg-[#f8faff] flex flex-col md:flex-row font-sans">
      <Toaster position="top-center" richColors />
      
      {/* =========================================
          1. SIDEBAR (KHUSUS DESKTOP) 
          ========================================= */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col shadow-sm z-10 shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center">
            <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-12 h-12 object-contain" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Portal</span>
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu Utama</p>
          <nav className="space-y-1.5">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-blue-600 text-white shadow-md shadow-blue-600/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span className="font-medium">Beranda</span>
            </button>
            <button onClick={() => router.push('/ojt/absen')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              {/* IKON SIDIK JARI */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
              <span className="font-medium">Presensi Lokasi</span>
            </button>
            <button onClick={() => router.push('/ojt/tugas')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              <span className="font-medium">Daftar Tugas</span>
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 mb-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#1e1b4b] flex items-center justify-center text-sm font-bold text-white">
                {profile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{profile?.name || user?.email}</p>
              <p className="text-xs text-slate-500">{profile?.divisi || 'Peserta OJT'}</p>
            </div>
          </div>
          <button onClick={() => router.push('/settings')} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-2 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Pengaturan Akun
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:text-red-700 transition-colors font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Keluar Sesi
          </button>
        </div>
      </aside>

      {/* =========================================
          2. MAIN CONTENT AREA 
          ========================================= */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        <div className="flex-1 overflow-y-auto pb-24 md:pb-8">
          
          {/* HEADER & PROFILE SECTION */}
          <div className="bg-[#1e1b4b] pt-8 md:pt-10 pb-20 px-6 md:px-10 rounded-b-[40px] md:rounded-b-none md:mx-6 md:mt-6 md:rounded-3xl shadow-lg relative overflow-hidden">
            {/* Dekorasi Background */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -left-10 bottom-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>

            <div className="relative z-10 flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                {/* Logo MDU Khusus Mobile di Header */}
                <div className="md:hidden bg-white p-1 rounded-xl">
                  <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <h2 className="text-blue-200 text-sm md:text-base font-medium tracking-wide">Selamat Datang,</h2>
                  <h1 className="text-white text-2xl md:text-3xl font-bold tracking-tight">{profile?.name}</h1>
                </div>
              </div>
              <button onClick={() => router.push('/settings')} className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md hidden md:flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </button>
            </div>

            {/* KARTU IDENTITAS DIGITAL */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-20 h-20 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-inner overflow-hidden border-4 border-slate-50">
                {profile?.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Foto Profil" />
                ) : profile?.name?.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-[#1e1b4b] font-black text-xl md:text-2xl leading-tight">{profile?.nip || 'Belum Ada NIP'}</p>
                <p className="text-slate-500 text-sm md:text-base font-bold uppercase tracking-wider mt-1">{profile?.divisi}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <span className="px-3 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] md:text-xs font-black border border-emerald-100 uppercase tracking-wide">
                    {profile?.asal_kantor}
                  </span>
                  <span className="px-3 py-1 rounded-md bg-slate-50 text-slate-500 text-[10px] md:text-xs font-bold border border-slate-100 uppercase tracking-wide">
                    {profile?.asal_sekolah}
                  </span>
                </div>
              </div>
              <div className="hidden sm:flex w-16 h-16 border-2 border-slate-100 rounded-xl items-center justify-center shrink-0 bg-slate-50">
                 <svg className="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h4v4H3V3zm0 7h4v4H3v-4zm0 7h4v4H3v-4zm7-14h4v4h-4V3zm0 7h4v4h-4v-4zm0 7h4v4h-4v-4zm7-14h4v4h-4V3zm0 7h4v4h-4v-4zm0 7h4v4h-4v-4zM5 5v0h0V5zm0 7v0h0v0zm0 7v0h0v0zm7-14v0h0V5zm0 7v0h0v0zm0 7v0h0v0zm7-14v0h0V5zm0 7v0h0v0zm0 7v0h0v0z" /></svg>
              </div>
            </div>
          </div>

          {/* INFORMASI PENUGASAN */}
          <div className="px-6 md:px-10 -mt-8 relative z-20">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 md:p-5 text-white shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 md:p-3 rounded-lg md:rounded-xl">
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-[10px] md:text-xs uppercase font-bold text-blue-100 leading-none mb-1">Sisa Masa Magang</p>
                  <p className="text-lg md:text-xl font-black leading-none">{calculateRemainingDays(profile?.end_period)} Hari Lagi</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] md:text-xs uppercase font-bold text-blue-100 leading-none mb-1">Mentor Pembimbing</p>
                <p className="text-sm md:text-base font-bold leading-none">{mentorName}</p>
              </div>
            </div>
          </div>

          {/* MENU UTAMA (GRID STYLE) */}
          <div className="px-6 md:px-10 mt-10">
            <h3 className="text-slate-800 font-bold text-lg mb-4 flex items-center gap-2">
              Layanan Peserta OJT
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {/* MENU 1: ABSENSI */}
              <button onClick={() => router.push('/ojt/absen')} className="bg-white p-5 md:p-6 rounded-[32px] md:rounded-[40px] shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:-translate-y-1 hover:shadow-md transition-all">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
                  {/* IKON SIDIK JARI */}
                  <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                </div>
                <span className="text-[#1e1b4b] font-bold text-sm md:text-base">Presensi Lokasi</span>
              </button>

              {/* MENU 2: TUGAS BOOST */}
              <button onClick={() => router.push('/ojt/tugas')} className="bg-white p-5 md:p-6 rounded-[32px] md:rounded-[40px] shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:-translate-y-1 hover:shadow-md transition-all">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-rose-600 group-hover:text-white transition-colors shadow-sm">
                  <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="text-[#1e1b4b] font-bold text-sm md:text-base">Tugas Boost Post</span>
              </button>

              {/* MENU 3: LOGBOOK */}
              <button className="bg-white p-5 md:p-6 rounded-[32px] md:rounded-[40px] shadow-sm border border-slate-100 flex flex-col items-center text-center group transition-all opacity-60 cursor-not-allowed">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="text-[#1e1b4b] font-bold text-sm md:text-base">Laporan Harian</span>
                <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full mt-1">Segera Hadir</span>
              </button>

              {/* MENU 4: HASIL EVALUASI */}
              <button className="bg-white p-5 md:p-6 rounded-[32px] md:rounded-[40px] shadow-sm border border-slate-100 flex flex-col items-center text-center group transition-all opacity-60 cursor-not-allowed">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-[#1e1b4b] font-bold text-sm md:text-base">Hasil Evaluasi</span>
                <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full mt-1">Segera Hadir</span>
              </button>
            </div>
          </div>

          {/* PENGUMUMAN / INFO TERBARU */}
          <div className="px-6 md:px-10 mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 font-bold text-lg">Pusat Informasi</h3>
            </div>
            <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                   <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
                <div>
                  <h4 className="text-sm md:text-base font-bold text-slate-800">Petunjuk Teknis Pengumpulan Tugas</h4>
                  <p className="text-xs md:text-sm text-slate-500 mt-1 leading-relaxed">Pastikan Anda menggunakan tautan Google Drive dengan akses publik (Anyone with the link) untuk melampirkan bukti foto kolase tugas harian Anda.</p>
                  <p className="text-[10px] md:text-xs text-blue-500 mt-2.5 font-bold uppercase tracking-widest">Terbit: Hari Ini</p>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER LOGOUT (MOBILE ONLY) */}
          <div className="px-6 mt-8 md:hidden">
             <button 
               onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
               className="w-full py-4 rounded-2xl bg-rose-50 text-rose-600 font-bold text-sm border border-rose-100 flex items-center justify-center gap-2 active:bg-rose-100 transition-all"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
               Keluar dari Sesi Magang
             </button>
          </div>

        </div>
      </main>

      {/* =========================================
          3. BOTTOM NAVIGATION (KHUSUS MOBILE) 
          ========================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 pb-safe pt-2 px-6 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex justify-between items-center pb-4">
          <button className="flex flex-col items-center p-2 flex-1 transition-colors text-blue-600">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-[10px] font-semibold">Beranda</span>
          </button>
          
          <button onClick={() => router.push('/ojt/absen')} className="flex flex-col items-center p-2 flex-1 transition-colors text-slate-400 hover:text-slate-700">
            {/* IKON SIDIK JARI */}
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
            <span className="text-[10px] font-semibold">Absensi</span>
          </button>
          
          <button onClick={() => router.push('/settings')} className="flex flex-col items-center p-2 flex-1 transition-colors text-slate-400 hover:text-slate-700">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[10px] font-semibold">Profil</span>
          </button>
        </div>
      </div>

    </div>
  )
}