'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import Swal from 'sweetalert2'
import { LoadingMDU } from '@/components/LoadingMDU'
import { getActiveAnnouncementForOJT } from '../mentor/actions'

export default function BerandaOJT() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mentorName, setMentorName] = useState<string>('Memuat...')
  const [loading, setLoading] = useState(true)
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
  const [attendanceStats, setAttendanceStats] = useState({ total: 0, hadir: 0, tepatWaktu: 0, izinSakit: 0 })
  const [attendanceStatsMonth, setAttendanceStatsMonth] = useState({
    totalDays: 0, hadir: 0, onTime: 0, late: 0, pct: 0, qual: ''
  })
  const [hasCertificate, setHasCertificate] = useState(false)
  const [showMentorModal, setShowMentorModal] = useState(false)
  const [showJurnalModal, setShowJurnalModal] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [activeAnnouncement, setActiveAnnouncement] = useState<any>(null)
  const [notifPermission, setNotifPermission] = useState<string>('default')
  const router = useRouter()

  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Check saved theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('mdu_ojt_theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission)
    }
  }, [])

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission()
        setNotifPermission(perm)
        if (perm === 'granted') {
          toast.success('Pengingat absen otomatis berhasil diaktifkan!')
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SHOW_NOTIFICATION',
              title: 'Pengingat Absen MDU Aktif',
              options: {
                body: 'Sistem akan mengingatkan Anda saat jam masuk (08.00) dan jam pulang (15.00 WIB).',
                data: { url: '/ojt/absen' }
              }
            })
          }
        } else if (perm === 'denied') {
          toast.error('Izin notifikasi ditolak di browser Anda.')
        }
      } catch (err) {
        console.error(err)
      }
    } else {
      toast.error('Perangkat Anda tidak mendukung Web Notification.')
    }
  }

  const toggleTheme = () => {
    const nextTheme = !isDarkMode
    setIsDarkMode(nextTheme)
    localStorage.setItem('mdu_ojt_theme', nextTheme ? 'dark' : 'light')
    toast.success(nextTheme ? 'Mode Gelap diaktifkan' : 'Mode Terang diaktifkan')
  }

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Keluar Sesi?',
      text: 'Apakah kamu yakin ingin keluar dari akun?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal',
      background: isDarkMode ? '#131f3d' : '#ffffff',
      color: isDarkMode ? '#ffffff' : '#1e293b',
    })
    if (result.isConfirmed) {
      await supabase.auth.signOut()
      router.push('/login')
    }
  }

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

          // Tarik Pengumuman Aktif dari Mentor (Cek apakah sudah pernah di-dismiss oleh OJT ini)
          const annRes = await getActiveAnnouncementForOJT(userData.mentor_id)
          if (annRes.success && annRes.announcement) {
            const dismissedId = localStorage.getItem(`mdu_dismissed_announce_${user.id}`)
            if (dismissedId !== annRes.announcement.id) {
              setActiveAnnouncement(annRes.announcement)
            }
          }
        } else {
          setMentorName('Belum Ditugaskan')
        }
      }

      // 3. Cek Status Sertifikat / Nilai OJT
      const { data: certGrade } = await supabase
        .from('ojt_grades')
        .select('id, no_sertifikat')
        .eq('user_id', user.id)
        .maybeSingle()

      if (certGrade || userData?.status_ojt === 'selesai') {
        setHasCertificate(true)
      }

      // 4. Tarik Data Absen Hari Ini
      const today = new Date().toLocaleDateString('en-CA')
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('check_in_time, check_out_time, status')
        .eq('user_id', user.id)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .maybeSingle()
      if (todayAttendance) setTodayRecord(todayAttendance)

      // 5. Tarik Riwayat Absen 7 Hari
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const formattedSevenDaysAgo = sevenDaysAgo.toLocaleDateString('en-CA')

      const { data: historyData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('check_in_time', `${formattedSevenDaysAgo}T00:00:00`)
        .order('check_in_time', { ascending: false })
        .limit(7)

      if (historyData) setAttendanceHistory(historyData)

      // 6. Tarik Seluruh Data Kehadiran untuk Statistik
      const { data: allAttendance } = await supabase
        .from('attendance')
        .select('check_in_time, status')
        .eq('user_id', user.id)

      if (allAttendance && allAttendance.length > 0) {
        const total = allAttendance.length
        const hadir = allAttendance.filter((a: any) =>
          a.status === 'Hadir' || a.status === 'Terlambat'
        ).length
        const tepatWaktu = allAttendance.filter((a: any) => a.status === 'Hadir').length
        const izinSakit = allAttendance.filter((a: any) =>
          a.status === 'Izin' || a.status === 'Sakit'
        ).length
        setAttendanceStats({ total, hadir, tepatWaktu, izinSakit })
      }

      // 7. Statistik Kehadiran BULAN INI
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const daysPassed = now.getDate()

      const { data: monthlyData } = await supabase
        .from('attendance')
        .select('check_in_time, status')
        .eq('user_id', user.id)
        .gte('check_in_time', startOfMonth.toISOString())
        .lt('check_in_time', startOfNextMonth.toISOString())

      if (monthlyData) {
        const hadirBulanIni = monthlyData.filter((a: any) =>
          a.status === 'Hadir' || a.status === 'Terlambat'
        ).length
        const onTimeBulanIni = monthlyData.filter((a: any) => a.status === 'Hadir').length
        const lateBulanIni = monthlyData.filter((a: any) => a.status === 'Terlambat').length
        const izinSakitBulanIni = monthlyData.filter((a: any) =>
          a.status === 'Izin' || a.status === 'Sakit'
        ).length
        const totalHadir = hadirBulanIni + izinSakitBulanIni
        const pct = daysPassed > 0 ? Math.round((totalHadir / daysPassed) * 100) : 0
        const qual = pct > 90 ? 'Sangat Baik' : pct >= 75 ? 'Baik' : 'Perlu Perbaikan'
        setAttendanceStatsMonth({
          totalDays: daysPassed,
          hadir: hadirBulanIni,
          onTime: onTimeBulanIni,
          late: lateBulanIni,
          pct,
          qual,
        })
      }

      setLoading(false)
    }

    fetchUserData()
  }, [router])

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {loading && <LoadingMDU message="Memuat Dasbor Peserta OJT..." />}

      <div className={`min-h-[100dvh] flex flex-col md:flex-row font-sans transition-colors duration-300 ${
        isDarkMode ? 'bg-[#0a1128] text-slate-100' : 'bg-[#f0f4fc] text-slate-800'
      }`}>
        <Toaster position="top-center" richColors theme={isDarkMode ? 'dark' : 'light'} />

        {/* =========================================
          1. DESKTOP SIDEBAR (KHUSUS DESKTOP)
          ========================================= */}
        <aside className={`w-72 border-r p-6 shrink-0 shadow-sm transition-colors duration-300 hidden md:flex flex-col h-screen fixed z-20 ${
          isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 p-0.5 shadow-md flex items-center justify-center">
              <img src="/icon-192.png" alt="MDU Logo" className="w-9 h-9 object-contain rounded-xl" />
            </div>
            <div>
              <h2 className={`text-base font-extrabold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>MDU Absen</h2>
              <p className="text-[11px] text-slate-400 font-medium">Portal Peserta OJT</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5 flex-1">
            <button className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm ${
              isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-700'
            }`}>
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span>Beranda</span>
            </button>
            <button onClick={() => router.push('/ojt/absen')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${
              isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
              <span>Presensi Lokasi</span>
            </button>
            <button onClick={() => router.push('/ojt/tugas')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${
              isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              <span>Ruang Tugas</span>
            </button>
            <button onClick={() => router.push('/ojt/izin')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${
              isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span>Pengajuan Izin</span>
            </button>
            <button onClick={() => router.push('/ojt/sertifikat')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-colors ${
              isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100'
            }`}>
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
              <span>Sertifikat PKL</span>
            </button>
            <button onClick={() => router.push('/ojt/absen/history')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${
              isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>Riwayat Absen</span>
            </button>
          </nav>

          <div className={`pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <button onClick={toggleTheme} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors mb-2 ${
              isDarkMode ? 'text-amber-300 bg-slate-800/80 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}>
              <span className="flex items-center gap-2">
                {isDarkMode ? (
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
                )}
                <span>Mode {isDarkMode ? 'Gelap' : 'Terang'}</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isDarkMode ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-200 text-slate-600'}`}>
                {isDarkMode ? 'DARK' : 'LIGHT'}
              </span>
            </button>

            <button onClick={() => router.push('/settings')} className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors mb-2 ${
              isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}>
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
              Pengaturan Profil
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors">
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Keluar Sesi
            </button>
          </div>
        </aside>

        {/* =========================================
          2. MAIN CONTENT AREA (MOBILE & DESKTOP)
          ========================================= */}
        <main className="flex-1 md:ml-72 flex flex-col h-[100dvh] overflow-y-auto pb-28 md:pb-10">

          {/* =========================================
            TOP HEADER AREA (Dengan Jam Realtime di Paling Atas & Light/Dark Mode)
            ========================================= */}
          <div className="relative bg-gradient-to-b from-[#102447] via-[#16356c] to-[#1e4591] text-white pt-4 pb-7 px-4 sm:px-6 rounded-b-[2.5rem] shadow-xl overflow-hidden">
            {/* Background Glow Orbs */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -left-20 top-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 max-w-6xl xl:max-w-7xl mx-auto flex flex-col gap-4">
              
              {/* ROW 1 (PALING ATAS): JAM REALTIME WIB PROMINENT + TOGGLE LIGHT/DARK + NOTIFIKASI */}
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                {/* Jam Realtime & Tanggal di Top Header agar Sangat Mudah Dilihat & Di-notice */}
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

                {/* Light/Dark Mode Pill Button & Bell Icon */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-xs font-bold text-white transition-all active:scale-95 shadow-xs"
                    title="Beralih Tema Terang / Gelap"
                  >
                    {isDarkMode ? (
                      <>
                        <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[11px] font-extrabold text-amber-200">Terang</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-cyan-200" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                        </svg>
                        <span className="text-[11px] font-extrabold text-cyan-100">Gelap</span>
                      </>
                    )}
                  </button>

                  {/* Bell Notification */}
                  <button
                    onClick={() => toast.info('Tidak ada pemberitahuan baru saat ini.')}
                    className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/25 active:scale-95 transition-all shadow-xs relative"
                    title="Pemberitahuan"
                  >
                    <svg className="w-4 h-4 text-blue-100" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3 3h6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 absolute top-1.5 right-1.5 ring-2 ring-[#16356c] animate-pulse"></span>
                  </button>

                  {/* Tombol Logout (Khusus Mobile) */}
                  <button
                    onClick={handleLogout}
                    className="md:hidden w-8 h-8 rounded-full bg-rose-500/20 hover:bg-rose-500/35 active:scale-95 border border-rose-400/30 flex items-center justify-center text-rose-200 hover:text-white transition-all shadow-xs cursor-pointer"
                    title="Keluar Sesi"
                    aria-label="Keluar Sesi"
                  >
                    <svg className="w-4 h-4 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ROW 2: Profile Avatar & Greeting */}
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 p-0.5 shadow-lg shadow-blue-900/40 shrink-0">
                  <div className="w-full h-full rounded-full bg-[#12244a] flex items-center justify-center overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-black text-lg">
                        {profile?.name?.charAt(0) || 'O'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight truncate">
                    Halo {profile?.name?.split(' ')[0] || 'Peserta'},
                  </h1>
                  <p className="text-xs text-blue-200/90 font-medium truncate">
                    Peserta PKL &bull; {profile?.divisi || 'Multimedia'} &bull; {profile?.asal_sekolah || '-'}
                  </p>
                </div>
              </div>

              {/* =========================================
                IDENTITY CARD: NIP, Instansi, Penempatan, Divisi & Mentor
                ========================================= */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3.5 sm:p-4 text-xs text-white shadow-inner">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider block">NIP Peserta</span>
                    <strong className="text-white font-mono text-xs sm:text-sm block truncate">{profile?.nip || '-'}</strong>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider block">Instansi Asal</span>
                    <strong className="text-white text-xs sm:text-sm block truncate" title={profile?.asal_sekolah}>{profile?.asal_sekolah || '-'}</strong>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider block">Penempatan</span>
                    <strong className="text-white text-xs sm:text-sm block truncate">{profile?.asal_kantor || 'Jatiwaringin'}</strong>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider block">Divisi Kerja</span>
                    <strong className="text-white text-xs sm:text-sm block truncate">{profile?.divisi || 'Peserta OJT'}</strong>
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-100">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Mentor Pembimbing: <strong className="text-white font-bold">{mentorName}</strong></span>
                  </div>
                  <span className="text-[10px] bg-white/15 px-2.5 py-0.5 rounded-full font-semibold">
                    {profile?.status_ojt === 'selesai' ? 'Alumni PKL' : 'OJT Aktif'}
                  </span>
                </div>
              </div>

              {/* =========================================
                HERO CARD: STATUS PRESENSI HARI INI
                ========================================= */}
              <div className="bg-gradient-to-r from-[#0d1e40] via-[#142852] to-[#0a1835] rounded-3xl p-5 sm:p-6 text-white shadow-2xl border border-white/15 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-44 h-44 bg-blue-500/15 rounded-full blur-2xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-xs uppercase font-extrabold tracking-wider text-blue-200">
                        Presensi Harian OJT
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-black text-white">
                      {todayRecord?.check_in_time ? (
                        todayRecord?.check_out_time ? 'Sudah Presensi Lengkap' : 'Sudah Masuk • Siap Pulang'
                      ) : (
                        'Belum Melakukan Presensi Hari Ini'
                      )}
                    </h3>

                    {/* Ringkasan Jam Masuk & Pulang */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
                      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                        <span className="text-blue-300">Masuk:</span>
                        <strong className="text-white font-mono">
                          {todayRecord?.check_in_time ? formatTime(todayRecord.check_in_time) : '--:--'}
                        </strong>
                      </div>
                      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                        <span className="text-blue-300">Pulang:</span>
                        <strong className="text-white font-mono">
                          {todayRecord?.check_out_time ? formatTime(todayRecord.check_out_time) : '--:--'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Action CTA Button */}
                  <div className="shrink-0">
                    <button
                      onClick={() => router.push('/ojt/absen')}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <span>Presensi Sekarang</span>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* =========================================
            BANNER PENGINGAT ABSEN (PAGI & PULANG 15.00 WIB)
            ========================================= */}
          {(() => {
            const nowH = currentTime ? currentTime.getHours() : new Date().getHours()
            const nowM = currentTime ? currentTime.getMinutes() : new Date().getMinutes()
            const isMorning = (nowH === 7 && nowM >= 45) || nowH === 8 || (nowH === 9 && nowM <= 0)
            const showMorning = isMorning && !todayRecord?.check_in_time
            const isAfternoon = nowH >= 15
            const showAfternoon = isAfternoon && Boolean(todayRecord?.check_in_time) && !todayRecord?.check_out_time

            if (!showMorning && !showAfternoon && notifPermission === 'granted') return null

            return (
              <div className="max-w-6xl xl:max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 mt-5 space-y-3">
                {/* 1. Pengingat Masuk Pagi */}
                {showMorning && (
                  <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-white animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-extrabold text-sm tracking-tight">Waktunya Presensi Masuk!</p>
                        <p className="text-xs text-amber-100 mt-0.5">Jam masuk standar telah dimulai (08.00 WIB). Jangan lupa check-in sekarang.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/ojt/absen')}
                      className="px-4 py-2.5 rounded-xl bg-white text-amber-900 font-extrabold text-xs shadow-md hover:bg-amber-50 transition-all shrink-0 cursor-pointer active:scale-95"
                    >
                      Check-In Sekarang
                    </button>
                  </div>
                )}

                {/* 2. Pengingat Pulang Sore (Tepat Jam 15.00 WIB) */}
                {showAfternoon && (
                  <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-extrabold text-sm tracking-tight">Jam Kerja Selesai (15.00 WIB)!</p>
                        <p className="text-xs text-emerald-100 mt-0.5">Anda sudah dapat melakukan presensi pulang sebelum meninggalkan kantor.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/ojt/absen')}
                      className="px-4 py-2.5 rounded-xl bg-white text-emerald-900 font-extrabold text-xs shadow-md hover:bg-emerald-50 transition-all shrink-0 cursor-pointer active:scale-95"
                    >
                      Check-Out Sekarang
                    </button>
                  </div>
                )}

                {/* 3. Permintaan Izin Notifikasi Web/PWA */}
                {notifPermission !== 'granted' && (
                  <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                    isDarkMode ? 'bg-[#152449] border-blue-500/30 text-blue-200' : 'bg-blue-50/70 border-blue-200/80 text-blue-900'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">🔔</span>
                      <span className="font-medium">Ingin diingatkan otomatis di HP saat jam masuk (08.00) dan pulang (15.00 WIB)?</span>
                    </div>
                    <button
                      type="button"
                      onClick={requestNotificationPermission}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shrink-0 transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      Aktifkan
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* =========================================
            PAPAN PENGUMUMAN DARI MENTOR (HERO BANNER)
            ========================================= */}
          {activeAnnouncement && (
            <div className="max-w-6xl xl:max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 mt-5">
              <div className={`p-5 rounded-3xl border shadow-md relative overflow-hidden transition-all ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-[#17203d] to-[#1d2b50] border-indigo-500/30 text-white' 
                  : 'bg-white border-2 border-indigo-100 shadow-indigo-100/40 text-slate-900'
              }`}>
                {/* Accent bar strip on left border for visual punch */}
                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                  activeAnnouncement.category === 'penting'
                    ? 'bg-rose-500'
                    : activeAnnouncement.category === 'evaluasi'
                    ? 'bg-purple-600'
                    : 'bg-indigo-600'
                }`} />

                <div className="pl-2">
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                        activeAnnouncement.category === 'penting'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : activeAnnouncement.category === 'evaluasi'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-indigo-600 text-white shadow-xs'
                      }`}>
                        {activeAnnouncement.category === 'penting'
                          ? 'Penting'
                          : activeAnnouncement.category === 'evaluasi'
                          ? 'Evaluasi'
                          : 'Info Tim'}
                      </span>
                      <span className={`text-[11px] font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                        Instruksi Mentor {mentorName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {new Date(activeAnnouncement.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const id = activeAnnouncement.id
                          setActiveAnnouncement(null)
                          if (typeof window !== 'undefined' && user?.id) {
                            localStorage.setItem(`mdu_dismissed_announce_${user.id}`, id)
                          }
                        }}
                        className={`p-1 rounded-lg transition-all cursor-pointer ${
                          isDarkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                        }`}
                        title="Tutup / Sembunyikan Pengumuman"
                        aria-label="Tutup Pengumuman"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <h3 className={`font-black text-base mb-1 tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    {activeAnnouncement.title}
                  </h3>
                  <p className={`text-xs whitespace-pre-line leading-relaxed ${
                    isDarkMode ? 'text-slate-300 font-normal' : 'text-slate-700 font-medium'
                  }`}>
                    {activeAnnouncement.content}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =========================================
            MENU UTAMA (GRID 8 SQUIRCLE ICONS MODERN)
            ========================================= */}
          <div className="max-w-6xl xl:max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 mt-6">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className={`text-base font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Menu Utama</h2>
              <span className="text-xs text-blue-500 font-bold">Layanan OJT</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3.5 lg:gap-4">
              
              {/* 1. Presensi Lokasi */}
              <button
                onClick={() => router.push('/ojt/absen')}
                className={`flex flex-col items-center text-center p-2.5 sm:p-3 rounded-2xl border shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group ${
                  isDarkMode ? 'bg-[#131f3d] border-slate-700/60 hover:bg-[#1a2b54]' : 'bg-white hover:bg-blue-50/50 border-slate-100'
                }`}
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/25 mb-2 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className={`text-[11px] sm:text-xs font-extrabold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Presensi Lokasi</span>
              </button>

              {/* 2. Ruang Tugas */}
              <button
                onClick={() => router.push('/ojt/tugas')}
                className={`flex flex-col items-center text-center p-2.5 sm:p-3 rounded-2xl border shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group relative ${
                  isDarkMode ? 'bg-[#131f3d] border-slate-700/60 hover:bg-[#1a2b54]' : 'bg-white hover:bg-blue-50/50 border-slate-100'
                }`}
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/25 mb-2 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className={`text-[11px] sm:text-xs font-extrabold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Ruang Tugas</span>
              </button>

              {/* 3. Pengajuan Izin */}
              <button
                onClick={() => router.push('/ojt/izin')}
                className={`flex flex-col items-center text-center p-2.5 sm:p-3 rounded-2xl border shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group relative ${
                  isDarkMode ? 'bg-[#131f3d] border-slate-700/60 hover:bg-[#1a2b54]' : 'bg-white hover:bg-blue-50/50 border-slate-100'
                }`}
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 mb-2 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className={`text-[11px] sm:text-xs font-extrabold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Pengajuan Izin</span>
              </button>

              {/* 4. Sertifikat PKL */}
              <button
                onClick={() => router.push('/ojt/sertifikat')}
                className={`flex flex-col items-center text-center p-2.5 sm:p-3 rounded-2xl border shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group relative ring-2 ring-amber-400/30 ${
                  isDarkMode ? 'bg-[#18233f] border-amber-500/40 hover:bg-[#202f54]' : 'bg-white hover:bg-amber-50/50 border-amber-200/60'
                }`}
              >
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase shadow-xs">
                  NEW
                </span>
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/25 mb-2 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                  </svg>
                </div>
                <span className="text-[11px] sm:text-xs font-black text-amber-500 leading-tight">Sertifikat PKL</span>
              </button>

              {/* 5. Riwayat Absen */}
              <button
                onClick={() => router.push('/ojt/absen/history')}
                className={`flex flex-col items-center text-center p-2.5 sm:p-3 rounded-2xl border shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group ${
                  isDarkMode ? 'bg-[#131f3d] border-slate-700/60 hover:bg-[#1a2b54]' : 'bg-white hover:bg-blue-50/50 border-slate-100'
                }`}
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-500/25 mb-2 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className={`text-[11px] sm:text-xs font-extrabold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Riwayat Absen</span>
              </button>

              {/* 6. Jurnal Harian */}
              <button
                onClick={() => setShowJurnalModal(true)}
                className={`flex flex-col items-center text-center p-2.5 sm:p-3 rounded-2xl border shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group ${
                  isDarkMode ? 'bg-[#131f3d] border-slate-700/60 hover:bg-[#1a2b54]' : 'bg-white hover:bg-blue-50/50 border-slate-100'
                }`}
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center shadow-md shadow-violet-500/25 mb-2 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className={`text-[11px] sm:text-xs font-extrabold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Jurnal Harian</span>
              </button>

              {/* 7. Info Mentor */}
              <button
                onClick={() => setShowMentorModal(true)}
                className={`flex flex-col items-center text-center p-2.5 sm:p-3 rounded-2xl border shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group ${
                  isDarkMode ? 'bg-[#131f3d] border-slate-700/60 hover:bg-[#1a2b54]' : 'bg-white hover:bg-blue-50/50 border-slate-100'
                }`}
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-500/25 mb-2 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className={`text-[11px] sm:text-xs font-extrabold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Info Mentor</span>
              </button>

              {/* 8. Pasang di HP (PWA) */}
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('open-pwa-tutorial'))
                  }
                }}
                className={`flex flex-col items-center text-center p-2.5 sm:p-3 rounded-2xl border shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group ${
                  isDarkMode ? 'bg-[#131f3d] border-slate-700/60 hover:bg-[#1a2b54]' : 'bg-white hover:bg-blue-50/50 border-slate-100'
                }`}
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25 mb-2 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className={`text-[11px] sm:text-xs font-extrabold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Pasang HP</span>
              </button>

            </div>
          </div>

          {/* =========================================
            STATUS SESI & SERTIFIKAT (3-COLUMN GRID DI DESKTOP)
            ========================================= */}
          <div className="max-w-6xl xl:max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 mt-7">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className={`text-base font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Status Sesi & Dokumen</h2>
              <button 
                onClick={() => router.push('/ojt/sertifikat')}
                className="text-xs font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1"
              >
                <span>Cek Sertifikat</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory md:grid md:grid-cols-3 md:gap-5 md:overflow-visible">
              
              {/* Card 1: Presensi Masuk */}
              <div 
                onClick={() => router.push('/ojt/absen')}
                className="min-w-[240px] sm:min-w-[270px] md:min-w-0 bg-gradient-to-br from-[#102447] to-[#1c3a70] rounded-3xl p-5 text-white shadow-md snap-start cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all border border-blue-800/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300">Sesi Pagi</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                      todayRecord?.check_in_time ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    }`}>
                      {todayRecord?.check_in_time ? 'Sudah Presensi' : '07:00 - 08:00 WIB'}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">Presensi Masuk</h4>
                  <p className="text-xs text-blue-200 mt-1">
                    Scan Anda: <strong className="text-white font-mono text-sm">{todayRecord?.check_in_time ? formatTime(todayRecord.check_in_time) : 'Belum Absen'}</strong>
                  </p>
                </div>
                <div className="mt-4 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${todayRecord?.check_in_time ? 'w-full bg-emerald-400' : 'w-1/3 bg-amber-400'}`}></div>
                </div>
              </div>

              {/* Card 2: Presensi Pulang */}
              <div 
                onClick={() => router.push('/ojt/absen')}
                className="min-w-[240px] sm:min-w-[270px] md:min-w-0 bg-gradient-to-br from-[#142852] to-[#1e3c7b] rounded-3xl p-5 text-white shadow-md snap-start cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all border border-blue-800/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300">Sesi Sore</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                      todayRecord?.check_out_time ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-slate-500/20 text-slate-300 border border-slate-400/30'
                    }`}>
                      {todayRecord?.check_out_time ? 'Sudah Pulang' : '15:00 - 16:00 WIB'}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">Presensi Pulang</h4>
                  <p className="text-xs text-blue-200 mt-1">
                    Scan Anda: <strong className="text-white font-mono text-sm">{todayRecord?.check_out_time ? formatTime(todayRecord.check_out_time) : 'Menunggu Sesi'}</strong>
                  </p>
                </div>
                <div className="mt-4 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${todayRecord?.check_out_time ? 'w-full bg-emerald-400' : 'w-0 bg-blue-400'}`}></div>
                </div>
              </div>

              {/* Card 3: Sertifikat PKL */}
              <div 
                onClick={() => router.push('/ojt/sertifikat')}
                className="min-w-[240px] sm:min-w-[270px] md:min-w-0 bg-gradient-to-br from-[#281c4e] to-[#401b6e] rounded-3xl p-5 text-white shadow-md snap-start cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all border border-purple-800/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300">Dokumen PKL</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                      hasCertificate ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    }`}>
                      {hasCertificate ? 'Siap Diunduh' : 'Sedang Berjalan'}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">Sertifikat Kelulusan</h4>
                  <p className="text-xs text-purple-200 mt-1">
                    {hasCertificate ? 'Dokumen siap dicetak PDF resmi' : 'Tersedia setelah dinilai mentor'}
                  </p>
                </div>
                <div className="mt-4 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${hasCertificate ? 'w-full bg-emerald-400' : 'w-2/3 bg-purple-400'}`}></div>
                </div>
              </div>

            </div>
          </div>

          {/* =========================================
            DESKTOP 2-COLUMN SECTION:
            KIRI: AKTIVITAS HARIAN (7 Kolom)
            KANAN: RINGKASAN STATISTIK MAGANG (5 Kolom)
            ========================================= */}
          <div className="max-w-6xl xl:max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 mt-7 mb-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* KOLOM KIRI (7 Kolom): AKTIVITAS HARIAN */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="flex items-center justify-between mb-3.5">
                  <h2 className={`text-base font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Aktivitas Harian Terakhir
                  </h2>
                  <button 
                    onClick={() => router.push('/ojt/absen/history')}
                    className="text-xs font-bold text-blue-500 hover:text-blue-400"
                  >
                    Lihat Semua &rarr;
                  </button>
                </div>

                <div className="flex flex-col gap-2.5">
                  {attendanceHistory && attendanceHistory.length > 0 ? (
                    attendanceHistory.slice(0, 5).map((record: any) => {
                      const statusColors: Record<string, { bg: string; text: string; dot: string; label: string }> = {
                        'Hadir':     { bg: isDarkMode ? 'bg-emerald-950/40' : 'bg-emerald-50', text: 'text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500', label: 'Hadir Tepat Waktu' },
                        'Terlambat': { bg: isDarkMode ? 'bg-amber-950/40' : 'bg-amber-50',     text: 'text-amber-400 border-amber-500/30',     dot: 'bg-amber-500',   label: 'Terlambat' },
                        'Izin':      { bg: isDarkMode ? 'bg-blue-950/40' : 'bg-blue-50',       text: 'text-blue-400 border-blue-500/30',       dot: 'bg-blue-500',    label: 'Izin' },
                        'Sakit':     { bg: isDarkMode ? 'bg-rose-950/40' : 'bg-rose-50',       text: 'text-rose-400 border-rose-500/30',       dot: 'bg-rose-500',    label: 'Sakit' },
                      }
                      const s = statusColors[record.status] || { bg: isDarkMode ? 'bg-slate-800' : 'bg-slate-50', text: 'text-slate-400 border-slate-700', dot: 'bg-slate-400', label: record.status || '-' }

                      return (
                        <div 
                          key={record.id}
                          className={`flex items-center justify-between rounded-2xl px-4 py-3.5 border shadow-xs hover:shadow-sm transition-all ${
                            isDarkMode ? 'bg-[#131f3d] border-slate-800' : 'bg-white border-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-extrabold text-xs shrink-0 ${
                              isDarkMode ? 'bg-blue-950/60 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'
                            }`}>
                              {new Date(record.check_in_time).getDate()}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {new Date(record.check_in_time).toLocaleDateString('id-ID', { weekday: 'long', month: 'short', day: 'numeric' })}
                              </p>
                              <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                Masuk: <strong className={`font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{formatTime(record.check_in_time)}</strong>
                                {record.check_out_time && (
                                  <> &bull; Pulang: <strong className={`font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{formatTime(record.check_out_time)}</strong></>
                                )}
                              </p>
                            </div>
                          </div>

                          <span className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold border ${s.bg} ${s.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                            {s.label}
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <div className={`rounded-2xl p-6 text-center border text-xs font-medium ${
                      isDarkMode ? 'bg-[#131f3d] border-slate-800 text-slate-500' : 'bg-white border-slate-100 text-slate-400'
                    }`}>
                      Belum ada catatan aktivitas presensi dalam 7 hari terakhir.
                    </div>
                  )}
                </div>
              </div>

              {/* KOLOM KANAN (5 Kolom): RINGKASAN STATISTIK MAGANG OJT */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="flex items-center justify-between mb-3.5">
                  <h2 className={`text-base font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Statistik Performa
                  </h2>
                  <span className="text-xs text-slate-400">Bulan Ini</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  
                  {/* Stat 1: Kehadiran Bulan Ini */}
                  <div className={`rounded-2xl p-4 border shadow-xs flex flex-col justify-between ${
                    isDarkMode ? 'bg-[#131f3d] border-slate-800' : 'bg-white border-slate-100'
                  }`}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Kehadiran</span>
                    <p className="text-2xl font-black text-blue-500 mt-1 font-mono">{attendanceStatsMonth.pct}%</p>
                    <span className="text-[10px] text-emerald-500 font-bold mt-1">
                      {attendanceStatsMonth.qual || 'Sangat Baik'}
                    </span>
                  </div>

                  {/* Stat 2: Tepat Waktu */}
                  <div className={`rounded-2xl p-4 border shadow-xs flex flex-col justify-between ${
                    isDarkMode ? 'bg-[#131f3d] border-slate-800' : 'bg-white border-slate-100'
                  }`}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tepat Waktu</span>
                    <p className="text-2xl font-black text-emerald-500 mt-1 font-mono">{attendanceStatsMonth.onTime} <span className="text-xs font-sans text-slate-400">hari</span></p>
                    <span className="text-[10px] text-amber-500 font-bold mt-1">
                      Terlambat: {attendanceStatsMonth.late}
                    </span>
                  </div>

                  {/* Stat 3: Total Hadir Kumulatif */}
                  <div className={`rounded-2xl p-4 border shadow-xs flex flex-col justify-between ${
                    isDarkMode ? 'bg-[#131f3d] border-slate-800' : 'bg-white border-slate-100'
                  }`}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Hadir</span>
                    <p className={`text-2xl font-black mt-1 font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {attendanceStats.hadir} <span className="text-xs font-sans text-slate-400 font-normal">/ {attendanceStats.total}</span>
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">
                      Kumulatif Seluruh Periode
                    </span>
                  </div>

                  {/* Stat 4: Izin & Sakit */}
                  <div className={`rounded-2xl p-4 border shadow-xs flex flex-col justify-between ${
                    isDarkMode ? 'bg-[#131f3d] border-slate-800' : 'bg-white border-slate-100'
                  }`}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Izin / Sakit</span>
                    <p className="text-2xl font-black text-rose-500 mt-1 font-mono">{attendanceStats.izinSakit} <span className="text-xs font-sans text-slate-400">hari</span></p>
                    <span className="text-[10px] text-blue-400 font-medium mt-1">
                      Terdata oleh Mentor
                    </span>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </main>

        {/* =========================================
          3. FLOATING BOTTOM NAVIGATION (MOBILE)
          Ditingkatkan dengan Ikon Jelas, Berwarna & Kontras
          ========================================= */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
          <div className={`relative backdrop-blur-xl border-t shadow-[0_-8px_25px_rgba(0,0,0,0.12)] px-3 py-2 flex items-center justify-around transition-colors duration-300 ${
            isDarkMode ? 'bg-[#0b1329]/95 border-slate-800 text-slate-200' : 'bg-white/95 border-slate-200/80 text-slate-700'
          }`}>
            
            {/* 1. Beranda */}
            <button
              onClick={() => router.push('/ojt')}
              className="flex flex-col items-center gap-1 py-1 px-2 flex-1 text-blue-500 group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </div>
              <span className="text-[10px] font-black text-blue-500">Beranda</span>
            </button>

            {/* 2. Riwayat */}
            <button
              onClick={() => router.push('/ojt/absen/history')}
              className={`flex flex-col items-center gap-1 py-1 px-2 flex-1 group ${
                isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                isDarkMode ? 'bg-slate-800/80 group-hover:bg-slate-700' : 'bg-slate-100 group-hover:bg-slate-200'
              }`}>
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold">Riwayat</span>
            </button>

            {/* 3. ELEVATED FLOATING CENTER BUTTON: PRESENSI CEPAT */}
            <div className="relative -top-5 flex items-center justify-center px-1">
              <button
                onClick={() => router.push('/ojt/absen')}
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-xl shadow-blue-500/40 flex items-center justify-center border-4 border-white dark:border-[#0b1329] active:scale-95 transition-all cursor-pointer ring-4 ring-blue-500/20"
                title="Buka Presensi Lokasi"
              >
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              </button>
            </div>

            {/* 4. Sertifikat PKL */}
            <button
              onClick={() => router.push('/ojt/sertifikat')}
              className={`flex flex-col items-center gap-1 py-1 px-2 flex-1 group ${
                isDarkMode ? 'text-slate-400 hover:text-amber-400' : 'text-slate-500 hover:text-amber-600'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
              </div>
              <span className="text-[10px] font-bold text-amber-500">Sertifikat</span>
            </button>

            {/* 5. Profil */}
            <button
              onClick={() => router.push('/settings')}
              className={`flex flex-col items-center gap-1 py-1 px-2 flex-1 group ${
                isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                isDarkMode ? 'bg-slate-800/80 group-hover:bg-slate-700' : 'bg-slate-100 group-hover:bg-slate-200'
              }`}>
                <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold">Profil</span>
            </button>

          </div>
        </div>

        {/* =========================================
          MODAL INFO MENTOR
          ========================================= */}
        {showMentorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className={`rounded-3xl p-6 max-w-sm w-full shadow-2xl border flex flex-col items-center text-center ${
              isDarkMode ? 'bg-[#131f3d] border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-800'
            }`}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 mb-1">
                Mentor Pembimbing OJT
              </span>
              <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{mentorName}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Penempatan: {profile?.asal_kantor || 'Jatiwaringin'}</p>

              <div className={`w-full mt-4 p-3 rounded-xl border text-left text-xs flex flex-col gap-1.5 ${
                isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="flex justify-between">
                  <span className="text-slate-400">Divisi Bimbingan:</span>
                  <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{profile?.divisi || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status Pendampingan:</span>
                  <span className="font-bold text-emerald-400">Aktif Membimbing</span>
                </div>
              </div>

              <button
                onClick={() => setShowMentorModal(false)}
                className="w-full mt-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
              >
                Tutup Informasi
              </button>
            </div>
          </div>
        )}

        {/* =========================================
          MODAL JURNAL HARIAN
          ========================================= */}
        {showJurnalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className={`rounded-3xl p-6 max-w-sm w-full shadow-2xl border flex flex-col items-center text-center ${
              isDarkMode ? 'bg-[#131f3d] border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-800'
            }`}>
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center shadow-inner mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Jurnal & Logbook Harian</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Fitur pengisian logbook tugas & catatan harian OJT sedang dipersiapkan dan akan segera diaktifkan.
              </p>
              <button
                onClick={() => setShowJurnalModal(false)}
                className="w-full mt-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}