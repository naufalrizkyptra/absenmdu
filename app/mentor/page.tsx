'use client'

import { createOJTAccount, resetPasswordByMentor } from './actions'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'


export default function MentorDashboard() {
  const [user, setUser] = useState<any>(null)
  const [mentees, setMentees] = useState<any[]>([])
  const [attendances, setAttendances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Ubah email -> nip
  const [formData, setFormData] = useState({
    nip: '',
    name: '',
    asal_sekolah: '',
    divisi: 'Multimedia',
    asal_kantor: 'Jatiwaringin',
    no_telp: '',
    start_period: '',
    end_period: ''
  })

  const handleCreateAccount = async () => {
    setIsSubmitting(true)
    const result = await createOJTAccount({
      ...formData,
      mentor_id: user.id 
    })

    if (result.success) {
      // POPUP SUKSES
      Swal.fire({
        title: 'Berhasil!',
        text: 'Akun OJT berhasil didaftarkan.',
        icon: 'success',
        confirmButtonColor: '#1e1b4b',
        confirmButtonText: 'Mantap'
      }).then(() => {
        setFormData({ nip: '', name: '', asal_sekolah: '', divisi: 'Multimedia', asal_kantor: 'Jatiwaringin', no_telp: '', start_period: '', end_period: '' }) 
        window.location.reload()
      })
    } else {
      // POPUP ERROR
      Swal.fire({
        title: 'Gagal',
        text: result.message,
        icon: 'error',
        confirmButtonColor: '#ef4444'
      })
    }
    setIsSubmitting(false)
  }

  // FUNGSI BARU: TOMBOL RESET PASSWORD OLEH MENTOR
  const handleResetPasswordOJT = async (ojtId: string, ojtName: string) => {
    const { value: newPassword } = await Swal.fire({
      title: `Reset Password ${ojtName}`,
      input: 'password',
      inputLabel: 'Masukkan password baru',
      inputPlaceholder: 'Minimal 6 karakter',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#1e1b4b',
      inputValidator: (value) => {
        if (!value || value.length < 6) {
          return 'Password minimal harus 6 karakter!'
        }
      }
    })
    
    if (newPassword) {
      setIsSubmitting(true)
      const result = await resetPasswordByMentor(ojtId, newPassword)
      
      if (result.success) {
        Swal.fire({
          title: 'Tersimpan!',
          text: `Password untuk ${ojtName} telah berhasil diubah.`,
          icon: 'success',
          confirmButtonColor: '#1e1b4b'
        })
      } else {
        Swal.fire({
          title: 'Gagal Mereset',
          text: result.message,
          icon: 'error',
          confirmButtonColor: '#ef4444'
        })
      }
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    const fetchMentorData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: mentorProfile } = await supabase
        .from('users')
        .select('name, avatar_url') 
        .eq('id', user.id)
        .single()
      
      if (mentorProfile) setProfile(mentorProfile)

      const { data: teamData } = await supabase
        .from('users')
        .select('*')
        .eq('mentor_id', user.id)

      if (teamData) {
        setMentees(teamData)
        if (teamData.length > 0) {
          const menteeIds = teamData.map(m => m.id)
          const startOfToday = new Date()
          startOfToday.setHours(0, 0, 0, 0)
          
          const { data: absenData } = await supabase
            .from('attendance')
            .select('*, users(name, divisi)')
            .in('user_id', menteeIds)
            .gte('check_in_time', startOfToday.toISOString())
            .order('check_in_time', { ascending: false })
            
          if (absenData) setAttendances(absenData)
        }
      }
      setLoading(false)
    }
    fetchMentorData()
  }, [router])

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f4f7fe]">Memuat Dashboard Mentor...</div>
  if (!user) return null

  return (
    <div className="min-h-screen bg-[#f4f7fe] flex flex-col md:flex-row font-sans">
      
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col shadow-sm z-10">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-xl bg-slate-100 shadow-sm object-cover" />
            ) : (
              <div className="w-10 h-10 bg-[#1e1b4b] rounded-xl flex items-center justify-center text-white font-bold text-xl">M</div>
            )}
            <span className="text-xl font-bold text-slate-800 tracking-tight">Mentor Panel</span>
          </div>
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu Kelola</p>
          <nav className="space-y-1.5">
            {/* Tombol Overview (Warnanya Gelap/Aktif karena kita lagi di halaman utama) */}
            <button 
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-[#1e1b4b] text-white shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <span className="font-medium">Overview Tim</span>
            </button>

            {/* Tombol Data Anak OJT (Warnanya Abu-abu/Tidak Aktif, kalau diklik pindah halaman) */}
            <button 
              onClick={() => router.push('/mentor/data-ojt')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              <span className="font-medium">Data Anak OJT</span>
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

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white/50 backdrop-blur-md md:bg-transparent px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Halo, {profile?.name || 'Mentor'}!</h1>
            <p className="text-sm text-slate-500 mt-1">Pantau kinerja dan kehadiran tim lu hari ini.</p>
          </div>
          <button onClick={() => router.push('/settings')} className="p-3.5 rounded-2xl bg-white border border-slate-100 hover:bg-slate-50 transition-all shadow-sm group hidden md:block">
            <svg className="w-6 h-6 text-slate-600 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-auto px-8 pb-24 md:pb-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <p className="text-sm font-semibold text-slate-500 mb-1">Total Anak OJT</p>
                  <p className="text-4xl font-black text-[#1e1b4b]">{mentees.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <p className="text-sm font-semibold text-slate-500 mb-1">Hadir Hari Ini</p>
                  <p className="text-4xl font-black text-emerald-600">{attendances.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <p className="text-sm font-semibold text-slate-500 mb-1">Terlambat</p>
                  <p className="text-4xl font-black text-rose-500">
                    {attendances.filter(a => a.status === 'Terlambat').length}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-white">
                  <h2 className="text-lg font-bold text-slate-800">Daftar Anggota Tim OJT</h2>
                </div>
                <div className="p-0 overflow-x-auto">
                  {mentees.length === 0 ? (
                    <div className="text-center py-10"><p className="text-sm text-slate-400">Belum ada anak OJT yang terdaftar.</p></div>
                  ) : (
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="p-4 font-semibold pl-6">NIP</th>
                          <th className="p-4 font-semibold">Nama Lengkap</th>
                          <th className="p-4 font-semibold">Asal Sekolah</th>
                          <th className="p-4 font-semibold">No. WhatsApp</th>
                          <th className="p-4 font-semibold">Periode Magang</th>
                          <th className="p-4 font-semibold text-right pr-6">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mentees.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 pl-6 font-bold text-slate-800">{m.nip || '-'}</td>
                            <td className="p-4 text-sm font-bold text-slate-800">
                              {m.name}
                              <div className="text-xs font-normal text-slate-500 mt-0.5">{m.divisi}</div>
                            </td>
                            <td className="p-4 text-sm font-medium text-slate-700">{m.asal_sekolah || '-'}</td>
                            <td className="p-4 text-sm font-medium text-blue-600">{m.no_telp || '-'}</td>
                            <td className="p-4 text-sm font-medium text-slate-600">
                              {m.start_period ? `${formatDate(m.start_period)} - ${formatDate(m.end_period)}` : '-'}
                            </td>
                            <td className="p-4 text-right pr-6">
                              <button 
                                onClick={() => handleResetPasswordOJT(m.id, m.name)}
                                disabled={isSubmitting}
                                className="text-xs font-bold px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors shadow-sm"
                              >
                                🔑 Reset Pass
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                  <h2 className="text-lg font-bold text-slate-800">Absensi Tim Hari Ini</h2>
                </div>
                <div className="p-0">
                  {attendances.length === 0 ? (
                    <div className="text-center py-10"><p className="text-sm text-slate-400">Belum ada anak OJT lu yang absen hari ini.</p></div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="p-4 font-semibold pl-6">Nama Tim</th>
                          <th className="p-4 font-semibold">Jam Masuk</th>
                          <th className="p-4 font-semibold">Jam Pulang</th>
                          <th className="p-4 font-semibold text-right pr-6">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendances.map((absen) => (
                          <tr key={absen.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 pl-6 font-bold text-slate-800">{absen.users?.name || 'Tanpa Nama'}</td>
                            <td className="p-4 text-sm font-bold text-slate-800">{formatTime(absen.check_in_time)}</td>
                            <td className="p-4 text-sm font-bold text-emerald-600">{absen.check_out_time ? formatTime(absen.check_out_time) : '-'}</td>
                            <td className="p-4 pr-6 text-right">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${absen.status === 'Terlambat' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
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
          )}

          {activeTab === 'tambah_tim' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-2xl">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Tambah Anggota OJT</h2>
              <p className="text-sm text-slate-500 mb-8">Buatkan akun akses portal untuk tim lu. Mereka akan menggunakan NIP untuk masuk ke portal.</p>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Masukkan nama lengkap..." className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">NIP / Nomor Induk Magang</label>
                  <input type="text" value={formData.nip} onChange={(e) => setFormData({ ...formData, nip: e.target.value })} placeholder="Contoh: 2026001" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">No. WhatsApp</label>
                    <input type="tel" value={formData.no_telp} onChange={(e) => setFormData({ ...formData, no_telp: e.target.value })} placeholder="Contoh: 08123456789" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Asal Sekolah / Kampus</label>
                    <input type="text" value={formData.asal_sekolah} onChange={(e) => setFormData({ ...formData, asal_sekolah: e.target.value })} placeholder="Contoh: SMK Telkom..." className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal Mulai Magang</label>
                    <input type="date" value={formData.start_period} onChange={(e) => setFormData({ ...formData, start_period: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal Selesai Magang</label>
                    <input type="date" value={formData.end_period} onChange={(e) => setFormData({ ...formData, end_period: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Divisi</label>
                    <select value={formData.divisi} onChange={(e) => setFormData({ ...formData, divisi: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                      <option value="Multimedia">Multimedia</option>
                      <option value="Humas">Humas</option>
                      <option value="LPPM">LPPM</option>
                      <option value="Content Creator">Content Creator</option>
                      <option value="DICO">DICO</option>
                      <option value="Socmed Spesialist">Socmed Spesialist</option>
                      <option value="Staff Human Capital">Staff Human Capital</option>
                      <option value="Kemahasiswaan">Kemahasiswaan</option>
                      <option value="NMC">NMC</option>
                      <option value="Perpustakaan">Perpustakaan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Asal Kantor</label>
                    <select value={formData.asal_kantor} onChange={(e) => setFormData({ ...formData, asal_kantor: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                      <option value="Jatiwaringin">Jatiwaringin</option>
                      <option value="Margonda">Margonda</option>
                      <option value="BSI Slipi">BSI Slipi</option>
                      <option value="BSI BSD">BSI BSD</option>
                      <option value="BSI Ciledug">BSI Ciledug</option>
                      <option value="Rawamangun">Rawamangun</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Password Default</label>
                  <input type="text" disabled value="ojtmdu2026!" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-medium" />
                </div>
                
                <div className="pt-4">
                  <button onClick={handleCreateAccount} disabled={isSubmitting} className="bg-[#1e1b4b] hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md disabled:opacity-50">
                    {isSubmitting ? 'Memproses...' : 'Buat Akun OJT'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}