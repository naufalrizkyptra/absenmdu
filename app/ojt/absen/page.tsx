'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'

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
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
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

      // Use timezone-safe date boundaries (Indonesia UTC+7)
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
  const todayDateObj = new Date()
  const tanggalStr = `${HARI_NAMA[todayDateObj.getDay()]}, ${todayDateObj.getDate()} ${BULAN_NAMA[todayDateObj.getMonth()]} ${todayDateObj.getFullYear()}`

  const statusHariLabel = isWeekend ? 'Hari Libur' : 'Hari Kerja'
  const statusHariColor = isWeekend ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'

  // Keterangan kartu Masuk (dari field status di database)
  const masukStatus = todayRecord?.check_in_time
    ? (todayRecord.status || 'Hadir')
    : 'Belum Absen'
  const masukStatusColor = !todayRecord?.check_in_time
    ? 'bg-slate-100 text-slate-500'
    : (todayRecord.status?.toLowerCase().includes('terlambat')
        ? 'bg-red-50 text-red-500'
        : 'bg-emerald-50 text-emerald-600')

  // Keterangan kartu Pulang (dikomputasi dari check_out_time)
  let pulangStatus = 'Belum Pulang'
  let pulangStatusColor = 'bg-slate-100 text-slate-500'
  if (todayRecord?.check_out_time) {
    const dOut = new Date(todayRecord.check_out_time)
    const hhmmOut = dOut.getHours().toString().padStart(2, '0') + ':' + dOut.getMinutes().toString().padStart(2, '0')
    if (hhmmOut <= JAM_PULANG_END) {
      pulangStatus = 'Tepat Waktu'
      pulangStatusColor = 'bg-emerald-50 text-emerald-600'
    } else {
      pulangStatus = 'Lembur'
      pulangStatusColor = 'bg-blue-50 text-blue-600'
    }
  }

  const handleAbsen = async () => {
    // Fix 1: guard re-entry sinkron (ref update langsung, beda dgn setState yang async).
    // Mencegah klik ganda / klik lagi saat insert pertama masih in-flight.
    if (submittingRef.current) return
    if ((distance === null || distance > MAX_RADIUS_METERS || !userLoc) || isBelumWaktunyaPulang) return

    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const sekarang = new Date()
      const jamMenitSekarang = sekarang.getHours().toString().padStart(2, '0') + ":" + sekarang.getMinutes().toString().padStart(2, '0')

      if (!todayRecord) {
        // Fix 2: re-verify dari DB (bukan state). Cegah insert duplikat jika insert
        //         pertama ternyata berhasil tapi response-nya hilang (network blip).
        // Use timezone-safe date boundaries for re-verification
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
          // Insert pertama sukses tanpa disadari → pakai record itu, jangan insert lagi.
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
            id: todayRecord.id,                                    // Keep same ID
            check_in_time: todayRecord.check_in_time,             // PRESERVE check-in!
            check_out_time: sekarang.toISOString(),               // New checkout time
            latitude: todayRecord.latitude,                        // PRESERVE check-in location!
            longitude: todayRecord.longitude,                      // PRESERVE check-in location!
            lat_out: userLoc?.lat || 0,                            // Checkout location
            lng_out: userLoc?.lng || 0,                            // Checkout location  
            status: todayRecord.status                             // PRESERVE status!
          })
          .eq('id', todayRecord.id)
          .select().single()

        if (!error) {
          // Force refresh from database to ensure data consistency
          const { data: refreshedData, error: refreshError } = await supabase
            .from('attendance')
            .select('*')
            .eq('id', todayRecord.id)
            .single()
          
          if (!refreshError && refreshedData) {
            // Use fresh data from DB
            setTodayRecord(refreshedData)
            
            // Also refresh history to keep it in sync
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
            // Fallback: use update response if force refresh fails
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

  if (isCheckingRole) {
    return (
      <div className="min-h-screen bg-[#f8faff] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Memuat profil...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8faff] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Memuat Data Presensi...</p>
        </div>
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans flex">
      <Toaster position="top-center" richColors />

      {/* SIDEBAR DESKTOP (Struktur Fixed Sama Seperti Beranda) */}
      <nav className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center">
            <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-12 h-12 object-contain" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Portal</span>
        </div>

        <div className="px-4 flex-1 mt-2 space-y-2">
          {/* TOMBOL KEMBALI KE BERANDA */}
          <button
            onClick={() => router.push('/ojt')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="font-medium">Beranda</span>
          </button>

          {/* TOMBOL PRESENSI (AKTIF) */}
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-blue-600 text-white shadow-md shadow-blue-600/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
            <span className="font-medium">Presensi Lokasi</span>
          </button>

          {/* Menu Laporan Tugas */}
          <button
            onClick={() => router.push('/ojt/tugas')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <span className="font-medium">Laporan Tugas</span>
          </button>

          {/* Menu Pengajuan Izin */}
          <button
            onClick={() => router.push('/ojt/izin')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="font-medium">Pengajuan Izin</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-100">
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
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 font-semibold hover:bg-red-50 rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Keluar Sesi
          </button>
        </div>
      </nav>

      {/* KONTEN UTAMA ABSENSI (Dengan margin kiri untuk desktop) */}
      <main className="flex-1 md:ml-64 flex flex-col h-[100dvh] overflow-hidden relative">
        <header className="px-5 py-5 md:px-8 md:py-6 flex items-center justify-between bg-white md:bg-transparent border-b border-slate-100 md:border-none shadow-sm md:shadow-none z-10">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Tombol Back Khusus Mobile */}
            <button
              onClick={() => router.push('/ojt')}
              className="md:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                Presensi Kehadiran
              </h1>
              <p className="text-slate-500 text-xs md:text-sm font-medium mt-0.5">
                Pastikan Anda berada di area {profile?.asal_kantor || 'MDU'}.
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-6 pt-4 md:pt-0">
          <div className="flex flex-col lg:flex-row gap-6 lg:h-full lg:min-h-[600px]">

            {/* KOLOM KIRI: PETA LOKASI */}
            <div className="flex-none h-[350px] lg:h-auto lg:flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative flex flex-col">
              <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                <h2 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Pelacak Lokasi (GPS)
                </h2>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
                  Sistem Aktif
                </span>
              </div>

              {/* --- BAGIAN PETA DENGAN OVERLAY RADIUS --- */}
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
                  <div className="w-[150px] h-[150px] rounded-full border-4 border-dashed border-blue-500/60 bg-blue-500/10 flex items-center justify-center">
                    <div className="w-3 h-3 bg-blue-600 rounded-full shadow-lg animate-ping"></div>
                  </div>
                </div>

                {/* Label Indikator */}
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm">
                  Radius Absensi: 50 Meter
                </div>
              </div>
            </div>

            {/* KOLOM KANAN: STATUS ABSEN & RIWAYAT */}
            <div className="w-full lg:w-[380px] flex flex-col gap-6">

              {/* KOTAK TANGGAL & JAM */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 md:p-6 relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-50"></div>

                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Tanggal & Waktu
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f8fafc] border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400 font-medium">Hari ini</p>
                      <p className="text-sm font-bold text-slate-800">{tanggalStr}</p>
                    </div>
                    <span className={`shrink-0 px-3 py-1 text-xs font-bold rounded-full ${statusHariColor}`}>
                      {statusHariLabel}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-100 text-center">
                    <p className="text-xs text-slate-400 font-medium mb-1">Waktu Sekarang</p>
                    <p className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight tabular-nums">{currentTime}</p>
                  </div>
                </div>
              </div>

              {/* KOTAK JADWAL PRESENSI HARI INI */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 md:p-6 relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-50"></div>

                <h3 className="text-lg font-bold text-slate-800 mb-4">Jadwal Presensi Hari Ini</h3>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* KARTU KECIL: ABSEN MASUK */}
                  <div className="rounded-2xl bg-blue-50/70 border border-blue-100 p-3.5 flex flex-col shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 shrink-0 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-tight">Jam Masuk</p>
                        <p className="text-[11px] text-slate-500 leading-tight">{JAM_MASUK_START} - {JAM_MASUK_DEADLINE}</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">Absen Anda</p>
                      <p className="text-lg font-black text-slate-800 tabular-nums leading-none">
                        {todayRecord?.check_in_time ? formatTime(todayRecord.check_in_time) : '—'}
                      </p>
                    </div>
                    <span className={`mt-auto w-full text-center px-2.5 py-1 text-[11px] font-bold rounded-full ${masukStatusColor}`}>
                      {masukStatus}
                    </span>
                  </div>

                  {/* KARTU KECIL: ABSEN PULANG */}
                  <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-3.5 flex flex-col shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 shrink-0 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-tight">Jam Pulang</p>
                        <p className="text-[11px] text-slate-500 leading-tight">{JAM_PULANG_START} - {JAM_PULANG_END}</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">Absen Anda</p>
                      <p className="text-lg font-black text-slate-800 tabular-nums leading-none">
                        {todayRecord?.check_out_time ? formatTime(todayRecord.check_out_time) : '—'}
                      </p>
                    </div>
                    <span className={`mt-auto w-full text-center px-2.5 py-1 text-[11px] font-bold rounded-full ${pulangStatusColor}`}>
                      {pulangStatus}
                    </span>
                  </div>
                </div>

                {/* Info jarak GPS */}
                <div className="bg-[#f8fafc] rounded-2xl p-4 text-center mb-4 border border-slate-100">
                  {distance !== null ? (
                    <>
                      <p className="text-3xl font-black text-slate-800 tracking-tight">{distance} <span className="text-lg font-medium text-slate-500">m</span></p>
                      <p className={`text-sm font-semibold mt-1 ${distance <= MAX_RADIUS_METERS ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {distance <= MAX_RADIUS_METERS ? 'Berada di Dalam Jangkauan' : 'Di Luar Radius Kantor'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 py-2">Tekan tombol deteksi lokasi terlebih dahulu untuk melakukan presensi.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={checkLocation}
                    className="w-full flex items-center justify-center gap-2 bg-white border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 text-slate-700 font-bold py-3.5 rounded-xl transition-all text-sm md:text-base"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Deteksi Lokasi GPS
                  </button>
                  <button
                    onClick={handleAbsen}
                    disabled={(distance === null || distance > MAX_RADIUS_METERS) || isSubmitting || (todayRecord?.check_in_time && todayRecord?.check_out_time) || isBelumWaktunyaPulang}
                    className={`w-full font-bold py-3.5 rounded-xl transition-all text-sm md:text-base ${ (distance === null || distance > MAX_RADIUS_METERS) || isSubmitting || (todayRecord?.check_in_time && todayRecord?.check_out_time) || isBelumWaktunyaPulang
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                        : !todayRecord
                          ? 'bg-[#1e1b4b] hover:bg-blue-700 text-white shadow-md'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                      }`}
                  >
                    {isSubmitting ? 'Memproses Data...' :
                      !todayRecord ? 'Presensi Masuk Sekarang' :
                        todayRecord.check_out_time ? 'Presensi Selesai Hari Ini' :
                          isBelumWaktunyaPulang ? `Belum Waktunya Pulang (${JAM_PULANG_START})` : 'Presensi Pulang Sekarang'}
                  </button>

                  {distance !== null && distance > MAX_RADIUS_METERS && (
                    <p className="text-center text-xs text-rose-500 font-medium flex items-center justify-center gap-1.5 mt-2 animate-pulse">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Akses ditolak. Anda berada di luar jangkauan kantor.
                    </p>
                  )}
                </div>
              </div>

              {/* KOTAK RIWAYAT ABSEN */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 md:p-6 flex-1 overflow-hidden flex flex-col min-h-[300px]">
                <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
                  <h3 className="text-lg font-bold text-slate-800">Riwayat Terakhir</h3>
                  <button onClick={() => router.push('/ojt/absen/history')} className="ml-auto text-sm text-indigo-600 hover:underline">Lihat Semua Riwayat</button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-sm text-slate-400 text-center">Sistem belum mencatat aktivitas presensi Anda.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {history.map((item, index) => (
                        <div key={item.id || index} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold
                                ${item.status === 'Terlambat'
                                ? 'bg-red-50 text-red-500'
                                : item.check_out_time
                                  ? 'bg-emerald-50 text-emerald-500'
                                  : 'bg-blue-50 text-blue-600'}`}
                            >
                              {item.check_out_time ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{formatDate(item.check_in_time)}</p>
                              <p className={`text-xs font-semibold ${item.status === 'Terlambat' ? 'text-red-500' : 'text-slate-500'}`}>
                                {item.status}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs text-slate-400 font-medium">
                              Masuk: <span className={`font-bold ${item.status === 'Terlambat' ? 'text-red-500' : 'text-slate-800'}`}>
                                {formatTime(item.check_in_time)}
                              </span>
                            </p>
                            {item.check_out_time && (
                              <p className="text-xs text-slate-400 font-medium">
                                Pulang: <span className="text-emerald-600 font-bold">{formatTime(item.check_out_time)}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

    </div>
  )
}