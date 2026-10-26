'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import { LoadingMDU } from '@/components/LoadingMDU'

export default function BerandaOJT() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mentorName, setMentorName] = useState<string>('Memults...')
  const [loading, setLoading] = useState(true)
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [showWfhModal, setShowWfhModal] = useState(false)
  const [isInFirstWeekWindow, setIsInFirstWeekWindow] = useState<boolean | null>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
  const [attendanceStats, setAttendanceStats] = useState({ total: 0, hadir: 0, tepatWaktu: 0, izinSakit: 0 })
  const [attendanceStatsMonth, setAttendanceStatsMonth] = useState({
    totalDays: 0, hadir: 0, onTime: 0, late: 0, pct: 0, qual: ''
  })
  const batchLabel = `Batch ${new Date().getFullYear()}`
  const router = useRouter()

  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const checkModalNeedsToShow = () => {
      // Check localStorage for dismissal history
      const dismissed = localStorage.getItem('wfh_modal_dismissed')
      const timestamp = localStorage.getItem('wfh_modal_timestamp')

      // If no dismissal ever, always show
      if (!dismissed) {
        setIsInFirstWeekWindow(true)
        return true
      }

      // Calculate days since last dismissal
      if (timestamp) {
        const lastDismissedTime = parseInt(timestamp)
        const currentTime = Date.now()
        const daysSinceDismissal = Math.floor(
          (currentTime - lastDismissedTime) / (1000 * 60 * 60 * 24)
        )

        // Show if still within first 7 days
        if (daysSinceDismissal < 7) {
          setIsInFirstWeekWindow(true)
          return true
        } else {
          // More than 7 days passed, permanent dismissal
          setIsInFirstWeekWindow(false)
          return false
        }
      }

      setIsInFirstWeekWindow(false)
      return false
    }

    // WFH modal dinonaktifkan - notifikasi penghentian WFH sudah tidak diperlukan
    // const shouldShowModal = checkModalNeedsToShow()
    setShowWfhModal(false)

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

      // 3. Tarik Data Absen Hari Ini untuk kartu shortcut presensi
      const today = new Date().toLocaleDateString('en-CA')
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('check_in_time, check_out_time, status')
        .eq('user_id', user.id)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .maybeSingle()
      if (todayAttendance) setTodayRecord(todayAttendance)

      // 4. Tarik Riwayat Absen 7 Hari
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

      // 5. Tarik Seluruh Data Kehadiran untuk Statistik
      const { data: allAttendance } = await supabase
        .from('attendance')
        .select('check_in_time, status')
        .eq('user_id', user.id)

      if (allAttendance && allAttendance.length > 0) {
        const total = allAttendance.length
        // Hadir mencakup yang datang fisik (Hadir + Terlambat)
        const hadir = allAttendance.filter((a: any) =>
          a.status === 'Hadir' || a.status === 'Terlambat'
        ).length
        // Tepat waktu = status 'Hadir' (masuk sebelum deadline, bukan terlambat)
        const tepatWaktu = allAttendance.filter((a: any) => a.status === 'Hadir').length
        const izinSakit = allAttendance.filter((a: any) =>
          a.status === 'Izin' || a.status === 'Sakit'
        ).length
        setAttendanceStats({ total, hadir, tepatWaktu, izinSakit })
      }

      // 6. Statistik Kehadiran BULAN INI
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      // Total hari kerja bulan ini (hari yang sudah lewat termasuk hari ini)
      const daysPassed = now.getDate() // sudah berapa hari di bulan ini

      const { data: monthlyData } = await supabase
        .from('attendance')
        .select('check_in_time, status')
        .eq('user_id', user.id)
        .gte('check_in_time', startOfMonth.toISOString())
        .lt('check_in_time', startOfNextMonth.toISOString())

      if (monthlyData) {
        // Hadir = semua yang datang ke kantor (Hadir + Terlambat)
        const hadirBulanIni = monthlyData.filter((a: any) =>
          a.status === 'Hadir' || a.status === 'Terlambat'
        ).length
        // Tepat waktu = hanya yang berstatus 'Hadir' (bukan Terlambat)
        const onTimeBulanIni = monthlyData.filter((a: any) => a.status === 'Hadir').length
        const lateBulanIni = monthlyData.filter((a: any) => a.status === 'Terlambat').length
        const izinSakitBulanIni = monthlyData.filter((a: any) =>
          a.status === 'Izin' || a.status === 'Sakit'
        ).length
        // Persentase = hadir (termasuk terlambat + izin/sakit) dari hari yang sudah lewat
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

  // Format waktu HH:MM untuk kartu shortcut presensi
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  // Handler for dismissing modal
  const handleCloseModal = () => {
    setShowWfhModal(false)

    // Save dismissal info to localStorage
    localStorage.setItem('wfh_modal_dismissed', 'true')
    localStorage.setItem('wfh_modal_timestamp', Date.now().toString())
  }



  return (
    <>
      {loading && <LoadingMDU message="Memuat Dasbor Peserta..." />}

      <div className="min-h-[100dvh] bg-[#f8faff] flex flex-col md:flex-row font-sans">
        <Toaster position="top-center" richColors />

        {/* MODAL POPUP NOTIFIKASI WFH - Muncul saat pertama kali login */}
        {showWfhModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto animate-in fade-in duration-300">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Backdrop overlay dengan blur effect yang kuat */}
              <div
                className="fixed inset-0 transition-all duration-300 bg-slate-900/80 backdrop-blur-xl"
                onClick={handleCloseModal}
              ></div>

              {/* Modal panel dengan backdrop blur sendiri */}
              <div className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-amber-200 animate-in zoom-in-95 duration-300">
                {/* Header dengan ikon */}
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                {/* Judul Modal */}
                <h3 className="text-xl font-bold text-slate-800 mb-3 text-center">
                  ðŸ“¢ Pemberitahuan Penting Perubahan Kebijakan Presensi
                </h3>

                {/* Isi Modal */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-2xl border-2 border-amber-200 mb-6">
                  <p className="text-sm text-amber-900 leading-relaxed mb-3">
                    Diberitahukan kepada seluruh peserta OJT, mulai tanggal <span className="font-black text-amber-700">1 September 2026</span>,
                    sistem <span className="font-black text-amber-700 underline decoration-amber-500">Work From Home (WFH) telah dihentikan</span>.
                  </p>
                  <p className="text-sm text-amber-900 leading-relaxed">
                    Mohon untuk <strong className="text-amber-700">hadir secara fisik</strong> ke kantor cabang masing-masing pada hari kerja.
                    Silakan perhatikan ketentuan absensi yang berlaku sekarang.
                  </p>
                </div>

                {/* Detail Informasi */}
                <div className="mb-6 space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Efektif Tanggal</p>
                      <p className="text-sm font-bold text-emerald-700">1 September 2026</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Kebijakan Baru</p>
                      <p className="text-sm font-bold text-blue-700">Hadir Fisik ke Kantor</p>
                    </div>
                  </div>
                </div>

                {/* Tombol Close Modal */}
                <div className="flex flex-col gap-3 sm:flex-col">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Saya Mengerti, Terima Kasih!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200/60 rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-purple-500 font-semibold uppercase tracking-wider">Status Magang</p>
                <p className="text-sm font-black text-purple-800">{batchLabel}</p>
              </div>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
            </div>
          </div>

          <div className="px-4 pb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu Utama</p>
            <nav className="space-y-1.5">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-blue-600 text-white shadow-md shadow-blue-600/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                <span className="font-medium">Beranda</span>
              </button>
              <button onClick={() => router.push('/ojt/absen')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                <span className="font-medium">Presensi Lokasi</span>
              </button>
              <button onClick={() => router.push('/ojt/tugas')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span className="font-medium">Daftar Tugas</span>
              </button>
              <button onClick={() => router.push('/ojt/izin')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-medium">Pengajuan Izin</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('open-pwa-tutorial'))
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-indigo-600 hover:bg-indigo-50 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                <span>Pasang di HP (PWA)</span>
              </button>
            </nav>
          </div>

          <div className="mt-auto p-4 border-t border-slate-100">
            <div className="flex items-center gap-3 px-2 mb-4">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-900 flex items-center justify-center text-sm font-bold text-white">
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
        <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative bg-slate-50">

          {/* HEADER TOP (DESKTOP) */}
          <header className="hidden md:flex sticky top-0 h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm z-40 items-center justify-between px-8">
            <div className="flex items-center gap-6 flex-1 max-w-xl">
              <div className="relative w-full max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Cari layanan, informasi..." className="w-full pl-10 pr-4 py-2 bg-slate-100/50 border border-slate-200 rounded-xl text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              {/* Label Kantor */}
              <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-sm font-bold text-blue-700">MDU-Jatiwaringin</span>
              </div>

              <div className="h-8 w-px bg-slate-200"></div>

              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 text-blue-600 font-bold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-lg">
                    {currentTime ? currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '00:00:00'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">WIB</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {currentTime ? currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                </span>
              </div>

              <div className="h-8 w-px bg-slate-200"></div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-bold text-slate-800 leading-tight">{profile?.name || user?.email}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">{profile?.nip ? `NIP: ${profile.nip}` : 'Siswa OJT'}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-[2px] shadow-sm">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Foto" />
                    ) : (
                      <span className="text-sm font-bold text-slate-800">{profile?.name?.charAt(0) || user?.email?.charAt(0)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* HEADER MOBILE */}
          <div className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-[1.5px] shadow-sm">
                  <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Foto" />
                    ) : (
                      <span className="text-xs font-bold text-slate-800">{profile?.name?.charAt(0) || user?.email?.charAt(0)}</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium leading-tight">Selamat datang,</p>
                  <p className="text-sm font-bold text-slate-800 leading-tight truncate max-w-[160px]">{profile?.name || user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xs font-bold text-blue-700">
                  {currentTime ? currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '00:00'}
                </span>
                <span className="text-[10px] text-blue-500 font-medium">WIB</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-28 md:pb-8">

            {/* HERO PANEL: IDENTITY & MENTOR */}
            <div className="px-4 md:px-8 pt-4 md:pt-6">
              <div className="w-full bg-gradient-to-r from-[#2b1055] via-[#431268] to-[#1e2a5e] border border-purple-500/20 rounded-2xl md:rounded-3xl p-4 md:p-8 text-white shadow-xl relative overflow-hidden">
                {/* Orbs */}
                <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-8">
                  {/* Identitas */}
                  <div className="flex flex-row items-center gap-4">
                    <div className="w-14 h-14 md:w-24 md:h-24 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 via-purple-600 to-emerald-500 p-1 shadow-2xl ring-4 ring-white/10 shrink-0">
                      <div className="w-full h-full rounded-lg md:rounded-xl bg-[#261044] flex items-center justify-center overflow-hidden">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Foto" />
                        ) : (
                          <span className="text-3xl font-extrabold">{profile?.name?.charAt(0) || user?.email?.charAt(0)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-purple-200 text-xs font-semibold tracking-wide uppercase">Selamat Datang,</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white text-[10px] flex items-center gap-1 backdrop-blur-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> OJT Aktif
                        </span>
                      </div>
                      <h1 className="text-xl md:text-3xl font-extrabold tracking-tight mb-1 truncate">{profile?.name}</h1>

                      {/* Info badges - scrollable on mobile */}
                      <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-purple-100">
                        <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                          <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                          NIP: <strong className="text-white">{profile?.nip || '-'}</strong>
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                          <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          Instansi: <strong className="text-white">{profile?.asal_sekolah || '-'}</strong>
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                          <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          Penempatan: <strong className="text-white">{profile?.asal_kantor || '-'}</strong>
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                          <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          Divisi: <strong className="text-white">{profile?.divisi || '-'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mentor Strip — compact on mobile */}
                  <div className="flex flex-row items-center gap-3 bg-white/10 backdrop-blur-md p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/15 w-full xl:w-auto">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-purple-200 uppercase tracking-widest font-bold block">Mentor Pembimbing</span>
                      <span className="font-bold text-white block truncate text-sm md:text-base">{mentorName}</span>
                      <span className="text-xs text-blue-200 truncate block">Penempatan: {profile?.asal_kantor || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PROMO / SHORTCUT PWA */}
            <div className="px-4 md:px-8 mt-4 md:mt-6">
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl md:rounded-3xl p-4 md:p-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md p-1.5 flex items-center justify-center shrink-0 border border-white/25 shadow-inner">
                    <img src="/icon-192.png" alt="MDU Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        Fitur Baru
                      </span>
                      <h3 className="font-bold text-sm md:text-base text-white">Buka MDU Portal Layaknya Aplikasi HP</h3>
                    </div>
                    <p className="text-xs text-blue-100 mt-0.5">
                      Tambahkan ke Layar Utama (Homescreen) agar absensi harian lebih cepat & praktis.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('open-pwa-tutorial'))
                    }
                  }}
                  className="px-4 py-2.5 bg-white text-indigo-700 hover:bg-blue-50 text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Cara Pasang di HP</span>
                </button>
              </div>
            </div>

            {/* STATISTIK KEHADIRAN */}
            <div className="px-4 md:px-8 mt-4 md:mt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Persentase Kehadiran Bulan Ini */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold uppercase">Bulan Ini</span>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-800">{attendanceStatsMonth.pct}%</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Kehadiran {new Date().toLocaleDateString('id-ID', { month: 'long' })}</p>
                    {attendanceStatsMonth.qual && (
                      <span className={`inline-block mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full ${attendanceStatsMonth.pct > 90
                        ? 'bg-emerald-50 text-emerald-700'
                        : attendanceStatsMonth.pct >= 75
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                        }`}>{attendanceStatsMonth.qual}</span>
                    )}
                  </div>
                </div>

                {/* Total Hadir */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-bold uppercase">Hadir</span>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-800">{attendanceStats.hadir} <span className="text-sm font-semibold text-slate-400">/ {attendanceStats.total}</span></p>
                    <p className="text-xs text-slate-500 font-medium mt-1">Total Kehadiran</p>
                  </div>
                </div>

                {/* Hadir Tepat Waktu + Terlambat */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-bold uppercase">Disiplin</span>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-800">{attendanceStatsMonth.onTime} <span className="text-sm font-semibold text-slate-400">hari</span></p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Hadir Tepat Waktu di Bulan ini                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                      <p className="text-xs text-rose-600 font-semibold">Terlambat: {attendanceStatsMonth.late} hari</p>
                    </div>
                  </div>
                </div>

                {/* Izin / Sakit */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md font-bold uppercase">Izin</span>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-800">{attendanceStats.izinSakit} <span className="text-sm font-semibold text-slate-400">hari</span></p>
                    <p className="text-xs text-slate-500 font-medium mt-1">Izin / Sakit Terdata</p>
                  </div>
                </div>
              </div>
            </div>

            {/* SPLIT LAYOUT (PRESENSI & JURNAL) */}
            <div className="px-4 md:px-8 mt-4 md:mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* KIRI: PRESENSI (8 Col) */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-800">Presensi Hari Ini</h2>
                          <p className="text-sm text-slate-500">Validasi Kehadiran Magang OJT</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Card Masuk */}
                      <div className="bg-gradient-to-b from-blue-50/50 to-white rounded-2xl p-5 border border-blue-100 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </div>
                            {todayRecord?.check_in_time ? (
                              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">Sudah Presensi</span>
                            ) : (
                              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">Sesi Aktif</span>
                            )}
                          </div>
                          <h3 className="text-slate-600 font-bold mb-1">Presensi Masuk</h3>
                          <p className="text-2xl font-black text-slate-800 tabular-nums">
                            {todayRecord?.check_in_time ? formatTime(todayRecord.check_in_time) : 'Belum Absen'}
                          </p>
                          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Jadwal: 07:00 - 08:00 WIB
                          </p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-blue-50">
                          <button onClick={() => router.push('/ojt/absen')} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                            Buka Menu Presensi
                          </button>
                        </div>
                      </div>

                      {/* Card Pulang */}
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </div>
                            {todayRecord?.check_out_time ? (
                              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">Sudah Pulang</span>
                            ) : (
                              <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">Menunggu</span>
                            )}
                          </div>
                          <h3 className="text-slate-500 font-bold mb-1">Presensi Pulang</h3>
                          <p className="text-2xl font-black text-slate-800 tabular-nums">
                            {todayRecord?.check_out_time ? formatTime(todayRecord.check_out_time) : 'Belum Pulang'}
                          </p>
                          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Jadwal: 15:00 - 16:00 WIB
                          </p>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-100">
                          <button onClick={() => router.push('/ojt/absen')} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                            Buka Menu Presensi
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* KANAN: JURNAL (4 Col) */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </div>
                        <h3 className="font-bold text-slate-800">Jurnal Harian</h3>
                      </div>
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-md font-bold uppercase">Soon</span>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">Fitur pencatatan tugas dan jurnal harian OJT sedang dalam tahap pengembangan dan akan segera dirilis.</p>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-600">Status Jurnal Hari Ini</span>
                        <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded">Dikunci</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-slate-400 h-1.5 rounded-full w-0"></div>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <button disabled className="w-full py-3 bg-slate-100 text-slate-400 font-bold rounded-xl cursor-not-allowed">
                        Buka Form Jurnal (Segera)
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* MENU UTAMA GRID */}
            <div className="px-6 md:px-8 mt-10 mb-10">
              <h3 className="text-slate-800 font-bold text-lg mb-4 flex items-center gap-2">
                Layanan Peserta OJT
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <button onClick={() => router.push('/ojt/absen')} className="bg-white p-6 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col items-center text-center group hover:-translate-y-1 hover:shadow-lg transition-all">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                  </div>
                  <span className="text-slate-800 font-bold text-sm md:text-base">Presensi Lokasi</span>
                </button>

                <button onClick={() => router.push('/ojt/tugas')} className="bg-white p-6 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col items-center text-center group hover:-translate-y-1 hover:shadow-lg transition-all">
                  <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <span className="text-slate-800 font-bold text-sm md:text-base">Tugas Boost Post</span>
                </button>

                <button onClick={() => router.push('/ojt/izin')} className="bg-white p-6 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col items-center text-center group hover:-translate-y-1 hover:shadow-lg transition-all">
                  <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <span className="text-slate-800 font-bold text-sm md:text-base">Pengajuan Izin</span>
                </button>

                <button className="bg-slate-50 p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center opacity-60 cursor-not-allowed">
                  <div className="w-14 h-14 bg-slate-200 text-slate-500 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <span className="text-slate-600 font-bold text-sm md:text-base">Hasil Evaluasi</span>
                  <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-md mt-1 font-bold">Segera Hadir</span>
                </button>
              </div>
            </div>

            {/* TABEL RIWAYAT 7 HARI */}
            <div className="px-4 md:px-8 mt-4 md:mt-10 mb-8">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" /></svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Riwayat Presensi 7 Hari Terakhir</h2>
                      <p className="text-sm text-slate-500">Daftar kehadiran dan logbook magang</p>
                    </div>
                  </div>
                  <button onClick={() => router.push('/ojt/absen/history')} className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-bold rounded-xl transition-colors flex items-center gap-2">
                    Lihat Semua
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                {/* Desktop table */}
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                        <th className="py-3 px-4 rounded-l-xl">Tanggal</th>
                        <th className="py-3 px-4">Jam Masuk</th>
                        <th className="py-3 px-4">Jam Pulang</th>
                        <th className="py-3 px-4 rounded-r-xl">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {attendanceHistory && attendanceHistory.length > 0 ? (
                        attendanceHistory.map((record: any) => (
                          <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-4 px-4">
                              <span className="font-bold text-slate-800 block">
                                {new Date(record.check_in_time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-semibold text-slate-600">{formatTime(record.check_in_time)}</td>
                            <td className="py-4 px-4 font-semibold text-slate-600">{record.check_out_time ? formatTime(record.check_out_time) : '-'}</td>
                            <td className="py-4 px-4">
                              {record.status === 'Hadir' ? (
                                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Hadir
                                </span>
                              ) : record.status === 'Terlambat' ? (
                                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Terlambat
                                </span>
                              ) : record.status === 'Izin' ? (
                                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Izin
                                </span>
                              ) : record.status === 'Sakit' ? (
                                <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Sakit
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> {record.status || 'Menunggu'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 font-medium">
                            Belum ada riwayat presensi dalam 7 hari terakhir.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden flex flex-col gap-2">
                  {attendanceHistory && attendanceHistory.length > 0 ? (
                    attendanceHistory.map((record: any) => {
                      const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
                        'Hadir':     { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Hadir' },
                        'Terlambat': { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Terlambat' },
                        'Izin':      { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Izin' },
                        'Sakit':     { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500',    label: 'Sakit' },
                      }
                      const s = statusConfig[record.status] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', label: record.status || '-' }
                      return (
                        <div key={record.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              {new Date(record.check_in_time).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Masuk: <span className="font-semibold text-slate-700">{formatTime(record.check_in_time)}</span>
                              {record.check_out_time && (
                                <> &nbsp;·&nbsp; Pulang: <span className="font-semibold text-slate-700">{formatTime(record.check_out_time)}</span></>
                              )}
                            </p>
                          </div>
                          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>{s.label}
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <p className="py-6 text-center text-slate-500 text-sm font-medium">Belum ada riwayat dalam 7 hari terakhir.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 md:px-8 mt-8 mb-4 md:hidden">
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full py-4 rounded-2xl bg-rose-50 text-rose-600 font-bold text-sm border border-rose-100 flex items-center justify-center gap-2 active:bg-rose-100 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Keluar Sesi
              </button>
            </div>

          </div>
        </main>

        {/* =========================================
          3. BOTTOM NAVIGATION (KHUSUS MOBILE)
          ========================================= */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/60 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex justify-around items-center px-2 pt-2 pb-safe">

            {/* Beranda */}
            <button className="flex flex-col items-center gap-0.5 py-2 px-3 flex-1 relative">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              </div>
              <span className="text-[10px] font-bold text-blue-600">Beranda</span>
            </button>

            {/* Absensi */}
            <button onClick={() => router.push('/ojt/absen')} className="flex flex-col items-center gap-0.5 py-2 px-3 flex-1">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">Absensi</span>
            </button>

            {/* Tugas */}
            <button onClick={() => router.push('/ojt/tugas')} className="flex flex-col items-center gap-0.5 py-2 px-3 flex-1">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">Tugas</span>
            </button>

            {/* Izin */}
            <button onClick={() => router.push('/ojt/izin')} className="flex flex-col items-center gap-0.5 py-2 px-3 flex-1">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">Izin</span>
            </button>

            {/* Profil */}
            <button onClick={() => router.push('/settings')} className="flex flex-col items-center gap-0.5 py-2 px-3 flex-1">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">Profil</span>
            </button>

          </div>
          <div className="h-safe"></div>
        </div>

      </div>
    </>
  )
}