'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { LoadingMDU } from '@/components/LoadingMDU'
import { Toaster, toast } from 'sonner'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import {
  createMentorAccount,
  updateMentorProfile,
  resetMentorPasswordByAdmin,
  deleteMentorAccount,
  archiveMentorAccount,
  submitMentorEvaluation,
  deleteMentorEvaluation
} from './actions'

const DIVISION_OPTIONS = [
  'Mentor',
  'Marketing Komunikasi',
  'Sosial Media Spesialis',
  'Content Creator',
  'Multimedia',
  'Animator',
  'Desain Komunikasi Visual',
  'Teknologi Informasi & Software',
  'Broadcasting & Media',
  'Humas',
  'Staff Human Capital',
  'DICO',
  'LPPM',
  'Kemahasiswaan',
  'Nusa Mandiri Center',
  'Perpustakaan'
]

const OFFICE_OPTIONS = [
  'Jatiwaringin',
  'Margonda',
  'BSD',
  'BSI BSD',
  'BSI Slipi',
  'Rawamangun',
  'BSI Ciledug',
  'Bandung'
]

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [allOjt, setAllOjt] = useState<any[]>([])
  const [allMentors, setAllMentors] = useState<any[]>([])
  const [mentorGrades, setMentorGrades] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'))
  const [attendances, setAttendances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'absensi' | 'performa' | 'mentors' | 'sertifikat'>('absensi')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()

  // STATE FILTER & SEARCH
  const [mentorSearch, setMentorSearch] = useState('')
  const [mentorStatusFilter, setMentorStatusFilter] = useState<'all' | 'aktif' | 'selesai'>('all')
  const [certSearch, setCertSearch] = useState('')
  const [certStatusFilter, setCertStatusFilter] = useState<'all' | 'belum' | 'terbit'>('all')

  // STATE MODAL TAMBAH MENTOR
  const [showAddMentorModal, setShowAddMentorModal] = useState(false)
  const [isSubmittingMentor, setIsSubmittingMentor] = useState(false)
  const [newMentorForm, setNewMentorForm] = useState({
    name: '',
    nip: '',
    email: '',
    password: '',
    divisi: 'Mentor',
    asal_kantor: 'Jatiwaringin',
    no_telp: '',
    start_period: '',
    end_period: ''
  })

  // STATE MODAL EDIT MENTOR
  const [showEditMentorModal, setShowEditMentorModal] = useState(false)
  const [editingMentor, setEditingMentor] = useState<any>(null)
  const [isUpdatingMentor, setIsUpdatingMentor] = useState(false)

  // STATE MODAL RESET PASSWORD
  const [showResetModal, setShowResetModal] = useState(false)
  const [selectedResetMentor, setSelectedResetMentor] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  // STATE MODAL EVALUASI & SERTIFIKAT MENTOR
  const [showEvalModal, setShowEvalModal] = useState(false)
  const [evaluatingMentor, setEvaluatingMentor] = useState<any>(null)
  const [isSubmittingEval, setIsSubmittingEval] = useState(false)
  const [evalForm, setEvalForm] = useState({
    no_sertifikat: '',
    start_period: '',
    end_period: '',
    nilai_kepemimpinan: 90,
    nilai_kedisiplinan: 90,
    nilai_komunikasi: 90,
    nilai_teknis: 90,
    nilai_efektivitas: 90,
    catatan: '',
    predikat: 'Sangat Memuaskan'
  })

  // STATE CETAK SERTIFIKAT MENTOR RENDER DOM
  const [certDataToPrint, setCertDataToPrint] = useState<{
    mentor: any
    grades: any
  } | null>(null)

  // FETCH DATA UTAMA
  const fetchAdminData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // 1. Profil Admin
      const { data: adminProfile } = await supabase
        .from('users')
        .select('name, role, avatar_url')
        .eq('id', user.id)
        .single()

      if (adminProfile?.role !== 'admin') {
        router.push('/login')
        return
      }
      setProfile(adminProfile)

      // 2. Tarik semua users (OJT & Mentor)
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true })

      if (usersData) {
        setAllOjt(usersData.filter(u => u.role === 'ojt'))
        setAllMentors(usersData.filter(u => u.role === 'mentor'))
      }

      // 3. Tarik data mentor_grades
      const { data: gradesData } = await supabase
        .from('mentor_grades')
        .select('*')

      if (gradesData) {
        setMentorGrades(gradesData)
      }
    } catch (err) {
      console.error('Error fetching admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [router])

  useEffect(() => {
    const fetchAttendanceByDate = async () => {
      const { data: absenData } = await supabase
        .from('attendance')
        .select('*, users(name, divisi, asal_kantor)')
        .gte('check_in_time', `${selectedDate}T00:00:00`)
        .lte('check_in_time', `${selectedDate}T23:59:59`)
        .order('check_in_time', { ascending: false })

      if (absenData) setAttendances(absenData)
    }
    fetchAttendanceByDate()
  }, [selectedDate])

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  // HITUNG JUMLAH MENTEE AKTIF PER MENTOR
  const getActiveMenteeCount = (mentorId: string) => {
    return allOjt.filter(o => o.mentor_id === mentorId && o.status_ojt !== 'selesai').length
  }

  // HITUNG PREDIKAT OTOMATIS
  const calculateAverage = (form: typeof evalForm) => {
    const sum = Number(form.nilai_kepemimpinan || 0) +
      Number(form.nilai_kedisiplinan || 0) +
      Number(form.nilai_komunikasi || 0) +
      Number(form.nilai_teknis || 0) +
      Number(form.nilai_efektivitas || 0)
    return Math.round(sum / 5)
  }

  const getPredicateLabel = (avg: number) => {
    if (avg >= 90) return 'Sangat Memuaskan'
    if (avg >= 80) return 'Memuaskan'
    if (avg >= 70) return 'Baik'
    return 'Cukup'
  }

  // HANDLER REGISTRASI MENTOR
  const handleCreateMentor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMentorForm.name || !newMentorForm.email) {
      toast.error('Nama dan Email mentor wajib diisi!')
      return
    }

    setIsSubmittingMentor(true)
    const toastId = toast.loading('Mendaftarkan akun mentor...')

    const res = await createMentorAccount(newMentorForm)
    setIsSubmittingMentor(false)

    if (res.success) {
      toast.success(res.message, { id: toastId })
      setShowAddMentorModal(false)
      setNewMentorForm({
        name: '',
        nip: '',
        email: '',
        password: '',
        divisi: 'Mentor',
        asal_kantor: 'Jatiwaringin',
        no_telp: '',
        start_period: '',
        end_period: ''
      })
      await fetchAdminData()
    } else {
      toast.error(res.message || 'Gagal mendaftarkan mentor', { id: toastId })
    }
  }

  // HANDLER UPDATE PROFIL MENTOR
  const handleUpdateMentor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMentor) return

    setIsUpdatingMentor(true)
    const toastId = toast.loading('Menyimpan perubahan profil mentor...')

    const res = await updateMentorProfile(editingMentor.id, {
      name: editingMentor.name,
      nip: editingMentor.nip,
      email: editingMentor.email,
      divisi: editingMentor.divisi,
      asal_kantor: editingMentor.asal_kantor,
      no_telp: editingMentor.no_telp,
      start_period: editingMentor.start_period,
      end_period: editingMentor.end_period,
      status: editingMentor.status
    })

    setIsUpdatingMentor(false)
    if (res.success) {
      toast.success(res.message, { id: toastId })
      setShowEditMentorModal(false)
      setEditingMentor(null)
      await fetchAdminData()
    } else {
      toast.error(res.message || 'Gagal memperbarui profil mentor', { id: toastId })
    }
  }

  // HANDLER RESET PASSWORD MENTOR
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedResetMentor || !newPassword) return

    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter!')
      return
    }

    setIsResettingPassword(true)
    const toastId = toast.loading(`Mereset password mentor ${selectedResetMentor.name}...`)

    const res = await resetMentorPasswordByAdmin(selectedResetMentor.id, newPassword)
    setIsResettingPassword(false)

    if (res.success) {
      toast.success(res.message, { id: toastId })
      setShowResetModal(false)
      setSelectedResetMentor(null)
      setNewPassword('')
    } else {
      toast.error(res.message || 'Gagal mereset password mentor', { id: toastId })
    }
  }

  // HANDLER HAPUS MENTOR
  const handleDeleteMentor = async (mentor: any) => {
    const activeCount = getActiveMenteeCount(mentor.id)
    if (activeCount > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Penghapusan Dicegah',
        html: `Mentor <b>${mentor.name}</b> masih membimbing <b>${activeCount} anak OJT aktif</b>.<br/><br/>Harap alihkan atau selesaikan masa bimbingan anak OJT terlebih dahulu sebelum menghapus akun ini.`,
        confirmButtonColor: '#2563eb'
      })
      return
    }

    const result = await Swal.fire({
      title: 'Hapus Akun Mentor?',
      html: `Anda akan menghapus akun mentor <b>${mentor.name}</b> secara permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus Permanen',
      cancelButtonText: 'Batal'
    })

    if (result.isConfirmed) {
      const toastId = toast.loading('Menghapus akun mentor...')
      const res = await deleteMentorAccount(mentor.id)
      if (res.success) {
        toast.success(res.message, { id: toastId })
        await fetchAdminData()
      } else {
        toast.error(res.message || 'Gagal menghapus mentor', { id: toastId })
      }
    }
  }

  // HANDLER ARSIPKAN MENTOR
  const handleArchiveMentor = async (mentor: any) => {
    const result = await Swal.fire({
      title: 'Selesaikan Masa Bimbingan?',
      html: `Ubah status mentor <b>${mentor.name}</b> menjadi <b>Selesai</b>? Riwayat data dan sertifikat tetap tersimpan aman.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Tandai Selesai',
      cancelButtonText: 'Batal'
    })

    if (result.isConfirmed) {
      const toastId = toast.loading('Mengarsipkan status mentor...')
      const res = await archiveMentorAccount(mentor.id)
      if (res.success) {
        toast.success(res.message, { id: toastId })
        await fetchAdminData()
      } else {
        toast.error(res.message || 'Gagal mengarsipkan mentor', { id: toastId })
      }
    }
  }

  // BUKA MODAL EVALUASI MENTOR
  const openEvaluationModal = (mentor: any) => {
    setEvaluatingMentor(mentor)
    const existingGrade = mentorGrades.find(g => g.mentor_id === mentor.id)

    // Cari nomor sertifikat otomatis jika belum ada
    const currentYear = new Date().getFullYear()
    const autoNo = existingGrade?.no_sertifikat || `${mentorGrades.length + 1}/MDU-MENTOR/XI/${currentYear}`

    setEvalForm({
      no_sertifikat: autoNo,
      start_period: existingGrade?.start_period || mentor.start_period || '',
      end_period: existingGrade?.end_period || mentor.end_period || '',
      nilai_kepemimpinan: Number(existingGrade?.nilai_kepemimpinan ?? 90),
      nilai_kedisiplinan: Number(existingGrade?.nilai_kedisiplinan ?? 90),
      nilai_komunikasi: Number(existingGrade?.nilai_komunikasi ?? 90),
      nilai_teknis: Number(existingGrade?.nilai_teknis ?? 90),
      nilai_efektivitas: Number(existingGrade?.nilai_efektivitas ?? 90),
      catatan: existingGrade?.catatan || '',
      predikat: existingGrade?.predikat || 'Sangat Memuaskan'
    })
    setShowEvalModal(true)
  }

  // SIMPAN EVALUASI MENTOR
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!evaluatingMentor) return

    if (!evalForm.no_sertifikat.trim()) {
      toast.error('Nomor sertifikat wajib diisi!')
      return
    }

    setIsSubmittingEval(true)
    const toastId = toast.loading(`Menyimpan evaluasi & sertifikat untuk ${evaluatingMentor.name}...`)

    const avg = calculateAverage(evalForm)
    const pred = getPredicateLabel(avg)

    const res = await submitMentorEvaluation({
      mentor_id: evaluatingMentor.id,
      admin_id: user?.id,
      no_sertifikat: evalForm.no_sertifikat.trim(),
      start_period: evalForm.start_period,
      end_period: evalForm.end_period,
      nilai_kepemimpinan: evalForm.nilai_kepemimpinan,
      nilai_kedisiplinan: evalForm.nilai_kedisiplinan,
      nilai_komunikasi: evalForm.nilai_komunikasi,
      nilai_teknis: evalForm.nilai_teknis,
      nilai_efektivitas: evalForm.nilai_efektivitas,
      predikat: pred,
      catatan: evalForm.catatan
    })

    setIsSubmittingEval(false)
    if (res.success) {
      toast.success(res.message, { id: toastId })
      setShowEvalModal(false)
      await fetchAdminData()
    } else {
      toast.error(res.message || 'Gagal menyimpan evaluasi', { id: toastId })
    }
  }

  // BATALKAN EVALUASI
  const handleDeleteEvaluation = async (mentor: any) => {
    const result = await Swal.fire({
      title: 'Batalkan Sertifikat?',
      html: `Penilaian dan sertifikat mentor <b>${mentor.name}</b> akan dihapus/dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Batalkan Sertifikat',
      cancelButtonText: 'Tutup'
    })

    if (result.isConfirmed) {
      const toastId = toast.loading('Membatalkan sertifikat...')
      const res = await deleteMentorEvaluation(mentor.id)
      if (res.success) {
        toast.success(res.message, { id: toastId })
        await fetchAdminData()
      } else {
        toast.error(res.message || 'Gagal membatalkan sertifikat', { id: toastId })
      }
    }
  }

  // MESIN CETAK SERTIFIKAT PDF MENTOR
  const handleDownloadCertificate = async (mentor: any) => {
    const grade = mentorGrades.find(g => g.mentor_id === mentor.id)
    if (!grade || !grade.no_sertifikat) {
      toast.warning('Mentor belum memiliki nilai/sertifikat yang diterbitkan.')
      return
    }

    const toastId = toast.loading(`Menyiapkan Sertifikat Mentor untuk ${mentor.name}...`)

    try {
      setCertDataToPrint({
        mentor,
        grades: grade
      })

      // Tunggu DOM me-render elemen
      setTimeout(async () => {
        toast.loading('Mencetak dokumen resolusi tinggi...', { id: toastId })
        const pdf = new jsPDF('p', 'pt', 'a4')

        // Halaman 1 (Sertifikat Landscape ke A4 Portrait)
        const page1 = document.getElementById('mentor-cert-page-1')
        if (page1) {
          const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true })
          const rotatedCanvas = document.createElement('canvas')
          rotatedCanvas.width = canvas1.height
          rotatedCanvas.height = canvas1.width
          const ctx = rotatedCanvas.getContext('2d')
          if (ctx) {
            ctx.translate(0, rotatedCanvas.height)
            ctx.rotate(-Math.PI / 2)
            ctx.drawImage(canvas1, 0, 0)
          }
          pdf.addImage(rotatedCanvas.toDataURL('image/png'), 'PNG', 0, 0, 595.28, 841.89)
        }

        // Halaman 2 (Transkrip Kinerja Mentor)
        const page2 = document.getElementById('mentor-cert-page-2')
        if (page2) {
          pdf.addPage('a4', 'portrait')
          const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true })
          pdf.addImage(canvas2.toDataURL('image/png'), 'PNG', 0, 0, 595.28, 841.89)
        }

        const cleanName = mentor.name.replace(/\s+/g, '_')
        pdf.save(`Sertifikat_Mentor_${cleanName}.pdf`)
        toast.success('Sertifikat Mentor berhasil diunduh!', { id: toastId })
      }, 700)
    } catch (err: any) {
      console.error(err)
      toast.error('Gagal mencetak sertifikat: ' + err.message, { id: toastId })
    }
  }

  // FILTERED MENTORS (TAB MANAJEMEN)
  const filteredMentors = allMentors.filter(m => {
    const matchesSearch = (m.name || '').toLowerCase().includes(mentorSearch.toLowerCase()) ||
      (m.nip || '').toLowerCase().includes(mentorSearch.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(mentorSearch.toLowerCase()) ||
      (m.divisi || '').toLowerCase().includes(mentorSearch.toLowerCase())

    if (mentorStatusFilter === 'aktif') return matchesSearch && m.status !== 'selesai'
    if (mentorStatusFilter === 'selesai') return matchesSearch && m.status === 'selesai'
    return matchesSearch
  })

  // FILTERED MENTORS (TAB SERTIFIKAT)
  const filteredCertMentors = allMentors.filter(m => {
    const hasCert = mentorGrades.some(g => g.mentor_id === m.id && g.no_sertifikat)
    const matchesSearch = (m.name || '').toLowerCase().includes(certSearch.toLowerCase()) ||
      (m.nip || '').toLowerCase().includes(certSearch.toLowerCase()) ||
      (m.divisi || '').toLowerCase().includes(certSearch.toLowerCase())

    if (certStatusFilter === 'terbit') return matchesSearch && hasCert
    if (certStatusFilter === 'belum') return matchesSearch && !hasCert
    return matchesSearch
  })

  if (!user) return null

  return (
    <>
      <Toaster position="top-right" richColors />
      {loading && <LoadingMDU message="Memuat MDU Central Admin..." />}

      <div className="min-h-screen bg-[#f8faff] font-sans flex">
        {/* MOBILE DRAWER OVERLAY */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex flex-col w-64 bg-white h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200">
              <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-[#1e1b4b]">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-white tracking-tight">MDU Central</span>
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

              {/* Menu Items Mobile */}
              <div className="px-4 flex-1 mt-4 space-y-1.5 overflow-y-auto">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Monitoring</p>
                <button
                  onClick={() => { setActiveTab('absensi'); setMobileMenuOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    activeTab === 'absensi'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>Live Absensi</span>
                </button>
                <button
                  onClick={() => { setActiveTab('performa'); setMobileMenuOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    activeTab === 'performa'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                  <span>Performa Kinerja</span>
                </button>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4 mb-2 px-2">Kelola Mentor</p>
                <button
                  onClick={() => { setActiveTab('mentors'); setMobileMenuOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    activeTab === 'mentors'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <span>Manajemen Mentor</span>
                </button>
                <button
                  onClick={() => { setActiveTab('sertifikat'); setMobileMenuOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    activeTab === 'sertifikat'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                  <span>Penilaian & Sertifikat</span>
                </button>
              </div>

              {/* Profile & Logout Mobile */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3 px-2 mb-3">
                  <div className="w-9 h-9 rounded-full bg-[#1e1b4b] flex items-center justify-center text-xs font-bold text-white shadow-md">
                    HQ
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-800 truncate">{profile?.name}</p>
                    <p className="text-[10px] text-blue-600 font-semibold">Administrator</p>
                  </div>
                </div>
                <button
                  onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Keluar Sesi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SIDEBAR ADMIN (DESKTOP) */}
        <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm overflow-hidden">
          <div className="p-6 flex items-center gap-3 border-b border-slate-100">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Admin" className="w-10 h-10 rounded-xl bg-blue-50 shadow-sm border border-blue-100 object-cover" />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30">
                HQ
              </div>
            )}
            <div>
              <span className="text-lg font-black text-slate-800 tracking-tight block leading-tight">MDU Central</span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600">Admin Utama</span>
            </div>
          </div>

          <div className="px-4 flex-1 mt-4 space-y-1.5 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Monitoring</p>
            <button
              onClick={() => setActiveTab('absensi')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-left font-bold text-sm ${
                activeTab === 'absensi'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>Live Absensi</span>
            </button>
            <button
              onClick={() => setActiveTab('performa')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-left font-bold text-sm ${
                activeTab === 'performa'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
              <span>Performa Kinerja</span>
            </button>

            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 px-2">Kelola Mentor</p>
            <button
              onClick={() => setActiveTab('mentors')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-left font-bold text-sm ${
                activeTab === 'mentors'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <span>Manajemen Mentor</span>
            </button>
            <button
              onClick={() => setActiveTab('sertifikat')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-left font-bold text-sm ${
                activeTab === 'sertifikat'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
              <span>Penilaian & Sertifikat</span>
            </button>
          </div>

          <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => router.push('/settings')}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all mb-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Pengaturan HQ
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Keluar Sesi
            </button>
          </div>
        </aside>

        {/* KONTEN UTAMA */}
        <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
          {/* HEADER HERO */}
          <div className="bg-[#1e1b4b] pt-8 pb-16 px-6 rounded-b-[36px] md:mx-6 md:mt-6 md:rounded-3xl shadow-xl relative overflow-hidden shrink-0">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>
            <div className="absolute left-1/4 bottom-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    {activeTab === 'absensi' && `Dashboard Eksekutif, ${profile?.name || 'Admin'}!`}
                    {activeTab === 'performa' && 'Monitoring Performa Kinerja Cabang'}
                    {activeTab === 'mentors' && 'Pusat Manajemen Akun Mentor'}
                    {activeTab === 'sertifikat' && 'Pusat Penilaian & Sertifikat Mentor'}
                  </h1>
                  <p className="text-blue-100 text-xs md:text-sm font-medium mt-0.5">
                    {activeTab === 'absensi' && 'Rekapitulasi kehadiran seluruh kantor cabang hari ini.'}
                    {activeTab === 'performa' && 'Tinjauan performa aktivitas bimbingan dan operasional.'}
                    {activeTab === 'mentors' && 'Buat akun mentor baru, atur profil, dan pantau anak bimbingan.'}
                    {activeTab === 'sertifikat' && 'Evaluasi 5 pilar bimbingan mentor dan terbitkan sertifikat resmi.'}
                  </p>
                </div>
              </div>

              {activeTab === 'mentors' && (
                <button
                  onClick={() => setShowAddMentorModal(true)}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  Tambah Akun Mentor
                </button>
              )}
            </div>
          </div>

          {/* ISI KONTEN TAB */}
          <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-10 relative z-10 space-y-6">

            {/* TAB 1: LIVE ABSENSI */}
            {activeTab === 'absensi' && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 mb-1">Total OJT Aktif</p>
                    <p className="text-3xl font-black text-slate-800">{allOjt.length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 mb-1">Total Mentor</p>
                    <p className="text-3xl font-black text-blue-600">{allMentors.length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 mb-1">Hadir Hari Ini</p>
                    <p className="text-3xl font-black text-emerald-600">{attendances.length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 mb-1">Total Terlambat</p>
                    <p className="text-3xl font-black text-rose-500">
                      {attendances.filter(a => a.status === 'Terlambat').length}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Log Kehadiran Global</h2>
                      <p className="text-xs text-slate-400">
                        {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    {attendances.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-xs font-bold text-slate-400">Belum ada data absensi untuk tanggal ini.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-100">
                            <th className="p-3.5 pl-5">Nama Lengkap</th>
                            <th className="p-3.5">Cabang</th>
                            <th className="p-3.5">Divisi</th>
                            <th className="p-3.5">Hari & Tanggal</th>
                            <th className="p-3.5">In</th>
                            <th className="p-3.5">Out</th>
                            <th className="p-3.5 text-right pr-5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {attendances.map((absen) => (
                            <tr key={absen.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3.5 pl-5 font-bold text-slate-800">{absen.users?.name || 'Tanpa Nama'}</td>
                              <td className="p-3.5 font-medium text-slate-600">{absen.users?.asal_kantor || '-'}</td>
                              <td className="p-3.5 font-medium text-slate-500">{absen.users?.divisi || '-'}</td>
                              <td className="p-3.5 font-bold text-indigo-900">{new Date(absen.check_in_time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                              <td className="p-3.5 font-bold text-slate-800">{formatTime(absen.check_in_time)}</td>
                              <td className="p-3.5 font-bold text-emerald-600">{absen.check_out_time ? formatTime(absen.check_out_time) : '-'}</td>
                              <td className="p-3.5 pr-5 text-right">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
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
              </>
            )}

            {/* TAB 2: PERFORMA KINERJA */}
            {activeTab === 'performa' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <span className="text-2xl">🏢</span>
                    <h3 className="text-sm font-bold text-slate-800 mt-2">Cabang Jatiwaringin</h3>
                    <p className="text-xs text-slate-400 mt-1">Kantor Operasional & Studio Produksi</p>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Mentor: {allMentors.filter(m => m.asal_kantor?.includes('Jatiwaringin')).length}</span>
                      <span className="text-blue-600">OJT: {allOjt.filter(o => o.asal_kantor?.includes('Jatiwaringin')).length}</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <span className="text-2xl">🏛️</span>
                    <h3 className="text-sm font-bold text-slate-800 mt-2">Cabang BSD</h3>
                    <p className="text-xs text-slate-400 mt-1">Sentra Teknologi & Desain</p>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Mentor: {allMentors.filter(m => m.asal_kantor?.includes('BSD')).length}</span>
                      <span className="text-blue-600">OJT: {allOjt.filter(o => o.asal_kantor?.includes('BSD')).length}</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <span className="text-2xl">🎓</span>
                    <h3 className="text-sm font-bold text-slate-800 mt-2">Kelulusan & Sertifikasi</h3>
                    <p className="text-xs text-slate-400 mt-1">Sertifikat Resmi Diterbitkan</p>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-xs font-bold">
                      <span className="text-amber-600">Sertif Mentor: {mentorGrades.filter(g => g.no_sertifikat).length}</span>
                      <span className="text-emerald-600">Mentor Selesai: {allMentors.filter(m => m.status === 'selesai').length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MANAJEMEN MENTOR */}
            {activeTab === 'mentors' && (
              <div className="space-y-5">
                {/* BARIS KONTROL ATAS: SEARCH, FILTER, TOMBOL TAMBAH MOBILE */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-1 items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                      <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Cari mentor (nama, NIP, email, divisi)..."
                        value={mentorSearch}
                        onChange={(e) => setMentorSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={mentorStatusFilter}
                      onChange={(e: any) => setMentorStatusFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Status</option>
                      <option value="aktif">Mentor Aktif</option>
                      <option value="selesai">Selesai Bimbingan</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setShowAddMentorModal(true)}
                    className="md:hidden flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Tambah Akun Mentor
                  </button>
                </div>

                {/* TABEL DAFTAR MENTOR */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    {filteredMentors.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-xs font-bold text-slate-400">Tidak ada mentor yang cocok dengan kriteria pencarian.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-100">
                            <th className="p-3.5 pl-5">Profil Mentor</th>
                            <th className="p-3.5">Kontak & NIP</th>
                            <th className="p-3.5">Divisi & Cabang</th>
                            <th className="p-3.5">Anak OJT Aktif</th>
                            <th className="p-3.5">Status</th>
                            <th className="p-3.5 text-right pr-5">Aksi Manajemen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredMentors.map((mentor) => {
                            const activeCount = getActiveMenteeCount(mentor.id)
                            const grade = mentorGrades.find(g => g.mentor_id === mentor.id)
                            const isCompleted = mentor.status === 'selesai'

                            return (
                              <tr key={mentor.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3.5 pl-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-xs">
                                      {mentor.name?.charAt(0)?.toUpperCase() || 'M'}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-800">{mentor.name}</p>
                                      <p className="text-[10px] text-slate-400">ID: {mentor.id.slice(0, 8)}...</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3.5">
                                  <p className="font-semibold text-slate-700">{mentor.email || '-'}</p>
                                  <p className="text-[10px] text-blue-600 font-mono">NIP: {mentor.nip || 'Belum diisi'}</p>
                                </td>
                                <td className="p-3.5">
                                  <p className="font-bold text-slate-800">{mentor.divisi || '-'}</p>
                                  <p className="text-[10px] text-slate-500">{mentor.asal_kantor || '-'}</p>
                                </td>
                                <td className="p-3.5">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${
                                    activeCount > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {activeCount} Anak OJT
                                  </span>
                                </td>
                                <td className="p-3.5">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                    isCompleted ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    {isCompleted ? 'Selesai' : 'Aktif'}
                                  </span>
                                </td>
                                <td className="p-3.5 pr-5 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    {/* Edit Profil */}
                                    <button
                                      onClick={() => {
                                        setEditingMentor({ ...mentor })
                                        setShowEditMentorModal(true)
                                      }}
                                      title="Edit Profil Mentor"
                                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>

                                    {/* Reset Password */}
                                    <button
                                      onClick={() => {
                                        setSelectedResetMentor(mentor)
                                        setNewPassword('')
                                        setShowResetModal(true)
                                      }}
                                      title="Reset Password Mentor"
                                      className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                    </button>

                                    {/* Arsipkan Status */}
                                    {!isCompleted && (
                                      <button
                                        onClick={() => handleArchiveMentor(mentor)}
                                        title="Tandai Selesai Bimbingan"
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                      </button>
                                    )}

                                    {/* Hapus Mentor */}
                                    <button
                                      onClick={() => handleDeleteMentor(mentor)}
                                      title="Hapus Akun Mentor"
                                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
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
            )}

            {/* TAB 4: PENILAIAN & SERTIFIKAT MENTOR */}
            {activeTab === 'sertifikat' && (
              <div className="space-y-5">
                {/* FILTER SEARCH */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-1 items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                      <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Cari mentor untuk dinilai..."
                        value={certSearch}
                        onChange={(e) => setCertSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={certStatusFilter}
                      onChange={(e: any) => setCertStatusFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Status Sertifikat</option>
                      <option value="terbit">Sertifikat Terbit</option>
                      <option value="belum">Belum Dinilai</option>
                    </select>
                  </div>
                </div>

                {/* TABEL SERTIFIKAT */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    {filteredCertMentors.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-xs font-bold text-slate-400">Tidak ada mentor yang sesuai dengan filter sertifikat.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-100">
                            <th className="p-3.5 pl-5">Mentor Pembimbing</th>
                            <th className="p-3.5">Divisi & Cabang</th>
                            <th className="p-3.5">Nomor Sertifikat</th>
                            <th className="p-3.5">Nilai Rata-Rata</th>
                            <th className="p-3.5">Predikat</th>
                            <th className="p-3.5 text-right pr-5">Tindakan Sertifikat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredCertMentors.map((mentor) => {
                            const grade = mentorGrades.find(g => g.mentor_id === mentor.id)
                            const hasCert = Boolean(grade && grade.no_sertifikat)
                            const avgScore = grade ? Math.round(
                              (Number(grade.nilai_kepemimpinan || 0) +
                                Number(grade.nilai_kedisiplinan || 0) +
                                Number(grade.nilai_komunikasi || 0) +
                                Number(grade.nilai_teknis || 0) +
                                Number(grade.nilai_efektivitas || 0)) / 5
                            ) : null

                            return (
                              <tr key={mentor.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3.5 pl-5">
                                  <p className="font-bold text-slate-800">{mentor.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">NIP: {mentor.nip || '-'}</p>
                                </td>
                                <td className="p-3.5">
                                  <p className="font-semibold text-slate-700">{mentor.divisi || '-'}</p>
                                  <p className="text-[10px] text-slate-400">{mentor.asal_kantor || '-'}</p>
                                </td>
                                <td className="p-3.5">
                                  {hasCert ? (
                                    <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                                      {grade.no_sertifikat}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Belum Diterbitkan</span>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  {avgScore !== null ? (
                                    <span className="font-black text-slate-800 text-sm">{avgScore} / 100</span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  {hasCert ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700">
                                      🏆 {grade.predikat || 'Memuaskan'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                                      ⏳ Belum Dinilai
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5 pr-5 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    {/* Tombol Input / Edit Evaluasi */}
                                    <button
                                      onClick={() => openEvaluationModal(mentor)}
                                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                      <span>{hasCert ? 'Ubah Nilai' : 'Beri Nilai'}</span>
                                    </button>

                                    {/* Tombol Cetak PDF */}
                                    {hasCert && (
                                      <button
                                        onClick={() => handleDownloadCertificate(mentor)}
                                        className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        <span>Cetak PDF</span>
                                      </button>
                                    )}

                                    {/* Tombol Batalkan Sertifikat */}
                                    {hasCert && (
                                      <button
                                        onClick={() => handleDeleteEvaluation(mentor)}
                                        title="Batalkan Sertifikat"
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    )}
                                  </div>
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
            )}

          </div>
        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: TAMBAH MENTOR BARU */}
      {/* ======================================================== */}
      {showAddMentorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-800">Daftarkan Mentor Baru</h3>
                <p className="text-xs text-slate-400">Buat akun mentor baru dengan hak kelola bimbingan OJT.</p>
              </div>
              <button
                onClick={() => setShowAddMentorModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMentor} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Mentor *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso, S.Kom"
                  value={newMentorForm.name}
                  onChange={(e) => setNewMentorForm({ ...newMentorForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Mentor *</label>
                  <input
                    type="email"
                    required
                    placeholder="mentor@mdu.com"
                    value={newMentorForm.email}
                    onChange={(e) => setNewMentorForm({ ...newMentorForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NIP Mentor (Opsional)</label>
                  <input
                    type="text"
                    placeholder="MTR2026001"
                    value={newMentorForm.nip}
                    onChange={(e) => setNewMentorForm({ ...newMentorForm, nip: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Divisi Penugasan</label>
                  <select
                    value={DIVISION_OPTIONS.includes(newMentorForm.divisi) ? newMentorForm.divisi : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setNewMentorForm({ ...newMentorForm, divisi: '' })
                      } else {
                        setNewMentorForm({ ...newMentorForm, divisi: e.target.value })
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DIVISION_OPTIONS.map((div) => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                    <option value="__custom__">➕ Lainnya (Ketik Manual)</option>
                  </select>
                  {(!DIVISION_OPTIONS.includes(newMentorForm.divisi) || newMentorForm.divisi === '') && (
                    <input
                      type="text"
                      placeholder="Ketik nama divisi baru..."
                      value={newMentorForm.divisi}
                      onChange={(e) => setNewMentorForm({ ...newMentorForm, divisi: e.target.value })}
                      className="mt-2 w-full px-3.5 py-2 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cabang Kantor</label>
                  <select
                    value={OFFICE_OPTIONS.includes(newMentorForm.asal_kantor) ? newMentorForm.asal_kantor : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setNewMentorForm({ ...newMentorForm, asal_kantor: '' })
                      } else {
                        setNewMentorForm({ ...newMentorForm, asal_kantor: e.target.value })
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {OFFICE_OPTIONS.map((off) => (
                      <option key={off} value={off}>{off}</option>
                    ))}
                    <option value="__custom__">➕ Lainnya (Ketik Manual)</option>
                  </select>
                  {(!OFFICE_OPTIONS.includes(newMentorForm.asal_kantor) || newMentorForm.asal_kantor === '') && (
                    <input
                      type="text"
                      placeholder="Ketik nama cabang kantor..."
                      value={newMentorForm.asal_kantor}
                      onChange={(e) => setNewMentorForm({ ...newMentorForm, asal_kantor: e.target.value })}
                      className="mt-2 w-full px-3.5 py-2 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password Awal (Default: mentormdu2026!)</label>
                <input
                  type="text"
                  placeholder="mentormdu2026!"
                  value={newMentorForm.password}
                  onChange={(e) => setNewMentorForm({ ...newMentorForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mulai Bimbingan</label>
                  <input
                    type="date"
                    value={newMentorForm.start_period}
                    onChange={(e) => setNewMentorForm({ ...newMentorForm, start_period: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selesai Bimbingan</label>
                  <input
                    type="date"
                    value={newMentorForm.end_period}
                    onChange={(e) => setNewMentorForm({ ...newMentorForm, end_period: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddMentorModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMentor}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  {isSubmittingMentor ? 'Mendaftarkan...' : 'Simpan Akun Mentor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT PROFIL MENTOR */}
      {/* ======================================================== */}
      {showEditMentorModal && editingMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-800">Edit Profil Mentor</h3>
                <p className="text-xs text-slate-400">Perbarui data profil dan cabang tugas mentor.</p>
              </div>
              <button
                onClick={() => setShowEditMentorModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateMentor} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editingMentor.name || ''}
                  onChange={(e) => setEditingMentor({ ...editingMentor, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editingMentor.email || ''}
                    onChange={(e) => setEditingMentor({ ...editingMentor, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NIP</label>
                  <input
                    type="text"
                    value={editingMentor.nip || ''}
                    onChange={(e) => setEditingMentor({ ...editingMentor, nip: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Divisi Penugasan</label>
                  <select
                    value={DIVISION_OPTIONS.includes(editingMentor.divisi) ? editingMentor.divisi : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setEditingMentor({ ...editingMentor, divisi: '' })
                      } else {
                        setEditingMentor({ ...editingMentor, divisi: e.target.value })
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DIVISION_OPTIONS.map((div) => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                    <option value="__custom__">➕ Lainnya (Ketik Manual)</option>
                  </select>
                  {(!DIVISION_OPTIONS.includes(editingMentor.divisi) || editingMentor.divisi === '') && (
                    <input
                      type="text"
                      placeholder="Ketik nama divisi..."
                      value={editingMentor.divisi || ''}
                      onChange={(e) => setEditingMentor({ ...editingMentor, divisi: e.target.value })}
                      className="mt-2 w-full px-3.5 py-2 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cabang Kantor</label>
                  <select
                    value={OFFICE_OPTIONS.includes(editingMentor.asal_kantor) ? editingMentor.asal_kantor : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setEditingMentor({ ...editingMentor, asal_kantor: '' })
                      } else {
                        setEditingMentor({ ...editingMentor, asal_kantor: e.target.value })
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {OFFICE_OPTIONS.map((off) => (
                      <option key={off} value={off}>{off}</option>
                    ))}
                    <option value="__custom__">➕ Lainnya (Ketik Manual)</option>
                  </select>
                  {(!OFFICE_OPTIONS.includes(editingMentor.asal_kantor) || editingMentor.asal_kantor === '') && (
                    <input
                      type="text"
                      placeholder="Ketik nama cabang kantor..."
                      value={editingMentor.asal_kantor || ''}
                      onChange={(e) => setEditingMentor({ ...editingMentor, asal_kantor: e.target.value })}
                      className="mt-2 w-full px-3.5 py-2 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mulai Bimbingan</label>
                  <input
                    type="date"
                    value={editingMentor.start_period || ''}
                    onChange={(e) => setEditingMentor({ ...editingMentor, start_period: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selesai Bimbingan</label>
                  <input
                    type="date"
                    value={editingMentor.end_period || ''}
                    onChange={(e) => setEditingMentor({ ...editingMentor, end_period: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditMentorModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingMentor}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  {isUpdatingMentor ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: RESET PASSWORD MENTOR */}
      {/* ======================================================== */}
      {showResetModal && selectedResetMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-black text-slate-800">Reset Password Mentor</h3>
            <p className="text-xs text-slate-500 mt-1">
              Atur ulang password untuk akun <b>{selectedResetMentor.name}</b>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password Baru (min 6 karakter)</label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan password baru..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  {isResettingPassword ? 'Mereset...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: EVALUASI & SERTIFIKAT MENTOR */}
      {/* ======================================================== */}
      {showEvalModal && evaluatingMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-800">Evaluasi Kinerja & Sertifikat Mentor</h3>
                <p className="text-xs text-slate-500">
                  Penilaian 5 pilar bimbingan resmi untuk <b>{evaluatingMentor.name}</b>.
                </p>
              </div>
              <button
                onClick={() => setShowEvalModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvaluation} className="space-y-5 mt-4">
              {/* NOMOR SERTIFIKAT & PERIODE */}
              <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-3">
                <div>
                  <label className="block text-xs font-black text-blue-900 mb-1">Nomor Sertifikat Resmi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 001/MDU-MENTOR/XI/2026"
                    value={evalForm.no_sertifikat}
                    onChange={(e) => setEvalForm({ ...evalForm, no_sertifikat: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-blue-900 mb-1">Mulai Bimbingan</label>
                    <input
                      type="date"
                      value={evalForm.start_period}
                      onChange={(e) => setEvalForm({ ...evalForm, start_period: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-900 mb-1">Selesai Bimbingan</label>
                    <input
                      type="date"
                      value={evalForm.end_period}
                      onChange={(e) => setEvalForm({ ...evalForm, end_period: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 5 PILAR PENILAIAN */}
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">5 Pilar Evaluasi Kinerja (Skala 0 - 100)</p>

                {/* 1. Kepemimpinan & Pembimbingan */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">1. Kepemimpinan & Pembimbingan Mentee</p>
                    <p className="text-[10px] text-slate-400">Kemampuan mengarahkan dan memotivasi anak OJT</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={evalForm.nilai_kepemimpinan}
                    onChange={(e) => setEvalForm({ ...evalForm, nilai_kepemimpinan: Number(e.target.value) })}
                    className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-black text-sm text-slate-900"
                  />
                </div>

                {/* 2. Tanggung Jawab & Kedisiplinan */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">2. Tanggung Jawab & Kedisiplinan</p>
                    <p className="text-[10px] text-slate-400">Ketepatan kehadiran, monitoring tugas, dan integritas kerja</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={evalForm.nilai_kedisiplinan}
                    onChange={(e) => setEvalForm({ ...evalForm, nilai_kedisiplinan: Number(e.target.value) })}
                    className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-black text-sm text-slate-900"
                  />
                </div>

                {/* 3. Komunikasi & Kerjasama */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">3. Komunikasi & Kerjasama Tim</p>
                    <p className="text-[10px] text-slate-400">Kolaborasi antar divisi dan feedback konstruktif ke mentee</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={evalForm.nilai_komunikasi}
                    onChange={(e) => setEvalForm({ ...evalForm, nilai_komunikasi: Number(e.target.value) })}
                    className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-black text-sm text-slate-900"
                  />
                </div>

                {/* 4. Penguasaan Teknis & Manajerial */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">4. Penguasaan Teknis & Manajerial</p>
                    <p className="text-[10px] text-slate-400">Keahlian bidang kejuruan dan transfer ilmu yang efektif</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={evalForm.nilai_teknis}
                    onChange={(e) => setEvalForm({ ...evalForm, nilai_teknis: Number(e.target.value) })}
                    className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-black text-sm text-slate-900"
                  />
                </div>

                {/* 5. Efektivitas Pembinaan & Capaian Tim */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">5. Efektivitas Pembinaan & Capaian Tim</p>
                    <p className="text-[10px] text-slate-400">Tingkat keberhasilan penyelesaian proyek bimbingan OJT</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={evalForm.nilai_efektivitas}
                    onChange={(e) => setEvalForm({ ...evalForm, nilai_efektivitas: Number(e.target.value) })}
                    className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-black text-sm text-slate-900"
                  />
                </div>
              </div>

              {/* RINGKASAN NILAI & PREDIKAT */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-emerald-900">Nilai Rata-Rata Otomatis</p>
                  <p className="text-[10px] text-emerald-700">Dihitung otomatis dari akumulasi 5 pilar bimbingan</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-950">{calculateAverage(evalForm)}</span>
                  <span className="block text-[11px] font-black text-emerald-700 uppercase tracking-wide">
                    {getPredicateLabel(calculateAverage(evalForm))}
                  </span>
                </div>
              </div>

              {/* CATATAN APRESIASI */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Apresiasi & Rekomendasi Admin</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Berdedikasi tinggi dalam membimbing mentee multimedia hingga menyelesaikan seluruh proyek tepat waktu."
                  value={evalForm.catatan}
                  onChange={(e) => setEvalForm({ ...evalForm, catatan: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEvalModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEval}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  {isSubmittingEval ? 'Menyimpan...' : 'Simpan & Terbitkan Sertifikat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TEMPLATE RENDER DOM SERTIFIKAT MENTOR (RESOLUSI TINGGI)  */}
      {/* ======================================================== */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', zIndex: -100 }}>
        {certDataToPrint && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {/* HALAMAN 1: PIAGAM APRESIASI MENTOR PEMBIMBING */}
            <div
              id="mentor-cert-page-1"
              style={{
                width: '1123px',
                height: '794px',
                backgroundColor: '#ffffff',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'center',
                boxSizing: 'border-box',
                padding: '145px 80px 40px 80px',
                fontFamily: 'sans-serif',
                color: '#111827',
                textAlign: 'center'
              }}
            >
              {/* Background Blanco template */}
              <img
                src="/template-portrait-front.png"
                alt="Blanco Front"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  zIndex: 0
                }}
              />

              <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                {/* Nomor Sertifikat */}
                <div style={{ marginBottom: '6px' }}>
                  <p style={{ fontSize: '1.35rem', fontFamily: 'sans-serif', margin: 0, color: '#111827', fontWeight: 700, textDecoration: 'underline' }}>
                    No : {certDataToPrint.grades?.no_sertifikat || '001/MDU-MENTOR/XI/2026'}
                  </p>
                </div>

                {/* Diberikan kepada */}
                <div style={{ marginBottom: '6px' }}>
                  <p style={{ fontSize: '1.2rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#374151', margin: 0 }}>
                    Diberikan kepada:
                  </p>
                </div>

                {/* Nama Mentor */}
                <div style={{ marginBottom: '10px' }}>
                  <h2 style={{ fontSize: '2.8rem', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#0F3357', margin: 0, fontWeight: 700, letterSpacing: '0.02em' }}>
                    {certDataToPrint.mentor?.name || 'Nama Mentor'}
                  </h2>
                </div>

                {/* sebagai */}
                <div style={{ marginBottom: '4px' }}>
                  <p style={{ fontSize: '1.15rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#374151', margin: 0 }}>
                    sebagai
                  </p>
                </div>

                {/* Peran: Mentor Pembimbing */}
                <div style={{ marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '1.65rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", fontWeight: 800, color: '#0F3357', margin: 0, letterSpacing: '0.03em' }}>
                    Mentor Pembimbing Praktik Kerja Lapangan
                  </h3>
                </div>

                {/* Pada Divisi */}
                <div style={{ marginBottom: '4px' }}>
                  <p style={{ fontSize: '1.15rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#374151', margin: 0 }}>
                    Pada Divisi
                  </p>
                </div>

                {/* Nama Divisi */}
                <div style={{ marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '1.65rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", fontWeight: 900, color: '#0F3357', margin: 0, letterSpacing: '0.03em' }}>
                    {certDataToPrint.mentor?.divisi || 'Multimedia'}
                  </h3>
                </div>

                {/* Keterangan Pengabdian */}
                <div style={{ marginBottom: '6px' }}>
                  <p style={{ fontSize: '1.15rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#111827', margin: 0 }}>
                    Telah mendedikasikan keahlian dan membimbing peserta magang pada Mandiri Digital Universe
                  </p>
                </div>

                {/* Periode Bimbingan */}
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '1.1rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#111827', margin: 0 }}>
                    Terhitung mulai tanggal {certDataToPrint.grades?.start_period || certDataToPrint.mentor?.start_period || '-'} sampai dengan {certDataToPrint.grades?.end_period || certDataToPrint.mentor?.end_period || '-'}
                  </p>
                </div>

                {/* Predikat Kelulusan Apresiasi */}
                <div style={{ marginBottom: '10px' }}>
                  <p style={{ fontSize: '1.25rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#0F3357', fontWeight: 800, margin: 0 }}>
                    Dengan Predikat: <span style={{ textDecoration: 'underline' }}>{certDataToPrint.grades?.predikat || 'Sangat Memuaskan'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* HALAMAN 2: TRANSKRIP EVALUASI KINERJA PEMBIMBINGAN */}
            <div
              id="mentor-cert-page-2"
              style={{
                width: '794px',
                height: '1123px',
                backgroundColor: '#ffffff',
                position: 'relative',
                boxSizing: 'border-box',
                padding: '60px 50px',
                fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif",
                color: '#111827'
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F3357', margin: 0 }}>
                  LEMBAR EVALUASI KINERJA MENTOR PEMBIMBING
                </h2>
                <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: '4px 0 0 0' }}>
                  PT MANDIRI DIGITAL UNIVERSE (MDU)
                </p>
              </div>

              {/* Identitas Mentor */}
              <div style={{ marginBottom: '20px', fontSize: '0.85rem', lineHeight: '1.6' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '160px', fontWeight: 700 }}>Nama Mentor</td>
                      <td style={{ width: '10px' }}>:</td>
                      <td style={{ fontWeight: 800, color: '#0F3357' }}>{certDataToPrint.mentor?.name}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>NIP / ID</td>
                      <td>:</td>
                      <td>{certDataToPrint.mentor?.nip || certDataToPrint.mentor?.id?.slice(0, 8)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Divisi & Penempatan</td>
                      <td>:</td>
                      <td>{certDataToPrint.mentor?.divisi} - {certDataToPrint.mentor?.asal_kantor}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>No. Sertifikat</td>
                      <td>:</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{certDataToPrint.grades?.no_sertifikat}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tabel Nilai 5 Pilar */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0F3357', color: '#ffffff', textAlign: 'center' }}>
                    <th style={{ padding: '10px', border: '1px solid #0F3357', width: '40px' }}>NO</th>
                    <th style={{ padding: '10px', border: '1px solid #0F3357', textAlign: 'left' }}>ASPEK KOMPETENSI PEMBIMBINGAN</th>
                    <th style={{ padding: '10px', border: '1px solid #0F3357', width: '100px' }}>NILAI (0-100)</th>
                    <th style={{ padding: '10px', border: '1px solid #0F3357', width: '120px' }}>KUALIFIKASI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>1</td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>
                      <b>Kepemimpinan & Pembimbingan Mentee</b><br/>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Kemampuan mengarahkan, membina, dan memotivasi peserta OJT</span>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center', fontWeight: 700 }}>
                      {certDataToPrint.grades?.nilai_kepemimpinan || 90}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                      {getPredicateLabel(Number(certDataToPrint.grades?.nilai_kepemimpinan || 90))}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>2</td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>
                      <b>Tanggung Jawab & Kedisiplinan</b><br/>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Konsistensi kehadiran bimbingan, review tugas, dan dedikasi</span>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center', fontWeight: 700 }}>
                      {certDataToPrint.grades?.nilai_kedisiplinan || 90}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                      {getPredicateLabel(Number(certDataToPrint.grades?.nilai_kedisiplinan || 90))}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>3</td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>
                      <b>Komunikasi & Kerjasama Tim</b><br/>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Koordinasi antar divisi, bimbingan berkala, dan evaluasi berkala</span>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center', fontWeight: 700 }}>
                      {certDataToPrint.grades?.nilai_komunikasi || 90}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                      {getPredicateLabel(Number(certDataToPrint.grades?.nilai_komunikasi || 90))}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>4</td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>
                      <b>Penguasaan Teknis & Manajerial</b><br/>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Penguasaan kurikulum industri, standar SOP, dan transfer ilmu</span>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center', fontWeight: 700 }}>
                      {certDataToPrint.grades?.nilai_teknis || 90}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                      {getPredicateLabel(Number(certDataToPrint.grades?.nilai_teknis || 90))}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>5</td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>
                      <b>Efektivitas Pembinaan & Capaian Tim</b><br/>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Kualitas karya peserta dan pencapaian target penugasan magang</span>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center', fontWeight: 700 }}>
                      {certDataToPrint.grades?.nilai_efektivitas || 90}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                      {getPredicateLabel(Number(certDataToPrint.grades?.nilai_efektivitas || 90))}
                    </td>
                  </tr>
                  {/* Rata-rata */}
                  <tr style={{ backgroundColor: '#F9FAFB', fontWeight: 800 }}>
                    <td colSpan={2} style={{ padding: '10px', border: '1px solid #D1D5DB', textAlign: 'right' }}>
                      NILAI RATA-RATA TOTAL
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #D1D5DB', textAlign: 'center', fontSize: '1rem', color: '#0F3357' }}>
                      {Math.round(
                        (Number(certDataToPrint.grades?.nilai_kepemimpinan || 0) +
                          Number(certDataToPrint.grades?.nilai_kedisiplinan || 0) +
                          Number(certDataToPrint.grades?.nilai_komunikasi || 0) +
                          Number(certDataToPrint.grades?.nilai_teknis || 0) +
                          Number(certDataToPrint.grades?.nilai_efektivitas || 0)) / 5
                      )}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #D1D5DB', textAlign: 'center', color: '#0F3357' }}>
                      {certDataToPrint.grades?.predikat || 'Sangat Memuaskan'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Catatan Apresiasi */}
              {certDataToPrint.grades?.catatan && (
                <div style={{ padding: '12px 16px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '30px', fontSize: '0.8rem', borderLeft: '4px solid #0F3357' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#374151' }}>Catatan Apresiasi Manajemen MDU:</p>
                  <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', color: '#4B5563' }}>"{certDataToPrint.grades.catatan}"</p>
                </div>
              )}

              {/* Bagian Tanda Tangan */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px' }}>
                <div style={{ textAlign: 'center', width: '240px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 700, fontSize: '0.85rem' }}>Manajemen Pusat MDU</p>
                  <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/stamp-signature-cmo.png" alt="Stempel MDU" style={{ height: '70px', objectFit: 'contain' }} />
                  </div>
                  <p style={{ margin: 0, fontWeight: 800, textDecoration: 'underline', fontSize: '0.9rem' }}>Chief Management Officer</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280' }}>PT Mandiri Digital Universe</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
