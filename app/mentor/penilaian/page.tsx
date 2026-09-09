'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import {
  submitOJTGrades, generateCertificatePDF


} from '../actions'
import { Toaster, toast } from 'sonner'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { LoadingMDU } from '@/components/LoadingMDU'


export default function PenilaianPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mentees, setMentees] = useState<any[]>([])
  const [gradesData, setGradesData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [activeView, setActiveView] = useState<'list' | 'form'>('list')
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // NEW STATE UNTUK TABS & SEARCH
  const [activeTab, setActiveTab] = useState<'belum-dinilai' | 'sudah-dinilai' | 'arsip'>('belum-dinilai')
  const [searchQuery, setSearchQuery] = useState('')

  // STATE UNTUK TEMPLATE PDF RAHASIA
  const [certData, setCertData] = useState<any>(null)

  const [grades, setGrades] = useState({
    q1: 0, q2: 0, q3: 0, q4: 0,
    q5: 0, q6: 0, q7: 0,
    q8: 0, q9: 0, q10: 0,
    q11: 0, q12: 0, q13: 0,
    no_sertifikat: '',
    kelas: '',
    jurusan: ''
  })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)

    const { data: mentorProfile } = await supabase.from('users').select('name, avatar_url').eq('id', user.id).single()
    if (mentorProfile) setProfile(mentorProfile)

    // FILTER ACTIVE PARTICIPANTS ONLY
    const { data: teamData } = await supabase
      .from('users')
      .select('*')
      .eq('mentor_id', user.id)
      .eq('role', 'ojt')
      .eq('status_ojt', 'aktif')
    if (teamData) setMentees(teamData)

    const { data: existingGrades } = await supabase.from('ojt_grades').select('*').eq('mentor_id', user.id)
    if (existingGrades) setGradesData(existingGrades)

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [router])

  const calculateAverage = (g = grades) => {
    const total = g.q1 + g.q2 + g.q3 + g.q4 + g.q5 + g.q6 + g.q7 + g.q8 + g.q9 + g.q10 + g.q11 + g.q12 + g.q13
    return (total / 13).toFixed(1)
  }

  const getLetterGrade = (avg: number) => {
    if (avg >= 96) return 'A+'
    if (avg >= 91) return 'A'
    if (avg >= 86) return 'A-'
    if (avg >= 81) return 'B+'
    if (avg >= 76) return 'B'
    if (avg >= 71) return 'B-'
    if (avg >= 66) return 'C'
    return 'D'
  }

  const openGradeForm = (student: any) => {
    setSelectedStudent(student)
    const existing = gradesData.find(g => g.user_id === student.id)
    if (existing) {
      setGrades({
        q1: existing.q1_waktu, q2: existing.q2_sikap, q3: existing.q3_tanggung_jawab, q4: existing.q4_kehadiran,
        q5: existing.q5_kemampuan, q6: existing.q6_keterampilan, q7: existing.q7_kualitas,
        q8: existing.q8_komunikasi, q9: existing.q9_kerjasama, q10: existing.q10_inisiatif,
        q11: existing.q11_percaya_diri || 0, q12: existing.q12_patuh_aturan || 0, q13: existing.q13_penampilan || 0,
        no_sertifikat: existing.no_sertifikat || '',
        kelas: existing.kelas || '',
        jurusan: existing.jurusan || ''
      })
    } else {
      setGrades({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0, q10: 0, q11: 0, q12: 0, q13: 0, no_sertifikat: '', kelas: '', jurusan: '' })
    }
    setActiveView('form')
  }

  const executeSubmitGrades = async () => {
    setIsSubmitting(true)
    const toastId = toast.loading(`Menyimpan rapor ${selectedStudent?.name}...`)

    const payload = {
      user_id: selectedStudent.id,
      mentor_id: user.id,
      q1_waktu: grades.q1, q2_sikap: grades.q2, q3_tanggung_jawab: grades.q3, q4_kehadiran: grades.q4,
      q5_kemampuan: grades.q5, q6_keterampilan: grades.q6, q7_kualitas: grades.q7,
      q8_komunikasi: grades.q8, q9_kerjasama: grades.q9, q10_inisiatif: grades.q10,
      q11_percaya_diri: grades.q11, q12_patuh_aturan: grades.q12, q13_penampilan: grades.q13,
      no_sertifikat: (grades as any).no_sertifikat,
      kelas: (grades as any).kelas,
      jurusan: (grades as any).jurusan
    }

    const result = await submitOJTGrades(payload)
    if (result.success) {
      toast.success('Rapor berhasil disimpan!', { id: toastId })
      await fetchData()
      setActiveView('list')
    } else {
      toast.error(`Gagal: ${result.message}`, { id: toastId })
    }
    setIsSubmitting(false)
  }

  const executeSubmitAndGeneratePDF = async () => {
    setIsSubmitting(true)
    const toastId = toast.loading(`Menyimpan rapor & Menyiapkan Sertifikat untuk ${selectedStudent?.name}...`)

    const payload = {
      user_id: selectedStudent.id,
      mentor_id: user.id,
      q1_waktu: grades.q1, q2_sikap: grades.q2, q3_tanggung_jawab: grades.q3, q4_kehadiran: grades.q4,
      q5_kemampuan: grades.q5, q6_keterampilan: grades.q6, q7_kualitas: grades.q7,
      q8_komunikasi: grades.q8, q9_kerjasama: grades.q9, q10_inisiatif: grades.q10,
      q11_percaya_diri: grades.q11, q12_patuh_aturan: grades.q12, q13_penampilan: grades.q13,
      no_sertifikat: (grades as any).no_sertifikat,
      kelas: (grades as any).kelas,
      jurusan: (grades as any).jurusan
    }

    const result = await submitOJTGrades(payload)
    if (result.success) {
      toast.success('Rapor disimpan! Memulai proses cetak...', { id: toastId })
      await fetchData()

      // Call PDF Generation explicitly
      await executeGeneratePDF(selectedStudent.id, selectedStudent.name)

      setActiveView('list')
    } else {
      toast.error(`Gagal menyimpan rapor: ${result.message}`, { id: toastId })
    }
    setIsSubmitting(false)
  }

  // ==========================================
  // MESIN CETAK HTML-TO-PDF DI CLIENT SIDE
  // ==========================================
  const executeGeneratePDF = async (studentId: string, studentName: string) => {
    const toastId = toast.loading('Menyiapkan desain sertifikat...')
    try {
      // 1. Tarik Data Terbaru langsung dari Database
      const { data: latestStudent, error: studentErr } = await supabase.from('users').select('*').eq('id', studentId).single()
      if (studentErr) throw new Error("Gagal mengambil data siswa")

      const { data: latestGrades, error: gradesErr } = await supabase.from('ojt_grades').select('*').eq('user_id', studentId).single()
      if (gradesErr && gradesErr.code !== 'PGRST116') throw new Error("Gagal mengambil data nilai rapor")

      // 2. Suntik data ke state (Memicu React merender template rahasia di bawah)
      setCertData({
        student: latestStudent,
        grades: latestGrades || {}
      })

      // 3. Beri jeda 800ms agar DOM selesai menggambar desain HTML-nya
      setTimeout(async () => {
        toast.loading('Mencetak PDF resolusi tinggi...', { id: toastId })
        const pdf = new jsPDF('p', 'pt', 'a4')

        // Halaman 1 (Sertifikat)
        const page1 = document.getElementById('cert-page-1')
        if (page1) {
          const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true })
          pdf.addImage(canvas1.toDataURL('image/png'), 'PNG', 0, 0, 595.28, 841.89)
        }

        // Halaman 2 (Tabel Rapor)
        const page2 = document.getElementById('cert-page-2')
        if (page2) {
          pdf.addPage('a4', 'portrait')
          const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true })
          pdf.addImage(canvas2.toDataURL('image/png'), 'PNG', 0, 0, 595.28, 841.89)
        }

        // 4. Unduh Otomatis
        pdf.save(`Sertifikat_OJT_${studentName.replace(/\s+/g, '_')}.pdf`)
        toast.success('Sertifikat berhasil diunduh!', { id: toastId })
      }, 800)

    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan sistem.', { id: toastId })
    }
  }

  // ==========================================
  // LOGIC PENYARINGAN & SEARCH
  // ==========================================
  const getFilteredMentees = () => {
    let filtered = mentees

    // Apply tab filter
    if (activeTab === 'belum-dinilai') {
      filtered = filtered.filter(m => !gradesData.find(g => g.user_id === m.id))
    } else if (activeTab === 'sudah-dinilai') {
      filtered = filtered.filter(m => gradesData.find(g => g.user_id === m.id))
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(query) ||
        m.nip?.toLowerCase().includes(query) ||
        m.divisi.toLowerCase().includes(query)
      )
    }

    return filtered
  }

  if (loading) return <LoadingMDU message="Memuat Modul Penilaian..." />

  const filteredMentees = getFilteredMentees()

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
                <span className="font-semibold text-sm">Pantuan Tim</span>
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
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 text-left"
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

      {/* SIDEBAR DESKTOP */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Panel</span>
        </div>

        <div className="px-4 flex-1 mt-4 space-y-2">
          <button onClick={() => router.push('/mentor')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="font-semibold text-sm">Pantuan Tim</span>
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
          {/* MENU AKTIF - PENILAIAN */}
          <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="font-semibold text-sm">Penilaian Evaluasi</span>
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        <div className="bg-[#1e1b4b] pt-8 pb-20 px-6 rounded-b-[40px] md:mx-6 md:mt-6 md:rounded-3xl shadow-xl relative overflow-hidden shrink-0">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>
          <div className="absolute left-1/4 bottom-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => activeView === 'form' ? setActiveView('list') : router.push('/mentor')}
                className="md:hidden p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
                  {activeView === 'list' ? (
                    <>Penilaian <span className="text-orange-300">Sertifikasi</span></>
                  ) : (
                    <>Evaluasi <span className="text-orange-300">Akhir</span></>
                  )}
                </h1>
                <p className="text-blue-100 text-xs md:text-sm font-medium mt-1">
                  {activeView === 'list' ? 'Evaluasi performa tim Anda dan terbitkan sertifikat MDU.' : `Mengisi rapor penugasan untuk ${selectedStudent?.name}`}
                </p>
              </div>
            </div>

            {activeView === 'form' ? (
              <button onClick={() => setActiveView('list')} className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all border border-white/20 backdrop-blur-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Kembali
              </button>
            ) : (
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden flex p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 animate-fade-in"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* AREA KONTEN BAWAH (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-12 relative z-10 custom-scrollbar">

          {/* LAYAR 1: DAFTAR ANAK OJT DENGAN TABS & SEARCH */}
          {activeView === 'list' && (
            <>
              {/* HEADER SEARCH & FILTERS */}
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden mb-8">
                <div className="p-5 md:p-6 border-b border-slate-100">
                  
                  {/* SEARCH INPUT */}
                  <div className="mb-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Cari nama, NIP, atau divisi..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 shadow-inner transition-all placeholder-slate-400 font-semibold"
                      />
                    </div>
                  </div>

                  {/* TABS FILTER */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setActiveTab('belum-dinilai')}
                      className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                        activeTab === 'belum-dinilai' 
                          ? 'bg-rose-50 text-rose-700 border-2 border-rose-200' 
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-2 border-transparent'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${activeTab === 'belum-dinilai' ? 'bg-rose-500 animate-pulse' : 'bg-slate-400'}`}></span>
                      Belum Dinilai ({mentees.filter(m => !gradesData.find(g => g.user_id === m.id)).length})
                    </button>
                    <button 
                      onClick={() => setActiveTab('sudah-dinilai')}
                      className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                        activeTab === 'sudah-dinilai' 
                          ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200' 
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-2 border-transparent'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${activeTab === 'sudah-dinilai' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      Sudah Dinilai ({mentees.filter(m => gradesData.find(g => g.user_id === m.id)).length})
                    </button>
                    <button 
                      onClick={() => setActiveTab('arsip')}
                      className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                        activeTab === 'arsip' 
                          ? 'bg-amber-50 text-amber-700 border-2 border-amber-200' 
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-2 border-transparent'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                      Arsip Sertifikat
                    </button>
                  </div>
                </div>

                {/* CONTENT BASED ON TAB */}
                {activeTab !== 'arsip' && (
                  <>
                    {/* STATS SUMMARY */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 border-b border-slate-100">
                      <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                        <p className="text-rose-600 text-xs font-bold uppercase mb-1">Belum Dinilai</p>
                        <p className="text-2xl font-black text-rose-700">{mentees.filter(m => !gradesData.find(g => g.user_id === m.id)).length}</p>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <p className="text-emerald-600 text-xs font-bold uppercase mb-1">Sudah Dinilai</p>
                        <p className="text-2xl font-black text-emerald-700">{mentees.filter(m => gradesData.find(g => g.user_id === m.id)).length}</p>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                        <p className="text-indigo-600 text-xs font-bold uppercase mb-1">Total Tim</p>
                        <p className="text-2xl font-black text-indigo-700">{mentees.length}</p>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                        <p className="text-amber-600 text-xs font-bold uppercase mb-1">Hasil Pencarian</p>
                        <p className="text-2xl font-black text-amber-700">{filteredMentees.length}</p>
                      </div>
                    </div>

                    {/* GRID STUDENT CARDS */}
                    <div className="p-5 md:p-6">
                      {filteredMentees.length === 0 ? (
                        <div className="text-center py-16">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </div>
                          <p className="text-base font-bold text-slate-600">Tidak Ada Data</p>
                          <p className="text-sm text-slate-400 mt-1">
                            {searchQuery 
                              ? `Pencarian "${searchQuery}" tidak ditemukan.` 
                              : activeTab === 'belum-dinilai' 
                                ? 'Semua peserta sudah dinilai!' 
                                : 'Belum ada peserta yang dinilai.'}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {filteredMentees.map(m => {
                            const grade = gradesData.find(g => g.user_id === m.id)
                            let avg = 0, letter = '-'
                            if (grade) {
                              const total = grade.q1_waktu + grade.q2_sikap + grade.q3_tanggung_jawab + grade.q4_kehadiran + grade.q5_kemampuan + grade.q6_keterampilan + grade.q7_kualitas + grade.q8_komunikasi + grade.q9_kerjasama + grade.q10_inisiatif + (grade.q11_percaya_diri || 0) + (grade.q12_patuh_aturan || 0) + (grade.q13_penampilan || 0)
                              avg = total / 13
                              letter = getLetterGrade(avg)
                            }

                            return (
                              <div key={m.id} className={`bg-white p-7 rounded-3xl border-2 shadow-xl flex flex-col relative overflow-hidden group transition-all ${
                                grade 
                                  ? 'border-emerald-100 hover:shadow-2xl hover:-translate-y-1' 
                                  : 'border-slate-100 hover:shadow-2xl hover:-translate-y-1'
                              }`}>
                                {grade && <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-emerald-100 to-transparent rounded-bl-full -z-10 opacity-60"></div>}

                                <div className="flex justify-between items-start mb-6">
                                  <div className="pr-4">
                                    <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{m.name}</h3>
                                    <p className="text-xs text-slate-500 font-semibold mt-1">{m.nip || 'Belum Ada NIP'} • {m.divisi}</p>
                                  </div>
                                  {grade && (
                                    <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-black text-xl w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner">
                                      {letter}
                                    </div>
                                  )}
                                </div>

                                <div className="mt-auto pt-6 border-t border-slate-100/60 flex gap-3">
                                  <button
                                    onClick={() => openGradeForm(m)}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${grade
                                      ? 'bg-slate-50 text-slate-600 border-2 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                                      : 'bg-indigo-600 text-white shadow-indigo-500/30 hover:bg-indigo-700 hover:shadow-indigo-500/50'
                                      }`}
                                  >
                                    {grade ? 'Edit Rapor' : 'Beri Penilaian'}
                                  </button>

                                  {grade && (
                                    <button
                                      onClick={() => executeGeneratePDF(m.id, m.name)}
                                      className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 hover:from-orange-600 hover:to-amber-600 hover:shadow-orange-500/50 transition-all"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      Sertifikat
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ARSIP SERTIFIKAT VIEW */}
                {activeTab === 'arsip' && (
                  <div className="p-5 md:p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                          Arsip Sertifikat
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Daftar sertifikat yang telah diterbitkan</p>
                      </div>
                    </div>

                    {gradesData.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-300">
                          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        </div>
                        <p className="text-base font-bold text-slate-600">Belum Ada Arsip</p>
                        <p className="text-sm text-slate-400 mt-1">Sertifikat akan muncul di sini setelah diterbitkan.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {gradesData.map(grade => {
                          const student = mentees.find(m => m.id === grade.user_id)
                          if (!student) return null
                          
                          const total = grade.q1_waktu + grade.q2_sikap + grade.q3_tanggung_jawab + grade.q4_kehadiran + grade.q5_kemampuan + grade.q6_keterampilan + grade.q7_kualitas + grade.q8_komunikasi + grade.q9_kerjasama + grade.q10_inisiatif + (grade.q11_percaya_diri || 0) + (grade.q12_patuh_aturan || 0) + (grade.q13_penampilan || 0)
                          const avg = total / 13
                          const letter = getLetterGrade(avg)

                          return (
                            <div key={grade.id} className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-2xl border-2 border-amber-200 shadow-lg hover:shadow-xl transition-all">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-bold text-slate-800 text-base truncate">{student.name}</h3>
                                  <p className="text-xs text-slate-500 font-semibold mt-0.5">{student.divisi}</p>
                                </div>
                                <div className="bg-amber-100 text-amber-700 border border-amber-200 font-black text-lg w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                                  {letter}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* LAYAR 2: FORM PENILAIAN */}
          {activeView === 'form' && (
            <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col lg:flex-row">
              <div className="flex-1 p-6 md:p-10 overflow-y-auto max-h-[75vh] custom-scrollbar border-r border-slate-100">
                <div className="space-y-10">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-5 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm shadow-inner">#</span>
                      Informasi Sertifikat
                    </h3>
                    <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex flex-col hover:border-indigo-100 transition-colors">
                      <span className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wide">Nomor Sertifikat (Contoh: 306/MDU/V/2026)</span>
                      <input type="text" value={(grades as any).no_sertifikat || ''} onChange={(e) => setGrades({ ...grades, no_sertifikat: e.target.value })} className="w-full px-4 py-2.5 text-base font-bold text-indigo-950 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" placeholder="Masukkan Nomor Sertifikat" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex flex-col hover:border-indigo-100 transition-colors">
                        <span className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wide">Kelas <span className="text-indigo-400 font-medium normal-case ml-1">(Gunakan Romawi: X, XI, XII)</span></span>
                        <input type="text" value={(grades as any).kelas || ''} onChange={(e) => setGrades({ ...grades, kelas: e.target.value })} className="w-full px-4 py-2.5 text-base font-bold text-indigo-950 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" placeholder="Contoh: XII" />
                      </div>
                      <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex flex-col hover:border-indigo-100 transition-colors">
                        <span className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wide">Jurusan</span>
                        <input type="text" value={(grades as any).jurusan || ''} onChange={(e) => setGrades({ ...grades, jurusan: e.target.value })} className="w-full px-4 py-2.5 text-base font-bold text-indigo-950 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" placeholder="Masukkan Jurusan" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-5 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm shadow-inner">1</span>
                      Kedisiplinan & Sikap
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[{ id: 'q1', label: 'Ketepatan waktu/disiplin' }, { id: 'q2', label: 'Sikap & prosedur kerja' }, { id: 'q3', label: 'Tanggung jawab tugas' }, { id: 'q4', label: 'Kehadiran/absensi' }].map(q => (
                        <div key={q.id} className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex flex-col hover:border-indigo-100 transition-colors">
                          <span className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wide">{q.label}</span>
                          <input type="number" min="0" max="100" value={(grades as any)[q.id] || ''} onChange={(e) => setGrades({ ...grades, [q.id]: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 text-xl font-black text-indigo-950 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" placeholder="0-100" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-5 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm shadow-inner">2</span>
                      Prestasi & Kompetensi
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[{ id: 'q5', label: 'Kemampuan Kerja' }, { id: 'q6', label: 'Keterampilan Kerja' }, { id: 'q7', label: 'Kualitas Hasil Kerja' }].map(q => (
                        <div key={q.id} className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex flex-col hover:border-indigo-100 transition-colors">
                          <span className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wide">{q.label}</span>
                          <input type="number" min="0" max="100" value={(grades as any)[q.id] || ''} onChange={(e) => setGrades({ ...grades, [q.id]: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 text-xl font-black text-indigo-950 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" placeholder="0-100" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-5 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm shadow-inner">3</span>
                      Adaptabilitas & Karakter
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[{ id: 'q8', label: 'Komunikasi' }, { id: 'q9', label: 'Kerjasama Tim' }, { id: 'q10', label: 'Kerajinan/Inisiatif' }, { id: 'q11', label: 'Kepercayaan Diri' }, { id: 'q12', label: 'Kepatuhan Aturan' }, { id: 'q13', label: 'Penampilan/Kerapihan' }].map(q => (
                        <div key={q.id} className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex flex-col hover:border-indigo-100 transition-colors">
                          <span className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wide">{q.label}</span>
                          <input type="number" min="0" max="100" value={(grades as any)[q.id] || ''} onChange={(e) => setGrades({ ...grades, [q.id]: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 text-xl font-black text-indigo-950 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" placeholder="0-100" />
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              <div className="w-full lg:w-[340px] bg-slate-50 p-6 md:p-8 flex flex-col">
                <div className="bg-gradient-to-br from-[#1e1b4b] to-indigo-900 rounded-3xl p-7 text-white shadow-xl relative overflow-hidden mb-8">
                  <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                  <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-1">Kalkulasi Rata-rata</p>
                  <p className="text-6xl font-black tracking-tighter mb-6">{calculateAverage()}</p>

                  <div className="border-t border-white/20 pt-5 flex justify-between items-end">
                    <span className="text-sm font-semibold text-blue-200">Predikat Akhir</span>
                    <span className="text-4xl font-black text-orange-400 leading-none">{getLetterGrade(parseFloat(calculateAverage()))}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  <button
                    onClick={executeSubmitAndGeneratePDF}
                    disabled={isSubmitting}
                    className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isSubmitting
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/30 hover:-translate-y-0.5'
                      }`}
                  >
                    {isSubmitting ? 'Memproses...' : 'Simpan & Cetak Sertifikat'}
                  </button>
                  <button
                    onClick={executeSubmitGrades}
                    disabled={isSubmitting}
                    className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isSubmitting
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 hover:-translate-y-0.5'
                      }`}
                  >
                    Simpan Nilai Rapor Saja
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* TEMPLATE PDF */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', opacity: 0, pointerEvents: 'none' }}>
        {certData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <div id="cert-page-1" style={{ width: '794px', height: '1123px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              <img src="/template-portrait-front.png" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -1 }} alt="Background" crossOrigin="anonymous" />
              <div style={{ position: 'absolute', top: '265px', left: 0, width: '100%', textAlign: 'center' }}>
                <p style={{ fontSize: '1.25rem', fontFamily: 'sans-serif', margin: 0, color: '#111827', fontWeight: 'bold' }}>{certData.grades?.no_sertifikat || '___/MDU/___/____'}</p>
              </div>
              <div style={{ position: 'absolute', top: '400px', left: 0, width: '100%', textAlign: 'center' }}>
                <h2 style={{ fontSize: '3.2rem', fontFamily: 'serif', fontStyle: 'italic', color: '#111827', margin: 0 }}>{certData.student?.name}</h2>
              </div>
              <div style={{ position: 'absolute', top: '500px', left: 0, width: '100%', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.6rem', fontFamily: 'sans-serif', fontWeight: 900, color: '#111827', margin: 0 }}>{certData.student?.divisi || 'Multimedia'}</h3>
              </div>
              <div style={{ position: 'absolute', top: '600px', left: 0, width: '100%', textAlign: 'center' }}>
                <p style={{ fontSize: '1.4rem', fontFamily: 'sans-serif', color: '#111827', margin: 0, fontWeight: 500 }}>Terhitung mulai tanggal {certData.student?.start_period || '-'} sampai dengan {certData.student?.end_period || '-'}</p>
              </div>
            </div>
            <div id="cert-page-2" style={{ width: '794px', height: '1123px', backgroundColor: '#ffffff', position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
              <img src="/template-portrait-back.png" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
              <div style={{ position: 'relative', padding: '160px 95px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e1b4b', textTransform: 'uppercase', marginBottom: '1rem' }}>LEMBAR PENILAIAN OJT</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #1e293b', marginBottom: '1rem', fontSize: '0.75rem' }}>
                  <tbody>
                    {[['Nama', certData.student?.name || '-'], ['Kelas', certData.grades?.kelas || '-'], ['Sekolah', certData.student?.asal_sekolah || '-'], ['Jurusan', certData.grades?.jurusan || '-'], ['Tanggal', `${certData.student?.start_period || '-'} s/d ${certData.student?.end_period || '-'}`], ['Posisi', certData.student?.divisi || '-']].map((row, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #1e293b', padding: '0.3rem', fontWeight: 700 }}>{row[0]}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '0.3rem', fontWeight: 700 }}>{row[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #1e293b', fontSize: '0.7rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#4c1d63', color: '#fff' }}>
                      <th style={{ border: '1px solid #1e293b', padding: '0.4rem' }}>Aspek</th>
                      <th style={{ border: '1px solid #1e293b', padding: '0.4rem', textAlign: 'center' }}>Nilai</th>
                      <th style={{ border: '1px solid #1e293b', padding: '0.4rem', textAlign: 'center' }}>Predikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['q1_waktu','q2_sikap','q3_tanggung_jawab','q4_kehadiran','q5_kemampuan','q6_keterampilan','q7_kualitas','q8_komunikasi','q9_kerjasama','q10_inisiatif','q11_percaya_diri','q12_patuh_aturan','q13_penampilan'].map((q,i) => (
                      <tr key={q} style={{ backgroundColor: i % 2 === 0 ? '#e8deef' : 'white' }}>
                        <td style={{ border: '1px solid #1e293b', padding: '0.3rem' }}>{['Waktu','Sikap','Tanggung Jawab','Kehadiran','Kemampuan','Keterampilan','Kualitas','Komunikasi','Kerjasama','Inisiatif','Percaya Diri','Kepatuhan','Penampilan'][i]}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '0.3rem', textAlign: 'center', fontWeight: 700 }}>{certData.grades?.[q] || 0}</td>
                        <td style={{ border: '1px solid #1e293b', padding: '0.3rem', textAlign: 'center', fontWeight: 700 }}>{getLetterGrade(certData.grades?.[q] || 0)}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#d8bfd8', fontWeight: 800 }}>
                      <td colSpan={3} style={{ border: '1px solid #1e293b', padding: '0.4rem', textAlign: 'center' }}>RATA-RATA AKHIR</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
