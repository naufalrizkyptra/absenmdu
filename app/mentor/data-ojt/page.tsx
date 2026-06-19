'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { createOJTAccount, updateOJTProfile, deleteOJTAccount, resetPasswordByMentor } from '../actions'
import Swal from 'sweetalert2'
import { Toaster, toast } from 'sonner'

export default function DataOJTPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mentees, setMentees] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetUser, setResetUser] = useState<{id: string, name: string} | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)
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

  // RUMUS MENGHITUNG SISA HARI MAGANG
  const calculateRemainingDays = (endDateStr: string) => {
    if (!endDateStr) return null
    const end = new Date(endDateStr)
    const today = new Date()
    end.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    const diffTime = end.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'

  const menteesEndingSoon = mentees.filter(m => {
    const days = calculateRemainingDays(m.end_period)
    return days !== null && days >= 0 && days <= 7
  })

  const handleCreateAccount = async () => {
    setIsSubmitting(true)
    const result = await createOJTAccount({ ...formData, mentor_id: user.id })
    if (result.success) {
      Swal.fire('Berhasil!', 'Data peserta OJT telah berhasil didaftarkan.', 'success').then(() => {
        setFormData({ nip: '', name: '', asal_sekolah: '', divisi: 'Multimedia', asal_kantor: 'Jatiwaringin', no_telp: '', start_period: '', end_period: '' })
        setShowAddModal(false) 
        window.location.reload()
      })
    } else {
      Swal.fire('Pendaftaran Gagal', result.message, 'error')
    }
    setIsSubmitting(false)
  }

  const handleUpdateAccount = async () => {
    setIsSubmitting(true)
    const result = await updateOJTProfile(editingUser.id, editingUser)
    if (result.success) {
      Swal.fire('Berhasil!', 'Data profil peserta OJT berhasil diperbarui.', 'success').then(() => window.location.reload())
    } else {
      Swal.fire('Pembaruan Gagal', result.message, 'error')
    }
    setIsSubmitting(false)
    setEditingUser(null)
  }

  const handleDeleteOJT = async (id: string, name: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus Data Peserta?',
      text: `Seluruh data akun dan riwayat atas nama ${name} akan dihapus secara permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, Hapus Data',
      cancelButtonText: 'Batal',
      customClass: { confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' }
    })
    if (confirm.isConfirmed) {
      setIsSubmitting(true)
      const res = await deleteOJTAccount(id)
      if (res.success) Swal.fire('Terhapus', 'Data peserta telah berhasil dihapus.', 'success').then(() => window.location.reload())
      else Swal.fire('Penghapusan Gagal', res.message, 'error')
      setIsSubmitting(false)
    }
  }

  const filteredMentees = mentees.filter((m) => {
    const query = searchQuery.toLowerCase()
    return (
      m.name?.toLowerCase().includes(query) ||
      m.nip?.toLowerCase().includes(query) ||
      m.asal_sekolah?.toLowerCase().includes(query) ||
      m.asal_kantor?.toLowerCase().includes(query)
    )
  })

  const openResetModal = (id: string, name: string) => {
    setResetUser({ id, name })
    setNewPassword('')
    setShowResetModal(true)
  }

  const executeResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Kata sandi minimal harus terdiri dari 6 karakter.')
      return
    }

    setIsResetting(true)
    const toastId = toast.loading(`Mereset kata sandi ${resetUser?.name}...`)

    const result = await resetPasswordByMentor(resetUser!.id, newPassword)

    if (result.success) {
      toast.success(`Kata sandi untuk ${resetUser?.name} berhasil diperbarui.`, { id: toastId })
      setShowResetModal(false) 
    } else {
      toast.error(`Pembaruan gagal: ${result.message}`, { id: toastId })
    }
    setIsResetting(false)
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8faff] text-indigo-950 font-medium">Memuat Manajemen Data...</div>

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
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="font-semibold text-sm">Ikhtisar Tim</span>
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); router.push('/mentor/data-ojt'); }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 text-left"
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
          1. SIDEBAR DESKTOP (Struktur Fixed) 
          ========================================= */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Panel</span>
        </div>

        <div className="px-4 flex-1 mt-4 space-y-2">
          <button onClick={() => router.push('/mentor')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="font-semibold text-sm">Ikhtisar Tim</span>
          </button>
          {/* MENU AKTIF - DATA PESERTA */}
          <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
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
              <button 
                onClick={() => router.push('/mentor')}
                className="md:hidden p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
                  Manajemen <span className="text-orange-300">Peserta OJT</span>
                </h1>
                <p className="text-blue-100 text-xs md:text-sm font-medium mt-1">
                  Kelola data administrasi dan masa penugasan tim kreatif Anda.
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

        {/* AREA KONTEN BAWAH (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-12 relative z-10">
          
          {/* BANNER PERINGATAN MASA MAGANG */}
          {menteesEndingSoon.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-3xl p-5 md:p-6 flex items-start gap-4 shadow-lg shadow-amber-500/10">
              <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-amber-800 text-base md:text-lg">Tenggat Evaluasi Mendekat</h3>
                <p className="text-sm text-amber-700 mt-1 font-medium leading-relaxed">
                  Terdapat <strong className="text-amber-900">{menteesEndingSoon.length} peserta</strong> yang masa penugasannya akan berakhir dalam kurang dari 7 hari. Mohon segera melengkapi nilai akhir mereka.
                </p>
              </div>
            </div>
          )}

          {/* BOX PUTIH UNTUK TABEL & KONTROL */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            
            {/* KONTROL HEADER (SEARCH & TAMBAH) */}
            <div className="p-5 md:p-6 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  type="text"
                  placeholder="Cari nama, NIP, institusi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 shadow-inner transition-all placeholder-slate-400"
                />
              </div>
              
              <button 
                onClick={() => setShowAddModal(true)}
                className="w-full md:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 md:py-3 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/30 text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Tambah Peserta
              </button>
            </div>

            {/* AREA TABEL */}
            <div className="p-0 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4 pl-6">NIP & Identitas</th>
                    <th className="p-4">Institusi & Kantor</th>
                    <th className="p-4">Periode Magang</th>
                    <th className="p-4">Kontak Aktif</th>
                    <th className="p-4 text-right pr-6">Tindakan Kelola</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMentees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-16 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <p className="text-sm font-bold text-slate-600">Tidak Ada Data</p>
                        <p className="text-xs text-slate-400 mt-1">Pencarian "{searchQuery}" tidak ditemukan.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMentees.map((m) => {
                      const remainingDays = calculateRemainingDays(m.end_period)
                      const isEndingSoon = remainingDays !== null && remainingDays >= 0 && remainingDays <= 7
                      const isFinished = remainingDays !== null && remainingDays < 0

                      return (
                        <tr key={m.id} className={`transition-all hover:bg-indigo-50/30 ${isEndingSoon ? 'bg-amber-50/30' : ''}`}>
                          
                          <td className="p-4 pl-6">
                            <div className="font-bold text-slate-800">{m.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-semibold text-slate-400">{m.nip || 'Belum Ada NIP'}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span className="text-xs font-bold text-indigo-600">{m.divisi}</span>
                            </div>
                          </td>

                          <td className="p-4 text-sm">
                            <div className="font-semibold text-slate-700">{m.asal_sekolah || '-'}</div>
                            <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wide border border-slate-200">
                              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h6" /></svg>
                              {m.asal_kantor}
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="text-sm font-semibold text-slate-600">
                              {m.start_period ? formatDate(m.start_period) : '-'} <span className="text-slate-300 mx-1">➔</span> {m.end_period ? formatDate(m.end_period) : '-'}
                            </div>
                            {isEndingSoon && (
                              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Sisa {remainingDays} Hari
                              </div>
                            )}
                            {isFinished && (
                              <div className="inline-flex items-center mt-2 px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                Telah Selesai
                              </div>
                            )}
                          </td>

                          <td className="p-4 text-sm text-indigo-600 font-bold">{m.no_telp || '-'}</td>

                          <td className="p-4 text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setEditingUser(m)} 
                                className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl shadow-sm transition-all border border-blue-100 tooltip-trigger"
                                title="Edit Profil"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button 
                                onClick={() => openResetModal(m.id, m.name)} 
                                className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-600 hover:bg-slate-600 hover:text-white rounded-xl shadow-sm transition-all border border-slate-200 tooltip-trigger"
                                title="Reset Kata Sandi"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                              </button>
                              <button 
                                onClick={() => handleDeleteOJT(m.id, m.name)} 
                                className="w-9 h-9 flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl shadow-sm transition-all border border-rose-100 tooltip-trigger"
                                title="Hapus Permanen"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================
          MODAL TAMBAH DATA (DI-MAKEOVER)
          ========================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto transform scale-100 animate-in zoom-in-95 duration-200 custom-scrollbar">
            
            <div className="flex items-center gap-4 mb-8 pb-5 border-b border-slate-100">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Registrasi Peserta OJT Baru</h2>
                <p className="text-sm text-slate-500 mt-0.5">Lengkapi identitas untuk mendaftarkan akun ke portal MDU.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Nama Lengkap</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Sesuai dokumen resmi" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">NIP / Identitas</label>
                  <input type="text" value={formData.nip} onChange={(e) => setFormData({...formData, nip: e.target.value})} placeholder="Contoh: 11240052" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Institusi Asal</label>
                  <input type="text" value={formData.asal_sekolah} onChange={(e) => setFormData({...formData, asal_sekolah: e.target.value})} placeholder="Nama Kampus / Sekolah" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Nomor WhatsApp</label>
                  <input type="tel" value={formData.no_telp} onChange={(e) => setFormData({...formData, no_telp: e.target.value})} placeholder="Contoh: 0812345678" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Tanggal Mulai</label>
                  <input type="date" value={formData.start_period} onChange={(e) => setFormData({...formData, start_period: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Tanggal Selesai</label>
                  <input type="date" value={formData.end_period} onChange={(e) => setFormData({...formData, end_period: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Divisi</label>
                  <select value={formData.divisi} onChange={(e) => setFormData({...formData, divisi: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer">
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
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Area Kantor</label>
                  <select value={formData.asal_kantor} onChange={(e) => setFormData({...formData, asal_kantor: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer">
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

            <div className="mt-10 flex gap-3 justify-end pt-5 border-t border-slate-100">
              <button onClick={() => setShowAddModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all">Batal</button>
              <button onClick={handleCreateAccount} disabled={isSubmitting} className="px-8 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5">
                {isSubmitting ? 'Memproses...' : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL EDIT DATA (DI-MAKEOVER)
          ========================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto transform scale-100 animate-in zoom-in-95 duration-200 custom-scrollbar">
            
            <div className="flex items-center gap-4 mb-8 pb-5 border-b border-slate-100">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Edit Data Peserta</h2>
                <p className="text-sm text-slate-500 mt-0.5">Pembaruan rekam administratif untuk {editingUser.name}.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Nama Lengkap</label>
                  <input type="text" value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">NIP / Identitas</label>
                  <input type="text" value={editingUser.nip} onChange={(e) => setEditingUser({...editingUser, nip: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Institusi Asal</label>
                  <input type="text" value={editingUser.asal_sekolah} onChange={(e) => setEditingUser({...editingUser, asal_sekolah: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Nomor WhatsApp</label>
                  <input type="tel" value={editingUser.no_telp} onChange={(e) => setEditingUser({...editingUser, no_telp: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Tanggal Mulai</label>
                  <input type="date" value={editingUser.start_period} onChange={(e) => setEditingUser({...editingUser, start_period: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Tanggal Selesai</label>
                  <input type="date" value={editingUser.end_period} onChange={(e) => setEditingUser({...editingUser, end_period: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Divisi</label>
                  <select value={editingUser.divisi} onChange={(e) => setEditingUser({...editingUser, divisi: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
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
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Area Kantor</label>
                  <select value={editingUser.asal_kantor} onChange={(e) => setEditingUser({...editingUser, asal_kantor: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
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

            <div className="mt-10 flex gap-3 justify-end pt-5 border-t border-slate-100">
              <button onClick={() => setEditingUser(null)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all">Batal</button>
              <button onClick={handleUpdateAccount} disabled={isSubmitting} className="px-8 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:-translate-y-0.5">
                {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL RESET PASSWORD (DI-MAKEOVER)
          ========================================= */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-sm rounded-[28px] p-8 shadow-2xl border border-white/60 transform scale-100 animate-in zoom-in-95 duration-200">
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-slate-100">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Atur Ulang Sandi</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">Buat kata sandi baru untuk mengamankan akses akun <strong>{resetUser?.name}</strong>.</p>
            </div>

            <div className="space-y-4">
              <div>
                <input 
                  type="password" 
                  placeholder="Masukkan minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium placeholder-slate-400 text-center tracking-wider"
                />
              </div>
              
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowResetModal(false)}
                  disabled={isResetting}
                  className="flex-1 px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-colors text-sm"
                >
                  Batal
                </button>
                <button 
                  onClick={executeResetPassword}
                  disabled={isResetting || newPassword.length < 6}
                  className={`flex-1 px-4 py-3.5 font-bold rounded-2xl transition-all shadow-md text-sm ${
                    isResetting || newPassword.length < 6 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                      : 'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-900/20 hover:-translate-y-0.5'
                  }`}
                >
                  {isResetting ? 'Memproses...' : 'Simpan Sandi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}