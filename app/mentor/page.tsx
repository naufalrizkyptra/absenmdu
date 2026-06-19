'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster } from 'sonner'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

export default function MentorDashboard() {
  const [user, setUser] = useState<any>(null)
  const [mentees, setMentees] = useState<any[]>([])
  
  // STATE BARU: Menyimpan tanggal yang dipilih (Default: Hari Ini)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'))
  const [attendances, setAttendances] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // 1. Ambil Profil & Data Tim (Hanya jalan sekali saat awal load)
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: mentorProfile } = await supabase.from('users').select('name, avatar_url, divisi').eq('id', user.id).single()
      if (mentorProfile) setProfile(mentorProfile)

      const { data: teamData } = await supabase.from('users').select('*').eq('mentor_id', user.id).eq('role', 'ojt')
      if (teamData) setMentees(teamData)
      
      setLoading(false)
    }
    fetchInitialData()
  }, [router])

  // 2. Ambil Absen berdasarkan Tanggal yang dipilih (Jalan otomatis tiap tanggal diganti)
  useEffect(() => {
    const fetchAttendanceByDate = async () => {
      if (mentees.length === 0) return

      const menteeIds = mentees.map(m => m.id)
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*, users(name, divisi)')
        .in('user_id', menteeIds)
        .gte('check_in_time', `${selectedDate}T00:00:00`)
        .lte('check_in_time', `${selectedDate}T23:59:59`)
        .order('check_in_time', { ascending: false })
        
      setAttendances(attendanceData || [])
    }
    fetchAttendanceByDate()
  }, [selectedDate, mentees])

  // FUNGSI EXPORT KE EXCEL
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data Kehadiran')

    worksheet.columns = [
      { header: 'NIP', key: 'nip', width: 15 },
      { header: 'Nama Peserta', key: 'name', width: 30 },
      { header: 'Asal Institusi', key: 'sekolah', width: 25 },
      { header: 'Divisi', key: 'divisi', width: 20 },
      { header: 'Tanggal', key: 'tanggal', width: 20 },
      { header: 'Jam Masuk', key: 'masuk', width: 15 },
      { header: 'Jam Pulang', key: 'pulang', width: 15 },
      { header: 'Status Kehadiran', key: 'status', width: 20 }
    ]

    mentees.forEach(m => {
      const absen = attendances.find(a => a.user_id === m.id)
      worksheet.addRow({
        nip: m.nip || '-',
        name: m.name,
        sekolah: m.asal_sekolah || '-',
        divisi: m.divisi,
        tanggal: new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        masuk: absen ? formatTime(absen.check_in_time) : '-',
        pulang: absen?.check_out_time ? formatTime(absen.check_out_time) : '-',
        status: absen ? absen.status : 'Alpa / Belum Absen'
      })
    })

    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
      row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        if (rowNumber !== 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
          if (colNumber >= 5) cell.alignment = { vertical: 'middle', horizontal: 'center' }
        }
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Laporan_Kehadiran_Tim_${selectedDate}.xlsx`)
  }

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const getFormattedDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8faff] text-indigo-950 font-medium">Memuat Panel Mentor...</div>
  if (!user) return null

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans flex">
      <Toaster position="top-center" richColors />

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
                <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-8 h-8 object-contain" />
                <span className="text-lg font-bold text-white tracking-tight">MDU Panel</span>
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
              <button 
                onClick={() => { setMobileMenuOpen(false); router.push('/mentor'); }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="font-semibold text-sm">Ikhtisar Tim</span>
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); router.push('/mentor/data-ojt'); }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                <span className="font-semibold text-sm">Data Peserta</span>
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); router.push('/mentor/tugas'); }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span className="font-semibold text-sm">Verifikasi Tugas</span>
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); router.push('/mentor/izin'); }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-semibold text-sm">Data Izin</span>
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); router.push('/mentor/penilaian'); }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-semibold text-sm">Penilaian Evaluasi</span>
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); router.push('/settings'); }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="font-semibold text-sm">Pengaturan Akun</span>
              </button>
            </div>

            {/* Profile & Logout */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3 px-2 mb-4">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white object-cover shadow-inner" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1e1b4b] flex items-center justify-center text-sm font-bold text-white shadow-md border-2 border-white">
                    {profile?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{profile?.name}</p>
                  <p className="text-xs text-indigo-600 font-medium">Mentor Eksekutif</p>
                </div>
              </div>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Keluar Sesi
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* =========================================
          1. SIDEBAR (KHUSUS DESKTOP) 
          ========================================= */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Panel</span>
        </div>

        <div className="px-4 flex-1 mt-4 space-y-2">
          <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="font-semibold text-sm">Ikhtisar Tim</span>
          </button>
          <button onClick={() => router.push('/mentor/data-ojt')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <span className="font-semibold text-sm">Data Peserta</span>
          </button>
          <button onClick={() => router.push('/mentor/tugas')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <span className="font-semibold text-sm">Verifikasi Tugas</span>
          </button>
          <button onClick={() => router.push('/mentor/izin')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="font-semibold text-sm">Data Izin</span>
          </button>
          <button onClick={() => router.push('/mentor/penilaian')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="font-semibold text-sm">Penilaian Evaluasi</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 px-2 mb-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white object-cover shadow-inner" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1e1b4b] flex items-center justify-center text-sm font-bold text-white shadow-md border-2 border-white">
                {profile?.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{profile?.name}</p>
              <p className="text-xs text-indigo-600 font-medium">Mentor Eksekutif</p>
            </div>
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Keluar Sesi
          </button>
        </div>
      </aside>

      {/* =========================================
          2. MAIN CONTENT AREA 
          ========================================= */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        
        {/* HEADER BERWARNA ALA MDU */}
        <div className="bg-[#1e1b4b] pt-8 pb-20 px-6 rounded-b-[40px] md:mx-6 md:mt-6 md:rounded-3xl shadow-xl relative overflow-hidden shrink-0">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>
          <div className="absolute left-1/4 bottom-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="md:hidden relative">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-12 h-12 rounded-xl bg-slate-100 object-cover border-2 border-white/20" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold border-2 border-white/20">M</div>
                )}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
                  Halo, <span className="text-orange-300">{profile?.name}</span>!
                </h1>
                <p className="text-blue-100 text-xs md:text-sm font-medium mt-1">
                  Pantau kehadiran dan produktivitas tim kreatif Anda hari ini.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/settings')} className="hidden md:flex p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 tooltip-trigger" title="Pengaturan Akun">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>

              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* AREA KONTEN BAWAH (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-12 relative z-10">
          
          {/* STATS SUMMARY CARD */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
            <div className="bg-white p-5 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center">
              <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Total Tim</p>
              <p className="text-3xl font-black text-slate-800">{mentees.length}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-5 rounded-3xl shadow-lg shadow-emerald-500/20 text-white flex flex-col items-center justify-center text-center">
              <p className="text-emerald-100 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Kehadiran</p>
              <p className="text-3xl font-black">{attendances.length}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-xl border border-rose-100 flex flex-col items-center justify-center text-center">
              <p className="text-rose-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Alpa / Izin</p>
              <p className="text-3xl font-black text-rose-600">{mentees.length - attendances.length}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-xl border border-amber-100 flex flex-col items-center justify-center text-center">
              <p className="text-amber-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Terlambat</p>
              <p className="text-3xl font-black text-amber-600">{attendances.filter(a => a.status === 'Terlambat').length}</p>
            </div>
          </div>

          {/* TABEL UTAMA: PANTAU KEHADIRAN */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              <div>
                <h2 className="text-lg font-bold text-slate-800">Catatan Absensi Tim</h2>
                <p className="text-xs text-slate-500 mt-0.5">Pantauan untuk tanggal: {getFormattedDate(selectedDate)}</p>
              </div>
              
              {/* FILTER & EXPORT */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full sm:w-auto pl-4 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all"
                  />
                </div>
                <button 
                  onClick={handleExportExcel}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all shrink-0 hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="hidden sm:inline">Unduh Excel</span>
                  <span className="sm:hidden">Excel</span>
                </button>
              </div>

            </div>
            
            {/* DATA TABEL */}
            <div className="p-0 overflow-x-auto custom-scrollbar">
              {mentees.length === 0 ? (
                <div className="text-center py-16 opacity-60">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-sm font-bold text-slate-700">Tim Kosong</p>
                  <p className="text-xs text-slate-400 mt-1">Belum ada peserta OJT yang ditugaskan kepada Anda.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-4 pl-6">Profil Peserta</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Waktu Masuk</th>
                      <th className="p-4">Waktu Pulang</th>
                      <th className="p-4 text-right pr-6">Kontak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mentees.map((m) => {
                      const absenHariIni = attendances.find(a => a.user_id === m.id)

                      return (
                        <tr key={m.id} className={`transition-colors hover:bg-slate-50/50 ${!absenHariIni ? 'bg-rose-50/20' : ''}`}>
                          
                          <td className="p-4 pl-6">
                            <div className="font-bold text-slate-800">{m.name}</div>
                            <div className="text-xs font-semibold text-slate-400 mt-0.5">{m.nip || '-'} • <span className="text-indigo-600">{m.divisi}</span></div>
                          </td>
                          
                          <td className="p-4">
                            {absenHariIni ? (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-inner ${absenHariIni.status === 'Terlambat' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${absenHariIni.status === 'Terlambat' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                {absenHariIni.status}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-rose-50 text-rose-700 border border-rose-100 shadow-inner">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                Belum Absen
                              </span>
                            )}
                          </td>
                          
                          <td className="p-4 text-sm font-bold text-slate-700">
                            {absenHariIni ? (
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                                {formatTime(absenHariIni.check_in_time)}
                              </div>
                            ) : '-'}
                          </td>

                          <td className="p-4 text-sm font-bold text-emerald-600">
                            {absenHariIni?.check_out_time ? (
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                {formatTime(absenHariIni.check_out_time)}
                              </div>
                            ) : '-'}
                          </td>
                          
                          <td className="p-4 text-right pr-6">
                            {!absenHariIni && m.no_telp && (
                              <a 
                                href={`https://wa.me/${m.no_telp?.replace(/^0/, '62')}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center justify-center w-8 h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all tooltip-trigger border border-emerald-100 shadow-inner"
                                title="Hubungi via WhatsApp"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })}
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