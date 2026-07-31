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
    <div className={`min-h-screen flex flex-col md:flex-row bg-white ${inter.className}`}>
      {/* KIRI: BRANDING (Hanya tampil di Desktop) */}
      <div className="hidden md:flex md:w-1/2 relative bg-gradient-to-br from-slate-900 via-[#1e1b4b] to-indigo-900 overflow-hidden items-center justify-center">
        {/* Dekorasi Abstract CSS (Tanpa Gambar External) */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/30 rounded-full blur-[100px]"></div>
          <div className="absolute top-1/2 -right-20 w-80 h-80 bg-indigo-500/30 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-32 left-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]"></div>
        </div>

        {/* Konten Kiri */}
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <div className="w-32 h-32 relative mb-8 p-4 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 shadow-2xl">
            <Image src="/logo-mdu.PNG" alt="MDU Logo" fill sizes="128px" className="object-contain drop-shadow-xl p-2" priority />
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
            Mandiri Digital<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Universe</span>
          </h1>
          <p className="text-indigo-200/80 text-lg font-medium max-w-sm">
            Tumbuh Bersama, Sukses Bersama. Melangkah pasti menuju masa depan digital.
          </p>
        </div>
      </div>

      {/* KANAN: FORM LOGIN */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-slate-50 md:bg-white relative">
        {/* Dekorasi Mobile: Hanya terlihat di mobile sebagai background atas */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#1e1b4b] to-slate-50 md:hidden -z-10"></div>
        
        <div className="w-full max-w-[380px] bg-white rounded-3xl p-8 md:p-10 shadow-2xl shadow-indigo-900/5 md:shadow-none md:border-none border border-slate-100 z-10 relative">
          
          {/* Logo untuk Mobile */}
          <div className="flex md:hidden justify-center mb-6">
            <div className="w-20 h-20 relative bg-white rounded-2xl shadow-sm border border-slate-50 p-2">
              <Image src="/logo-mdu.PNG" alt="MDU Logo" fill sizes="80px" className="object-contain" priority />
            </div>
          </div>

          <div className="text-center md:text-left mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
              {isForgotPassword ? 'Reset Password' : 'MDU Portal'}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {isForgotPassword
                ? 'Masukkan email untuk me-reset password'
                : 'Silakan masuk menggunakan NIP atau Email'}
            </p>
          </div>

          {errorMsg && <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold text-center animate-fade-in">{errorMsg}</div>}
          {successMsg && <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-bold text-center animate-fade-in">{successMsg}</div>}

          <form onSubmit={isForgotPassword ? handleResetPassword : handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">NIP / Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <input
                  type="text"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600 focus:bg-white transition-all text-slate-900 placeholder-slate-400 font-medium shadow-sm"
                  placeholder="Masukkan NIP atau Email"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600 focus:bg-white transition-all text-slate-900 placeholder-slate-400 font-medium shadow-sm"
                    placeholder="Masukkan Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-600 transition-colors">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {showPassword ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1 pb-2">
              <button type="button" onClick={() => { setIsForgotPassword(!isForgotPassword); setErrorMsg(''); setSuccessMsg(''); }} className="text-xs text-slate-500 hover:text-indigo-600 font-bold transition-colors">
                {isForgotPassword ? 'Kembali ke Login' : 'Lupa password?'}
              </button>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 text-sm">
              {loading ? 'Memproses...' : isForgotPassword ? 'Kirim Link Reset' : 'Masuk Portal'}
            </button>
          </form>

          {!isForgotPassword && (
            <>
              <div className="mt-8 mb-6 flex items-center justify-center space-x-4 opacity-70">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Akses Alternatif</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>
              <div className="flex gap-3">
                <button onClick={showMaintenanceAlert} className="flex-1 py-3 px-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 flex justify-center transition-all shadow-sm group">
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                </button>
                <button onClick={showMaintenanceAlert} className="flex-1 py-3 px-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 flex justify-center transition-all shadow-sm group">
                  <svg className="w-5 h-5 text-[#1877F2] group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}