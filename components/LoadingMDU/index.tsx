'use client'

import { LogoLoader } from '../LogoLoader'
import { useState, useEffect } from 'react'

export interface LoadingMDUProps {
  message?: string
  backgroundColor?: 'light' | 'dark' | 'gradient' | 'blur'
  logoSize?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
  minDuration?: number
}

export function LoadingMDU({
  message = 'Memulai aplikasi...',
  backgroundColor = 'blur',
  logoSize = 'md',
  showText = true,
  className = '',
  minDuration = 0
}: LoadingMDUProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (minDuration > 0) {
      const timer = setTimeout(() => setIsVisible(false), minDuration)
      return () => clearTimeout(timer)
    }
  }, [minDuration])

  if (!isVisible) return null

  const sizeMap = {
    sm: 80,
    md: 120,
    lg: 160
  }

  // Pilih background sesuai prop. Default-nya 'blur' agar tidak hitam pekat.
  const bgMap = {
    light: 'bg-white/90 backdrop-blur-md',
    dark: 'bg-slate-900/90 backdrop-blur-md',
    gradient: 'bg-gradient-to-br from-indigo-900/90 via-purple-800/90 to-black/90 backdrop-blur-md',
    blur: 'bg-white/10 backdrop-blur-[16px]' // Efek glassmorphism bening
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${bgMap[backgroundColor]} ${className} transition-all duration-300`}>
      {/* Matikan overlay bawaan LogoLoader karena kita sudah membungkusnya dengan div ini */}
      <LogoLoader size={sizeMap[logoSize]} overlay={false} />
      
      {/* Berikan margin-top (mt-8) agar teks tidak mepet/tumpang tindih dengan logo */}
      {showText && message && (
        <p className={`mt-8 text-sm font-semibold px-6 py-2.5 rounded-2xl shadow-sm backdrop-blur-md border 
          ${backgroundColor === 'light' || backgroundColor === 'blur' 
            ? 'bg-white/60 text-slate-800 border-white/40' 
            : 'bg-black/30 text-white border-white/10'
          } animate-pulse`}>
          {message}
        </p>
      )}
    </div>
  )
}

export default LoadingMDU