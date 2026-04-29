'use client'

import { createOJTAccount, resetPasswordByMentor } from './actions'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    nip: '', name: '', asal_sekolah: '', divisi: 'Multimedia', asal_kantor: 'Jatiwaringin', no_telp: '', start_period: '', end_period: ''
  })

  // 1. Ambil Profil & Data Tim (Hanya jalan sekali saat awal load)
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: mentorProfile } = await supabase.from('users').select('name, avatar_url').eq('id', user.id).single()
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
    // 1. Bikin file Excel baru
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data Kehadiran')

    // 2. Bikin Header (Judul Kolom) beserta lebar kolomnya
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

    // 3. Masukin datanya baris demi baris
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

    // 4. PROSES STYLING & BORDERING
    // Bikin tulisan header jadi tebal (Bold) dan posisinya di tengah
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    // Looping buat ngasih garis (Border) ke semua kotak yang ada isinya
    worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
      row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
        // Kasih garis kotak
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
        
        // Bikin data di bawah header posisinya di tengah vertikal
        if (rowNumber !== 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
          // Khusus Jam dan Status kita taruh tengah biar rapi
          if (colNumber >= 5) cell.alignment = { vertical: 'middle', horizontal: 'center' }
        }
      })
    })

    // 5. Download filenya otomatis
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Laporan_Kehadiran_OJT_${selectedDate}.xlsx`)
  }

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const getFormattedDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f4f7fe]">Memuat Dashboard Mentor...</div>
  if (!user) return null

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fe] flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR (KHUSUS DESKTOP) */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col shadow-sm z-10 shrink-0">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-xl bg-slate-100 shadow-sm object-cover" />
            ) : (
              <div className="w-10 h-10 bg-[#1e1b4b] rounded-xl flex items-center justify-center text-white font-bold text-xl">M</div>
            )}
            <span className="text-xl font-bold text-slate-800 tracking-tight">Panel Mentor</span>
          </div>
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu Navigasi</p>
          <nav className="space-y-1.5">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-[#1e1b4b] text-white shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <span className="font-medium">Overview Tim</span>
            </button>
            <button onClick={() => router.push('/mentor/data-ojt')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <span className="font-medium">Data Peserta OJT</span>
            </button>
            <button onClick={() => router.push('/mentor/penilaian')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="font-medium">Penilaian & Sertifikat</span>
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
          <button onClick={() => router.push('/settings')} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-2 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Pengaturan Akun
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:text-red-700 transition-colors font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-[100dvh] md:h-screen overflow-hidden relative">
        <header className="px-5 py-5 md:px-8 md:py-6 flex items-center justify-between bg-white md:bg-transparent border-b border-slate-100 md:border-none shadow-sm md:shadow-none z-10">
          <div className="flex items-center gap-3 md:block">
            <div className="md:hidden relative">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-10 h-10 rounded-xl bg-slate-100 object-cover border border-slate-200" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#1e1b4b] flex items-center justify-center text-white font-bold">M</div>
              )}
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">Halo, {profile?.name || 'Mentor'}!</h1>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1">
                Memantau kinerja dan kehadiran tim Anda untuk tanggal <strong>{getFormattedDate(selectedDate)}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/settings')} className="hidden md:block p-3.5 rounded-2xl bg-white border border-slate-100 hover:bg-slate-50 transition-all shadow-sm group">
              <svg className="w-6 h-6 text-slate-600 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="md:hidden p-2.5 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-28 md:pb-8">
          <div className="space-y-6">
            
            {/* STATS SUMMARY (Berdasarkan tanggal yang dipilih) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Tim</p>
                <p className="text-2xl font-black text-slate-800">{mentees.length} <span className="text-sm font-medium text-slate-400">Peserta</span></p>
              </div>
              <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100">
                <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">Hadir</p>
                <p className="text-2xl font-black text-emerald-700">{attendances.length}</p>
              </div>
              <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100">
                <p className="text-rose-600 text-xs font-bold uppercase tracking-wider mb-1">Alpa</p>
                <p className="text-2xl font-black text-rose-700">{mentees.length - attendances.length}</p>
              </div>
              <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100">
                <p className="text-amber-600 text-xs font-bold uppercase tracking-wider mb-1">Terlambat</p>
                <p className="text-2xl font-black text-amber-700">{attendances.filter(a => a.status === 'Terlambat').length}</p>
              </div>
            </div>

            {/* TABEL UTAMA: PANTAU KEHADIRAN */}
            <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 md:p-6 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                <h2 className="text-base md:text-lg font-bold text-slate-800">Status Kehadiran Tim</h2>
                
                {/* AKSI: FILTER TANGGAL & EXPORT EXCEL */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <input 
                      type="date" 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                  </div>
                  <button 
                    onClick={handleExportExcel}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-all shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span className="hidden sm:inline">Unduh Excel</span>
                    <span className="sm:hidden">Excel</span>
                  </button>
                </div>

              </div>
              <div className="p-0 overflow-x-auto custom-scrollbar">
                {mentees.length === 0 ? (
                  <div className="text-center py-10"><p className="text-sm text-slate-400">Belum ada data peserta OJT yang terdaftar.</p></div>
                ) : (
                  <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold pl-4 md:pl-6">Nama & NIP</th>
                        <th className="p-4 font-semibold">Status Absen</th>
                        <th className="p-4 font-semibold">Jam Masuk</th>
                        <th className="p-4 font-semibold">Jam Pulang</th>
                        <th className="p-4 font-semibold text-right pr-4 md:pr-6">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mentees.map((m) => {
                        const absenHariIni = attendances.find(a => a.user_id === m.id)

                        return (
                          <tr key={m.id} className={`transition-colors ${!absenHariIni ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50'}`}>
                            
                            <td className="p-4 pl-4 md:pl-6">
                              <div className="font-bold text-slate-800">{m.name}</div>
                              <div className="text-xs font-medium text-slate-500 mt-0.5">{m.nip || '-'} • {m.divisi}</div>
                            </td>
                            
                            <td className="p-4">
                              {absenHariIni ? (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${absenHariIni.status === 'Terlambat' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                  ● {absenHariIni.status}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-600 shadow-sm border border-rose-200">
                                  ● Belum Absen / Alpa
                                </span>
                              )}
                            </td>
                            
                            <td className="p-4 text-sm font-bold text-slate-700">
                              {absenHariIni ? formatTime(absenHariIni.check_in_time) : '-'}
                            </td>

                            <td className="p-4 text-sm font-bold text-emerald-600">
                              {absenHariIni?.check_out_time ? formatTime(absenHariIni.check_out_time) : '-'}
                            </td>
                            
                            <td className="p-4 text-right pr-4 md:pr-6 flex justify-end items-center">
                              {!absenHariIni && (
                                <a 
                                  href={`https://wa.me/${m.no_telp?.replace(/^0/, '62')}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold transition-all"
                                >
                                  Hubungi WA
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
        </div>
      </main>

      {/* BOTTOM NAVIGATION (KHUSUS MOBILE) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 pb-safe pt-2 px-6 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex justify-between items-center pb-4">
          <button className="flex flex-col items-center p-2 flex-1 transition-colors text-[#1e1b4b]">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-[10px] font-semibold">Overview Tim</span>
          </button>
          
          <button onClick={() => router.push('/mentor/data-ojt')} className="flex flex-col items-center p-2 flex-1 transition-colors text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            <span className="text-[10px] font-semibold">Data Tim</span>
          </button>
          
          <button onClick={() => router.push('/settings')} className="flex flex-col items-center p-2 flex-1 transition-colors text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[10px] font-semibold">Profil</span>
          </button>
        </div>
      </div>

    </div>
  )
}