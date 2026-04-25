'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// --- KORDINAT KANTOR MDU ---
const OFFICE_LAT = -6.247899682220398
const OFFICE_LNG = 106.90729045201107
const MAX_RADIUS_METERS = 50 

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

export default function Dashboard() {
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('absen')
  const router = useRouter()
  const [isCheckingRole, setIsCheckingRole] = useState(true)

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return } 
      setUser(user)

      // 1. Tarik profil dan TAMBAHIN kolom 'role' buat dicek
      const { data: userProfile } = await supabase
        .from('users')
        .select('role, name, avatar_url, divisi, asal_kantor') // <-- role ditambahin
        .eq('id', user.id)
        .single()

      // 2. LOGIKA SATPAM: Cek role-nya sekarang!
      if (userProfile?.role === 'admin') {
        router.push('/admin')
        return // Langsung stop proses, biarin dia pindah halaman
      } else if (userProfile?.role === 'mentor') {
        router.push('/mentor')
        return // Langsung stop proses
      }

      // 3. KALAU LOLOS (Berarti anak OJT): Matikan loading satpam dan lanjut narik data absen
      setIsCheckingRole(false) 
      if (userProfile) setProfile(userProfile)

      // Tarik data absensi hari ini
      const today = new Date().toISOString().split('T')[0]
      const { data: todayData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .maybeSingle()

      setTodayRecord(todayData)

      // Tarik history absen
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
      alert('Browser lu ga support GPS cuy!')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setUserLoc({ lat, lng })

        const dist = getDistance(lat, lng, OFFICE_LAT, OFFICE_LNG)
        setDistance(Math.round(dist))
      },
      (error) => alert('Tolong izinin akses lokasi (GPS) buat absen ya!'),
      { enableHighAccuracy: true }
    )
  }

  const JAM_MASUK_DEADLINE = "09:00"

  const handleAbsen = async () => {
    if (distance === null || distance > MAX_RADIUS_METERS || !userLoc) return
    setIsSubmitting(true)
    const sekarang = new Date()
    const jamMenitSekarang = sekarang.getHours().toString().padStart(2, '0') + ":" + sekarang.getMinutes().toString().padStart(2, '0')

    if (!todayRecord) {
      const isTerlambat = jamMenitSekarang > JAM_MASUK_DEADLINE
      const { data, error } = await supabase
        .from('attendance')
        .insert([{ 
          user_id: user.id, 
          check_in_time: new Date().toISOString(),
          latitude: userLoc.lat,
          longitude: userLoc.lng,
          status: isTerlambat ? 'Terlambat' : 'Hadir'
        }])
        .select().single()

      if (!error) {
        setTodayRecord(data)
        setHistory([data, ...history].slice(0, 5))
        alert(`Absen masuk sukses jam ${jamMenitSekarang}. Semangat kerjanya!`)
      } else {
        console.error(error)
        alert("Gagal absen masuk euy!")
      }
    } else {
      const { data, error } = await supabase
      .from('attendance')
      .update({ 
        check_out_time: sekarang.toISOString(),
        lat_out: userLoc.lat,
        lng_out: userLoc.lng
      })
      .eq('id', todayRecord.id)
      .select().single()

      if (!error) {
        setTodayRecord(data)
        setHistory(history.map(h => h.id === data.id ? data : h))
        alert(`Berhasil absen pulang jam ${jamMenitSekarang}. Hati-hati di jalan!`)
      } else {
        console.error("Detail Error:", error)
        alert("Gagal absen pulang!")
      }
    }
    setIsSubmitting(false)
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const mapCenterLat = userLoc ? userLoc.lat : OFFICE_LAT
  const mapCenterLng = userLoc ? userLoc.lng : OFFICE_LNG

  if (isCheckingRole) {
    return (
      <div className="min-h-screen bg-[#f4f7fe] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e1b4b]"></div>
      </div>
    )
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f4f7fe]">Loading Data...</div>
  if (!user) return null

  return (
    <div className="min-h-screen bg-[#f4f7fe] flex flex-col md:flex-row font-sans">
      
      {/* 1. SIDEBAR (Khusus Desktop - Hidden di Mobile) */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col shadow-sm z-10">
        <div className="p-6 flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center">
            {/* PASTIKAN IMPORT IMAGE DARI NEXT/IMAGE SUDAH ADA DI ATAS */}
            <img
              src="/logo-mdu.PNG"
              alt="MDU Logo"
              className="w-12 h-12 object-contain"
            />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Portal</span>
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu Utama</p>
          <nav className="space-y-1.5">
            <button 
              onClick={() => setActiveTab('absen')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'absen' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="font-medium">Absensi Lokasi</span>
            </button>
            <button 
              onClick={() => setActiveTab('tugas')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'tugas' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              <span className="font-medium">Daftar Tugas</span>
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 mb-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#1e1b4b] flex items-center justify-center text-sm font-bold text-white">
                {profile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{profile?.name || user?.email}</p>
              <p className="text-xs text-slate-500">{profile?.divisi || 'OJT Member'}</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/settings')}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Pengaturan Akun
          </button>
          <button 
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:text-red-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Keluar
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      {/* Pakai h-[100dvh] biar full screen di HP (nggak kepotong address bar) */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        
        {/* Header (Top Bar) */}
        <header className="px-5 py-5 md:px-8 md:py-8 flex items-center justify-between bg-white md:bg-transparent border-b border-slate-100 md:border-none shadow-sm md:shadow-none z-10">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Profile" 
                  className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white shadow-sm border border-slate-100 object-cover"
                />
              ) : (
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-[#1e1b4b] flex items-center justify-center text-white text-xl md:text-2xl font-bold">
                  {profile?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-emerald-500 border-2 border-white rounded-full"></div>
            </div>

            <div>
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                Halo, {profile?.name || 'Rekan MDU'}!
              </h1>
              <p className="text-slate-500 text-xs md:text-sm font-medium mt-0.5">
                {profile?.divisi || 'Tim OJT'} • {profile?.asal_kantor || 'MDU'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Settings (Khusus Desktop) */}
            <button 
              onClick={() => router.push('/settings')}
              className="hidden md:block p-3.5 rounded-2xl bg-white border border-slate-100 hover:bg-slate-50 transition-all shadow-sm group"
              title="Pengaturan Akun"
            >
              <svg className="w-6 h-6 text-slate-600 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>

            {/* Tombol Logout (Khusus Mobile) */}
            <button 
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="md:hidden p-3 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all shadow-sm"
              title="Keluar Akun"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-28 md:pb-6 pt-4 md:pt-0">
          
          {activeTab === 'absen' && (
            <div className="flex flex-col lg:flex-row gap-6 lg:h-full lg:min-h-[600px]">
              
              {/* Kolom Kiri: Peta Gmaps (FIX: h-[350px] buat mobile biar nggak ilang) */}
              <div className="flex-none h-[350px] lg:h-auto lg:flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative flex flex-col">
                <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                  <h2 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Live Tracker
                  </h2>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
                    GPS Active
                  </span>
                </div>
                <div className="flex-1 relative bg-slate-100">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    style={{ border: 0 }} 
                    src={`https://maps.google.com/maps?q=${mapCenterLat},${mapCenterLng}&z=17&output=embed`} 
                    allowFullScreen
                    className="absolute inset-0"
                  ></iframe>
                </div>
              </div>

              {/* Kolom Kanan: Kotak Aksi */}
              <div className="w-full lg:w-[380px] flex flex-col gap-6">
                
                {/* Kotak Absen */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 md:p-6 relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-50"></div>
                  
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Status Kehadiran</h3>
                  
                  <div className="bg-[#f8fafc] rounded-2xl p-5 text-center mb-5 border border-slate-100">
                    {distance !== null ? (
                      <>
                        <p className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">{distance} <span className="text-lg md:text-xl font-medium text-slate-500">m</span></p>
                        <p className={`text-sm font-semibold mt-2 ${distance <= MAX_RADIUS_METERS ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {distance <= MAX_RADIUS_METERS ? 'Dalam Jangkauan' : 'Di Luar Radius Kantor'}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500 py-2">Tekan tombol deteksi lokasi terlebih dahulu.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={checkLocation}
                      className="w-full flex items-center justify-center gap-2 bg-white border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 text-slate-700 font-bold py-3.5 rounded-xl transition-all text-sm md:text-base"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Deteksi Lokasi
                    </button>

                    <button 
                      onClick={handleAbsen}
                      disabled={distance === null || distance > MAX_RADIUS_METERS || isSubmitting || (todayRecord?.check_in_time && todayRecord?.check_out_time)}
                      className={`w-full font-bold py-3.5 rounded-xl transition-all text-sm md:text-base ${
                        // Logika CSS: Kalau radius kejauhan atau udah absen pulang, bikin tombolnya abu-abu mati
                        distance === null || distance > MAX_RADIUS_METERS || isSubmitting || (todayRecord?.check_in_time && todayRecord?.check_out_time)
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200' 
                          : !todayRecord 
                            ? 'bg-[#1e1b4b] hover:bg-blue-700 text-white shadow-md' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' 
                      }`}
                    >
                      {isSubmitting ? 'Mencatat...' : 
                      !todayRecord ? 'Absen Masuk Sekarang' : 
                      todayRecord.check_out_time ? 'Tugas Selesai Hari Ini' : 'Absen Pulang Sekarang'}
                    </button>

                    {/* MUNCULIN TEKS PERINGATAN KALAU DI LUAR RADIUS */}
                    {distance !== null && distance > MAX_RADIUS_METERS && (
                      <p className="text-center text-xs text-rose-500 font-medium flex items-center justify-center gap-1.5 mt-2 animate-pulse">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Anda berada di luar jangkauan, tidak bisa absen.
                      </p>
                    )}
                  </div>
                </div>

                {/* Kotak History */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 md:p-6 flex-1 overflow-hidden flex flex-col min-h-[300px]">
                  <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
                    <h3 className="text-lg font-bold text-slate-800">Riwayat Absen</h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {history.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-slate-400 text-center">Belum ada aktivitas absensi.</p>
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
                                In: <span className={`font-bold ${item.status === 'Terlambat' ? 'text-red-500' : 'text-slate-800'}`}>
                                  {formatTime(item.check_in_time)}
                                </span>
                              </p>
                              {item.check_out_time && (
                                <p className="text-xs text-slate-400 font-medium">
                                  Out: <span className="text-emerald-600 font-bold">{formatTime(item.check_out_time)}</span>
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
          )}

          {activeTab === 'tugas' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-10 text-center h-[500px] flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Modul Tugas</h2>
              <p className="text-sm md:text-base text-slate-500 max-w-sm mx-auto">Ruang untuk memantau tugas harian dan setoran konten lagi disiapin.</p>
            </div>
          )}

        </div>
      </main>

      {/* 3. BOTTOM NAVIGATION (Khusus Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 pb-safe pt-2 px-6 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex justify-between items-center pb-4">
          <button onClick={() => setActiveTab('absen')} className={`flex flex-col items-center p-2 flex-1 transition-colors ${activeTab === 'absen' ? 'text-blue-600' : 'text-slate-400'}`}>
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[10px] font-semibold">Absen</span>
          </button>
          
          <button onClick={() => setActiveTab('tugas')} className={`flex flex-col items-center p-2 flex-1 transition-colors ${activeTab === 'tugas' ? 'text-blue-600' : 'text-slate-400'}`}>
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <span className="text-[10px] font-semibold">Tugas</span>
          </button>
          
          <button onClick={() => router.push('/settings')} className="flex flex-col items-center p-2 flex-1 transition-colors text-slate-400">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[10px] font-semibold">Profil</span>
          </button>
        </div>
      </div>

    </div>
  )
}