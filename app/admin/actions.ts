'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 1. DAFTARKAN AKUN MENTOR BARU
export async function createMentorAccount(formData: {
  name: string
  email: string
  nip?: string
  password?: string
  divisi?: string
  asal_kantor?: string
  no_telp?: string
  start_period?: string
  end_period?: string
}) {
  try {
    const rawEmail = (formData.email || '').trim().toLowerCase()
    if (!rawEmail || !rawEmail.includes('@')) {
      throw new Error('Alamat email mentor harus valid dan menyertakan karakter @')
    }

    const defaultPassword = formData.password && formData.password.trim().length >= 6
      ? formData.password.trim()
      : 'mentormdu2026!'

    // 1. Buat user di Auth Supabase
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: rawEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        name: formData.name,
        role: 'mentor'
      }
    })

    if (authError) throw authError
    if (!authUser?.user) throw new Error('Gagal menginisialisasi akun auth mentor')

    // 2. Simpan profil mentor di tabel users
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authUser.user.id,
        email: rawEmail,
        nip: formData.nip ? formData.nip.trim() : null,
        name: formData.name.trim(),
        role: 'mentor',
        status: 'aktif',
        divisi: formData.divisi || 'Multimedia',
        asal_kantor: formData.asal_kantor || 'Jatiwaringin',
        no_telp: formData.no_telp || null,
        start_period: formData.start_period || null,
        end_period: formData.end_period || null
      }])

    if (profileError) {
      // Rollback auth user jika insert profile gagal
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw profileError
    }

    return { success: true, message: 'Akun mentor berhasil dibuat.' }
  } catch (error: any) {
    console.error('Error createMentorAccount:', error)
    return { success: false, message: error.message || 'Gagal mendaftarkan akun mentor.' }
  }
}

// 2. PERBARUI PROFIL MENTOR
export async function updateMentorProfile(
  mentorId: string,
  updateData: {
    name?: string
    nip?: string
    email?: string
    divisi?: string
    asal_kantor?: string
    no_telp?: string
    start_period?: string
    end_period?: string
    status?: string
  }
) {
  try {
    const updatePayload: Record<string, any> = {}
    if (updateData.name !== undefined) updatePayload.name = updateData.name.trim()
    if (updateData.nip !== undefined) updatePayload.nip = updateData.nip ? updateData.nip.trim() : null
    if (updateData.divisi !== undefined) updatePayload.divisi = updateData.divisi
    if (updateData.asal_kantor !== undefined) updatePayload.asal_kantor = updateData.asal_kantor
    if (updateData.no_telp !== undefined) updatePayload.no_telp = updateData.no_telp
    if (updateData.start_period !== undefined) updatePayload.start_period = updateData.start_period || null
    if (updateData.end_period !== undefined) updatePayload.end_period = updateData.end_period || null
    if (updateData.status !== undefined) updatePayload.status = updateData.status

    if (updateData.email && updateData.email.includes('@')) {
      const cleanEmail = updateData.email.trim().toLowerCase()
      updatePayload.email = cleanEmail

      // Update email di Auth Supabase
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(mentorId, {
        email: cleanEmail
      })
      if (authError) throw authError
    }

    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', mentorId)

    if (dbError) throw dbError

    return { success: true, message: 'Profil mentor berhasil diperbarui.' }
  } catch (error: any) {
    console.error('Error updateMentorProfile:', error)
    return { success: false, message: error.message || 'Gagal memperbarui profil mentor.' }
  }
}

// 3. RESET PASSWORD MENTOR OLEH ADMIN
export async function resetMentorPasswordByAdmin(mentorId: string, newPassword: string) {
  try {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password baru minimal harus 6 karakter')
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(mentorId, {
      password: newPassword
    })

    if (error) throw error
    return { success: true, message: 'Password mentor berhasil direset.' }
  } catch (error: any) {
    console.error('Error resetMentorPasswordByAdmin:', error)
    return { success: false, message: error.message || 'Gagal mereset password mentor.' }
  }
}

// 4. HAPUS AKUN MENTOR (DENGAN PROTEKSI ANAK OJT AKTIF)
export async function deleteMentorAccount(mentorId: string) {
  try {
    // 1. Cek apakah mentor masih memiliki anak OJT aktif
    const { data: activeMentees, error: checkErr } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .eq('mentor_id', mentorId)
      .eq('role', 'ojt')
      .neq('status_ojt', 'selesai')

    if (checkErr) throw checkErr

    if (activeMentees && activeMentees.length > 0) {
      return {
        success: false,
        message: `Tidak dapat menghapus mentor: Masih memiliki ${activeMentees.length} anak bimbingan OJT yang aktif. Silakan pindahkan anak bimbingan ke mentor lain terlebih dahulu.`
      }
    }

    // 2. Bersihkan nilai evaluasi mentor jika ada
    await supabaseAdmin.from('mentor_grades').delete().eq('mentor_id', mentorId)

    // 3. Hapus profil dari tabel users
    const { error: userErr } = await supabaseAdmin.from('users').delete().eq('id', mentorId)
    if (userErr) throw userErr

    // 4. Hapus dari Auth Supabase
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(mentorId)
    if (authErr) throw authErr

    return { success: true, message: 'Akun mentor berhasil dihapus secara permanen.' }
  } catch (error: any) {
    console.error('Error deleteMentorAccount:', error)
    return { success: false, message: error.message || 'Gagal menghapus akun mentor.' }
  }
}

