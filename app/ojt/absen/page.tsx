'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import { LoadingMDU } from '@/components/LoadingMDU'

// --- KORDINAT KANTOR MDU ---
const LOKASI_CABANG: Record<string, { lat: number, lng: number }> = {
  'Jatiwaringin': { lat: -6.247942342659016, lng: 106.90724753666649 },
  'Margonda': { lat: -6.357711365116603, lng: 106.83183796973027 },
  'BSI Slipi': { lat: -6.1898682555279985, lng: 106.79550692558983 },
  'BSI BSD': { lat: -6.304062726210843, lng: 106.6872615116959 },
  'BSI Ciledug': { lat: -6.237729787450286, lng: 106.76291247847368 },
  'Rawamangun': { lat: -6.192347469094796, lng: 106.88095207476705 },
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export default function AbsenPage() {
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState('')
  const [currentDateObj, setCurrentDateObj] = useState<Date>(new Date())
  const router = useRouter()
  const [isCheckingRole, setIsCheckingRole] = useState(true)
  const submittingRef = useRef(false)

  const MAX_RADIUS_METERS = 50
  const cabangAktif = profile?.asal_kantor || 'Jatiwaringin'
  const targetLat = LOKASI_CABANG[cabangAktif]?.lat || LOKASI_CABANG['Jatiwaringin'].lat
  const targetLng = LOKASI_CABANG[cabangAktif]?.lng || LOKASI_CABANG['Jatiwaringin'].lng

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentDateObj(now)
      setCurrentTime(
        now.getHours().toString().padStart(2, '0') + ":" +
        now.getMinutes().toString().padStart(2, '0') + ":" +
        now.getSeconds().toString().padStart(2, '0')
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: userProfile } = await supabase
        .from('users')
        .select('role, name, avatar_url, divisi, asal_kantor')
        .eq('id', user.id)
        .single()

      if (userProfile?.role === 'admin') {
        router.push('/admin')
        return
      } else if (userProfile?.role === 'mentor') {
        router.push('/mentor')
        return
      }

      setIsCheckingRole(false)
      if (userProfile) setProfile(userProfile)

      const now = new Date()
      const todayStart = new Date(now.getTime())
      todayStart.setHours(0, 0, 0, 0)
      
      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)

      const { data: todayData, error: todayErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('check_in_time', todayStart.toISOString())
        .lt('check_in_time', tomorrowStart.toISOString())
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (todayErr) console.error('Gagal memuat record hari ini:', todayErr)
      setTodayRecord(todayData)

      const { data: historyData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .order('check_in_time', { ascending: false })
        .limit(5)

      if (historyData) setHistory(historyData)
      setLoading(false)
    }

    checkUserAndFetchData()
  }, [router])

  const checkLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Peramban Anda tidak mendukung fitur GPS.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setUserLoc({ lat, lng })

        const dist = getDistance(lat, lng, targetLat, targetLng)
        setDistance(Math.round(dist))
        toast.success('Lokasi berhasil dideteksi.')
      },
      (error) => toast.error('Mohon izinkan akses lokasi (GPS) untuk melakukan presensi.'),
      { enableHighAccuracy: true }
    )
  }

  const JAM_MASUK_START = "07:00"
  const JAM_MASUK_DEADLINE = "08:00"
  const JAM_PULANG_START = "15:00"
  const JAM_PULANG_END = "16:00"

  const isBelumWaktunyaPulang = todayRecord && !todayRecord.check_out_time && currentTime !== '' && currentTime < JAM_PULANG_START
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6

  const HARI_NAMA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const BULAN_NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const tanggalStr = `${HARI_NAMA[currentDateObj.getDay()]}, ${currentDateObj.getDate()} ${BULAN_NAMA[currentDateObj.getMonth()]} ${currentDateObj.getFullYear()}`

  const statusHariLabel = isWeekend ? 'Hari Libur' : 'Hari Kerja'
  const statusHariColor = isWeekend ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'

  const masukStatus = todayRecord?.check_in_time
    ? (todayRecord.status || 'Hadir')
    : 'Belum Absen'
  const masukStatusColor = !todayRecord?.check_in_time
    ? 'bg-slate-100 text-slate-500'
    : (todayRecord.status?.toLowerCase().includes('terlambat')
        ? 'bg-red-50 text-red-600 border border-red-200'
        : 'bg-emerald-50 text-emerald-700 border border-emerald-200')

  let pulangStatus = 'Belum Pulang'
  let pulangStatusColor = 'bg-slate-100 text-slate-500'
  if (todayRecord?.check_out_time) {
    const dOut = new Date(todayRecord.check_out_time)
    const hhmmOut = dOut.getHours().toString().padStart(2, '0') + ':' + dOut.getMinutes().toString().padStart(2, '0')
    if (hhmmOut <= JAM_PULANG_END) {
      pulangStatus = 'Tepat Waktu'
      pulangStatusColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    } else {
      pulangStatus = 'Lembur'
      pulangStatusColor = 'bg-blue-50 text-blue-700 border border-blue-200'
    }
  }

  const handleAbsen = async () => {
    if (submittingRef.current) return
    if ((distance === null || distance > MAX_RADIUS_METERS || !userLoc) || isBelumWaktunyaPulang) return

    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const sekarang = new Date()
      const jamMenitSekarang = sekarang.getHours().toString().padStart(2, '0') + ":" + sekarang.getMinutes().toString().padStart(2, '0')

      if (!todayRecord) {
        const now = new Date()
        const todayStart = new Date(now.getTime())
        todayStart.setHours(0, 0, 0, 0)
        
        const tomorrowStart = new Date(todayStart)
        tomorrowStart.setDate(tomorrowStart.getDate() + 1)

        const { data: existingToday } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .gte('check_in_time', todayStart.toISOString())
          .lt('check_in_time', tomorrowStart.toISOString())
          .order('check_in_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingToday) {
          setTodayRecord(existingToday)
          setHistory([existingToday, ...history].slice(0, 5))
          toast.info('Anda sudah melakukan presensi masuk hari ini.')
          return
        }

        const isTerlambat = jamMenitSekarang > JAM_MASUK_DEADLINE
        let finalStatus = isTerlambat ? 'Terlambat' : 'Hadir'

        const { data, error } = await supabase
          .from('attendance')
          .insert([{
            user_id: user.id,
            check_in_time: new Date().toISOString(),
            latitude: userLoc?.lat || 0,
            longitude: userLoc?.lng || 0,
            status: finalStatus
          }])
          .select().single()

        if (!error) {
          setTodayRecord(data)
          setHistory([data, ...history].slice(0, 5))
          toast.success(`Presensi masuk berhasil pada pukul ${jamMenitSekarang}. Selamat bertugas.`)
        } else {
          console.error(error)
          toast.error("Gagal melakukan presensi masuk.")
        }
      } else {
        const { data, error } = await supabase
          .from('attendance')
          .update({
            id: todayRecord.id,
            check_in_time: todayRecord.check_in_time,
            check_out_time: sekarang.toISOString(),
            latitude: todayRecord.latitude,
            longitude: todayRecord.longitude,
            lat_out: userLoc?.lat || 0,
            lng_out: userLoc?.lng || 0,
            status: todayRecord.status
          })
          .eq('id', todayRecord.id)
          .select().single()

        if (!error) {
          const { data: refreshedData, error: refreshError } = await supabase
            .from('attendance')
            .select('*')
            .eq('id', todayRecord.id)
            .single()
          
          if (!refreshError && refreshedData) {
            setTodayRecord(refreshedData)
            const { data: historyData } = await supabase
              .from('attendance')
              .select('*')
              .eq('user_id', user.id)
              .order('check_in_time', { ascending: false })
              .limit(5)
            
            if (historyData) {
              setHistory(historyData)
            }
            toast.success(`Presensi pulang berhasil pada pukul ${jamMenitSekarang}. Hati-hati di jalan.`)
          } else {
            setTodayRecord(data)
            setHistory(history.map(h => h.id === data.id ? data : h))
            toast.success(`Presensi pulang berhasil pada pukul ${jamMenitSekarang}. Hati-hati di jalan.`)
          }
        } else {
          console.error("Detail Error:", error)
          toast.error("Gagal melakukan presensi pulang.")
        }
      }
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (!isCheckingRole && !loading && !user) return null

  return (
    <>
      {(isCheckingRole || loading) && (
        <LoadingMDU message={isCheckingRole ? "Memeriksa profil..." : "Memuat Data Presensi..."} />
      )}
      <div className="min-h-screen bg-[#f0f4fc] font-sans flex">
        <Toaster position="top-center" richColors />

        {/* =========================================
          1. SIDEBAR DESKTOP
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
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span>Beranda</span>
            </button>

            <button className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50 text-blue-700 font-bold text-sm">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
              <span>Presensi Lokasi</span>
            </button>

            <button
              onClick={() => router.push('/ojt/tugas')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              <span>Ruang Tugas</span>
            </button>

            <button
              onClick={() => router.push('/ojt/izin')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span>Pengajuan Izin</span>
            </button>

            <button
              onClick={() => router.push('/ojt/sertifikat')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 font-bold text-sm transition-colors"
            >
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
              <span>Sertifikat PKL</span>
            </button>

            <button
              onClick={() => router.push('/ojt/absen/history')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>Riwayat Absen</span>
            </button>
          </nav>

          <div className="pt-4 border-t border-slate-100">
            <button onClick={() => router.push('/settings')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors mb-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
              Pengaturan Profil
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Keluar Sesi
            </button>
          </div>
        </aside>

        {/* =========================================
          2. KONTEN UTAMA DENGAN HEADER GRADASI SERASI
          ========================================= */}
        <main className="flex-1 md:ml-72 flex flex-col h-[100dvh] overflow-y-auto pb-24 md:pb-8">

          {/* TOP HEADER SELARAS DENGAN BERANDA */}
          <div className="relative bg-gradient-to-b from-[#102447] via-[#16356c] to-[#1e4591] text-white pt-4 pb-7 px-4 sm:px-8 rounded-b-[2.5rem] shadow-xl overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 max-w-6xl xl:max-w-7xl mx-auto flex flex-col gap-3.5">
              
              {/* BARIS 1: JAM REALTIME WIB PROMINENT + TOMBOL KEMBALI */}
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/30 animate-pulse"></span>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <span className="font-mono text-base sm:text-lg font-black text-white tracking-wider leading-none">
                      {currentTime || '00:00:00'} <span className="text-xs font-sans text-cyan-300 font-bold">WIB</span>
                    </span>
                    <span className="text-[11px] text-blue-200/90 font-medium">
                      &bull; {tanggalStr}
                    </span>
                  </div>
                </div>

                {/* Badge Kantor */}
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-xs font-bold text-white shadow-xs">
                  <svg className="w-3.5 h-3.5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>MDU {cabangAktif}</span>
                </div>
              </div>

              {/* BARIS 2: JUDUL & TOMBOL BACK MOBILE */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/ojt')}
                    className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-all active:scale-95 shadow-sm"
                    title="Kembali ke Beranda"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight">
                      Presensi Kehadiran
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">
                      Validasi kehadiran peserta OJT di area kantor {cabangAktif}.
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusHariColor}`}>
                    {statusHariLabel}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* MAIN CONTENT BODY */}
          <div className="max-w-6xl xl:max-w-7xl w-full mx-auto px-4 sm:px-8 mt-5 flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

              {/* =========================================
                KOLOM KIRI: MAPS & DETEKSI LOKASI (7 Kolom)
                ========================================= */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col h-[400px] lg:h-[490px]">
                  
                  {/* Maps Header */}
                  <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight">
                          Pelacak Lokasi Kantor
                        </h2>
                        <p className="text-[11px] text-slate-500">Cabang {cabangAktif}</p>
                      </div>
                    </div>

                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      GPS Aktif
                    </span>
                  </div>

                  {/* Peta Iframe dengan Radius Indicator */}
                  <div className="flex-1 relative bg-slate-100">
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      style={{ border: 0 }}
                      src={`https://maps.google.com/maps?q=${targetLat},${targetLng}&z=19&output=embed`}
                      allowFullScreen
                      className="absolute inset-0"
                    ></iframe>

                    {/* Overlay Visual Radius 50m */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[160px] h-[160px] rounded-full border-4 border-dashed border-blue-600/70 bg-blue-600/10 flex items-center justify-center shadow-lg">
                        <div className="w-4 h-4 bg-blue-600 rounded-full shadow-lg ring-4 ring-white animate-ping"></div>
                      </div>
                    </div>

                    {/* Badge Indikator Radius di atas Peta */}
                    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-800 shadow-md flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Radius Presensi: {MAX_RADIUS_METERS} Meter
                    </div>
                  </div>

                </div>
              </div>

              {/* =========================================
                KOLOM KANAN: STATUS JADWAL & TOMBOL ABSEN (5 Kolom)
                ========================================= */}
              <div className="lg:col-span-5 flex flex-col gap-4">

                {/* KARTU JADWAL & AKSI PRESENSI */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col gap-4">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Jadwal Presensi Hari Ini
                    </h3>
                    <span className="text-xs text-blue-600 font-bold">WIB</span>
                  </div>

                  {/* KARTU JADWAL: MASUK & PULANG */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Kartu Masuk */}
                    <div className="rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border border-blue-100 p-3.5 flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-800 leading-tight">Jam Masuk</p>
                          <p className="text-[10px] text-slate-500 leading-tight">{JAM_MASUK_START} - {JAM_MASUK_DEADLINE}</p>
                        </div>
                      </div>
                      <div className="my-1.5">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Scan Anda</p>
                        <p className="text-base sm:text-lg font-black text-slate-800 font-mono">
                          {todayRecord?.check_in_time ? formatTime(todayRecord.check_in_time) : '—'}
                        </p>
                      </div>
                      <span className={`mt-auto text-center px-2 py-0.5 text-[10px] font-extrabold rounded-full ${masukStatusColor}`}>
                        {masukStatus}
                      </span>
                    </div>

                    {/* Kartu Pulang */}
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-100 p-3.5 flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-800 leading-tight">Jam Pulang</p>
                          <p className="text-[10px] text-slate-500 leading-tight">{JAM_PULANG_START} - {JAM_PULANG_END}</p>
                        </div>
                      </div>
                      <div className="my-1.5">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Scan Anda</p>
                        <p className="text-base sm:text-lg font-black text-slate-800 font-mono">
                          {todayRecord?.check_out_time ? formatTime(todayRecord.check_out_time) : '—'}
                        </p>
                      </div>
                      <span className={`mt-auto text-center px-2 py-0.5 text-[10px] font-extrabold rounded-full ${pulangStatusColor}`}>
                        {pulangStatus}
                      </span>
                    </div>
                  </div>

                  {/* KOTAK STATUS JARAK GPS */}
                  <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                    {distance !== null ? (
                      <>
                        <p className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                          {distance} <span className="text-sm font-bold text-slate-500 font-sans">meter</span>
                        </p>
                        <p className={`text-xs font-extrabold mt-1 flex items-center justify-center gap-1.5 ${
                          distance <= MAX_RADIUS_METERS ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${distance <= MAX_RADIUS_METERS ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {distance <= MAX_RADIUS_METERS ? 'Anda Berada di Dalam Jangkauan Kantor' : 'Di Luar Radius Kantor (Maks. 50m)'}
                        </p>
                      </>
                    ) : (
                      <div className="py-1">
                        <p className="text-xs text-slate-600 font-bold">GPS Belum Terdeteksi</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Tekan tombol deteksi lokasi di bawah ini terlebih dahulu.</p>
                      </div>
                    )}
                  </div>

                  {/* TOMBOL AKSI PRESENSI */}
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={checkLocation}
                      className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-blue-600 text-slate-800 hover:text-blue-600 font-extrabold py-3.5 rounded-2xl transition-all text-xs sm:text-sm active:scale-98 cursor-pointer shadow-xs"
                    >
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Deteksi Lokasi GPS Sekarang</span>
                    </button>

                    <button
                      onClick={handleAbsen}
                      disabled={(distance === null || distance > MAX_RADIUS_METERS) || isSubmitting || (todayRecord?.check_in_time && todayRecord?.check_out_time) || isBelumWaktunyaPulang}
                      className={`w-full font-black py-4 rounded-2xl transition-all text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 ${
                        (distance === null || distance > MAX_RADIUS_METERS) || isSubmitting || (todayRecord?.check_in_time && todayRecord?.check_out_time) || isBelumWaktunyaPulang
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                          : !todayRecord
                            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25 active:scale-98 cursor-pointer'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25 active:scale-98 cursor-pointer'
                      }`}
                    >
                      {isSubmitting ? (
                        <span>Memproses Data Presensi...</span>
                      ) : !todayRecord ? (
                        <>
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>Presensi Masuk Sekarang</span>
                        </>
                      ) : todayRecord.check_out_time ? (
                        <span>Presensi Selesai Hari Ini</span>
                      ) : isBelumWaktunyaPulang ? (
                        <span>Belum Waktunya Pulang ({JAM_PULANG_START} WIB)</span>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>Presensi Pulang Sekarang</span>
                        </>
                      )}
                    </button>

                    {distance !== null && distance > MAX_RADIUS_METERS && (
                      <p className="text-center text-xs text-rose-600 font-bold flex items-center justify-center gap-1.5 mt-1 animate-pulse">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Akses ditolak: Anda berada di luar radius kantor {cabangAktif}.
                      </p>
                    )}
                  </div>

                </div>

                {/* KOTAK RIWAYAT 5 HARI TERAKHIR */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-3.5 pb-2.5 border-b border-slate-100">
                    <h3 className="text-sm font-extrabold text-slate-800">Riwayat Terakhir</h3>
                    <button 
                      onClick={() => router.push('/ojt/absen/history')} 
                      className="text-xs text-blue-600 hover:text-blue-700 font-bold"
                    >
                      Lihat Semua &rarr;
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {history.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">Belum ada riwayat presensi tercatat.</p>
                    ) : (
                      history.map((item, index) => (
                        <div key={item.id || index} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                              item.status === 'Terlambat'
                                ? 'bg-red-100 text-red-600'
                                : item.check_out_time
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-100 text-blue-700'
                            }`}>
                              {new Date(item.check_in_time).getDate()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 truncate">{formatDate(item.check_in_time)}</p>
                              <span className={`text-[10px] font-extrabold ${
                                item.status === 'Terlambat' ? 'text-red-500' : 'text-slate-500'
                              }`}>{item.status}</span>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <p className="text-[11px] text-slate-700">
                              Msk: <span className="font-bold">{formatTime(item.check_in_time)}</span>
                            </p>
                            {item.check_out_time && (
                              <p className="text-[11px] text-emerald-600">
                                Plg: <span className="font-bold">{formatTime(item.check_out_time)}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>

        </main>

        {/* =========================================
          3. FLOATING BOTTOM NAVIGATION (MOBILE)
          ========================================= */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
          <div className="relative bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] px-3 py-2 flex items-center justify-around">
            
            {/* Beranda */}
            <button
              onClick={() => router.push('/ojt')}
              className="flex flex-col items-center gap-1 py-1 px-2 flex-1 text-slate-500 hover:text-blue-600 group"
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
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold">Riwayat</span>
            </button>

            {/* Elevated Center Button: Presensi Lokasi (Aktif) */}
            <div className="relative -top-5 flex items-center justify-center px-1">
              <button
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-xl shadow-blue-500/40 flex items-center justify-center border-4 border-white ring-4 ring-blue-500/20"
                title="Presensi Lokasi"
              >
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              </button>
            </div>

            {/* Sertifikat PKL */}
            <button
              onClick={() => router.push('/ojt/sertifikat')}
              className="flex flex-col items-center gap-1 py-1 px-2 flex-1 text-slate-500 hover:text-amber-600 group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
              </div>
              <span className="text-[10px] font-bold text-amber-600">Sertifikat</span>
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

      </div>
    </>
  )
}