'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export function InstallPWA() {
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [activeTab, setActiveTab] = useState<'ios' | 'android'>('android')

  useEffect(() => {
    // 1. Cek apakah sudah running sebagai PWA (Standalone / Di homescreen)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')

      setIsStandalone(Boolean(isStandaloneMode))
      return Boolean(isStandaloneMode)
    }

    const runningStandalone = checkStandalone()

    // 2. Deteksi device OS
    const ua = navigator.userAgent || ''
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    const isAndroidDevice = /Android/.test(ua)

    setIsIOS(isIosDevice)
    setIsAndroid(isAndroidDevice)
    if (isIosDevice) {
      setActiveTab('ios')
    } else {
      setActiveTab('android')
    }

    // 3. Daftarkan Service Worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('PWA: Service Worker registration failed', err))
    }

    // 4. Tangkap event beforeinstallprompt (Khusus browser Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // 5. Listener untuk event manual (misal diklik dari menu dashboard)
    const handleOpenTutorial = () => {
      setShowModal(true)
    }
    window.addEventListener('open-pwa-tutorial', handleOpenTutorial)

    // 6. Cek apakah banner pernah di-dismiss user
    const isDismissed = localStorage.getItem('mdu_pwa_banner_dismissed')
    if (!runningStandalone && !isDismissed && (isIosDevice || isAndroidDevice)) {
      // Munculkan banner setelah 2 detik
      const timer = setTimeout(() => {
        setShowBanner(true)
      }, 2000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.removeEventListener('open-pwa-tutorial', handleOpenTutorial)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('open-pwa-tutorial', handleOpenTutorial)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setShowBanner(false)
        setShowModal(false)
      }
    } else {
      // Jika browser tidak support prompt native (misal iOS Safari), buka tutorial
      setShowModal(true)
    }
  }

  const dismissBanner = () => {
    setShowBanner(false)
    localStorage.setItem('mdu_pwa_banner_dismissed', 'true')
  }

  // Jika sudah terpasang sebagai aplikasi standalone, sembunyikan banner & modal otomatis
  if (isStandalone && !showModal) {
    return null
  }

  return (
    <>
      {/* ============================================================== */}
      {/* 1. SMART FLOATING BANNER (Khusus Mobile Saat Dibuka di Browser) */}
      {/* ============================================================== */}
      {showBanner && !showModal && (
        <aside
          role="region"
          aria-label="Promosi PWA"
          className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-bounce-subtle"
        >
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-3.5 rounded-2xl shadow-2xl border border-indigo-500/30 backdrop-blur-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/10 p-1.5 flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
                <Image
                  src="/icon-192.png"
                  alt="MDU Logo"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain drop-shadow"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold bg-blue-500 text-white px-1.5 py-0.5 rounded">
                    Aplikasi HP
                  </span>
                  <span className="text-xs font-bold text-white truncate">MDU Portal</span>
                </div>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">
                  Pasang ke layar HP agar absen & tugas lebih cepat!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowModal(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
              >
                Pasang
              </button>
              <button
                onClick={dismissBanner}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Tutup"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ============================================================== */}
      {/* 2. MODAL TUTORIAL LENGKAP ADD TO HOME SCREEN                    */}
      {/* ============================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="relative bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 p-6 text-white text-center shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="w-20 h-20 mx-auto rounded-2xl bg-white p-2.5 shadow-xl ring-4 ring-white/20 mb-3 flex items-center justify-center">
                <Image
                  src="/icon-192.png"
                  alt="MDU Logo"
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                />
              </div>

              <h2 className="text-xl font-black tracking-tight">Pasang ke Layar HP</h2>
              <p className="text-xs text-blue-200 mt-1 max-w-xs mx-auto">
                Buka MDU Portal langsung dari Homescreen seperti aplikasi Play Store / App Store
              </p>
            </div>

            {/* Device Switcher Tab */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1.5 shrink-0">
              <button
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'android'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-1.0001 0-.5515.4482-.9997.9993-.9997.5516 0 .9997.4482.9997.9997 0 .5515-.4481 1.0001-.9997 1.0001m-11.046 0c-.5511 0-.9993-.4486-.9993-1.0001 0-.5515.4482-.9997.9993-.9997.5516 0 .9997.4482.9997.9997 0 .5515-.4481 1.0001-.9997 1.0001m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8.125 12 8.125s-3.5902.2866-5.1368.8297L4.8409 5.4517a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.775h24c-.3432-4.1161-2.6889-7.5883-6.1185-9.4536" />
                </svg>
                <span>Android (Chrome)</span>
              </button>

              <button
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'ios'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.84.94-2.91-.91.04-2.02.61-2.67 1.38-.57.66-.99 1.74-.86 2.8 1.02.08 2.06-.51 2.59-1.27z" />
                </svg>
                <span>iPhone (iOS Safari)</span>
              </button>
            </div>

            {/* Konten Petunjuk */}
            <div className="p-5 overflow-y-auto space-y-4 text-slate-700 dark:text-slate-200 flex-1">
              
              {/* TOMBOL INSTAL 1-KLIK (JIKA BROWSER MENDUKUNG NATIVE PROMPT) */}
              {activeTab === 'android' && deferredPrompt && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 text-center space-y-2">
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Browser kamu mendukung pemasangan otomatis!
                  </p>
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Install Aplikasi Sekarang (1-Klik)</span>
                  </button>
                </div>
              )}

              {/* LANGKAH-LANGKAH ANDROID CHROME */}
              {activeTab === 'android' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                      1
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Buka Menu Chrome (Titik Tiga)
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ketuk icon titik tiga <strong className="font-bold text-slate-800 dark:text-slate-200">⋮</strong> di pojok kanan atas browser Google Chrome.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                      2
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Pilih &quot;Tambahkan ke Layar Utama&quot;
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Cari dan ketuk menu <strong className="font-bold text-slate-800 dark:text-slate-200">&quot;Install aplikasi&quot;</strong> atau <strong className="font-bold text-slate-800 dark:text-slate-200">&quot;Tambahkan ke Layar utama&quot;</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Konfirmasi &quot;Install&quot;
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Tekan tombol <strong className="font-bold text-emerald-600 dark:text-emerald-400">Install</strong>. Aplikasi MDU Portal dengan logo resmi akan muncul di beranda HP kamu!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* LANGKAH-LANGKAH IOS SAFARI */}
              {activeTab === 'ios' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl">
                    <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                      ⚠️ <strong>Penting:</strong> Pastikan kamu membuka website ini menggunakan browser <strong>Safari</strong> bawaan iPhone/iPad.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                      1
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Ketuk Tombol Share (Bagikan)
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>Tekan icon Bagikan</span>
                        <span className="inline-flex items-center justify-center p-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </span>
                        <span>atau icon kotak panah ke atas</span>
                        <span className="inline-flex items-center justify-center p-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </span>
                        <span>di bilah menu Safari bawah.</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                      2
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Pilih &quot;Add to Home Screen&quot;
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>Gulir ke bawah pada lembar opsi, lalu ketuk</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Tambahkan ke Layar Utama
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-sm">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Tekan &quot;Tambah&quot; (Add) di Kanan Atas
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ketuk <strong className="text-emerald-600 dark:text-emerald-400 font-bold">Tambah / Add</strong> di pojok kanan atas. MDU Portal siap digunakan sebagai aplikasi layar penuh tanpa bilah URL browser!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* KEUNTUNGAN PWA */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Kenapa memasang aplikasi ini?
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Layar penuh (No URL bar)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Akses 1-ketuk dari HP</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Loading lebih enteng</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Hemat kuota & memori</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-center shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs rounded-xl transition-all shadow-sm"
              >
                Saya Mengerti, Tutup
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}

export default InstallPWA
