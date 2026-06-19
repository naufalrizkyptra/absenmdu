'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'

export default function VerifikasiIzinPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [izinData, setIzinData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('Menunggu Verifikasi')
  const router = useRouter()

  useEffect(() => {
    const fetchMentorAndIzin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: mentorProfile } = await supabase
        .from('users')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single()
      if (mentorProfile) setProfile(mentorProfile)

      const { data: mentees } = await supabase
        .from('users')
        .select('id')
        .eq('mentor_id', user.id)
        .eq('role', 'ojt')

      if (mentees && mentees.length > 0) {
        const menteeIds = mentees.map(m => m.id)
        const { data: dataIzin } = await supabase
          .from('izin_ojt')
          .select('*, users(name, divisi, nip)')
          .in('user_id', menteeIds)
          .order('created_at', { ascending: false })

        if (dataIzin) setIzinData(dataIzin)
      }
      setLoading(false)
    }
    fetchMentorAndIzin()
  }, [router])

  const handleUpdateStatus = async (izinId: string, userId: string, tanggalIzin: string, kategori: string, newStatus: 'Disetujui' | 'Ditolak') => {
    const toastId = toast.loading(`Memproses verifikasi...`)
    
    try {
      const { error } = await supabase.from('izin_ojt').update({ status: newStatus }).eq('id', izinId)

      if (error) throw error

      if (newStatus === 'Disetujui') {
        const checkInTime = new Date(`${tanggalIzin}T08:00:00+07:00`).toISOString()
        const checkOutTime = new Date(`${tanggalIzin}T14:00:00+07:00`).toISOString()

        const { error: absensiError } = await supabase.from('attendance').insert([{
          user_id: userId,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          status: kategori, // "Sakit" atau "Izin"
          latitude: 0,
          longitude: 0,
          lat_out: 0,
          lng_out: 0
        }])

        if (absensiError) {
          console.error('Gagal memasukkan absensi:', absensiError)
          toast.warning(`Status Izin berhasil disetujui, namun gagal masuk ke data absensi.`, { id: toastId })
        } else {
          toast.success(`Izin berhasil disetujui dan dicatat ke Absensi harian!`, { id: toastId })
        }
      } else {
        toast.success(`Pengajuan Izin Ditolak`, { id: toastId })
      }

      setIzinData(izinData.map(t => t.id === izinId ? { ...t, status: newStatus } : t))
    } catch (err: any) {
      toast.error(`Terjadi kesalahan: ${err.message}`, { id: toastId })
    }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  const filteredIzin = izinData.filter(t => t.status === filterStatus)

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8faff] font-bold text-indigo-900">Memuat Panel Verifikasi Izin...</div>

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans flex">
      <Toaster position="top-center" richColors />

      {/* MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          
          <div className="relative flex flex-col w-64 bg-white h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200">
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

            <div className="px-4 flex-1 mt-4 space-y-2 overflow-y-auto">
              <button onClick={() => { setMobileMenuOpen(false); router.push('/mentor'); }} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="font-semibold text-sm">Ikhtisar Tim</span>
              </button>
              <button onClick={() => { setMobileMenuOpen(false); router.push('/mentor/data-ojt'); }} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                <span className="font-semibold text-sm">Data Peserta</span>
              </button>
              <button onClick={() => { setMobileMenuOpen(false); router.push('/mentor/tugas'); }} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span className="font-semibold text-sm">Verifikasi Tugas</span>
              </button>
              <button onClick={() => { setMobileMenuOpen(false); router.push('/mentor/izin'); }} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20 text-left">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-semibold text-sm">Data Izin</span>
              </button>
              <button onClick={() => { setMobileMenuOpen(false); router.push('/mentor/penilaian'); }} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left">
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
            </div>
          </div>
        </div>
      )}
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Panel</span>
        </div>
        <div className="px-4 flex-1 mt-4 space-y-2">
          <button onClick={() => router.push('/mentor')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <span className="font-semibold text-sm">Ikhtisar Tim</span>
          </button>
          <button onClick={() => router.push('/mentor/data-ojt')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <span className="font-semibold text-sm">Data Peserta</span>
          </button>
          <button onClick={() => router.push('/mentor/tugas')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <span className="font-semibold text-sm">Verifikasi Tugas</span>
          </button>
          <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20">
            <span className="font-semibold text-sm">Data Izin</span>
          </button>
          <button onClick={() => router.push('/mentor/penilaian')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <span className="font-semibold text-sm">Penilaian Evaluasi</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        <div className="bg-[#1e1b4b] pt-8 pb-20 px-6 rounded-b-[40px] md:mx-6 md:mt-6 md:rounded-3xl shadow-xl relative overflow-hidden shrink-0">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl"></div>
          <div className="absolute left-1/4 bottom-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/mentor')}
                className="md:hidden p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">Pusat Validasi Izin</h1>
                <p className="text-teal-100 text-xs md:text-sm font-medium mt-1">
                  Validasi dan verifikasi permohonan izin ketidakhadiran dari peserta OJT Anda.
                </p>
              </div>
            </div>

            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden flex p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 animate-fade-in"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-12 relative z-10">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit mb-6">
              {['Menunggu Verifikasi', 'Disetujui', 'Ditolak'].map(status => (
                <button key={status} onClick={() => setFilterStatus(status)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${filterStatus === status ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-500'}`}>
                  {status} ({izinData.filter(t => t.status === status).length})
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
                    <th className="p-4">Peserta</th>
                    <th className="p-4">Tgl Izin</th>
                    <th className="p-4">Kategori & Keterangan</th>
                    <th className="p-4">Bukti</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredIzin.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-800 text-sm">
                        {t.users?.name}
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">{t.users?.divisi}</p>
                      </td>
                      <td className="p-4 text-xs font-semibold text-slate-500">{formatDate(t.tanggal_izin)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.kategori === 'Sakit' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t.kategori}
                        </span>
                        <p className="text-xs text-slate-600 mt-1">{t.keterangan}</p>
                      </td>
                      <td className="p-4">
                        <a href={t.bukti_link} target="_blank" className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg text-xs font-bold hover:bg-teal-100 flex items-center gap-1 w-fit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          Buka
                        </a>
                      </td>
                      <td className="p-4 text-right">
                        {t.status === 'Menunggu Verifikasi' ? (
                          <div className="flex justify-end gap-2 flex-col sm:flex-row">
                            <button onClick={() => handleUpdateStatus(t.id, t.user_id, t.tanggal_izin, t.kategori, 'Disetujui')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 border border-emerald-100 shadow-sm">✓ Setujui</button>
                            <button onClick={() => handleUpdateStatus(t.id, t.user_id, t.tanggal_izin, t.kategori, 'Ditolak')} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100 border border-rose-100 shadow-sm">✕ Tolak</button>
                          </div>
                        ) : <span className="text-[10px] font-black uppercase">{t.status}</span>}
                      </td>
                    </tr>
                  ))}
                  {filteredIzin.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 text-sm">Tidak ada data izin dengan status {filterStatus}.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
