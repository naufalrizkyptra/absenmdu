'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { LoadingMDU } from '@/components/LoadingMDU'

export default function SertifikatOJTPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mentorName, setMentorName] = useState<string>('Mentor Pembimbing')
  const [grades, setGrades] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showAspects, setShowAspects] = useState(false)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const router = useRouter()

  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchCertificateData = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        setUser(user)

        // 1. Ambil data profil siswa OJT
        const { data: studentData, error: studentErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (studentErr || !studentData) {
          throw new Error('Gagal memuat profil peserta.')
        }
        setProfile(studentData)

        // 2. Ambil data mentor jika ada
        if (studentData.mentor_id) {
          const { data: mentorData } = await supabase
            .from('users')
            .select('name')
            .eq('id', studentData.mentor_id)
            .single()
          if (mentorData?.name) {
            setMentorName(mentorData.name)
          }
        }

        // 3. Ambil data nilai dan nomor sertifikat dari ojt_grades
        const { data: gradeData, error: gradeErr } = await supabase
          .from('ojt_grades')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (gradeData) {
          setGrades(gradeData)
        }
      } catch (err: any) {
        console.error('Error fetching certificate:', err)
        toast.error(err.message || 'Terjadi kesalahan saat memuat data sertifikat.')
      } finally {
        setLoading(false)
      }
    }

    fetchCertificateData()
  }, [router])

  const getLetterGrade = (avg: number) => {
    if (avg >= 96) return 'A+'
    if (avg >= 91) return 'A'
    if (avg >= 86) return 'A-'
    if (avg >= 81) return 'B+'
    if (avg >= 76) return 'B'
    if (avg >= 71) return 'B-'
    if (avg >= 66) return 'C'
    return 'D'
  }

  const aspectList = [
    { key: 'q1_waktu', label: 'Disiplin Waktu & Kehadiran' },
    { key: 'q2_sikap', label: 'Etika & Sikap Perilaku' },
    { key: 'q3_tanggung_jawab', label: 'Tanggung Jawab Penugasan' },
    { key: 'q4_kehadiran', label: 'Konsistensi Presensi' },
    { key: 'q5_kemampuan', label: 'Kemampuan Kerja & Problem Solving' },
    { key: 'q6_keterampilan', label: 'Keterampilan Teknis & Kreativitas' },
    { key: 'q7_kualitas', label: 'Kualitas Hasil Pekerjaan' },
    { key: 'q8_komunikasi', label: 'Komunikasi & Koordinasi' },
    { key: 'q9_kerjasama', label: 'Kerjasama Tim' },
    { key: 'q10_inisiatif', label: 'Inisiatif & Keaktifan' },
    { key: 'q11_percaya_diri', label: 'Percaya Diri & Kemandirian' },
    { key: 'q12_patuh_aturan', label: 'Kepatuhan Tata Tertib MDU' },
    { key: 'q13_penampilan', label: 'Kerapian & Penampilan' }
  ]

  const calculateAverage = () => {
    if (!grades) return 0
    let total = 0
    let count = 0
    aspectList.forEach(a => {
      if (typeof grades[a.key] === 'number') {
        total += grades[a.key]
        count++
      }
    })
    return count > 0 ? (total / count).toFixed(1) : '0'
  }

  const isCertificateReady = Boolean(
    grades?.no_sertifikat || profile?.status_ojt === 'selesai' || (grades && Object.keys(grades).length > 0)
  )

  const handleDownloadPDF = async () => {
    if (!isCertificateReady) {
      toast.warning('Sertifikat belum dapat diunduh karena periode PKL belum selesai dinilai.')
      return
    }

    setIsDownloading(true)
    const toastId = toast.loading('Menyiapkan dan merender dokumen sertifikat...')

    try {
      // Tunggu DOM siap
      await new Promise(resolve => setTimeout(resolve, 600))

      const pdf = new jsPDF('p', 'pt', 'a4')

      // Halaman 1 (Sertifikat Depan)
      const page1 = document.getElementById('cert-ojt-page-1')
      if (page1) {
        toast.loading('Mencetak halaman sertifikat...', { id: toastId })
        const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true })
        pdf.addImage(canvas1.toDataURL('image/png'), 'PNG', 0, 0, 595.28, 841.89)
      }

      // Halaman 2 (Lembar Penilaian OJT)
      const page2 = document.getElementById('cert-ojt-page-2')
      if (page2) {
        toast.loading('Mencetak lembar nilai rapor...', { id: toastId })
        pdf.addPage('a4', 'portrait')
        const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true })
        pdf.addImage(canvas2.toDataURL('image/png'), 'PNG', 0, 0, 595.28, 841.89)
      }

      const cleanName = (profile?.name || 'Peserta').replace(/\s+/g, '_')
      pdf.save(`Sertifikat_PKL_${cleanName}.pdf`)
      toast.success('Sertifikat berhasil diunduh!', { id: toastId })
    } catch (err: any) {
      console.error('Download PDF error:', err)
      toast.error('Gagal mengunduh sertifikat. Silakan coba kembali.', { id: toastId })
    } finally {
      setIsDownloading(false)
    }
  }

  if (loading) {
    return <LoadingMDU message="Memuat Dokumen Sertifikat..." />
  }

  const avgScore = parseFloat(calculateAverage() as string)
  const letterGrade = getLetterGrade(avgScore)

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-[#f0f4fc] font-sans flex">
        
        {/* =========================================
          1. DESKTOP SIDEBAR (KHUSUS DESKTOP)
          ========================================= */}
        <aside className="w-72 bg-white border-r border-slate-200/80 hidden md:flex flex-col h-screen fixed z-20 shadow-sm p-6">
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 p-0.5 shadow-md flex items-center justify-center">
              <img src="/icon-192.png" alt="MDU Logo" className="w-9 h-9 object-contain rounded-xl" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">MDU Absen</h2>
              <p className="text-[11px] text-slate-500 font-medium">Portal Peserta OJT</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5 flex-1">
            <button
              onClick={() => router.push('/ojt')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span>Beranda</span>
            </button>

            <button
              onClick={() => router.push('/ojt/absen')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
              <span>Presensi Lokasi</span>
            </button>

            <button
              onClick={() => router.push('/ojt/tugas')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              <span>Ruang Tugas</span>
            </button>

            <button
              onClick={() => router.push('/ojt/izin')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span>Pengajuan Izin</span>
            </button>

            {/* 5. Sertifikat PKL (ACTIVE) */}
            <button className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200/70 font-bold text-sm shadow-xs cursor-pointer">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
              <span>Sertifikat PKL</span>
            </button>

            <button
              onClick={() => router.push('/ojt/absen/history')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>Riwayat Absen</span>
            </button>
          </nav>

          <div className="pt-4 border-t border-slate-100">
            <button onClick={() => router.push('/settings')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors mb-2 cursor-pointer">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
              Pengaturan Profil
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer">
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Keluar Sesi
            </button>
          </div>
        </aside>

        {/* =========================================
          2. KONTEN UTAMA DENGAN HEADER GRADASI SERASI
          ========================================= */}
        <main className="flex-1 md:ml-72 flex flex-col h-[100dvh] overflow-y-auto pb-28 md:pb-12">
          
          {/* TOP HEADER SELARAS DENGAN BERANDA & PRESENSI */}
          <div className="relative bg-gradient-to-b from-[#102447] via-[#16356c] to-[#1e4591] text-white pt-4 pb-7 px-4 sm:px-8 rounded-b-[2.5rem] shadow-xl overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 max-w-6xl xl:max-w-7xl mx-auto flex flex-col gap-3.5">
              
              {/* BARIS 1: JAM REALTIME WIB PROMINENT + STATUS SERTIFIKAT */}
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/30 animate-pulse"></span>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <span className="font-mono text-base sm:text-lg font-black text-white tracking-wider leading-none">
                      {currentTime ? currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '00:00:00'} <span className="text-xs font-sans text-cyan-300 font-bold">WIB</span>
                    </span>
                    <span className="text-[11px] text-blue-200/90 font-medium">
                      &bull; {currentTime ? currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </span>
                  </div>
                </div>

                {/* Badge Status Kelulusan */}
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-xs border ${
                    isCertificateReady 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isCertificateReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                    {isCertificateReady ? 'Sertifikat Terbit' : 'Dalam Proses Evaluasi'}
                  </span>
                </div>
              </div>

              {/* BARIS 2: JUDUL & TOMBOL BACK */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/ojt')}
                    className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-all active:scale-95 shadow-sm cursor-pointer"
                    title="Kembali ke Beranda"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight">
                      Sertifikat Magang & PKL
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">
                      Dokumen resmi kelulusan & lembar evaluasi kompetensi PT Mandiri Digital Universe.
                    </p>
                  </div>
                </div>

                {grades?.no_sertifikat && (
                  <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 text-xs font-mono font-bold text-blue-100">
                    <span className="text-blue-300 font-sans">No:</span> {grades.no_sertifikat}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* MAIN BODY CONTAINER */}
          <div className="max-w-6xl xl:max-w-7xl w-full mx-auto px-4 sm:px-8 mt-6 flex-1 flex flex-col gap-6">
            
            {/* PROFILE SUMMARY STRIP: NIP, Instansi, Penempatan, Divisi, Periode, Mentor */}
            <div className="bg-gradient-to-r from-[#111c44] via-[#1a2b6b] to-[#0f172a] rounded-3xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden border border-white/10">
              <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-blue-500/20 blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 p-1 border border-white/20 shadow-inner flex items-center justify-center shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Foto" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl">
                        {profile?.name?.charAt(0) || 'O'}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-blue-200">
                        Peserta PKL
                      </span>
                      <span className="text-xs text-blue-200 font-mono font-bold">NIP: {profile?.nip || '-'}</span>
                    </div>
                    <h2 className="text-lg md:text-2xl font-black text-white mt-0.5 tracking-tight">{profile?.name}</h2>
                    <p className="text-xs text-blue-200">{profile?.asal_sekolah || '-'} &bull; Divisi {profile?.divisi || '-'}</p>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 text-xs flex flex-col gap-1 sm:text-right shrink-0">
                  <span className="text-[10px] text-blue-300 uppercase font-semibold">Mentor Pembimbing</span>
                  <span className="font-extrabold text-white text-sm">{mentorName}</span>
                  <span className="text-[11px] text-blue-200">Kantor {profile?.asal_kantor || 'Jatiwaringin'}</span>
                </div>
              </div>

              {/* BADGES METADATA 4 KOLOM */}
              <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-blue-300 block text-[10px] uppercase font-bold">Instansi Asal</span>
                  <span className="font-bold text-white truncate block mt-0.5" title={profile?.asal_sekolah}>{profile?.asal_sekolah || '-'}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-blue-300 block text-[10px] uppercase font-bold">Penempatan</span>
                  <span className="font-bold text-white truncate block mt-0.5">{profile?.asal_kantor || 'Jatiwaringin'}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-blue-300 block text-[10px] uppercase font-bold">Divisi Kerja</span>
                  <span className="font-bold text-white truncate block mt-0.5">{profile?.divisi || '-'}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-blue-300 block text-[10px] uppercase font-bold">Periode PKL</span>
                  <span className="font-bold text-white truncate block mt-0.5">
                    {profile?.start_period && profile?.end_period ? `${profile.start_period} s/d ${profile.end_period}` : 'Tersedia'}
                  </span>
                </div>
              </div>
            </div>

            {/* STATUS KONDISI SERTIFIKAT */}
            {isCertificateReady ? (
              /* =========================================
                 KONDISI 1: SERTIFIKAT SUDAH TERBIT
                 TAMPILAN 2-KOLOM MODERN DI DESKTOP
                 ========================================= */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* KOLOM KIRI (7 Kolom): PREVIEW MOCKUP SERTIFIKAT & CTA DOWNLOAD */}
                <div className="lg:col-span-7 flex flex-col gap-5">
                  <div className="bg-white rounded-3xl p-5 md:p-7 shadow-sm border border-slate-200/80">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px] uppercase">
                            Terverifikasi Resmi
                          </span>
                          {grades?.no_sertifikat && (
                            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              No: {grades.no_sertifikat}
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Sertifikat Kelulusan OJT</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Dokumen kelulusan resmi telah selesai diverifikasi oleh mentor pembimbing.
                        </p>
                      </div>

                      {avgScore > 0 && (
                        <div className="flex items-center gap-3 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-4 py-2.5 shrink-0">
                          <div>
                            <span className="text-[10px] text-amber-700 uppercase font-black block">Nilai Akhir</span>
                            <span className="text-2xl font-black text-amber-900 font-mono">{avgScore}</span>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                            {letterGrade}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* VISUAL CERTIFICATE MOCKUP */}
                    <div className="mt-5 bg-gradient-to-br from-slate-900 via-[#132247] to-[#1e1b4b] rounded-2xl p-5 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
                      <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
                      
                      <div className="border border-white/20 rounded-xl p-5 md:p-8 bg-white/5 backdrop-blur-sm flex flex-col items-center text-center relative z-10">
                        <div className="w-13 h-13 rounded-2xl bg-white p-1.5 shadow-md mb-3 flex items-center justify-center">
                          <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-full h-full object-contain" />
                        </div>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-blue-300">
                          PT MANDIRI DIGITAL UNIVERSE
                        </p>
                        <h4 className="text-lg md:text-2xl font-extrabold tracking-tight mt-1 text-white">
                          SERTIFIKAT PRAKTIK KERJA LAPANGAN
                        </h4>
                        {grades?.no_sertifikat && (
                          <p className="text-xs font-mono text-blue-200 mt-1">
                            Nomor: {grades.no_sertifikat}
                          </p>
                        )}
                        <div className="my-4 w-20 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
                        <p className="text-xs text-slate-300">Diberikan kepada:</p>
                        <p className="text-2xl md:text-3xl font-black text-amber-300 font-serif italic mt-1.5 tracking-wide">
                          {profile?.name}
                        </p>
                        <p className="text-xs text-blue-100 mt-1.5">
                          Sebagai Peserta Magang / OJT Divisi <strong className="text-white">{profile?.divisi || 'Multimedia'}</strong>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-3 max-w-md leading-relaxed">
                          Telah menyelesaikan seluruh rangkaian program Praktik Kerja Lapangan dengan dedikasi dan pencapaian kompetensi yang sangat baik.
                        </p>
                      </div>
                    </div>

                    {/* DOWNLOAD CTA BUTTON */}
                    <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
                      >
                        {isDownloading ? (
                          <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                            </svg>
                            <span>Mencetak Dokumen PDF...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Unduh Sertifikat PDF Resmi</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </div>

                {/* KOLOM KANAN (5 Kolom): LEMBAR PENILAIAN 13 ASPEK KOMPETENSI */}
                <div className="lg:col-span-5 flex flex-col gap-5">
                  <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200/80">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900 tracking-tight">Lembar Penilaian Kinerja</h4>
                        <p className="text-xs text-slate-500">Evaluasi 13 aspek kompetensi selama magang</p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-xl">
                        13 Aspek Terisi
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                      {aspectList.map((aspect, idx) => {
                        const score = grades?.[aspect.key] ?? 0
                        const p = getLetterGrade(score)
                        return (
                          <div key={aspect.key} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 transition-colors rounded-xl px-3.5 py-2.5 border border-slate-100">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-semibold text-slate-700 truncate">{aspect.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-extrabold text-slate-900 font-mono">{score}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono">
                                {p}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* FOOTER RINGKASAN RATA-RATA */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Rata-Rata Nilai Akhir:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black font-mono text-amber-600">{avgScore}</span>
                        <span className="text-xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          Predikat {letterGrade}
                        </span>
                      </div>
                    </div>

                    {/* CATATAN RESMI */}
                    <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100 leading-relaxed text-center">
                      Dokumen ini diterbitkan secara resmi oleh PT Mandiri Digital Universe melalui sistem evaluasi mentor pembimbing OJT.
                    </p>
                  </div>
                </div>

              </div>
            ) : (
              /* =========================================
                 KONDISI 2: PERIODE MASIH BERJALAN
                 ========================================= */
              <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200/80 flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 mb-4 shadow-inner">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                <span className="px-3.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold uppercase tracking-wider mb-2">
                  Periode PKL Sedang Berlangsung
                </span>

                <h3 className="text-xl md:text-2xl font-black text-slate-900 max-w-md">
                  Sertifikat Belum Diterbitkan
                </h3>
                <p className="text-xs md:text-sm text-slate-500 mt-2 max-w-lg leading-relaxed">
                  Dokumen sertifikat resmi dan lembar penilaian rapor akan secara otomatis tersedia dan dapat Anda unduh langsung di halaman ini setelah masa penugasan PKL Anda dinyatakan selesai dan diverifikasi oleh mentor pembimbing.
                </p>

                <div className="w-full max-w-md mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left flex flex-col gap-2.5 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-slate-500">Status Akun Peserta:</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> OJT Aktif
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-slate-500">Mentor Pembimbing:</span>
                    <span className="font-bold text-slate-800">{mentorName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Estimasi Selesai:</span>
                    <span className="font-bold text-indigo-700">{profile?.end_period || 'Sesuai Jadwal PKL'}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
                  <button
                    onClick={() => router.push('/ojt')}
                    className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer"
                  >
                    Kembali ke Beranda OJT
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* =========================================
            3. FLOATING BOTTOM NAVIGATION (KHUSUS MOBILE)
            ========================================= */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
            <div className="relative backdrop-blur-xl bg-white/95 border-t border-slate-200/80 shadow-[0_-8px_25px_rgba(0,0,0,0.12)] px-3 py-2 flex items-center justify-around text-slate-700">
              
              {/* Beranda */}
              <button
                onClick={() => router.push('/ojt')}
                className="flex flex-col items-center gap-1 py-1 px-2 flex-1 text-slate-500 hover:text-slate-800 group"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold">Beranda</span>
              </button>

              {/* Riwayat */}
              <button
                onClick={() => router.push('/ojt/absen/history')}
                className="flex flex-col items-center gap-1 py-1 px-2 flex-1 text-slate-500 hover:text-slate-800 group"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold">Riwayat</span>
              </button>

              {/* Center Button: Presensi */}
              <div className="relative -top-5 flex items-center justify-center px-1">
                <button
                  onClick={() => router.push('/ojt/absen')}
                  className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-xl shadow-blue-500/40 flex items-center justify-center border-4 border-white active:scale-95 transition-all cursor-pointer ring-4 ring-blue-500/20"
                  title="Buka Presensi Lokasi"
                >
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                </button>
              </div>

              {/* Sertifikat (ACTIVE) */}
              <button
                onClick={() => router.push('/ojt/sertifikat')}
                className="flex flex-col items-center gap-1 py-1 px-2 flex-1 text-amber-500 group"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                  </svg>
                </div>
                <span className="text-[10px] font-black text-amber-600">Sertifikat</span>
              </button>

              {/* Profil */}
              <button
                onClick={() => router.push('/settings')}
                className="flex flex-col items-center gap-1 py-1 px-2 flex-1 text-slate-500 hover:text-slate-800 group"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold">Profil</span>
              </button>

            </div>
          </div>

        </main>

        {/* TEMPLATE ELEMEN PDF TERSEMBUNYI (UNTUK DIRENDER KE HTML2CANVAS & JSPDF) */}
        <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', opacity: 0, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            
            {/* Halaman 1: Sertifikat Depan */}
            <div id="cert-ojt-page-1" style={{ width: '794px', height: '1123px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              <img src="/template-portrait-front.png" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -1 }} alt="Background" crossOrigin="anonymous" />
              <div style={{ position: 'absolute', top: '265px', left: 0, width: '100%', textAlign: 'center' }}>
                <p style={{ fontSize: '1.25rem', fontFamily: 'sans-serif', margin: 0, color: '#111827', fontWeight: 'bold' }}>
                  {grades?.no_sertifikat || '___/MDU/OJT/____'}
                </p>
              </div>
              <div style={{ position: 'absolute', top: '400px', left: 0, width: '100%', textAlign: 'center' }}>
                <h2 style={{ fontSize: '3.2rem', fontFamily: 'serif', fontStyle: 'italic', color: '#111827', margin: 0 }}>
                  {profile?.name}
                </h2>
              </div>
              <div style={{ position: 'absolute', top: '500px', left: 0, width: '100%', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.6rem', fontFamily: 'sans-serif', fontWeight: 900, color: '#111827', margin: 0 }}>
                  {profile?.divisi || 'Multimedia'}
                </h3>
              </div>
              <div style={{ position: 'absolute', top: '600px', left: 0, width: '100%', textAlign: 'center' }}>
                <p style={{ fontSize: '1.4rem', fontFamily: 'sans-serif', color: '#111827', margin: 0, fontWeight: 500 }}>
                  Terhitung mulai tanggal {profile?.start_period || '-'} sampai dengan {profile?.end_period || '-'}
                </p>
              </div>
            </div>

            {/* Halaman 2: Lembar Penilaian Rapor OJT */}
            <div id="cert-ojt-page-2" style={{ width: '794px', height: '1123px', backgroundColor: '#ffffff', position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', fontFamily: 'sans-serif', color: '#000000' }}>
              <div style={{ position: 'relative', padding: '120px 95px', flex: 1, display: 'flex', flexDirection: 'column', color: '#000000' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F3357', textTransform: 'uppercase', marginBottom: '1rem' }}>
                  LEMBAR PENILAIAN OJT
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #0F3357', marginBottom: '1rem', fontSize: '0.75rem' }}>
                  <tbody>
                    {[
                      ['Nama', profile?.name || '-'],
                      ['NIP', profile?.nip || '-'],
                      ['Sekolah / Instansi', profile?.asal_sekolah || '-'],
                      ['Divisi / Posisi', profile?.divisi || '-'],
                      ['Periode', `${profile?.start_period || '-'} s/d ${profile?.end_period || '-'}`],
                      ['Penempatan', profile?.asal_kantor || '-']
                    ].map((row, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #0F3357', padding: '0.35rem 0.6rem', fontWeight: 700, width: '35%', backgroundColor: '#f8fafc' }}>{row[0]}</td>
                        <td style={{ border: '1px solid #0F3357', padding: '0.35rem 0.6rem', fontWeight: 700 }}>{row[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #0F3357', fontSize: '0.7rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F3357', color: '#FCE91A' }}>
                      <th style={{ border: '1px solid #0F3357', padding: '0.4rem' }}>Aspek Penilaian</th>
                      <th style={{ border: '1px solid #0F3357', padding: '0.4rem', textAlign: 'center', width: '70px' }}>Nilai</th>
                      <th style={{ border: '1px solid #0F3357', padding: '0.4rem', textAlign: 'center', width: '70px' }}>Predikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aspectList.map((aspect, i) => {
                      const score = grades?.[aspect.key] ?? 0
                      return (
                        <tr key={aspect.key} style={{ backgroundColor: i % 2 === 0 ? '#f0f5fa' : 'white' }}>
                          <td style={{ border: '1px solid #0F3357', padding: '0.3rem 0.5rem' }}>{aspect.label}</td>
                          <td style={{ border: '1px solid #0F3357', padding: '0.3rem', textAlign: 'center', fontWeight: 700 }}>{score}</td>
                          <td style={{ border: '1px solid #0F3357', padding: '0.3rem', textAlign: 'center', fontWeight: 700 }}>{getLetterGrade(score)}</td>
                        </tr>
                      )
                    })}
                    <tr style={{ backgroundColor: '#FCE91A', color: '#0F3357', fontWeight: 800 }}>
                      <td style={{ border: '1px solid #0F3357', padding: '0.4rem 0.5rem' }}>RATA-RATA AKHIR</td>
                      <td style={{ border: '1px solid #0F3357', padding: '0.4rem', textAlign: 'center' }}>{avgScore}</td>
                      <td style={{ border: '1px solid #0F3357', padding: '0.4rem', textAlign: 'center' }}>{letterGrade}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
