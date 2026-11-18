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

const ROLE_OPTIONS = [
  'Mentor',
  'Mentor Pembimbing',
  'Marketing Komunikasi',
  'Sosial Media Spesialis',
  'Content Creator',
  'Staff Human Capital',
  'DICO'
]

const OJT_EVALUATION_CRITERIA = [
  { key: 'q1', field: 'q1_waktu', label: 'Disiplin Waktu & Kehadiran', desc: 'Ketepatan waktu dan komitmen kehadiran' },
  { key: 'q2', field: 'q2_sikap', label: 'Etika & Sikap Perilaku', desc: 'Sopan santun, integritas, dan etika profesional' },
  { key: 'q3', field: 'q3_tanggung_jawab', label: 'Tanggung Jawab Penugasan', desc: 'Penyelesaian amanah dan bimbingan' },
  { key: 'q4', field: 'q4_kehadiran', label: 'Konsistensi Presensi', desc: 'Keaktifan presensi dan kehadiran berkala' },
  { key: 'q5', field: 'q5_kemampuan', label: 'Kemampuan Kerja & Problem Solving', desc: 'Daya analisis dan pemecahan kendala kerja' },
  { key: 'q6', field: 'q6_keterampilan', label: 'Keterampilan Teknis & Kreativitas', desc: 'Penguasaan keahlian bidang dan inovasi ide' },
  { key: 'q7', field: 'q7_kualitas', label: 'Kualitas Hasil Pekerjaan', desc: 'Output bimbingan dan standar mutu hasil kerja' },
  { key: 'q8', field: 'q8_komunikasi', label: 'Komunikasi & Koordinasi', desc: 'Penyampaian informasi dan koordinasi tim' },
  { key: 'q9', field: 'q9_kerjasama', label: 'Kerjasama Tim', desc: 'Kolaborasi antar divisi dan suportivitas' },
  { key: 'q10', field: 'q10_inisiatif', label: 'Inisiatif & Keaktifan', desc: 'Proaktif dalam pengembangan dan mentoring' },
  { key: 'q11', field: 'q11_percaya_diri', label: 'Percaya Diri & Kemandirian', desc: 'Kemandirian eksekusi dan kepercayaan diri' },
  { key: 'q12', field: 'q12_patuh_aturan', label: 'Kepatuhan Tata Tertib MDU', desc: 'Ketaatan pada SOP, regulasi, dan tata tertib' },
  { key: 'q13', field: 'q13_penampilan', label: 'Kerapian & Penampilan', desc: 'Kerapian berpakaian dan standar performa' }
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

  // STATE MODAL EVALUASI & SERTIFIKAT MENTOR (PERSIS DENGAN FORMAT OJT)
  const [showEvalModal, setShowEvalModal] = useState(false)
  const [evaluatingMentor, setEvaluatingMentor] = useState<any>(null)
  const [isSubmittingEval, setIsSubmittingEval] = useState(false)
  const [evalForm, setEvalForm] = useState({
    no_sertifikat: '',
    start_period: '',
    end_period: '',
    sebagai: 'Mentor',
    q1: 90,
    q2: 90,
    q3: 90,
    q4: 90,
    q5: 90,
    q6: 90,
    q7: 90,
    q8: 90,
    q9: 90,
    q10: 90,
    q11: 90,
    q12: 90,
    q13: 90,
    catatan: ''
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

      const mentors = (usersData || []).filter(u => u.role === 'mentor')
      if (usersData) {
        setAllOjt(usersData.filter(u => u.role === 'ojt'))
        setAllMentors(mentors)
      }

      // 3. Tarik data nilai mentor dari ojt_grades dan mentor_grades
      const mentorIds = mentors.map(m => m.id)
      const { data: ojtGradesData } = mentorIds.length > 0
        ? await supabase.from('ojt_grades').select('*').in('user_id', mentorIds)
        : { data: [] }
      const { data: gradesData } = await supabase
        .from('mentor_grades')
        .select('*')

      const combinedMap = new Map<string, any>()
      ;(gradesData || []).forEach(mg => {
        combinedMap.set(mg.mentor_id, {
          ...mg,
          q1_waktu: mg.nilai_kedisiplinan ?? 90,
          q2_sikap: mg.nilai_kepemimpinan ?? 90,
          q3_tanggung_jawab: mg.nilai_kedisiplinan ?? 90,
          q4_kehadiran: mg.nilai_kedisiplinan ?? 90,
          q5_kemampuan: mg.nilai_teknis ?? 90,
          q6_keterampilan: mg.nilai_teknis ?? 90,
          q7_kualitas: mg.nilai_efektivitas ?? 90,
          q8_komunikasi: mg.nilai_komunikasi ?? 90,
          q9_kerjasama: mg.nilai_komunikasi ?? 90,
          q10_inisiatif: mg.nilai_kepemimpinan ?? 90,
          q11_percaya_diri: mg.nilai_kepemimpinan ?? 90,
          q12_patuh_aturan: mg.nilai_kedisiplinan ?? 90,
          q13_penampilan: mg.nilai_kedisiplinan ?? 90,
          sebagai: mg.sebagai || 'Mentor'
        })
      })

      ;(ojtGradesData || []).forEach(og => {
        const existing = combinedMap.get(og.user_id) || {}
        combinedMap.set(og.user_id, {
          ...existing,
          ...og,
          mentor_id: og.user_id,
          no_sertifikat: og.no_sertifikat || existing.no_sertifikat || '',
          q1_waktu: og.q1_waktu ?? existing.q1_waktu ?? 90,
          q2_sikap: og.q2_sikap ?? existing.q2_sikap ?? 90,
          q3_tanggung_jawab: og.q3_tanggung_jawab ?? existing.q3_tanggung_jawab ?? 90,
          q4_kehadiran: og.q4_kehadiran ?? existing.q4_kehadiran ?? 90,
          q5_kemampuan: og.q5_kemampuan ?? existing.q5_kemampuan ?? 90,
          q6_keterampilan: og.q6_keterampilan ?? existing.q6_keterampilan ?? 90,
          q7_kualitas: og.q7_kualitas ?? existing.q7_kualitas ?? 90,
          q8_komunikasi: og.q8_komunikasi ?? existing.q8_komunikasi ?? 90,
          q9_kerjasama: og.q9_kerjasama ?? existing.q9_kerjasama ?? 90,
          q10_inisiatif: og.q10_inisiatif ?? existing.q10_inisiatif ?? 90,
          q11_percaya_diri: og.q11_percaya_diri ?? existing.q11_percaya_diri ?? 90,
          q12_patuh_aturan: og.q12_patuh_aturan ?? existing.q12_patuh_aturan ?? 90,
          q13_penampilan: og.q13_penampilan ?? existing.q13_penampilan ?? 90,
          sebagai: og.sebagai || existing.sebagai || 'Mentor'
        })
      })

      setMentorGrades(Array.from(combinedMap.values()))
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

  // HITUNG RATA-RATA & PREDIKAT 13 KRITERIA IDENTIK OJT
  const calculateAverage13 = (g: any) => {
    if (!g) return '0.0'
    const q1 = Number(g.q1 ?? g.q1_waktu ?? 0)
    const q2 = Number(g.q2 ?? g.q2_sikap ?? 0)
    const q3 = Number(g.q3 ?? g.q3_tanggung_jawab ?? 0)
    const q4 = Number(g.q4 ?? g.q4_kehadiran ?? 0)
    const q5 = Number(g.q5 ?? g.q5_kemampuan ?? 0)
    const q6 = Number(g.q6 ?? g.q6_keterampilan ?? 0)
    const q7 = Number(g.q7 ?? g.q7_kualitas ?? 0)
    const q8 = Number(g.q8 ?? g.q8_komunikasi ?? 0)
    const q9 = Number(g.q9 ?? g.q9_kerjasama ?? 0)
    const q10 = Number(g.q10 ?? g.q10_inisiatif ?? 0)
    const q11 = Number(g.q11 ?? g.q11_percaya_diri ?? 0)
    const q12 = Number(g.q12 ?? g.q12_patuh_aturan ?? 0)
    const q13 = Number(g.q13 ?? g.q13_penampilan ?? 0)
    const total = q1 + q2 + q3 + q4 + q5 + q6 + q7 + q8 + q9 + q10 + q11 + q12 + q13
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

  const setQuickGrades = (score: number) => {
    setEvalForm(prev => ({
      ...prev,
      q1: score, q2: score, q3: score, q4: score,
      q5: score, q6: score, q7: score, q8: score,
      q9: score, q10: score, q11: score, q12: score, q13: score
    }))
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

  // BUKA MODAL EVALUASI MENTOR (13 ASPEK PERSIS OJT)
  const openEvaluationModal = (mentor: any) => {
    setEvaluatingMentor(mentor)
    const existingGrade = mentorGrades.find(g => g.mentor_id === mentor.id || g.user_id === mentor.id)

    // Cari nomor sertifikat otomatis jika belum ada
    const currentYear = new Date().getFullYear()
    const autoNo = existingGrade?.no_sertifikat || `${mentorGrades.length + 1}/MDU-MENTOR/XI/${currentYear}`

    setEvalForm({
      no_sertifikat: autoNo,
      start_period: existingGrade?.start_period || mentor.start_period || '',
      end_period: existingGrade?.end_period || mentor.end_period || '',
      sebagai: existingGrade?.sebagai || mentor.status || 'Mentor',
      q1: Number(existingGrade?.q1_waktu ?? existingGrade?.nilai_kedisiplinan ?? 90),
      q2: Number(existingGrade?.q2_sikap ?? existingGrade?.nilai_kepemimpinan ?? 90),
      q3: Number(existingGrade?.q3_tanggung_jawab ?? existingGrade?.nilai_kedisiplinan ?? 90),
      q4: Number(existingGrade?.q4_kehadiran ?? existingGrade?.nilai_kedisiplinan ?? 90),
      q5: Number(existingGrade?.q5_kemampuan ?? existingGrade?.nilai_teknis ?? 90),
      q6: Number(existingGrade?.q6_keterampilan ?? existingGrade?.nilai_teknis ?? 90),
      q7: Number(existingGrade?.q7_kualitas ?? existingGrade?.nilai_efektivitas ?? 90),
      q8: Number(existingGrade?.q8_komunikasi ?? existingGrade?.nilai_komunikasi ?? 90),
      q9: Number(existingGrade?.q9_kerjasama ?? existingGrade?.nilai_komunikasi ?? 90),
      q10: Number(existingGrade?.q10_inisiatif ?? existingGrade?.nilai_kepemimpinan ?? 90),
      q11: Number(existingGrade?.q11_percaya_diri ?? existingGrade?.nilai_kepemimpinan ?? 90),
      q12: Number(existingGrade?.q12_patuh_aturan ?? existingGrade?.nilai_kedisiplinan ?? 90),
      q13: Number(existingGrade?.q13_penampilan ?? existingGrade?.nilai_kedisiplinan ?? 90),
      catatan: existingGrade?.catatan || ''
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

    const avg = calculateAverage13(evalForm)
    const pred = getLetterGrade(parseFloat(avg))

    const res = await submitMentorEvaluation({
      mentor_id: evaluatingMentor.id,
      admin_id: user?.id,
      no_sertifikat: evalForm.no_sertifikat.trim(),
      start_period: evalForm.start_period,
      end_period: evalForm.end_period,
      sebagai: evalForm.sebagai,
      q1_waktu: evalForm.q1,
      q2_sikap: evalForm.q2,
      q3_tanggung_jawab: evalForm.q3,
      q4_kehadiran: evalForm.q4,
      q5_kemampuan: evalForm.q5,
      q6_keterampilan: evalForm.q6,
      q7_kualitas: evalForm.q7,
      q8_komunikasi: evalForm.q8,
      q9_kerjasama: evalForm.q9,
      q10_inisiatif: evalForm.q10,
      q11_percaya_diri: evalForm.q11,
      q12_patuh_aturan: evalForm.q12,
      q13_penampilan: evalForm.q13,
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
    const grade = mentorGrades.find(g => g.mentor_id === mentor.id || g.user_id === mentor.id)
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
                            const grade = mentorGrades.find(g => g.mentor_id === mentor.id || g.user_id === mentor.id)
                            const hasCert = Boolean(grade && grade.no_sertifikat)
                            const avgScore = grade && hasCert ? calculateAverage13(grade) : null
                            const letterPred = avgScore !== null ? getLetterGrade(parseFloat(avgScore)) : null

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
                                      🏆 {letterPred || grade.predikat || 'A'}
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
      {/* MODAL 4: EVALUASI & SERTIFIKAT MENTOR (13 ASPEK PERSIS OJT) */}
      {/* ======================================================== */}
      {showEvalModal && evaluatingMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-800">Evaluasi Kinerja & Sertifikat Mentor</h3>
                <p className="text-xs text-slate-500">
                  Penilaian 13 kriteria evaluasi bimbingan resmi untuk <b>{evaluatingMentor.name}</b>.
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
              {/* NOMOR SERTIFIKAT, PERAN & PERIODE */}
              <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-xs font-black text-blue-900 mb-1">Peran / Sebagai</label>
                    <select
                      value={ROLE_OPTIONS.includes(evalForm.sebagai) ? evalForm.sebagai : '__custom__'}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setEvalForm({ ...evalForm, sebagai: '' })
                        } else {
                          setEvalForm({ ...evalForm, sebagai: e.target.value })
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="__custom__">➕ Lainnya (Ketik Manual)</option>
                    </select>
                    {(!ROLE_OPTIONS.includes(evalForm.sebagai) || evalForm.sebagai === '') && (
                      <input
                        type="text"
                        placeholder="Ketik peran (contoh: Mentor Pembimbing)..."
                        value={evalForm.sebagai}
                        onChange={(e) => setEvalForm({ ...evalForm, sebagai: e.target.value })}
                        className="mt-2 w-full px-3.5 py-2 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
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

              {/* 13 ASPEK PENILAIAN */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 pb-1">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">13 Aspek Penilaian (Skala 0 - 100)</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">Isi Cepat:</span>
                    {[80, 85, 90, 95, 100].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setQuickGrades(val)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 font-bold rounded-lg text-[11px] transition-all"
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
                  {OJT_EVALUATION_CRITERIA.map((crit, idx) => (
                    <div key={crit.key} className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-800">{idx + 1}. {crit.label}</p>
                        <p className="text-[10px] text-slate-400">{crit.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={(evalForm as any)[crit.key]}
                          onChange={(e) => setEvalForm({ ...evalForm, [crit.key]: Number(e.target.value) })}
                          className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="w-8 text-center text-xs font-extrabold text-blue-700">
                          {getLetterGrade(Number((evalForm as any)[crit.key]))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RINGKASAN NILAI & PREDIKAT */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-emerald-900">Nilai Rata-Rata Otomatis</p>
                  <p className="text-[10px] text-emerald-700">Dihitung otomatis dari akumulasi 13 aspek standar rapor MDU</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-950">{calculateAverage13(evalForm)}</span>
                  <span className="block text-[11px] font-black text-emerald-700 uppercase tracking-wide">
                    Predikat: {getLetterGrade(parseFloat(calculateAverage13(evalForm)))}
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
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', opacity: 0, pointerEvents: 'none' }}>
        {certDataToPrint && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {/* HALAMAN 1: SERTIFIKAT DEPAN (LANDSCAPE PERSIS OJT) */}
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
                padding: '150px 80px 40px 80px',
                fontFamily: 'sans-serif',
                color: '#111827',
                textAlign: 'center'
              }}
            >
              {/* Nomor Sertifikat */}
              <div style={{ marginBottom: '5px' }}>
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
              <div style={{ marginBottom: '12px' }}>
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

              {/* Peran / Status */}
              <div style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.55rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", fontWeight: 800, color: '#0F3357', margin: 0, letterSpacing: '0.03em' }}>
                  {certDataToPrint.grades?.sebagai || certDataToPrint.mentor?.status || 'Mentor'}
                </h3>
              </div>

              {/* Pada Divisi */}
              <div style={{ marginBottom: '4px' }}>
                <p style={{ fontSize: '1.15rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#374151', margin: 0 }}>
                  Pada Divisi
                </p>
              </div>

              {/* Nama Divisi */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.65rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", fontWeight: 900, color: '#0F3357', margin: 0, letterSpacing: '0.03em' }}>
                  {certDataToPrint.mentor?.divisi || 'Multimedia'}
                </h3>
              </div>

              {/* Keterangan Pelaksanaan */}
              <div style={{ marginBottom: '4px' }}>
                <p style={{ fontSize: '1.2rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#111827', margin: 0 }}>
                  Telah melaksanakan praktik kerja lapangan pada Mandiri Digital Universe
                </p>
              </div>

              {/* Periode Tanggal */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '1.15rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#111827', margin: 0 }}>
                  Terhitung mulai tanggal {certDataToPrint.grades?.start_period || certDataToPrint.mentor?.start_period || '-'} sampai dengan {certDataToPrint.grades?.end_period || certDataToPrint.mentor?.end_period || '-'}
                </p>
              </div>

              {/* Pengesahan CMO (Jakarta) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <p style={{ margin: '0 0 2px 0', fontSize: '1.05rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", fontWeight: 700, color: '#0F3357' }}>
                  Jakarta, {certDataToPrint.grades?.created_at ? new Date(certDataToPrint.grades.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p style={{ margin: '0 0 3px 0', fontSize: '1.05rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", fontWeight: 400, color: '#111827' }}>
                  Chief Marketing Officer
                </p>
                <div style={{ position: 'relative', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px 0' }}>
                  <img
                    src="/stamp-signature-cmo.png"
                    alt="Stempel & Tanda Tangan Resmi MDU"
                    style={{ height: '70px', width: 'auto', objectFit: 'contain' }}
                    crossOrigin="anonymous"
                  />
                </div>
                <div style={{ width: '160px', height: '2px', background: 'linear-gradient(90deg, #b8860b, #e2b755, #b8860b)', margin: '4px 0 5px 0', borderRadius: '1px' }}></div>
                <p style={{ margin: 0, fontSize: '1.15rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", fontWeight: 600, color: '#111827' }}>
                  Sofian Wira Hadi, M.Kom.
                </p>
              </div>
            </div>

            {/* HALAMAN 2: LEMBAR PENILAIAN (PERSIS OJT DENGAN 13 ASPEK) */}
            <div
              id="mentor-cert-page-2"
              style={{
                width: '794px',
                height: '1123px',
                backgroundColor: '#ffffff',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                fontFamily: 'sans-serif',
                color: '#000000'
              }}
            >
              <div style={{ position: 'relative', padding: '45px 85px 25px 85px', flex: 1, display: 'flex', flexDirection: 'column', color: '#000000' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F3357', textTransform: 'uppercase', marginBottom: '0.85rem', textAlign: 'center', letterSpacing: '0.05em' }}>
                  LEMBAR PENILAIAN MENTOR
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #0F3357', marginBottom: '0.85rem', fontSize: '0.74rem', lineHeight: '1.2' }}>
                  <tbody>
                    {[
                      ['Nama', certDataToPrint.mentor?.name || '-'],
                      ['Sebagai', certDataToPrint.grades?.sebagai || certDataToPrint.mentor?.status || 'Mentor'],
                      ['Instansi / Cabang', certDataToPrint.mentor?.asal_kantor || 'MDU Central'],
                      ['Divisi', certDataToPrint.mentor?.divisi || '-'],
                      ['Tanggal', `${certDataToPrint.grades?.start_period || certDataToPrint.mentor?.start_period || '-'} s/d ${certDataToPrint.grades?.end_period || certDataToPrint.mentor?.end_period || '-'}`],
                      ['No. Sertifikat', certDataToPrint.grades?.no_sertifikat || '-']
                    ].map((row, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #0F3357', padding: '4px 10px 10px 10px', fontWeight: 700, width: '35%', backgroundColor: '#f8fafc', verticalAlign: 'middle', lineHeight: '1.2' }}>{row[0]}</td>
                        <td style={{ border: '1px solid #0F3357', padding: '4px 10px 10px 10px', fontWeight: 700, verticalAlign: 'middle', lineHeight: '1.2' }}>{row[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #0F3357', fontSize: '0.7rem', lineHeight: '1.2' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F3357', color: '#FCE91A' }}>
                      <th style={{ border: '1px solid #0F3357', padding: '6px 4px 10px 4px', textAlign: 'center', width: '45px', verticalAlign: 'middle', lineHeight: '1.2' }}>No</th>
                      <th style={{ border: '1px solid #0F3357', padding: '6px 10px 10px 10px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.2' }}>Aspek Penilaian</th>
                      <th style={{ border: '1px solid #0F3357', padding: '6px 4px 10px 4px', textAlign: 'center', width: '75px', verticalAlign: 'middle', lineHeight: '1.2' }}>Nilai</th>
                      <th style={{ border: '1px solid #0F3357', padding: '6px 4px 10px 4px', textAlign: 'center', width: '75px', verticalAlign: 'middle', lineHeight: '1.2' }}>Predikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { q: 'q1_waktu', label: 'Disiplin Waktu & Kehadiran' },
                      { q: 'q2_sikap', label: 'Etika & Sikap Perilaku' },
                      { q: 'q3_tanggung_jawab', label: 'Tanggung Jawab Penugasan' },
                      { q: 'q4_kehadiran', label: 'Konsistensi Presensi' },
                      { q: 'q5_kemampuan', label: 'Kemampuan Kerja & Problem Solving' },
                      { q: 'q6_keterampilan', label: 'Keterampilan Teknis & Kreativitas' },
                      { q: 'q7_kualitas', label: 'Kualitas Hasil Pekerjaan' },
                      { q: 'q8_komunikasi', label: 'Komunikasi & Koordinasi' },
                      { q: 'q9_kerjasama', label: 'Kerjasama Tim' },
                      { q: 'q10_inisiatif', label: 'Inisiatif & Keaktifan' },
                      { q: 'q11_percaya_diri', label: 'Percaya Diri & Kemandirian' },
                      { q: 'q12_patuh_aturan', label: 'Kepatuhan Tata Tertib MDU' },
                      { q: 'q13_penampilan', label: 'Kerapian & Penampilan' }
                    ].map((item, i) => (
                      <tr key={item.q} style={{ backgroundColor: i % 2 === 0 ? '#f0f5fa' : 'white' }}>
                        <td style={{ border: '1px solid #0F3357', padding: '3px 4px 20px 4px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 600, lineHeight: '1.2' }}>{i + 1}</td>
                        <td style={{ border: '1px solid #0F3357', padding: '3px 10px 20px 10px', textAlign: 'left', verticalAlign: 'middle', lineHeight: '1.2' }}>{item.label}</td>
                        <td style={{ border: '1px solid #0F3357', padding: '3px 4px 20px 4px', textAlign: 'center', fontWeight: 700, verticalAlign: 'middle', lineHeight: '1.2' }}>{certDataToPrint.grades?.[item.q] || 90}</td>
                        <td style={{ border: '1px solid #0F3357', padding: '3px 4px 20px 4px', textAlign: 'center', fontWeight: 700, verticalAlign: 'middle', lineHeight: '1.2' }}>{getLetterGrade(Number(certDataToPrint.grades?.[item.q] || 90))}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#FCE91A', color: '#0F3357', fontWeight: 800 }}>
                      <td colSpan={2} style={{ border: '1px solid #0F3357', padding: '15px 10px 20px 10px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>RATA-RATA AKHIR</td>
                      <td style={{ border: '1px solid #0F3357', padding: '15px 4px 20px 4px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>{calculateAverage13(certDataToPrint.grades)}</td>
                      <td style={{ border: '1px solid #0F3357', padding: '15px 4px 20px 4px', textAlign: 'center', verticalAlign: 'middle', lineHeight: '1.5' }}>{getLetterGrade(Number(calculateAverage13(certDataToPrint.grades)))}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Ketentuan Penilaian */}
                <div style={{ marginTop: '12px', fontSize: '0.66rem', color: '#334155', lineHeight: '1.45', borderLeft: '3px solid #0F3357', paddingLeft: '8px' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0F3357' }}>Ketentuan penilaian:</p>
                  <p style={{ margin: '2px 0 0 0' }}>
                    96 s/d 100 : Nilai A+, 91 s/d 95 : Nilai A, 86 s/d 90 : Nilai A-, 81 s/d 85 : Nilai B+, 76 s/d 80 : Nilai B, 71 s/d 75 : Nilai B-, 66 s/d 70 : Nilai C
                  </p>
                </div>

                {/* Tanda Tangan & Stempel Resmi MDU */}
                <div style={{ marginTop: '2px', display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                  <div style={{ textAlign: 'center', width: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ margin: '0 0 3px 0', fontSize: '0.78rem', fontFamily: "'Century Gothic', 'Montserrat', 'Poppins', sans-serif", color: '#0F3357', fontWeight: 700 }}>
                      Jakarta, {certDataToPrint.grades?.created_at ? new Date(certDataToPrint.grades.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <img
                      src="/signature-mdu.png"
                      alt="Tanda Tangan & Stempel MDU"
                      style={{ width: '155px', height: 'auto', display: 'block' }}
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>

                {/* Media Partner MDU */}
                <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1.5px solid #0F3357', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: '#0F3357', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Media Partner:
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                    <img
                      src="/partners/milenianews.jpg"
                      alt="Milenianews.com"
                      style={{ height: '26px', width: 'auto', objectFit: 'contain' }}
                      crossOrigin="anonymous"
                    />
                    <img
                      src="/partners/sobatsekolah.png"
                      alt="Sobat Sekolah"
                      style={{ height: '30px', width: 'auto', objectFit: 'contain' }}
                      crossOrigin="anonymous"
                    />
                    <img
                      src="/partners/nusamandirinews.png"
                      alt="Nusa Mandiri News"
                      style={{ height: '24px', width: 'auto', objectFit: 'contain' }}
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
