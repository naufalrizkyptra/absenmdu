'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'

export default function IzinPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    tanggal_izin: '',
    kategori: 'Sakit',
    keterangan: ''
  })
  const [file, setFile] = useState<File | null>(null)
  
  const router = useRouter()

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

      // Ambil riwayat izin
      const { data: izinData } = await supabase
        .from('izin_ojt')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (izinData) setHistory(izinData)

      setLoading(false)
    }

    fetchUserData()
  }, [router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      // Validasi ukuran max 2MB
      if (selectedFile.size > 2 * 1024 * 1024) {
        toast.error('Ukuran file maksimal adalah 2MB.')
        e.target.value = ''
        return
      }
      setFile(selectedFile)
    }
  }

  const handleSubmitIzin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.tanggal_izin || !formData.kategori || !formData.keterangan || !file) {
      toast.error('Mohon lengkapi semua form dan unggah bukti surat.')
      return
    }

    setIsSubmitting(true)
    const toastId = toast.loading('Mengunggah bukti dan mengirim pengajuan izin...')

    try {
      // 1. Upload File ke Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('izin-bukti')
        .upload(fileName, file)

      if (uploadError) throw new Error('Gagal mengunggah file bukti. Pastikan Bucket izin-bukti sudah dibuat.')

      // Ambil URL public
      const { data: publicUrlData } = supabase.storage
        .from('izin-bukti')
        .getPublicUrl(fileName)
        
      const bukti_link = publicUrlData.publicUrl

      // 2. Simpan ke database
      const { data, error } = await supabase
        .from('izin_ojt')
        .insert([{
          user_id: user.id,
          tanggal_izin: formData.tanggal_izin,
          kategori: formData.kategori,
          keterangan: formData.keterangan,
          bukti_link: bukti_link,
          status: 'Menunggu Verifikasi'
        }])
        .select()
        .single()

      if (error) throw error

      toast.success('Pengajuan izin berhasil dikirim!', { id: toastId })
      setHistory([data, ...history])
      setFormData({ tanggal_izin: '', kategori: 'Sakit', keterangan: '' })
      setFile(null)
      // Reset input file (workaround manual element select)
      const fileInput = document.getElementById('file_bukti') as HTMLInputElement
      if(fileInput) fileInput.value = ''

    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Terjadi kesalahan saat mengirim pengajuan.', { id: toastId })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8faff] text-indigo-950 font-medium">Memuat Data...</div>

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans flex">
      <Toaster position="top-center" richColors />
      
      {/* SIDEBAR DESKTOP */}
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

          {/* Menu Tugas Boost */}
          <button 
            onClick={() => router.push('/ojt/tugas')}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <span className="font-semibold text-sm">Laporan Tugas</span>
          </button>
          
          {/* Menu Pengajuan Izin (AKTIF) */}
          <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="font-semibold text-sm">Pengajuan Izin</span>
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
              <p className="text-xs text-teal-600 font-medium">{profile?.divisi}</p>
            </div>
          </div>
        </div>
      </nav>

      {/* KONTEN UTAMA */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        
        {/* Header section */}
        <div className="bg-[#1e1b4b] pt-8 pb-20 px-6 rounded-b-[40px] md:mx-6 md:mt-6 md:rounded-3xl shadow-xl relative overflow-hidden shrink-0">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl"></div>
          <div className="absolute left-1/4 bottom-0 w-32 h-32 bg-teal-400/20 rounded-full blur-2xl"></div>

          <div className="relative z-10 flex items-center gap-4">
            <button 
              onClick={() => router.push('/ojt')}
              className="md:hidden p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
                Pengajuan <span className="text-teal-300">Izin</span>
              </h1>
              <p className="text-blue-100 text-xs md:text-sm font-medium mt-1">
                Kirim permohonan izin ketidakhadiran beserta surat bukti Anda di sini.
              </p>
            </div>
          </div>
        </div>

        {/* Bagian Bawah (Scrolling Area) */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-12 relative z-10 custom-scrollbar">
          <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
            
            {/* KOLOM KIRI: FORM PENGAJUAN */}
            <div className="w-full lg:w-[460px] bg-white rounded-3xl shadow-xl border border-slate-100 p-7 md:p-9 shrink-0">
              <div className="flex items-center gap-3.5 mb-7 pb-5 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Formulir Izin</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Isi data dan lampirkan bukti pendukung.</p>
                </div>
              </div>

              <form onSubmit={handleSubmitIzin} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tanggal Izin</label>
                  <input 
                    type="date" 
                    required
                    value={formData.tanggal_izin}
                    onChange={(e) => setFormData({...formData, tanggal_izin: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-500 transition-all text-slate-900 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Kategori</label>
                  <select 
                    required
                    value={formData.kategori}
                    onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-500 transition-all text-slate-900 shadow-inner"
                  >
                    <option value="Sakit">Sakit</option>
                    <option value="Izin">Izin (Keperluan Keluarga, dll)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Keterangan / Alasan</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="Tuliskan alasan lengkap Anda di sini..."
                    value={formData.keterangan}
                    onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-500 transition-all text-slate-900 shadow-inner resize-none"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Unggah Bukti (Foto/PDF)</label>
                  <input 
                    type="file" 
                    id="file_bukti"
                    required
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-500 transition-all text-slate-900 shadow-inner file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                  />
                  <p className="text-[11px] text-slate-400 mt-2 ml-1">Maksimal 2MB. Format didukung: JPG, PNG, PDF.</p>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full font-bold py-4 rounded-xl transition-all text-sm mt-4 shadow-lg flex items-center justify-center gap-2 ${
                    isSubmitting 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-teal-500/30 hover:shadow-teal-500/50 hover:-translate-y-0.5'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                      Memproses...
                    </>
                  ) : 'Ajukan Permohonan Izin'}
                </button>
              </form>
            </div>

            {/* KOLOM KANAN: RIWAYAT IZIN */}
            <div className="flex-1 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col min-h-[480px]">
              <div className="p-6 md:p-7 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
                <h2 className="text-lg md:text-xl font-bold text-slate-800">Riwayat Pengajuan</h2>
                <span className="bg-teal-50 text-teal-600 border border-teal-100 px-4 py-1.5 rounded-full text-xs font-bold shadow-inner">
                  {history.length} Data
                </span>
              </div>
              
              <div className="flex-1 p-6 md:p-7 overflow-y-auto bg-slate-50/30 space-y-5 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <div className="w-20 h-20 mb-5 bg-white shadow-inner border border-slate-100 rounded-full flex items-center justify-center text-slate-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <p className="text-base font-semibold text-slate-600">Belum Ada Riwayat Izin</p>
                    <p className="text-sm text-slate-400 mt-1.5 max-w-xs">Data permohonan izin beserta status validasi dari Mentor akan muncul di sini.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-teal-100 transition-all relative overflow-hidden">
                      {/* Dekorasi Garis Kiri Kategori */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        item.kategori === 'Sakit' ? 'bg-orange-500' : 'bg-blue-500'
                      }`}></div>

                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="min-w-0 pl-2">
                          <p className="text-sm font-bold text-slate-800 leading-tight flex items-center gap-2">
                            Izin {item.kategori}
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              item.kategori === 'Sakit' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {formatDate(item.tanggal_izin)}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 mt-1.5 max-w-sm line-clamp-2" title={item.keterangan}>
                            "{item.keterangan}"
                          </p>
                          
                          <div className="mt-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-inner ${
                              item.status === 'Disetujui' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              item.status === 'Ditolak' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                              'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                item.status === 'Disetujui' ? 'bg-emerald-500' :
                                item.status === 'Ditolak' ? 'bg-rose-500' :
                                'bg-amber-500 animate-pulse'
                              }`}></span>
                              {item.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2.5 shrink-0 ml-2 md:ml-0">
                          <a 
                            href={item.bukti_link} target="_blank" rel="noreferrer"
                            className="w-auto px-4 h-10 rounded-xl bg-slate-50 text-slate-600 font-semibold text-xs flex items-center justify-center hover:bg-teal-50 hover:text-teal-600 transition-colors shadow-inner border border-slate-100 gap-2"
                            title="Lihat File Bukti"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            Lihat Bukti
                          </a>
                        </div>
                      </div>
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
