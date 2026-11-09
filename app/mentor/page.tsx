'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { LoadingMDU } from '@/components/LoadingMDU'
import Swal from 'sweetalert2'
import { 
  mentorSubmitSpecialAttendance,
  createAnnouncement,
  getMentorAnnouncements,
  toggleAnnouncementStatus,
  deleteAnnouncement,
  type AnnouncementItem 
} from './actions'

export default function MentorDashboard() {
  const [user, setUser] = useState<any>(null)
  const [mentees, setMentees] = useState<any[]>([])

  // STATE: Menyimpan tanggal yang dipilih (Default: Hari Ini)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'))
  const [attendances, setAttendances] = useState<any[]>([])
  const [izinList, setIzinList] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // STATE: Modal Presensi Khusus / Edit Absen
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false)
  const [selectedMenteeForAttendance, setSelectedMenteeForAttendance] = useState<any>(null)
  const [specialStatus, setSpecialStatus] = useState<string>('Tugas Luar / Visit')
  const [specialCheckInTime, setSpecialCheckInTime] = useState<string>('08:00')
  const [specialCheckOutTime, setSpecialCheckOutTime] = useState<string>('15:00')
  const [specialKeterangan, setSpecialKeterangan] = useState<string>('')
  const [specialFile, setSpecialFile] = useState<File | null>(null)
  const [existingBuktiUrl, setExistingBuktiUrl] = useState<string>('')
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false)

  // STATE: Papan Pengumuman Tim (Broadcast)
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [newAnnounceTitle, setNewAnnounceTitle] = useState('')
  const [newAnnounceContent, setNewAnnounceContent] = useState('')
  const [newAnnounceCategory, setNewAnnounceCategory] = useState<'info' | 'penting' | 'evaluasi'>('info')
  const [isSubmittingAnnounce, setIsSubmittingAnnounce] = useState(false)

  // STATE: Peringatan Dini Tim (Early Warning)
  const [lateCounts, setLateCounts] = useState<{ [userId: string]: number }>({})
  const [warningFilter, setWarningFilter] = useState<'all' | 'absent' | 'late' | 'ending'>('all')

  // 1. Ambil Profil & Data Tim (Hanya jalan sekali saat awal load)
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: mentorProfile } = await supabase.from('users').select('name, avatar_url, divisi').eq('id', user.id).single()
      if (mentorProfile) setProfile(mentorProfile)

      const { data: teamData } = await supabase
        .from('users')
        .select('*')
        .eq('mentor_id', user.id)
        .eq('role', 'ojt')
        .or('status_ojt.eq.aktif,status_ojt.is.null') // Filter only active participants, exclude archived
      if (teamData) setMentees(teamData)

      // Tarik Pengumuman Tim
      const annRes = await getMentorAnnouncements(user.id)
      if (annRes.success && annRes.announcements) {
        setAnnouncements(annRes.announcements)
      }

      // Tarik Riwayat Terlambat 30 Hari Terakhir untuk Early Warning
      if (teamData && teamData.length > 0) {
        const menteeIds = teamData.map(m => m.id)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const { data: lateData } = await supabase
          .from('attendance')
          .select('user_id')
          .in('user_id', menteeIds)
          .eq('status', 'Terlambat')
          .gte('check_in_time', thirtyDaysAgo.toISOString())

        const counts: { [userId: string]: number } = {}
        ;(lateData || []).forEach(r => {
          counts[r.user_id] = (counts[r.user_id] || 0) + 1
        })
        setLateCounts(counts)
      }

      setLoading(false)
    }
    fetchInitialData()
  }, [router])

  // 2. Ambil Absen & Izin berdasarkan Tanggal yang dipilih
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

    // Ambil data izin / surat tugas pada tanggal terpilih
    const { data: izinData } = await supabase
      .from('izin_ojt')
      .select('*')
      .in('user_id', menteeIds)
      .eq('tanggal_izin', selectedDate)

    setIzinList(izinData || [])
  }

  useEffect(() => {
    fetchAttendanceByDate()
  }, [selectedDate, mentees])

  // FUNGSI BUKA MODAL ABSEN / EDIT
  const handleOpenAttendanceModal = (mentee: any) => {
    setSelectedMenteeForAttendance(mentee)
    const existingAbsen = attendances.find(a => a.user_id === mentee.id)
    const existingIzin = izinList.find(i => i.user_id === mentee.id)

    if (existingAbsen) {
      const inTime = new Date(existingAbsen.check_in_time)
      const inHours = String(inTime.getHours()).padStart(2, '0')
      const inMins = String(inTime.getMinutes()).padStart(2, '0')
      setSpecialCheckInTime(`${inHours}:${inMins}`)

      if (existingAbsen.check_out_time) {
        const outTime = new Date(existingAbsen.check_out_time)
        const outHours = String(outTime.getHours()).padStart(2, '0')
        const outMins = String(outTime.getMinutes()).padStart(2, '0')
        setSpecialCheckOutTime(`${outHours}:${outMins}`)
      } else {
        setSpecialCheckOutTime('17:00')
      }
      setSpecialStatus(existingAbsen.status || 'Tugas Luar / Visit')
    } else {
      setSpecialCheckInTime('08:00')
      setSpecialCheckOutTime('17:00')
      setSpecialStatus('Tugas Luar / Visit')
    }

    if (existingIzin) {
      setSpecialKeterangan(existingIzin.keterangan || '')
      setExistingBuktiUrl(existingIzin.bukti_link || '')
    } else {
      setSpecialKeterangan('')
      setExistingBuktiUrl('')
    }

    setSpecialFile(null)
    setAttendanceModalOpen(true)
  }

  // FUNGSI SUBMIT PRESENSI KHUSUS
  const handleSubmitSpecialAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMenteeForAttendance) return

    setIsSubmittingAttendance(true)
    const toastId = toast.loading('Menyimpan presensi & surat tugas...')

    try {
      let finalBuktiLink = existingBuktiUrl

      // Upload file jika mentor melampirkan berkas baru
      if (specialFile) {
        const fileExt = specialFile.name.split('.').pop()
        const fileName = `surat-tugas-${selectedMenteeForAttendance.id}-${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('izin-bukti')
          .upload(fileName, specialFile)

        if (uploadError) throw new Error('Gagal mengunggah surat tugas / berkas.')

        const { data: publicUrlData } = supabase.storage
          .from('izin-bukti')
          .getPublicUrl(fileName)

        finalBuktiLink = publicUrlData.publicUrl
      }

      const checkInISO = `${selectedDate}T${specialCheckInTime}:00`
      const checkOutISO = specialCheckOutTime ? `${selectedDate}T${specialCheckOutTime}:00` : undefined

      const res = await mentorSubmitSpecialAttendance({
        menteeId: selectedMenteeForAttendance.id,
        tanggal: selectedDate,
        checkInTime: checkInISO,
        checkOutTime: checkOutISO,
        status: specialStatus,
        keterangan: specialKeterangan,
        buktiLink: finalBuktiLink
      })

      if (!res.success) {
        throw new Error(res.message || 'Gagal menyimpan presensi khusus.')
      }

      toast.success(`Presensi ${selectedMenteeForAttendance.name} berhasil disimpan!`, { id: toastId })
      setAttendanceModalOpen(false)
      await fetchAttendanceByDate()
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan sistem.', { id: toastId })
    } finally {
      setIsSubmittingAttendance(false)
    }
  }

  // FUNGSI EXPORT KE EXCEL
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data Kehadiran')

    worksheet.columns = [
      { header: 'NIP', key: 'nip', width: 15 },
      { header: 'Nama Peserta', key: 'name', width: 30 },
      { header: 'Asal Institusi', key: 'sekolah', width: 25 },
      { header: 'Divisi', key: 'divisi', width: 20 },
      { header: 'Tanggal', key: 'tanggal', width: 20 },
      { header: 'Jam Masuk', key: 'masuk', width: 15 },
      { header: 'Jam Pulang', key: 'pulang', width: 15 },
      { header: 'Status Kehadiran', key: 'status', width: 20 },
      { header: 'Keterangan Penugasan', key: 'keterangan', width: 30 },
      { header: 'Link Surat Tugas', key: 'surat_tugas', width: 35 }
    ]

    mentees.forEach(m => {
      const absen = attendances.find(a => a.user_id === m.id)
      const izin = izinList.find(i => i.user_id === m.id)

      worksheet.addRow({
        nip: m.nip || '-',
        name: m.name,
        sekolah: m.asal_sekolah || '-',
        divisi: m.divisi,
        tanggal: new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        masuk: absen ? formatTime(absen.check_in_time) : '-',
        pulang: absen?.check_out_time ? formatTime(absen.check_out_time) : '-',
        status: absen ? absen.status : 'Alpa / Belum Absen',
        keterangan: izin?.keterangan || '-',
        surat_tugas: izin?.bukti_link || '-'
      })
    })

    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
      row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        if (rowNumber !== 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
          if (colNumber >= 5 && colNumber <= 8) cell.alignment = { vertical: 'middle', horizontal: 'center' }
        }
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Laporan_Kehadiran_Tim_${selectedDate}.xlsx`)
  }

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const getFormattedDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // HANDLER PENGUMUMAN TIM (BROADCAST)
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAnnounceTitle.trim() || !newAnnounceContent.trim()) {
      toast.error('Judul dan isi pengumuman tidak boleh kosong.')
      return
    }
    setIsSubmittingAnnounce(true)
    const res = await createAnnouncement({
      mentor_id: user.id,
      title: newAnnounceTitle,
      content: newAnnounceContent,
      category: newAnnounceCategory
    })
    if (res.success && res.item) {
      setAnnouncements(prev => [res.item!, ...prev])
      setNewAnnounceTitle('')
      setNewAnnounceContent('')
      setNewAnnounceCategory('info')
      setShowAnnouncementModal(false)
      toast.success('Pengumuman berhasil disiarkan ke anak bimbingan!')
    } else {
      toast.error(res.message || 'Gagal menyiarkan pengumuman.')
    }
    setIsSubmittingAnnounce(false)
  }

  const handleToggleAnnounce = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus
    const res = await toggleAnnouncementStatus(id, user.id, nextStatus)
    if (res.success) {
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: nextStatus } : a))
      toast.success(nextStatus ? 'Pengumuman diaktifkan kembali.' : 'Pengumuman dinonaktifkan.')
    } else {
      toast.error('Gagal memperbarui status pengumuman.')
    }
  }

  const handleDeleteAnnounce = async (id: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus Pengumuman?',
      text: 'Pengumuman ini tidak akan ditampilkan lagi ke anak bimbingan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      customClass: { confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' }
    })

    if (confirm.isConfirmed) {
      const res = await deleteAnnouncement(id, user.id)
      if (res.success) {
        setAnnouncements(prev => prev.filter(a => a.id !== id))
        toast.success('Pengumuman berhasil dihapus.')
      } else {
        toast.error('Gagal menghapus pengumuman.')
      }
    }
  }

  // KALKULASI PERINGATAN DINI TIM (EARLY WARNING)
  const calculateRemainingDays = (endDateStr: string) => {
    if (!endDateStr) return null
    const end = new Date(endDateStr)
    const today = new Date()
    end.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    const diffTime = end.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Helper cek apakah mentee masih aktif magang (belum lewat end_period & bukan status selesai)
  const isMenteeActive = (m: any) => {
    if (m.status_ojt && m.status_ojt !== 'aktif') return false
    if (m.end_period) {
      const days = calculateRemainingDays(m.end_period)
      if (days !== null && days < 0) return false
    }
    return true
  }

  const activeMentees = mentees.filter(isMenteeActive)

  const isToday = selectedDate === new Date().toLocaleDateString('en-CA')
  const now = new Date()
  const isPastMorningCheck = (now.getHours() > 8) || (now.getHours() === 8 && now.getMinutes() >= 15)

  const attendedUserIds = new Set((attendances || []).map(a => a.user_id))
  const izinUserIds = new Set((izinList || []).map(i => i.user_id))

  // 1. Belum Hadir Hari Ini (jam > 08.15 & belum absen/izin & HANYA untuk peserta magang aktif)
  const absentTodayList = isToday && isPastMorningCheck
    ? activeMentees.filter(m => !attendedUserIds.has(m.id) && !izinUserIds.has(m.id))
    : []

  // 2. Sering Terlambat (>= 3 kali dalam 30 hari terakhir & HANYA untuk peserta magang aktif)
  const frequentLateList = activeMentees.filter(m => (lateCounts[m.id] || 0) >= 3)

  // 3. Sisa Masa Magang <= 7 hari (dan >= 0 hari & status aktif)
  const endingSoonList = activeMentees.filter(m => {
    const days = calculateRemainingDays(m.end_period)
    return days !== null && days >= 0 && days <= 7
  })

  // Daftar peserta yang ditampilkan di tabel presensi:
  // Seluruh peserta aktif, atau peserta selesai yang tercatat absensi/izin pada tanggal yang dipilih
  const displayMentees = mentees.filter(m => {
    if (isMenteeActive(m)) return true
    const hasAbsen = attendances.some(a => a.user_id === m.id)
    const hasIzin = izinList.some(i => i.user_id === m.id)
    return hasAbsen || hasIzin
  })

  const activeAnnouncements = announcements.filter(a => a.is_active)
  const hasEarlyWarnings = absentTodayList.length > 0 || frequentLateList.length > 0 || endingSoonList.length > 0

  if (!loading && !user) return null

  return (
    <>
      {loading && <LoadingMDU message="Memuat Panel Mentor..." />}
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
                  className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 text-left"
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
          1. SIDEBAR (KHUSUS DESKTOP) 
          ========================================= */}
        <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm overflow-hidden">
          <div className="p-6 flex items-center gap-3 border-b border-slate-100">
            <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Panel</span>
          </div>

          <div className="px-4 flex-1 mt-4 space-y-2">
            <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
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
                <div className="md:hidden relative">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-12 h-12 rounded-xl bg-slate-100 object-cover border-2 border-white/20" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold border-2 border-white/20">M</div>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
                    Halo, <span className="text-orange-300">{profile?.name}</span>!
                  </h1>
                  <p className="text-blue-100 text-xs md:text-sm font-medium mt-1">
                    Pantau kehadiran dan kelola absensi penugasan tim kreatif Anda.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => router.push('/settings')} className="hidden md:flex p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 tooltip-trigger" title="Pengaturan Akun">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>

                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* AREA KONTEN BAWAH (SCROLLABLE) */}
          <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-12 relative z-10">

            {/* STATS SUMMARY CARD */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
              <div className="bg-white p-5 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Total Tim Aktif</p>
                <p className="text-3xl font-black text-slate-800">{activeMentees.length}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-5 rounded-3xl shadow-lg shadow-emerald-500/20 text-white flex flex-col items-center justify-center text-center">
                <p className="text-emerald-100 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Kehadiran</p>
                <p className="text-3xl font-black">{attendances.length}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-xl border border-rose-100 flex flex-col items-center justify-center text-center">
                <p className="text-rose-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Alpa / Izin</p>
                <p className="text-3xl font-black text-rose-600">{Math.max(0, activeMentees.length - attendances.length)}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-xl border border-amber-100 flex flex-col items-center justify-center text-center">
                <p className="text-amber-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">Terlambat</p>
                <p className="text-3xl font-black text-amber-600">{attendances.filter(a => a.status === 'Terlambat').length}</p>
              </div>
            </div>

            {/* ACTION BAR: BROADCAST PENGUMUMAN & QUICK INFO */}
            <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-900 to-[#1e1b4b] p-4 md:p-5 rounded-3xl text-white shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-300 shrink-0 border border-white/15">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span>Papan Pengumuman Tim</span>
                    {activeAnnouncements.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white shadow-xs">
                        {activeAnnouncements.length} Aktif
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5 line-clamp-1">
                    {activeAnnouncements.length > 0 
                      ? activeAnnouncements[0].title
                      : 'Siarkan pesan pengumuman atau instruksi ke seluruh anak bimbingan Anda.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-indigo-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Kelola Pengumuman</span>
                </button>
              </div>
            </div>

            {/* PERINGATAN DINI TIM (EARLY WARNING SYSTEM) */}
            {hasEarlyWarnings && (
              <div className="mb-6 bg-white p-4 sm:p-5 rounded-3xl shadow-lg border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                      Pantauan Khusus & Peringatan Dini Tim
                    </h3>
                  </div>

                  {/* Filter Tabs Early Warning */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setWarningFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        warningFilter === 'all'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua
                    </button>
                    {absentTodayList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWarningFilter('absent')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                          warningFilter === 'absent'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span>Belum Hadir ({absentTodayList.length})</span>
                      </button>
                    )}
                    {frequentLateList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWarningFilter('late')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                          warningFilter === 'late'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span>Sering Terlambat ({frequentLateList.length})</span>
                      </button>
                    )}
                    {endingSoonList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWarningFilter('ending')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                          warningFilter === 'ending'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        <span>Sisa &le; 7 Hari ({endingSoonList.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Grid Kartu Peserta Peringatan Dini */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* 1. Belum Hadir Hari Ini */}
                  {(warningFilter === 'all' || warningFilter === 'absent') &&
                    absentTodayList.map(m => (
                      <div
                        key={`absent-${m.id}`}
                        className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100 flex items-center justify-between gap-2.5 shadow-xs hover:border-rose-300 transition-all min-w-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white leading-none">
                              Belum Hadir
                            </span>
                            <span className="text-[10px] text-rose-700/90 font-semibold truncate" title={m.divisi}>
                              {m.divisi}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 truncate" title={m.name}>{m.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{m.asal_sekolah || '-'}</p>
                        </div>
                        {m.no_telp && (
                          <a
                            href={`https://wa.me/${m.no_telp.replace(/^0/, '62')}?text=${encodeURIComponent(
                              `Halo ${m.name}, Anda belum melakukan presensi hari ini. Mohon segera konfirmasi kehadiran Anda.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 shadow-xs transition-all active:scale-95"
                            title="Ingatkan via WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            <span>Ingatkan</span>
                          </a>
                        )}
                      </div>
                    ))}

                  {/* 2. Sering Terlambat 30 Hari */}
                  {(warningFilter === 'all' || warningFilter === 'late') &&
                    frequentLateList.map(m => (
                      <div
                        key={`late-${m.id}`}
                        className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100 flex items-center justify-between gap-2.5 shadow-xs hover:border-amber-300 transition-all min-w-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white leading-none">
                              {lateCounts[m.id] || 0}x Terlambat
                            </span>
                            <span className="text-[10px] text-amber-700/90 font-semibold truncate" title={m.divisi}>
                              {m.divisi}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 truncate" title={m.name}>{m.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{m.nip || '-'}</p>
                        </div>
                        {m.no_telp && (
                          <a
                            href={`https://wa.me/${m.no_telp.replace(/^0/, '62')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[11px] flex items-center gap-1 shrink-0 transition-all active:scale-95"
                            title="Hubungi WhatsApp"
                          >
                            <span>Kontak</span>
                          </a>
                        )}
                      </div>
                    ))}

                  {/* 3. Sisa Masa Magang <= 7 Hari */}
                  {(warningFilter === 'all' || warningFilter === 'ending') &&
                    endingSoonList.map(m => {
                      const days = calculateRemainingDays(m.end_period)
                      return (
                        <div
                          key={`ending-${m.id}`}
                          className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between gap-2.5 shadow-xs hover:border-indigo-300 transition-all min-w-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white leading-none">
                                Sisa {days} Hari
                              </span>
                              <span className="text-[10px] text-indigo-700/90 font-semibold truncate" title={m.divisi}>
                                {m.divisi}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 truncate" title={m.name}>{m.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{m.asal_sekolah || '-'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => router.push('/mentor/penilaian')}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shrink-0 shadow-xs transition-all active:scale-95"
                          >
                            Rapor Nilai
                          </button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* TABEL UTAMA: PANTAU KEHADIRAN */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-5 md:p-6 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                <div>
                  <h2 className="text-lg font-bold text-slate-800">Catatan Absensi Tim</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Pantauan untuk tanggal: {getFormattedDate(selectedDate)}</p>
                </div>

                {/* FILTER & EXPORT */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full sm:w-auto pl-4 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all"
                    />
                  </div>
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all shrink-0 hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span className="hidden sm:inline">Unduh Excel</span>
                    <span className="sm:hidden">Excel</span>
                  </button>
                </div>

              </div>

              {/* DATA TABEL & CARD VIEW MOBILE */}
              <div className="p-0 custom-scrollbar">
                {mentees.length === 0 ? (
                  <div className="text-center py-16 opacity-60">
                    <div className="w-12 h-12 mx-auto mb-3 text-slate-300">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-700">Tim Kosong</p>
                    <p className="text-xs text-slate-400 mt-1">Belum ada peserta OJT yang ditugaskan kepada Anda.</p>
                  </div>
                ) : (
                  <>
                    {/* 1. TAMPILAN MOBILE (CARD VIEW) */}
                    <div className="block md:hidden p-4 space-y-3 bg-slate-50/50">
                      {displayMentees.map((m) => {
                        const absenHariIni = attendances.find(a => a.user_id === m.id)
                        const izinHariIni = izinList.find(i => i.user_id === m.id)
                        const isTugasKhusus = absenHariIni?.status?.includes('Tugas') || absenHariIni?.status?.includes('Event') || izinHariIni?.bukti_link
                        const isActive = isMenteeActive(m)

                        return (
                          <div
                            key={`mobile-mentee-${m.id}`}
                            className={`p-4 rounded-2xl bg-white border shadow-xs flex flex-col gap-3 transition-all ${
                              !absenHariIni ? 'border-rose-200/80 bg-rose-50/20' : 'border-slate-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-sm text-slate-900 truncate">{m.name}</p>
                                  {!isActive && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 shrink-0">
                                      Selesai
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
                                  {m.nip || '-'} • <span className="text-indigo-600 font-bold">{m.divisi}</span>
                                </p>
                              </div>
                              <div className="shrink-0">
                                {absenHariIni ? (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                                    absenHariIni.status === 'Terlambat'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : isTugasKhusus
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      absenHariIni.status === 'Terlambat'
                                        ? 'bg-amber-500'
                                        : isTugasKhusus
                                        ? 'bg-blue-500'
                                        : 'bg-emerald-500'
                                    }`}></span>
                                    {absenHariIni.status}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-50 text-rose-700 border border-rose-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    Belum Absen
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Masuk</span>
                                <span className="font-extrabold text-slate-700">
                                  {absenHariIni ? formatTime(absenHariIni.check_in_time) : '--:--'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Pulang</span>
                                <span className="font-extrabold text-emerald-600">
                                  {absenHariIni?.check_out_time ? formatTime(absenHariIni.check_out_time) : '--:--'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleOpenAttendanceModal(m)}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                  absenHariIni
                                    ? 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                }`}
                              >
                                <span>{absenHariIni ? 'Ubah Presensi' : 'Absenkan Khusus'}</span>
                              </button>

                              {izinHariIni?.bukti_link && (
                                <a
                                  href={izinHariIni.bukti_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="py-2 px-3 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 shrink-0"
                                >
                                  Surat
                                </a>
                              )}

                              {m.no_telp && (
                                <a
                                  href={`https://wa.me/${m.no_telp?.replace(/^0/, '62')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0"
                                  title="WhatsApp"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* 2. TAMPILAN DESKTOP (TABEL LENGKAP) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap min-w-[950px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                        <th className="p-4 pl-6">Profil Peserta</th>
                        <th className="p-4">Hari & Tanggal</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Waktu Masuk</th>
                        <th className="p-4">Waktu Pulang</th>
                        <th className="p-4">Surat Tugas / Bukti</th>
                        <th className="p-4 text-center">Aksi Kelola</th>
                        <th className="p-4 text-right pr-6">Kontak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayMentees.map((m) => {
                        const absenHariIni = attendances.find(a => a.user_id === m.id)
                        const izinHariIni = izinList.find(i => i.user_id === m.id)
                        const isTugasKhusus = absenHariIni?.status?.includes('Tugas') || absenHariIni?.status?.includes('Event') || izinHariIni?.bukti_link
                        const isActive = isMenteeActive(m)

                        return (
                          <tr key={m.id} className={`transition-colors hover:bg-slate-50/50 ${!absenHariIni ? 'bg-rose-50/20' : ''}`}>

                            <td className="p-4 pl-6">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">{m.name}</span>
                                {!isActive && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">
                                    Selesai
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-semibold text-slate-400 mt-0.5">{m.nip || '-'} • <span className="text-indigo-600">{m.divisi}</span></div>
                            </td>

                            <td className="p-4 text-xs font-bold text-indigo-900">
                              {absenHariIni ? new Date(absenHariIni.check_in_time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>

                            <td className="p-4">
                              {absenHariIni ? (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-inner ${
                                  absenHariIni.status === 'Terlambat'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : isTugasKhusus
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    absenHariIni.status === 'Terlambat'
                                      ? 'bg-amber-500'
                                      : isTugasKhusus
                                      ? 'bg-blue-500'
                                      : 'bg-emerald-500'
                                  }`}></span>
                                  {absenHariIni.status}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-rose-50 text-rose-700 border border-rose-100 shadow-inner">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  Belum Absen
                                </span>
                              )}
                            </td>

                            <td className="p-4 text-sm font-bold text-slate-700">
                              {absenHariIni ? (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                                  {formatTime(absenHariIni.check_in_time)}
                                </div>
                              ) : '-'}
                            </td>

                            <td className="p-4 text-sm font-bold text-emerald-600">
                              {absenHariIni?.check_out_time ? (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                  {formatTime(absenHariIni.check_out_time)}
                                </div>
                              ) : '-'}
                            </td>

                            {/* SURAT TUGAS / BUKTI */}
                            <td className="p-4">
                              {izinHariIni?.bukti_link ? (
                                <a
                                  href={izinHariIni.bukti_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-lg transition-all"
                                  title="Buka Dokumen Surat Tugas"
                                >
                                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span>Lihat Surat</span>
                                </a>
                              ) : izinHariIni?.keterangan ? (
                                <span className="text-xs text-slate-500 italic max-w-[150px] truncate block" title={izinHariIni.keterangan}>
                                  {izinHariIni.keterangan}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-300">-</span>
                              )}
                            </td>

                            {/* TOMBOL AKSI KELOLA ABSEN */}
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleOpenAttendanceModal(m)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                                  absenHariIni
                                    ? 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20'
                                }`}
                                title={absenHariIni ? 'Ubah data presensi peserta' : 'Absenkan peserta khusus tugas luar / event'}
                              >
                                {absenHariIni ? (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                    <span>Edit Absen</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Absenkan</span>
                                  </>
                                )}
                              </button>
                            </td>

                            <td className="p-4 text-right pr-6">
                              {m.no_telp ? (
                                <a
                                  href={`https://wa.me/${m.no_telp?.replace(/^0/, '62')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-8 h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all tooltip-trigger border border-emerald-100 shadow-inner"
                                  title="Hubungi via WhatsApp"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                </a>
                              ) : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* =========================================
        MODAL KELOLA PRESENSI KHUSUS / SURAT TUGAS
        ========================================= */}
      {attendanceModalOpen && selectedMenteeForAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header Modal */}
            <div className="p-6 bg-gradient-to-r from-[#1e1b4b] to-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Kelola Presensi Peserta</h3>
                  <p className="text-xs text-indigo-200">
                    {selectedMenteeForAttendance.name} • {getFormattedDate(selectedDate)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitSpecialAttendance} className="p-6 overflow-y-auto space-y-4">
              {/* Info Box */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
                <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Gunakan fitur ini apabila anak OJT ditugaskan khusus (event luar, liputan, atau kunjungan dinas) sehingga tidak dapat melakukan scan absensi mandiri di kantor.
                </span>
              </div>

              {/* Status Presensi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Presensi
                </label>
                <select
                  value={specialStatus}
                  onChange={(e) => setSpecialStatus(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                >
                  <option value="Tugas Luar / Visit">Tugas Luar / Visit</option>
                  <option value="Event / Lapangan">Event / Lapangan</option>
                  <option value="Tepat Waktu">Tepat Waktu (Hadir)</option>
                  <option value="Terlambat">Terlambat</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                </select>
              </div>

              {/* Jam Masuk & Jam Pulang */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jam Masuk
                  </label>
                  <input
                    type="time"
                    required
                    value={specialCheckInTime}
                    onChange={(e) => setSpecialCheckInTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jam Pulang
                  </label>
                  <input
                    type="time"
                    value={specialCheckOutTime}
                    onChange={(e) => setSpecialCheckOutTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                  />
                </div>
              </div>

              {/* Keterangan Tugas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keterangan / Agenda Penugasan
                </label>
                <textarea
                  rows={3}
                  value={specialKeterangan}
                  onChange={(e) => setSpecialKeterangan(e.target.value)}
                  placeholder="Contoh: Ditugaskan meliput event pameran mitra MDU di Hall A"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              {/* Upload Surat Tugas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Unggah Dokumen Surat Tugas / Bukti (PDF / Foto)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setSpecialFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl p-1.5"
                />
                {existingBuktiUrl && !specialFile && (
                  <div className="mt-2 text-xs flex items-center gap-1.5 text-indigo-700 font-medium">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Dokumen sebelumnya tersimpan:</span>
                    <a
                      href={existingBuktiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold hover:text-indigo-900"
                    >
                      Buka Dokumen
                    </a>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setAttendanceModalOpen(false)}
                  disabled={isSubmittingAttendance}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAttendance}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingAttendance ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Simpan Presensi</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* =========================================
        MODAL KELOLA PAPAN PENGUMUMAN TIM (BROADCAST)
        ========================================= */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="p-6 bg-gradient-to-r from-[#1e1b4b] to-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Papan Pengumuman Tim</h3>
                  <p className="text-xs text-indigo-200">
                    Siarkan pesan atau instruksi penting kepada seluruh anak OJT bimbingan Anda.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Form Tambah Pengumuman */}
              <form onSubmit={handleCreateAnnouncement} className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-4">
                <h4 className="text-sm font-extrabold text-indigo-950 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Tulis Pengumuman Baru</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Judul Pengumuman
                    </label>
                    <input
                      type="text"
                      value={newAnnounceTitle}
                      onChange={(e) => setNewAnnounceTitle(e.target.value)}
                      placeholder="Contoh: Jadwal Evaluasi Tim Mingguan"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Kategori
                    </label>
                    <select
                      value={newAnnounceCategory}
                      onChange={(e) => setNewAnnounceCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                    >
                      <option value="info">🔵 Info Umum</option>
                      <option value="penting">🔴 Penting / Urgent</option>
                      <option value="evaluasi">🟣 Evaluasi Proyek</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Isi Pengumuman / Instruksi
                  </label>
                  <textarea
                    rows={3}
                    value={newAnnounceContent}
                    onChange={(e) => setNewAnnounceContent(e.target.value)}
                    placeholder="Tuliskan pesan atau instruksi secara jelas..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                    required
                  ></textarea>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingAnnounce}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAnnounce ? 'Menyiarkan...' : 'Siarkan Sekarang'}
                  </button>
                </div>
              </form>

              {/* Daftar Pengumuman Tim Yang Pernah Dibuat */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">
                  Riwayat Pengumuman ({announcements.length})
                </h4>

                {announcements.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                    Belum ada pengumuman yang pernah disiarkan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          item.is_active
                            ? 'bg-white border-slate-200 shadow-xs'
                            : 'bg-slate-50 border-slate-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${
                                item.category === 'penting'
                                  ? 'bg-rose-100 text-rose-700'
                                  : item.category === 'evaluasi'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {item.category === 'penting'
                                ? 'Penting'
                                : item.category === 'evaluasi'
                                ? 'Evaluasi'
                                : 'Info'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(item.created_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleAnnounce(item.id, item.is_active)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                item.is_active
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              {item.is_active ? '● Aktif' : '○ Nonaktif'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAnnounce(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                              title="Hapus Pengumuman"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <h5 className="font-bold text-sm text-slate-900 mb-1">{item.title}</h5>
                        <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{item.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}