'use server'

import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 1. FUNGSI BIKIN AKUN OJT (Pakai NIP)
export async function createOJTAccount(formData: {
  nip: string,           // <-- Ganti email jadi nip
  name: string,
  divisi: string,
  asal_kantor: string,
  asal_sekolah: string,
  no_telp: string,
  start_period: string,
  end_period: string,
  mentor_id: string
}) {
  try {
    // Trik Ninja: Bikin email bayangan dari NIP
    const dummyEmail = `${formData.nip}@ojt.mdu.com`

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: dummyEmail,
      password: 'ojtmdu2026!',
      email_confirm: true
    })

    if (authError) throw authError

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authUser.user.id,
        email: dummyEmail, // Tetap simpan email bayangan buat jaga-jaga
        nip: formData.nip, // Simpan NIP aslinya
        name: formData.name,
        role: 'ojt',
        divisi: formData.divisi,
        asal_kantor: formData.asal_kantor,
        asal_sekolah: formData.asal_sekolah,
        no_telp: formData.no_telp,
        start_period: formData.start_period || null,
        end_period: formData.end_period || null,
        mentor_id: formData.mentor_id
      }])

    if (profileError) throw profileError

    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// 2. FUNGSI BARU: MENTOR RESET PASSWORD OJT
export async function resetPasswordByMentor(userId: string, newPassword: string) {
  try {
    // Admin Supabase maksa ganti password tanpa perlu nanya password lama
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// 3. FUNGSI UPDATE DATA PROFIL OJT
// 3. FUNGSI UPDATE DATA PROFIL OJT
export async function updateOJTProfile(userId: string, updateData: any) {
  try {
    // Pindahin deklarasi email ke atas biar bisa dipakai di kedua brankas
    const newEmail = `${updateData.nip}@ojt.mdu.com`

    // Langkah 1: Update data profil di tabel users (database biasa)
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({
        name: updateData.name,
        nip: updateData.nip,
        email: newEmail, // <--- INI TAMBAHANNYA BIAR DI TABEL IKUT BERUBAH
        asal_sekolah: updateData.asal_sekolah,
        no_telp: updateData.no_telp,
        divisi: updateData.divisi,
        asal_kantor: updateData.asal_kantor,
        start_period: updateData.start_period || null,
        end_period: updateData.end_period || null,
      })
      .eq('id', userId)

    if (dbError) throw dbError

    // Langkah 2: Update email login di sistem Auth Supabase
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: newEmail }
    )

    if (authError) throw authError

    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// 4. FUNGSI ARSIPKAN AKUN OJT (Tidak Dihapus)
export async function archiveOJTAccount(userId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ status_ojt: 'selesai' })
      .eq('id', userId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// 5. FUNGSI HAPUS AKUN OJT PERMANEN
export async function deleteOJTAccount(userId: string) {
  try {
    // Hapus dari tabel users
    await supabaseAdmin.from('users').delete().eq('id', userId)

    // Hapus total dari sistem Auth Supabase
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) throw error

    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// 5. FUNGSI INPUT & UPDATE NILAI OJT
export async function submitOJTGrades(gradeData: any) {
  try {
    // Cek dulu apakah anak OJT ini udah pernah dinilai sebelumnya
    const { data: existing } = await supabaseAdmin
      .from('ojt_grades')
      .select('id')
      .eq('user_id', gradeData.user_id)
      .maybeSingle()

    if (existing) {
      // Kalau udah pernah dinilai, kita UPDATE datanya (biar nggak dobel)
      const { error } = await supabaseAdmin
        .from('ojt_grades')
        .update(gradeData)
        .eq('id', existing.id)

      if (error) throw error
    } else {
      // Kalau belum pernah dinilai, kita INSERT data baru
      const { error } = await supabaseAdmin
        .from('ojt_grades')
        .insert([gradeData])

      if (error) throw error
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// 5.b FUNGSI HAPUS / RESET NILAI OJT (BATALKAN PENILAIAN / UNDO)
export async function deleteOJTGrades(userId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('ojt_grades')
      .delete()
      .eq('user_id', userId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// 6. MESIN CETAK SERTIFIKAT PDF
export async function generateCertificatePDF(studentId: string) {
  try {
    // 1. Ambil data anak OJT dari Database
    const { data: student } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', studentId)
      .single()

    if (!student) throw new Error("Data anak OJT tidak ditemukan!")

    // 2. Baca file template PDF dari folder public (Pakai fs biar 100% aman di server)
    const pdfPath = path.join(process.cwd(), 'public', 'template-sertifikat-mdu.pdf')
    const existingPdfBytes = fs.readFileSync(pdfPath)

    // 3. Load PDF ke mesin pdf-lib
    const pdfDoc = await PDFDocument.load(existingPdfBytes)

    // Siapkan font bawaan biar teksnya rapi
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const pages = pdfDoc.getPages()
    const firstPage = pages[0] // Halaman 1 (Depan)
    const secondPage = pages[1] // Halaman 2 (Belakang/Nilai)

    // ==========================================
    // SUNTIK DATA HALAMAN 1 (Sertifikat Depan)
    // ==========================================

    // Nama (Berdasarkan kotak tinggi 40, size 28-30 itu pas banget)
    firstPage.drawText(student.name.toUpperCase(), {
      x: 138,
      y: 460,
      size: 28,
      font: fontBold,
      color: rgb(0.12, 0.11, 0.29), // Warna biru gelap elegan ala MDU (#1e1b4b)
    })

    // Divisi
    firstPage.drawText(student.divisi.toUpperCase(), {
      x: 255,
      y: 372,
      size: 20,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2), // Abu-abu gelap
    })

    // ==========================================
    // SUNTIK DATA HALAMAN 2 (Tabel Nilai)
    // ==========================================

    // Nama (Berdasarkan kotak tinggi 14, size 11-12 ideal)
    secondPage.drawText(student.name, {
      x: 316,
      y: 682,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // Sekolah
    secondPage.drawText(student.asal_sekolah || '-', {
      x: 319,
      y: 654,
      size: 11,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    // Posisi / Divisi
    secondPage.drawText(student.divisi || '-', {
      x: 316,
      y: 612,
      size: 11,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    // 4. Bungkus jadi file PDF baru
    const pdfBytes = await pdfDoc.save()

    // Ubah jadi format Base64 biar bisa langsung di-download otomatis sama browser
    const base64 = Buffer.from(pdfBytes).toString('base64')

    // Nama file otomatis rapi pakai nama anak
    const cleanName = student.name.replace(/[^a-zA-Z0-9]/g, '_')
    return { success: true, pdfBase64: base64, fileName: `Sertifikat_OJT_${cleanName}.pdf` }

  } catch (error: any) {
    console.error("Error Cetak PDF:", error)
    return { success: false, message: error.message }
  }
}

// 7. FUNGSI MENTOR SUBMIT / EDIT ABSENSI KHUSUS (TUGAS LUAR / EVENT + SURAT TUGAS)
export async function mentorSubmitSpecialAttendance(payload: {
  menteeId: string,
  tanggal: string, // Format YYYY-MM-DD
  checkInTime: string, // ISO string
  checkOutTime?: string, // ISO string (opsional)
  status: string, // "Tugas Luar / Visit", "Event", "Hadir", dll.
  keterangan?: string,
  buktiLink?: string
}) {
  try {
    const { menteeId, tanggal, checkInTime, checkOutTime, status, keterangan, buktiLink } = payload

    // 1. Cek apakah sudah ada record attendance pada tanggal ini
    const { data: existingAttendance } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('user_id', menteeId)
      .gte('check_in_time', `${tanggal}T00:00:00`)
      .lte('check_in_time', `${tanggal}T23:59:59`)
      .maybeSingle()

    if (existingAttendance) {
      // Update data presensi
      const { error: updateError } = await supabaseAdmin
        .from('attendance')
        .update({
          check_in_time: checkInTime,
          check_out_time: checkOutTime || null,
          status: status,
          latitude: 0,
          longitude: 0,
          lat_out: 0,
          lng_out: 0
        })
        .eq('id', existingAttendance.id)

      if (updateError) throw updateError
    } else {
      // Insert baru ke attendance
      const { error: insertError } = await supabaseAdmin
        .from('attendance')
        .insert([{
          user_id: menteeId,
          check_in_time: checkInTime,
          check_out_time: checkOutTime || null,
          status: status,
          latitude: 0,
          longitude: 0,
          lat_out: 0,
          lng_out: 0
        }])

      if (insertError) throw insertError
    }

    // 2. Simpan atau sinkronkan Surat Tugas / Bukti ke tabel izin_ojt
    if (buktiLink || keterangan || status.includes('Tugas') || status.includes('Event')) {
      const { data: existingIzin } = await supabaseAdmin
        .from('izin_ojt')
        .select('id, bukti_link')
        .eq('user_id', menteeId)
        .eq('tanggal_izin', tanggal)
        .maybeSingle()

      if (existingIzin) {
        const { error: izinUpdateErr } = await supabaseAdmin
          .from('izin_ojt')
          .update({
            kategori: status,
            keterangan: keterangan || 'Penugasan khusus / Tugas Luar oleh Mentor',
            bukti_link: buktiLink || existingIzin.bukti_link,
            status: 'Disetujui'
          })
          .eq('id', existingIzin.id)

        if (izinUpdateErr) throw izinUpdateErr
      } else {
        const { error: izinInsertErr } = await supabaseAdmin
          .from('izin_ojt')
          .insert([{
            user_id: menteeId,
            tanggal_izin: tanggal,
            kategori: status,
            keterangan: keterangan || 'Penugasan khusus / Tugas Luar oleh Mentor',
            bukti_link: buktiLink || null,
            status: 'Disetujui'
          }])

        if (izinInsertErr) throw izinInsertErr
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error submit special attendance:", error)
    return { success: false, message: error.message }
  }
}

// 8. FUNGSI PINDAH MENTOR (TRANSFER ANAK OJT KE MENTOR LAIN)
export async function transferOJTToMentor(ojtUserId: string, targetMentorId: string) {
  try {
    // Validasi mentor tujuan
    const { data: targetMentor, error: mentorErr } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .eq('id', targetMentorId)
      .eq('role', 'mentor')
      .single()

    if (mentorErr || !targetMentor) {
      throw new Error("Mentor tujuan tidak valid atau tidak ditemukan.")
    }

    // Update mentor_id pada anak OJT
    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ mentor_id: targetMentorId })
      .eq('id', ojtUserId)

    if (updateErr) throw updateErr

    return { success: true, targetMentorName: targetMentor.name }
  } catch (error: any) {
    console.error("Error transfer OJT:", error)
    return { success: false, message: error.message }
  }
}

// 9. FUNGSI TUKAR (SWAP) ANAK OJT ANTAR MENTOR
export async function swapOJTMentors(
  ojtId1: string,
  targetMentorIdForOjt1: string,
  ojtId2: string,
  targetMentorIdForOjt2: string
) {
  try {
    // Update anak OJT 1 ke mentor baru
    const { error: err1 } = await supabaseAdmin
      .from('users')
      .update({ mentor_id: targetMentorIdForOjt1 })
      .eq('id', ojtId1)

    if (err1) throw err1

    // Update anak OJT 2 ke mentor baru
    const { error: err2 } = await supabaseAdmin
      .from('users')
      .update({ mentor_id: targetMentorIdForOjt2 })
      .eq('id', ojtId2)

    if (err2) throw err2

    return { success: true }
  } catch (error: any) {
    console.error("Error swap OJT mentors:", error)
    return { success: false, message: error.message }
  }
}

// 10. FUNGSI AMBIL DAFTAR MENTOR REKANAN BESERTA ANAK OJT AKTIFNYA
export async function getOtherMentorsWithMentees(currentMentorId: string) {
  try {
    // Ambil semua mentor selain yang sedang login
    const { data: mentors, error: mentorsErr } = await supabaseAdmin
      .from('users')
      .select('id, name, email, divisi')
      .eq('role', 'mentor')
      .neq('id', currentMentorId)
      .order('name', { ascending: true })

    if (mentorsErr) throw mentorsErr

    // Ambil semua anak OJT aktif milik mentor-mentor tersebut
    const mentorIds = (mentors || []).map(m => m.id)
    let menteesByMentor: { [mentorId: string]: any[] } = {}

    if (mentorIds.length > 0) {
      const { data: mentees, error: menteesErr } = await supabaseAdmin
        .from('users')
        .select('id, name, nip, divisi, mentor_id, asal_sekolah')
        .eq('role', 'ojt')
        .eq('status_ojt', 'aktif')
        .in('mentor_id', mentorIds)
        .order('name', { ascending: true })

      if (menteesErr) throw menteesErr;

      const menteeList = mentees || []
      menteeList.forEach(m => {
        if (!menteesByMentor[m.mentor_id]) menteesByMentor[m.mentor_id] = []
        menteesByMentor[m.mentor_id].push(m)
      })
    }

    const result = (mentors || []).map(m => ({
      ...m,
      mentees: menteesByMentor[m.id] || []
    }))

    return { success: true, mentors: result }
  } catch (error: any) {
    console.error("Error fetching other mentors:", error)
    return { success: false, message: error.message, mentors: [] }
  }
}

// 11. FUNGSI SINKRONISASI NOMOR SERTIFIKAT GLOBAL (SELURUH MENTOR)
export async function getGlobalLatestCertificate() {
  try {
    // Ambil seluruh nomor sertifikat yang ada di tabel ojt_grades tanpa filter mentor
    const { data, error } = await supabaseAdmin
      .from('ojt_grades')
      .select('no_sertifikat, created_at')
      .not('no_sertifikat', 'is', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    const certList = (data || [])
      .map(d => d.no_sertifikat)
      .filter((c): c is string => Boolean(c && typeof c === 'string' && c.trim() !== ''))

    let highestNum = 0
    let latestCert = ''

    for (const cert of certList) {
      const match = cert.match(/^(\d+)/) || cert.match(/(\d+)/)
      if (match) {
        const val = parseInt(match[1], 10)
        if (val > highestNum) {
          highestNum = val
          latestCert = cert
        }
      }
    }

    // Bulan romawi saat ini dan tahun saat ini
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
    const now = new Date()
    const currentRomanMonth = romanMonths[now.getMonth()]
    const currentYear = now.getFullYear()

    let nextCert = ''
    if (highestNum > 0) {
      const nextNum = highestNum + 1
      nextCert = `${nextNum}/MDU/${currentRomanMonth}/${currentYear}`
    } else {
      nextCert = `001/MDU/${currentRomanMonth}/${currentYear}`
    }

    return {
      success: true,
      latestCert,
      nextCert,
      highestNum
    }
  } catch (error: any) {
    console.error("Error getGlobalLatestCertificate:", error)
    return { success: false, message: error.message, latestCert: '', nextCert: '', highestNum: 0 }
  }
}