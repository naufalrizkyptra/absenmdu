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

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f4f7fe]">Memuat Dashboard CBO...</div>
  if (!user) return null

  return (
    <div className="min-h-screen bg-[#f4f7fe] flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR ADMIN */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col shadow-sm z-10">
        <div className="p-6 flex items-center gap-3">
          {/* Tampilkan Avatar Admin kalau udah di-set, kalau belum pakai logo HQ */}
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Admin" className="w-10 h-10 rounded-xl bg-blue-50 shadow-sm border border-blue-100 object-cover" />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30">
              HQ
            </div>
          )}
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Central</span>
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Monitoring</p>
          <nav className="space-y-1.5">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-blue-600 text-white shadow-md shadow-blue-600/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="font-medium">Live Absensi</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
              <span className="font-medium">Performa Kinerja</span>
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
          <button 
            onClick={() => router.push('/settings')}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-2 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Pengaturan HQ
          </button>
          <button 
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:text-red-700 transition-colors font-semibold"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white/50 backdrop-blur-md md:bg-transparent px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Dashboard Eksekutif, {profile?.name}!
            </h1>
            <p className="text-sm text-slate-500 mt-1">Rekapitulasi kehadiran seluruh kantor cabang hari ini.</p>
          </div>
          
          {/* Tombol Settings Top Right (Opsional, mempermudah kalau lagi layar kecil) */}
          <button 
            onClick={() => router.push('/settings')}
            className="p-3.5 rounded-2xl bg-white border border-slate-100 hover:bg-slate-50 transition-all shadow-sm group hidden md:block"
            title="Pengaturan Akun"
          >
            <svg className="w-6 h-6 text-slate-600 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-auto px-8 pb-24 md:pb-8 space-y-6">
          
          {/* KOTAK STATISTIK NASIONAL */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-500 mb-1">Total OJT Aktif</p>
              <p className="text-4xl font-black text-slate-800">{allOjt.length}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-500 mb-1">Total Mentor</p>
              <p className="text-4xl font-black text-blue-600">{allMentors.length}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-500 mb-1">Hadir Hari Ini</p>
              <p className="text-4xl font-black text-emerald-600">{attendances.length}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-500 mb-1">Total Terlambat</p>
              <p className="text-4xl font-black text-rose-500">
                {attendances.filter(a => a.status === 'Terlambat').length}
              </p>
            </div>
          </div>

          {/* TABEL ABSENSI SEMUA CABANG */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">Log Kehadiran Global</h2>
            </div>
            <div className="p-0 overflow-x-auto">
              {attendances.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-400">Belum ada data absensi masuk hari ini.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="p-4 font-semibold pl-6">Nama Lengkap</th>
                      <th className="p-4 font-semibold">Cabang</th>
                      <th className="p-4 font-semibold">Divisi</th>
                      <th className="p-4 font-semibold">In</th>
                      <th className="p-4 font-semibold">Out</th>
                      <th className="p-4 font-semibold text-right pr-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendances.map((absen) => (
                      <tr key={absen.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 pl-6 font-bold text-slate-800">{absen.users?.name || 'Tanpa Nama'}</td>
                        <td className="p-4 text-sm font-medium text-slate-600">{absen.users?.asal_kantor || '-'}</td>
                        <td className="p-4 text-sm text-slate-500">{absen.users?.divisi || '-'}</td>
                        <td className="p-4 text-sm font-bold text-slate-800">{formatTime(absen.check_in_time)}</td>
                        <td className="p-4 text-sm font-bold text-emerald-600">{absen.check_out_time ? formatTime(absen.check_out_time) : '-'}</td>
                        <td className="p-4 pr-6 text-right">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
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