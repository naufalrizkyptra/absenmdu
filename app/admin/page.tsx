'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [allOjt, setAllOjt] = useState<any[]>([])
  const [allMentors, setAllMentors] = useState<any[]>([])
  const [attendances, setAttendances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchAdminData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // 1. Tarik profil Admin (tambahin avatar_url)
      const { data: adminProfile } = await supabase
        .from('users')
        .select('name, role, avatar_url') 
        .eq('id', user.id)
        .single()
      
      // Keamanan ekstra: Kalau bukan admin, tendang ke login
      if (adminProfile?.role !== 'admin') {
        router.push('/login')
        return
      }
      setProfile(adminProfile)

      // 2. Tarik semua data users (OJT & Mentor)
      const { data: usersData } = await supabase
        .from('users')
        .select('*')

      if (usersData) {
        setAllOjt(usersData.filter(u => u.role === 'ojt'))
        setAllMentors(usersData.filter(u => u.role === 'mentor'))
      }
        
      // 3. Tarik SEMUA data absen hari ini se-MDU
      const today = new Date().toISOString().split('T')[0]
      const { data: absenData } = await supabase
        .from('attendance')
        .select('*, users(name, divisi, asal_kantor)')
        .gte('check_in_time', `${today}T00:00:00`)
        .order('check_in_time', { ascending: false })
        
      if (absenData) setAttendances(absenData)
      
      setLoading(false)
    }

    fetchAdminData()
  }, [router])

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8faff] font-bold">Memuat Dashboard CBO...</div>
  if (!user) return null

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans flex">
      {/* MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          
          {/* Drawer content */}
          <div className="relative flex flex-col w-64 bg-white h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-[#1e1b4b]">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-white tracking-tight">MDU Central</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Menu Items */}
            <div className="px-4 flex-1 mt-4 space-y-2 overflow-y-auto">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Monitoring</p>
              <button 
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-semibold text-sm">Live Absensi</span>
              </button>
              <button 
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-blue-50 hover:text-blue-700 text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                <span className="font-semibold text-sm">Performa Kinerja</span>
              </button>
            </div>

            {/* Profile & Logout */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3 px-2 mb-4">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Admin" className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white object-cover shadow-inner" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1e1b4b] flex items-center justify-center text-sm font-bold text-white shadow-md border-2 border-white">
                    HQ
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{profile?.name}</p>
                  <p className="text-xs text-blue-600 font-medium">Administrator</p>
                </div>
              </div>
              <button 
                onClick={() => { setMobileMenuOpen(false); router.push('/settings'); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all mb-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Pengaturan HQ
              </button>
              <button 
                onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} 
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Keluar Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR ADMIN (DESKTOP) */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Admin" className="w-10 h-10 rounded-xl bg-blue-50 shadow-sm border border-blue-100 object-cover" />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30">
              HQ
            </div>
          )}
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Central</span>
        </div>

        <div className="px-4 flex-1 mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Monitoring</p>
          <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 text-left">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-semibold text-sm">Live Absensi</span>
          </button>
          <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-blue-50 hover:text-blue-700 text-left">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            <span className="font-semibold text-sm">Performa Kinerja</span>
          </button>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={() => router.push('/settings')}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all mb-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Pengaturan HQ
          </button>
          <button 
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Keluar Sesi
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        <div className="bg-[#1e1b4b] pt-8 pb-20 px-6 rounded-b-[40px] md:mx-6 md:mt-6 md:rounded-3xl shadow-xl relative overflow-hidden shrink-0">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute left-1/4 bottom-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 animate-fade-in"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
                  Dashboard Eksekutif, {profile?.name}!
                </h1>
                <p className="text-blue-100 text-xs md:text-sm font-medium mt-1">
                  Rekapitulasi kehadiran seluruh kantor cabang hari ini.
                </p>
              </div>
            </div>

            <button 
              onClick={() => router.push('/settings')}
              className="hidden md:flex p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 items-center justify-center"
              title="Pengaturan Akun"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-12 relative z-10 space-y-6">
          {/* KOTAK STATISTIK NASIONAL */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-xl border border-slate-100 flex flex-col justify-center">
              <p className="text-xs md:text-sm font-semibold text-slate-500 mb-1">Total OJT Aktif</p>
              <p className="text-3xl md:text-4xl font-black text-slate-800">{allOjt.length}</p>
            </div>
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-xl border border-slate-100 flex flex-col justify-center">
              <p className="text-xs md:text-sm font-semibold text-slate-500 mb-1">Total Mentor</p>
              <p className="text-3xl md:text-4xl font-black text-blue-600">{allMentors.length}</p>
            </div>
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-xl border border-slate-100 flex flex-col justify-center">
              <p className="text-xs md:text-sm font-semibold text-slate-500 mb-1">Hadir Hari Ini</p>
              <p className="text-3xl md:text-4xl font-black text-emerald-600">{attendances.length}</p>
            </div>
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-xl border border-slate-100 flex flex-col justify-center">
              <p className="text-xs md:text-sm font-semibold text-slate-500 mb-1">Total Terlambat</p>
              <p className="text-3xl md:text-4xl font-black text-rose-500">
                {attendances.filter(a => a.status === 'Terlambat').length}
              </p>
            </div>
          </div>

          {/* TABEL ABSENSI SEMUA CABANG */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">Log Kehadiran Global</h2>
            </div>
            <div className="p-0 overflow-x-auto">
              {attendances.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm font-semibold text-slate-400">Belum ada data absensi masuk hari ini.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs uppercase font-bold tracking-wider border-b border-slate-100">
                      <th className="p-4 pl-6">Nama Lengkap</th>
                      <th className="p-4">Cabang</th>
                      <th className="p-4">Divisi</th>
                      <th className="p-4">In</th>
                      <th className="p-4">Out</th>
                      <th className="p-4 text-right pr-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {attendances.map((absen) => (
                      <tr key={absen.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 pl-6 font-bold text-slate-800 text-sm">{absen.users?.name || 'Tanpa Nama'}</td>
                        <td className="p-4 text-xs font-semibold text-slate-600">{absen.users?.asal_kantor || '-'}</td>
                        <td className="p-4 text-xs font-medium text-slate-500">{absen.users?.divisi || '-'}</td>
                        <td className="p-4 text-sm font-bold text-slate-800">{formatTime(absen.check_in_time)}</td>
                        <td className="p-4 text-sm font-bold text-emerald-600">{absen.check_out_time ? formatTime(absen.check_out_time) : '-'}</td>
                        <td className="p-4 pr-6 text-right">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            absen.status === 'Terlambat' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {absen.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}