// 5. ARSIPKAN STATUS MENTOR
export async function archiveMentorAccount(mentorId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ status: 'selesai' })
      .eq('id', mentorId)

    if (error) throw error
    return { success: true, message: 'Status mentor berhasil diarsipkan (selesai bimbingan).' }
  } catch (error: any) {
    console.error('Error archiveMentorAccount:', error)
    return { success: false, message: error.message || 'Gagal mengarsipkan status mentor.' }
  }
}

// 6. INPUT / UPDATE EVALUASI KINERJA & SERTIFIKAT MENTOR
export async function submitMentorEvaluation(gradeData: {
  mentor_id: string
  admin_id?: string
  no_sertifikat: string
  start_period?: string
  end_period?: string
  nilai_kepemimpinan: number
  nilai_kedisiplinan: number
  nilai_komunikasi: number
  nilai_teknis: number
  nilai_efektivitas: number
  predikat?: string
  catatan?: string
}) {
  try {
    if (!gradeData.mentor_id) throw new Error('ID Mentor diperlukan')

    // Hitung rata-rata jika predikat belum ditentukan
    const avg = Math.round(
      (Number(gradeData.nilai_kepemimpinan || 0) +
        Number(gradeData.nilai_kedisiplinan || 0) +
        Number(gradeData.nilai_komunikasi || 0) +
        Number(gradeData.nilai_teknis || 0) +
        Number(gradeData.nilai_efektivitas || 0)) /
        5
    )

    let finalPredikat = gradeData.predikat
    if (!finalPredikat) {
      if (avg >= 90) finalPredikat = 'Sangat Memuaskan'
      else if (avg >= 80) finalPredikat = 'Memuaskan'
      else if (avg >= 70) finalPredikat = 'Baik'
      else finalPredikat = 'Cukup'
    }

    const payload = {
      mentor_id: gradeData.mentor_id,
      admin_id: gradeData.admin_id || null,
      no_sertifikat: gradeData.no_sertifikat ? gradeData.no_sertifikat.trim() : null,
      start_period: gradeData.start_period || null,
      end_period: gradeData.end_period || null,
      nilai_kepemimpinan: Number(gradeData.nilai_kepemimpinan || 0),
      nilai_kedisiplinan: Number(gradeData.nilai_kedisiplinan || 0),
      nilai_komunikasi: Number(gradeData.nilai_komunikasi || 0),
      nilai_teknis: Number(gradeData.nilai_teknis || 0),
      nilai_efektivitas: Number(gradeData.nilai_efektivitas || 0),
      predikat: finalPredikat,
      catatan: gradeData.catatan ? gradeData.catatan.trim() : null,
      updated_at: new Date().toISOString()
    }

    // Cek apakah sudah ada evaluasi sebelumnya untuk mentor ini
    const { data: existing } = await supabaseAdmin
      .from('mentor_grades')
      .select('id')
      .eq('mentor_id', gradeData.mentor_id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabaseAdmin
        .from('mentor_grades')
        .update(payload)
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin.from('mentor_grades').insert([payload])
      if (error) throw error
    }

    // Sinkronkan periode bimbingan ke tabel users jika ada
    if (gradeData.start_period || gradeData.end_period) {
      await supabaseAdmin
        .from('users')
        .update({
          start_period: gradeData.start_period || null,
          end_period: gradeData.end_period || null
        })
        .eq('id', gradeData.mentor_id)
    }

    return { success: true, message: 'Evaluasi & sertifikat mentor berhasil disimpan.' }
  } catch (error: any) {
    console.error('Error submitMentorEvaluation:', error)
    return { success: false, message: error.message || 'Gagal menyimpan evaluasi mentor.' }
  }
}

// 7. BATALKAN / HAPUS EVALUASI & SERTIFIKAT MENTOR
export async function deleteMentorEvaluation(mentorId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('mentor_grades')
      .delete()
      .eq('mentor_id', mentorId)

    if (error) throw error
    return { success: true, message: 'Evaluasi & sertifikat mentor berhasil dibatalkan.' }
  } catch (error: any) {
    console.error('Error deleteMentorEvaluation:', error)
    return { success: false, message: error.message || 'Gagal membatalkan evaluasi mentor.' }
  }
}

// 8. AMBIL DATA SERTIFIKAT MENTOR
export async function getMentorCertificateData(mentorId: string) {
  try {
    const { data: mentor, error: mentorErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', mentorId)
      .single()

    if (mentorErr || !mentor) throw new Error('Data mentor tidak ditemukan')

    const { data: grades } = await supabaseAdmin
      .from('mentor_grades')
      .select('*')
      .eq('mentor_id', mentorId)
      .maybeSingle()

    return {
      success: true,
      data: {
        mentor,
        grades: grades || null
      }
    }
  } catch (error: any) {
    console.error('Error getMentorCertificateData:', error)
    return { success: false, message: error.message || 'Gagal memuat data sertifikat mentor.' }
  }
}
