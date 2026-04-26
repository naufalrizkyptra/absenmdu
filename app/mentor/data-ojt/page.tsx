'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { createOJTAccount, updateOJTProfile, deleteOJTAccount } from '../actions'
import Swal from 'sweetalert2'

export default function DataOJTPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mentees, setMentees] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  
  const [showAddModal, setShowAddModal] = useState(false)
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

  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Tarik profil Mentor buat ditampilin di sidebar
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
        .eq('role', 'ojt')

      if (teamData) setMentees(teamData)
      setLoading(false)
    }
    fetchData()
  }, [router])

  const handleCreateAccount = async () => {
    setIsSubmitting(true)
    const result = await createOJTAccount({ ...formData, mentor_id: user.id })
    if (result.success) {
      Swal.fire('Berhasil!', 'Akun OJT berhasil didaftarkan.', 'success').then(() => {
        setFormData({ nip: '', name: '', asal_sekolah: '', divisi: 'Multimedia', asal_kantor: 'Jatiwaringin', no_telp: '', start_period: '', end_period: '' })
        setShowAddModal(false) 
        window.location.reload()
      })
    } else {
      Swal.fire('Gagal', result.message, 'error')
    }
    setIsSubmitting(false)
  }

  const handleUpdateAccount = async () => {
    setIsSubmitting(true)
    const result = await updateOJTProfile(editingUser.id, editingUser)
    if (result.success) {
      Swal.fire('Berhasil!', 'Data OJT berhasil diupdate.', 'success').then(() => window.location.reload())
    } else {
      Swal.fire('Gagal', result.message, 'error')
    }
    setIsSubmitting(false)
    setEditingUser(null)
  }

  const handleDeleteOJT = async (id: string, name: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus Data?',
      text: `Seluruh akun dan riwayat ${name} akan hilang.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, Hapus'
    })
    if (confirm.isConfirmed) {
      setIsSubmitting(true)
      const res = await deleteOJTAccount(id)
      if (res.success) Swal.fire('Berhasil', 'Data dihapus', 'success').then(() => window.location.reload())
      else Swal.fire('Gagal', res.message, 'error')
      setIsSubmitting(false)
    }
  }
  // LOGIKA FILTER SEARCH
  const filteredMentees = mentees.filter((m) => {
    const query = searchQuery.toLowerCase()
    return (
      m.name?.toLowerCase().includes(query) ||
      m.nip?.toLowerCase().includes(query) ||
      m.asal_sekolah?.toLowerCase().includes(query) ||
      m.asal_kantor?.toLowerCase().includes(query)
    )
  })

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f4f7fe]">Memuat Data Tim...</div>

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fe] flex flex-col md:flex-row font-sans">
      
      {/* =========================================
          1. SIDEBAR (KHUSUS DESKTOP) 
          ========================================= */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col shadow-sm z-10 shrink-0">
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
            <button 
              onClick={() => router.push('/mentor')} 
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <span className="font-medium">Overview Tim</span>
            </button>
            <button 
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-[#1e1b4b] text-white shadow-md"
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

      {/* =========================================
          2. MAIN CONTENT AREA 
          ========================================= */}
      <main className="flex-1 flex flex-col h-[100dvh] md:h-screen overflow-hidden relative">
        
        {/* HEADER BERSAMA */}
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
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">Manajemen Anggota</h1>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1">Kelola data profil tim OJT lu.</p>
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

        {/* AREA KONTEN UTAMA */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-28 md:pb-8">
          
          {/* SEARCH BAR & TOMBOL TAMBAH */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative w-full sm:w-80">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                placeholder="Cari nama, NIP, kantor, atau sekolah..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 md:py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm transition-all"
              />
            </div>
            
            <button 
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto bg-[#1e1b4b] hover:bg-blue-700 text-white font-bold py-3 md:py-2.5 px-5 rounded-xl transition-all shadow-md text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Tambah Anak OJT
            </button>
          </div>

          {/* TABEL DATA OJT (Dengan Scroll Horizontal) */}
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-0 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <th className="p-4 pl-6 font-semibold">NIP</th>
                    <th className="p-4 font-semibold">Nama & Divisi</th>
                    <th className="p-4 font-semibold">Asal Sekolah</th>
                    <th className="p-4 font-semibold">Asal Kantor</th>
                    <th className="p-4 font-semibold">Kontak</th>
                    <th className="p-4 font-semibold text-right pr-6">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMentees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                        Tidak ada data yang cocok dengan pencarian "{searchQuery}".
                      </td>
                    </tr>
                  ) : (
                    filteredMentees.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 pl-6 font-bold text-slate-800">{m.nip}</td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{m.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{m.divisi}</div>
                        </td>
                        <td className="p-4 text-sm text-slate-600 font-medium">{m.asal_sekolah}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h6" /></svg>
                            {m.asal_kantor}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-blue-600 font-medium">{m.no_telp}</td>
                        <td className="p-4 text-right pr-6">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setEditingUser(m)} 
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold shadow-sm transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteOJT(m.id, m.name)} 
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold shadow-sm transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================
          3. BOTTOM NAVIGATION (KHUSUS MOBILE) 
          ========================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 pb-safe pt-2 px-6 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex justify-between items-center pb-4">
          <button 
            onClick={() => router.push('/mentor')} 
            className="flex flex-col items-center p-2 flex-1 transition-colors text-slate-400 hover:text-slate-600"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-[10px] font-semibold">Overview</span>
          </button>
          
          <button 
            className="flex flex-col items-center p-2 flex-1 transition-colors text-[#1e1b4b]"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            <span className="text-[10px] font-semibold">Data Tim</span>
          </button>
          
          <button 
            onClick={() => router.push('/settings')} 
            className="flex flex-col items-center p-2 flex-1 transition-colors text-slate-400 hover:text-slate-600"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[10px] font-semibold">Profil</span>
          </button>
        </div>
      </div>

      {/* MODAL TAMBAH DATA */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Tambah Anggota OJT Baru</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Lengkap</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">NIP</label>
                <input type="text" value={formData.nip} onChange={(e) => setFormData({...formData, nip: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Asal Sekolah</label>
                  <input type="text" value={formData.asal_sekolah} onChange={(e) => setFormData({...formData, asal_sekolah: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">No. WhatsApp</label>
                  <input type="text" value={formData.no_telp} onChange={(e) => setFormData({...formData, no_telp: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Mulai Magang</label>
                  <input type="date" value={formData.start_period} onChange={(e) => setFormData({...formData, start_period: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Selesai Magang</label>
                  <input type="date" value={formData.end_period} onChange={(e) => setFormData({...formData, end_period: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Divisi</label>
                  <select value={formData.divisi} onChange={(e) => setFormData({...formData, divisi: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                    <option value="Multimedia">Multimedia</option>
                    <option value="Humas">Humas</option>
                    <option value="LPPM">LPPM</option>
                    <option value="Content Creator">Content Creator</option>
                    <option value="DICO">DICO</option>
                    <option value="Socmed Spesialist">Socmed Spesialist</option>
                    <option value="Staff Human Capital">Staff Human Capital</option>
                    <option value="Kemahasiswaan">Kemahasiswaan</option>
                    <option value="Nusa Mandiri Center">Nusa Mandiri Center</option>
                    <option value="Perpustakaan">Perpustakaan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Asal Kantor</label>
                  <select value={formData.asal_kantor} onChange={(e) => setFormData({...formData, asal_kantor: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                    <option value="Jatiwaringin">Jatiwaringin</option>
                    <option value="Margonda">Margonda</option>
                    <option value="BSI Slipi">BSI Slipi</option>
                    <option value="Rawamangun">Rawamangun</option>
                    <option value="BSI BSD">BSI BSD</option>
                    <option value="BSI Ciledug">BSI Ciledug</option>
                    
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-8 flex gap-3 justify-end">
              <button onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
              <button onClick={handleCreateAccount} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-bold text-white bg-[#1e1b4b] hover:bg-blue-700 rounded-xl transition-colors shadow-md">
                {isSubmitting ? 'Memproses...' : 'Buat Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT DATA */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Edit Data Anggota OJT</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Lengkap</label>
                <input type="text" value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">NIP</label>
                <input type="text" value={editingUser.nip} onChange={(e) => setEditingUser({...editingUser, nip: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Asal Sekolah</label>
                  <input type="text" value={editingUser.asal_sekolah} onChange={(e) => setEditingUser({...editingUser, asal_sekolah: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">No. WhatsApp</label>
                  <input type="text" value={editingUser.no_telp} onChange={(e) => setEditingUser({...editingUser, no_telp: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Mulai Magang</label>
                  <input type="date" value={editingUser.start_period} onChange={(e) => setEditingUser({...editingUser, start_period: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Selesai Magang</label>
                  <input type="date" value={editingUser.end_period} onChange={(e) => setEditingUser({...editingUser, end_period: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Divisi</label>
                  <select value={editingUser.divisi} onChange={(e) => setEditingUser({...editingUser, divisi: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                    <option value="Multimedia">Multimedia</option>
                      <option value="Humas">Humas</option>
                      <option value="LPPM">LPPM</option>
                      <option value="Content Creator">Content Creator</option>
                      <option value="DICO">DICO</option>
                      <option value="Socmed Spesialist">Socmed Spesialist</option>
                      <option value="Staff Human Capital">Staff Human Capital</option>
                      <option value="Kemahasiswaan">Kemahasiswaan</option>
                      <option value="Nusa Mandiri Center">Nusa Mandiri Center</option>
                      <option value="Perpustakaan">Perpustakaan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Asal Kantor</label>
                  <select value={editingUser.asal_kantor} onChange={(e) => setEditingUser({...editingUser, asal_kantor: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                    <option value="Jatiwaringin">Jatiwaringin</option>
                    <option value="Margonda">Margonda</option>
                    <option value="BSI Slipi">BSI Slipi</option>
                    <option value="BSI BSD">BSI BSD</option>
                    <option value="BSI Ciledug">BSI Ciledug</option>
                    <option value="Rawamangun">Rawamangun</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-8 flex gap-3 justify-end">
              <button onClick={() => setEditingUser(null)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
              <button onClick={handleUpdateAccount} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md">
                {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}