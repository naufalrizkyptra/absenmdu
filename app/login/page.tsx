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
    <div className={`min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-900 ${inter.className}`}>
      <div className="absolute inset-0 z-0 bg-cover bg-center opacity-40" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop')" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 to-slate-900/90 z-0" />

      <div className="relative z-10 w-full max-w-[370px] bg-white/95 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl border border-white/20">
        
        <div className="flex justify-center mb-5">
          <div className="w-20 h-20 relative">
            <Image src="/logo-mdu.PNG" alt="MDU Logo" fill className="object-contain drop-shadow-sm" priority />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-900 mb-1.5 tracking-tight">
            {isForgotPassword ? 'Reset Password' : 'MDU Portal'}
          </h1>
          <p className="text-[13px] text-slate-500 leading-relaxed px-2">
            {isForgotPassword 
              ? 'Mentor: Masukkan Email | OJT: Hubungi Mentor' 
              : 'OJT gunakan NIP | Mentor gunakan Email'}
          </p>
        </div>

        {errorMsg && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold text-center">{errorMsg}</div>}
        {successMsg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-semibold text-center">{successMsg}</div>}

        <form onSubmit={isForgotPassword ? handleResetPassword : handleLogin} className="space-y-3.5">
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <input 
              type="text" 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-900 placeholder-slate-400"
              placeholder="NIP / Email"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required 
            />
          </div>

          {!isForgotPassword && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-900 placeholder-slate-400"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {showPassword ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                </svg>
              </button>
            </div>
          )}

          <div className="flex justify-end pt-0.5 pb-1">
            <button type="button" onClick={() => { setIsForgotPassword(!isForgotPassword); setErrorMsg(''); setSuccessMsg(''); }} className="text-[12px] text-slate-500 hover:text-blue-600 font-medium transition-colors">
              {isForgotPassword ? 'Kembali ke Login' : 'Forgot password?'}
            </button>
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-[#0f172a] hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all shadow-md disabled:opacity-70 text-sm">
            {loading ? 'Memproses...' : isForgotPassword ? 'Kirim Link Reset' : 'Access Portal'}
          </button>
        </form>

        {!isForgotPassword && (
          <>
            <div className="mt-6 mb-5 flex items-center justify-center space-x-3">
              <div className="h-px bg-slate-200 flex-1"></div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Or sign in with</span>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={showMaintenanceAlert} className="flex-1 py-2.5 px-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex justify-center transition-colors"><svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg></button>
              <button onClick={showMaintenanceAlert} className="flex-1 py-2.5 px-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex justify-center transition-colors"><svg className="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}