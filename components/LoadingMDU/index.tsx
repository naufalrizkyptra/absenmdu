'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'

interface LoadingMDUProps {
  message?: string
  backgroundColor?: 'light' | 'dark' | 'gradient'
  logoSize?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
  minDuration?: number // Custom minimum duration in ms (default: 2000)
}

export function LoadingMDU({
  message = 'Memulai aplikasi...',
  backgroundColor = 'light',
  logoSize = 'md',
  showText = true,
  className = '',
  minDuration = 2000, // Default 2 seconds minimum
}: LoadingMDUProps) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Force loading minimal selama minDuration ms
    const timer = setTimeout(() => {
      setIsReady(true)
    }, minDuration)
    
    return () => clearTimeout(timer)
  }, [])

  // Jika belum ready, tampilkan loader dengan delay yang ditentukan
  if (!isReady) {
    // Background colors based on theme
    const getBackgroundClass = () => {
      switch (backgroundColor) {
        case 'dark':
          return 'bg-[#1e1b4b]'
        case 'gradient':
          return 'bg-gradient-to-br from-indigo-900 via-purple-800 to-black'
        default:
          return 'bg-[#f8faff]'
      }
    }

    // Logo size variants
    const getLogoSize = () => {
      switch (logoSize) {
        case 'sm':
          return 'w-24 h-24'
        case 'lg':
          return 'w-40 h-40'
        default:
          return 'w-32 h-32'
      }
    }

    return (
      <div 
        className={`min-h-screen flex items-center justify-center ${getBackgroundClass()}`}
        style={{
          backgroundImage: backgroundColor === 'gradient' 
            ? 'linear-gradient(135deg, #1e1b4b 0%, #581c87 50%, #000000 100%)'
            : undefined
        }}
      >
        {/* Main Container */}
        <div className="relative flex flex-col items-center gap-6">
          
          {/* Logo Animation - Berputar seperti loading ring */}
          <div className={`relative ${getLogoSize()}`}>
            {/* Outer Glow Shadow */}
            <div className="absolute inset-0 rounded-full animate-pulse-glow-ring" />
            
            {/* Rotating Logo Ring */}
            <div className="relative z-10 w-full h-full rounded-full overflow-hidden shadow-2xl
              bg-gradient-to-br from-white/95 via-indigo-50/90 to-white/95
              backdrop-blur-xl border-4 border-white/50">
              
              {/* Inner gradient overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-400/10 to-purple-400/10" />
              
              {/* MDU Logo Circular Animation */}
              <Image
                src="/logo-mdu.PNG"
                alt="MDU Logo"
                fill
                sizes={logoSize === 'sm' ? '96px' : logoSize === 'lg' ? '160px' : '128px'}
                className="animate-spin-logo object-contain p-4"
                priority
                style={{
                  filter: 'drop-shadow(0 4px 16px rgba(79, 70, 229, 0.3))'
                }}
              />
            </div>
            
            {/* Ripple Effect Rings */}
            <div className="absolute inset-0 -m-6 rounded-full pointer-events-none">
              <div className="animate-multi-ring-1 absolute inset-0 border-2 border-indigo-400/20 rounded-full" />
              <div className="animate-multi-ring-2 absolute inset-0 border-2 border-indigo-400/15 rounded-full" />
              <div className="animate-multi-ring-3 absolute inset-0 border-2 border-indigo-400/10 rounded-full" />
            </div>
          </div>

          {/* Message Text */}
          {showText && (
            <p 
              className="text-sm font-semibold text-slate-600 dark:text-slate-300 relative z-10
                tracking-wide animate-fade-text"
            >
              {message}
            </p>
          )}

          {/* Loader Dots */}
          <div className="flex gap-2 mt-2 animate-stagger-in">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>

        </div>
      </div>
    )
  }

  // Setelah minDuration, jangan tampilkan apa-apa (loader selesai)
  return null
}

export default LoadingMDU
