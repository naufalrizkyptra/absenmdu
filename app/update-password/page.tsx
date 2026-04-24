'use client'

import { useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Inter } from 'next/font/google'
import Image from 'next/image'

const inter = Inter({ subsets: ['latin'] })

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    if (password !== confirmPassword) {
      setErrorMsg("Password dan konfirmasi tidak cocok!")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setErrorMsg("Password minimal 6 karakter euy!")
      setLoading(false)
      return
    }

    // 1. Update Password di Auth Supabase
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
      setErrorMsg("Gagal menyimpan password: " + updateError.message)
      setLoading(false)
      return
    }

    // 2. Jika sukses, ambil data role user untuk penentuan Redirect
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      setSuccessMsg("Password berhasil diubah! Mengarahkan ke Dashboard...")
      
      // 3. Redirect sesuai role masing-masing setelah delay 2 detik
      setTimeout(() => {
        if (profile?.role === 'admin') {
          router.push('/admin')
        } else if (profile?.role === 'mentor') {
          router.push('/mentor')
        } else {
          router.push('/') // Dashboard OJT
        }
      }, 2000)
    } else {
      // Fallback jika user session tidak ditemukan
      router.push('/login')
    }
  }

  return (
    <div className={`min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-900 ${inter.className}`}>
      
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 to-slate-900/90 z-0" />

      <div className="relative z-10 w-full max-w-[370px] bg-white/95 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl border border-white/20">
        
        <div className="flex justify-center mb-5">
          <div className="w-20 h-20 relative">
            <Image 
              src="/logo-mdu.PNG" 
              alt="MDU Logo" 
              fill 
              className="object-contain drop-shadow-sm"
              priority
            />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-900 mb-1.5 tracking-tight">Buat Password Baru</h1>
          <p className="text-[13px] text-slate-500 leading-relaxed px-2">
            Masukkan password baru lu untuk mengamankan kembali akun MDU Portal.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold text-center">
            {errorMsg}
          </div>
        )}
        
        {successMsg ? (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-sm font-semibold text-center flex flex-col items-center gap-2">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-900 placeholder-slate-400"
                placeholder="Password Baru"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-900 placeholder-slate-400"
                placeholder="Ulangi Password Baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </button>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#0f172a] hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all shadow-md disabled:opacity-70 text-sm mt-2"
            >
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}