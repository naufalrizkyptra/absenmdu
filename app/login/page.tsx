'use client'

import { useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import Swal from 'sweetalert2'

const inter = Inter({ subsets: ['latin'] })

export default function Login() {
  const [loginId, setLoginId] = useState('') // Bisa email, bisa NIP
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    // Trik Ninja: Kalau gak ada '@', anggep itu NIP anak OJT
    let finalEmail = loginId
    if (!loginId.includes('@')) {
      finalEmail = `${loginId}@ojt.mdu.com`
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: finalEmail,
      password,
    })

    if (authError) {
      setErrorMsg("NIP/Email atau password salah nih. Coba cek lagi!")
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profile?.role === 'mentor') router.push('/mentor')
    else if (profile?.role === 'admin') router.push('/admin')
    else router.push('/ojt')
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    // JEGAT ANAK OJT: Kalau dia ngetik NIP (gak ada '@')
    if (!loginId.includes('@')) {
      alert("⚠️ KHUSUS OJT: Silakan hubungi Mentor lu untuk meminta perubahan / reset password akun.")
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    const { error } = await supabase.auth.resetPasswordForEmail(loginId, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) setErrorMsg("Gagal ngirim link: " + error.message)
    else {
      setSuccessMsg("Link reset password udah dikirim ke email lu!")
      setIsForgotPassword(false)
      setPassword('')
    }
    setLoading(false)
  }

  const showMaintenanceAlert = (e: React.MouseEvent) => {
    e.preventDefault()
    Swal.fire({
      title: 'Under Maintenance 🚧',
      text: 'Fitur login ini belum tersedia.',
      icon: 'info',
      confirmButtonColor: '#1e1b4b',
      confirmButtonText: 'Oke'
    })
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-[#f4f7fc] p-4 md:p-8 ${inter.className}`}>
      
      {/* Wrapper for the card to add a custom gradient shadow */}
      <div className="relative w-full max-w-[1000px]">
        {/* Glowing Gradient Shadow (MDU Colors: Blue, Cyan, Yellow/Gold) */}
        <div className="absolute -inset-2 md:-inset-3 bg-gradient-to-r from-indigo-900 via-purple-800 to-black rounded-[2.5rem] blur-2xl opacity-40"></div>
        
        {/* Main Card */}
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-3 md:p-4 flex flex-col md:flex-row overflow-hidden relative min-h-[500px] md:min-h-[600px] z-10 border border-white/50">
          
          {/* KIRI: BRANDING (Hidden on mobile) */}
          <div className="hidden md:flex md:w-[45%] lg:w-1/2 relative bg-blue-900 rounded-[2rem] overflow-hidden flex-col justify-end p-10 lg:p-12">
            {/* Mesh Gradient Background (MDU Colors) */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-800 to-black opacity-90"></div>
            {/* Blurred color blobs */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-700 rounded-full mix-blend-screen filter blur-[80px] opacity-50"></div>
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-indigo-600 rounded-full mix-blend-screen filter blur-[90px] opacity-30"></div>
            <div className="absolute -bottom-10 left-10 w-96 h-96 bg-indigo-500 rounded-full mix-blend-screen filter blur-[90px] opacity-60"></div>

            <div className="relative z-10 text-white">
              {/* Logo MDU (Original Color, Larger) */}
              <div className="w-20 h-20 relative drop-shadow-2xl mb-6 bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/20">
                <Image src="/logo-mdu.PNG" alt="MDU Logo" fill sizes="80px" className="object-contain p-1" priority />
              </div>
              
              <p className="text-sm font-semibold text-white/90 mb-2 tracking-wide uppercase drop-shadow-md">Mandiri Digital Universe</p>
              <h1 className="text-3xl lg:text-4xl font-bold leading-[1.15] mb-4 tracking-tight drop-shadow-md">
                Tumbuh Bersama,<br/>Sukses Bersama.
              </h1>
              <p className="text-sm text-white/80 max-w-sm leading-relaxed font-medium">
                Dapatkan akses ke personal hub Anda untuk memantau kehadiran, progres tugas, dan evaluasi dalam satu platform yang terintegrasi.
              </p>
            </div>
          </div>

          {/* KANAN: FORM LOGIN */}
          <div className="w-full md:w-[55%] lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-white relative rounded-3xl md:rounded-none">

          
          <div className="w-full max-w-[360px]">
            
            {/* Logo form area */}
            <div className="w-10 h-10 mb-6 relative">
              <Image src="/logo-mdu.PNG" alt="MDU Logo" fill sizes="40px" className="object-contain" priority />
            </div>

            <div className="mb-8">
              <h2 className="text-[28px] font-extrabold text-slate-900 tracking-tight mb-2">
                {isForgotPassword ? 'Reset password' : 'MDU Portal'}
              </h2>
              <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                {isForgotPassword
                  ? 'Masukkan email untuk mengatur ulang kata sandi Anda.'
                  : 'Akses portal OJT dan Mentor. Kelola aktivitas Anda kapan saja dan di mana saja.'}
              </p>
            </div>

            {errorMsg && <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold text-center animate-fade-in">{errorMsg}</div>}
            {successMsg && <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-bold text-center animate-fade-in">{successMsg}</div>}

            <form onSubmit={isForgotPassword ? handleResetPassword : handleLogin} className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-slate-900 mb-1.5">NIP / Email</label>
                <input
                  type="text"
                  className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-900 placeholder-slate-400 font-medium shadow-sm"
                  placeholder="Masukkan NIP atau Email"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                />
              </div>

              {!isForgotPassword && (
                <div>
                  <label className="block text-[13px] font-bold text-slate-900 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-900 placeholder-slate-400 font-medium shadow-sm"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {showPassword ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button type="submit" disabled={loading} className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_8px_25px_rgba(79,70,229,0.4)] hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 text-[13px] tracking-wide">
                  {loading ? 'Memproses...' : isForgotPassword ? 'Kirim Link Reset' : 'Access Portal'}
                </button>
              </div>
            </form>

            {!isForgotPassword && (
              <>
                <div className="mt-8 mb-6 flex items-center justify-center space-x-3 opacity-60">
                  <div className="h-[1px] bg-slate-300 flex-1"></div>
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">atau masuk dengan</span>
                  <div className="h-[1px] bg-slate-300 flex-1"></div>
                </div>
                
                <div className="flex gap-3">
                  <button onClick={showMaintenanceAlert} className="flex-1 py-2.5 px-4 bg-slate-100 rounded-xl hover:bg-slate-200 flex justify-center transition-colors items-center gap-2 group">
                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                  </button>
                  <button onClick={showMaintenanceAlert} className="flex-1 py-2.5 px-4 bg-slate-100 rounded-xl hover:bg-slate-200 flex justify-center transition-colors items-center gap-2 group">
                    <svg className="w-4 h-4 text-[#1877F2] group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  </button>
                </div>
              </>
            )}

            <div className="mt-10 text-center">
              <p className="text-[13px] text-slate-500 font-medium">
                Butuh bantuan akses?{' '}
                <button type="button" onClick={() => { setIsForgotPassword(!isForgotPassword); setErrorMsg(''); setSuccessMsg(''); }} className="text-[#4f46e5] hover:text-[#4338ca] font-bold hover:underline transition-all">
                  {isForgotPassword ? 'Kembali ke Login' : 'Reset Password'}
                </button>
              </p>
            </div>

          </div>
        </div>

        </div>
      </div>
    </div>
  )
}