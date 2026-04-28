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

// 4. FUNGSI HAPUS AKUN OJT PERMANEN
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

// 6. MESIN CETAK SERTIFIKAT PDF
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