'use server'

import { createClient } from '@supabase/supabase-js'

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
export async function updateOJTProfile(userId: string, updateData: any) {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        name: updateData.name,
        nip: updateData.nip,
        asal_sekolah: updateData.asal_sekolah,
        no_telp: updateData.no_telp,
        divisi: updateData.divisi,
        asal_kantor: updateData.asal_kantor,
        start_period: updateData.start_period || null,
        end_period: updateData.end_period || null,
      })
      .eq('id', userId)

    if (error) throw error
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