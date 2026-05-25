'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'

export default function TugasBoostPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    postLink: '',
    proofLink: ''
  })
  
  const router = useRouter()

  // Ambil Data User dan Riwayat Tugas
  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (userData) {
        if (userData.role !== 'ojt') {
          router.push(userData.role === 'admin' ? '/admin' : '/mentor')
          return
        }
        setProfile(userData)
      }

      // Ambil riwayat tugas khusus user ini
      const { data: taskData } = await supabase
        .from('boost_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (taskData) setHistory(taskData)

      setLoading(false)
    }

    fetchUserData()
  }, [router])

  // Fungsi Kirim Tugas
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.postLink || !formData.proofLink) {
      toast.error('Mohon lengkapi kedua tautan yang diminta.')
      return
    }

    setIsSubmitting(true)
    const toastId = toast.loading('Memproses pengiriman laporan tugas...')

    const { data, error } = await supabase
      .from('boost_tasks')
      .insert([{
        user_id: user.id,
        post_link: formData.postLink,
        proof_link: formData.proofLink,
        status: 'Menunggu Verifikasi'
      }])
      .select()
      .single()

    if (error) {
      console.error(error)
      toast.error('Gagal mengirim laporan. Cek koneksi Anda.', { id: toastId })
    } else {
      toast.success('Laporan tugas berhasil terkirim! Menunggu verifikasi Mentor.', { id: toastId })
      setHistory([data, ...history]) // Tambah ke daftar riwayat paling atas
      setFormData({ postLink: '', proofLink: '' }) // Kosongin form
    }
    
    setIsSubmitting(false)
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8faff] text-indigo-950 font-medium">Memuat Modul Tugas...</div>

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans flex">
      <Toaster position="top-center" richColors />
      
      {/* SIDEBAR DESKTOP (Struktur Fixed) */}
      <nav className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Portal</span>
        </div>
        
        <div className="px-4 flex-1 mt-4 space-y-2">
          {/* Menu Beranda */}
          <button 
            onClick={() => router.push('/ojt')}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="font-semibold text-sm">Beranda</span>
          </button>

          {/* Menu Presensi */}
          <button 
            onClick={() => router.push('/ojt/absen')}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
            <span className="font-semibold text-sm">Presensi Lokasi</span>
          </button>

          {/* Menu Tugas Boost (AKTIF - Gradasi MDU) */}
          <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <span className="font-semibold text-sm">Laporan Tugas</span>
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
              <p className="text-xs text-indigo-600 font-medium">{profile?.divisi}</p>
            </div>
          </div>
        </div>
      </nav>

      {/* KONTEN UTAMA */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        
        {/* Colorful header section ala Beranda */}
        <div className="bg-[#1e1b4b] pt-8 pb-20 px-6 rounded-b-[40px] md:mx-6 md:mt-6 md:rounded-3xl shadow-xl relative overflow-hidden shrink-0">
          {/* Dekorasi Gradasi ala Logo MDU */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>
          <div className="absolute left-1/4 bottom-0 w-32 h-32 bg-orange-400/20 rounded-full blur-2xl"></div>

          <div className="relative z-10 flex items-center gap-4">
            {/* Tombol Back Khusus Mobile */}
            <button 
              onClick={() => router.push('/ojt')}
              className="md:hidden p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
                Tugas <span className="text-orange-300">Boost Post</span>
              </h1>
              <p className="text-blue-100 text-xs md:text-sm font-medium mt-1">
                Kirim laporan dan pantau status validasi tugas harian Anda.
              </p>
            </div>
          </div>
        </div>

        {/* Bagian Bawah (Scrolling Area) */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-12 relative z-10">
          <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
            
            {/* KOLOM KIRI: FORM PENGUMPULAN (DIPOLIS) */}
            <div className="w-full lg:w-[460px] bg-white rounded-3xl shadow-xl border border-slate-100 p-7 md:p-9 shrink-0">
              <div className="flex items-center gap-3.5 mb-7 pb-5 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Formulir Laporan</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Input detail dukungan konten Anda hari ini.</p>
                </div>
              </div>

              <form onSubmit={handleSubmitTask} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tautan Postingan MDU</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-4.5 h-4.5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </div>
                    <input 
                      type="url" 
                      required
                      placeholder="https://www.instagram.com/p/..."
                      value={formData.postLink}
                      onChange={(e) => setFormData({...formData, postLink: e.target.value})}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-all text-slate-900 shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tautan Bukti G-Drive (Kolase Foto)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-4.5 h-4.5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    <input 
                      type="url" 
                      required
                      placeholder="Pastikan akses link G-Drive sudah Publik"
                      value={formData.proofLink}
                      onChange={(e) => setFormData({...formData, proofLink: e.target.value})}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-all text-slate-900 shadow-inner"
                    />
                  </div>
                  <div className="bg-orange-50/70 rounded-xl p-3.5 mt-3 border border-orange-100 flex items-start gap-2.5">
                    <svg className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-xs text-orange-800 leading-relaxed font-medium">
                      Unggah foto kolase (Like + Komen + Save) ke folder Google Drive Anda. Pastikan akses link diatur ke <b>Publik / Siapa saja</b> sebelum mengirim.
                    </p>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full font-bold py-4 rounded-xl transition-all text-sm mt-3 shadow-lg flex items-center justify-center gap-2 ${
                    isSubmitting 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                      Mengirim...
                    </>
                  ) : 'Kirim Laporan Tugas'}
                </button>
              </form>
            </div>

            {/* KOLOM KANAN: RIWAYAT TUGAS (DIPOLIS) */}
            <div className="flex-1 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col min-h-[480px]">
              <div className="p-6 md:p-7 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
                <h2 className="text-lg md:text-xl font-bold text-slate-800">Riwayat Pengumpulan</h2>
                <span className="bg-orange-50 text-orange-600 border border-orange-100 px-4 py-1.5 rounded-full text-xs font-bold shadow-inner">
                  {history.length} Laporan Total
                </span>
              </div>
              
              <div className="flex-1 p-6 md:p-7 overflow-y-auto bg-slate-50/30 space-y-5">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <div className="w-20 h-20 mb-5 bg-white shadow-inner border border-slate-100 rounded-full flex items-center justify-center text-slate-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </div>
                    <p className="text-base font-semibold text-slate-600">Belum Ada Riwayat Laporan</p>
                    <p className="text-sm text-slate-400 mt-1.5 max-w-xs">Laporan tugas yang Anda kirimkan akan muncul di sini beserta status validasi dari Mentor.</p>
                  </div>
                ) : (
                  history.map((task) => (
                    <div key={task.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all">
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                            Setoran Tugas Hari Ini
                          </p>
                          <p className="text-xs font-semibold text-slate-400 mt-1 mb-3">
                            Dikirim: {formatDate(task.created_at)}
                          </p>
                          
                          {/* Badge Status Berwarna */}
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-inner ${
                            task.status === 'Disetujui' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            task.status === 'Ditolak' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              task.status === 'Disetujui' ? 'bg-emerald-500' :
                              task.status === 'Ditolak' ? 'bg-rose-500' :
                              'bg-amber-500 animate-pulse'
                            }`}></span>
                            {task.status}
                          </span>
                        </div>
                        
                        {/* Tombol Aksi Tautan */}
                        <div className="flex gap-2.5 shrink-0">
                          <a 
                            href={task.post_link} target="_blank" rel="noreferrer"
                            className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-colors tooltip-trigger shadow-inner border border-slate-100"
                            title="Lihat Postingan MDU"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          </a>
                          <a 
                            href={task.proof_link} target="_blank" rel="noreferrer"
                            className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-orange-50 hover:text-orange-600 transition-colors tooltip-trigger shadow-inner border border-slate-100"
                            title="Lihat Bukti G-Drive"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          </a>
                        </div>
                      </div>
                      
                      {/* Pesan jika ditolak */}
                      {task.status === 'Ditolak' && (
                        <div className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-3">
                          <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          <p className="text-xs text-rose-800 font-medium leading-relaxed">
                            Mohon maaf, laporan Anda ditolak Mentor. Alasannya bisa karena tautan Drive tidak bisa dibuka (Privat) atau bukti foto salah. Silakan perbaiki dan kirim ulang laporan baru.
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
          </div>
        </div>
      </main>

    </div>
  )
}