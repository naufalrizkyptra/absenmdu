'use client'

import { useEffect, useRef } from 'react'

interface GradientStop {
  offset: string
  color: string
}

/** Gradasi diambil dari warna logo MDU (kiri bawah → kanan atas) */
const MDU_GRADIENT_STOPS: GradientStop[] = [
  { offset: '0%', color: '#F9C10C' }, // kuning
  { offset: '25%', color: '#E86920' }, // oranye
  { offset: '45%', color: '#DE312B' }, // merah
  { offset: '65%', color: '#B41F66' }, // magenta
  { offset: '85%', color: '#5E3395' }, // ungu
  { offset: '100%', color: '#6676C3' }, // biru
]

interface LogoLoaderProps {
  /** Ukuran logo dalam pixel (width = height). Default: 120 */
  size?: number
  /** ID unik untuk elemen linearGradient — wajib unik jika dipakai lebih dari 1 instance */
  gradientId?: string
  /** Stop warna gradient. Default: gradasi logo MDU (kuning → oranye → merah → magenta → ungu → biru) */
  stops?: GradientStop[]
  /** Durasi satu siklus animasi dash dalam detik. Default: 2 */
  duration?: number
  /** Panjang dash relatif terhadap total path length (0–1). Default: 0.25 */
  dashRatio?: number
  /** Tebal garis dalam satuan viewBox (439). 12 ≈ 3px di size 120. Default: 12 */
  strokeWidth?: number
  /**
   * Tampilkan sebagai overlay fullscreen: tanpa warna background,
   * hanya blur pada konten di belakangnya. Default: true
   */
  overlay?: boolean
  /** Kekuatan blur overlay dalam px. Default: 12 */
  blur?: number
  className?: string
}

/**
 * LogoLoader
 *
 * Outline logo MDU dengan efek "traveling dash": dash pendek berjalan
 * mengelilingi outline secara looping.
 *
 * - stroke-dasharray dihitung via path.getTotalLength() di runtime
 * - stroke memakai linearGradient
 * - overlay: fixed fullscreen, background transparan + backdrop-filter blur
 * - @media (prefers-reduced-motion) mematikan animasi
 */
export function LogoLoader({
  size = 120,
  gradientId = 'logo-loader-grad',
  stops = MDU_GRADIENT_STOPS,
  duration = 2,
  dashRatio = 0.25,
  strokeWidth = 12,
  overlay = true,
  blur = 12,
  className = '',
}: LogoLoaderProps) {
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const path = pathRef.current
    if (!path) return

    // Hitung panjang total path di runtime — tidak hardcode
    const totalLength = path.getTotalLength()
    const dashLength = totalLength * dashRatio
    const gapLength = totalLength - dashLength

    path.style.strokeDasharray = `${dashLength} ${gapLength}`
    path.style.strokeDashoffset = `${totalLength}`

    const animName = `logo-dash-${gradientId}`

    const existingStyle = document.getElementById(animName)
    if (existingStyle) existingStyle.remove()

    const style = document.createElement('style')
    style.id = animName
    style.textContent = `
      @keyframes ${animName} {
        from { stroke-dashoffset: ${totalLength}; }
        to   { stroke-dashoffset: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        [data-logo-loader-path="${gradientId}"] {
          animation: none !important;
          stroke-dasharray: none !important;
          stroke-dashoffset: 0 !important;
          opacity: 0.5;
        }
      }
    `
    document.head.appendChild(style)

    path.style.animation = `${animName} ${duration}s linear infinite`

    return () => {
      style.remove()
      if (path) {
        path.style.strokeDasharray = ''
        path.style.strokeDashoffset = ''
        path.style.animation = ''
      }
    }
  }, [gradientId, duration, dashRatio])

  const logo = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 439 438"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Loading..."
      role="img"
      // FIX #1: path menempel ke tepi viewBox, tanpa ini stroke-nya kepotong
      overflow="visible"
      className={className}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0%"
          y1="100%"
          x2="100%"
          y2="0%"
          gradientUnits="userSpaceOnUse"
        >
          {stops.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>

      {/* Path outline logo MDU — satu path, hasil manual trace Figma. */}
      <path
        ref={pathRef}
        data-logo-loader-path={gradientId}
        d="M218.5 194.03L219.5 299.53H205L185.5 294.53L166.5 282.03L150.5 264.53L140.5 245.03L138 231.03L136.5 215.53V178.53V132.03V93.0297L118 105.53L99.5 125.53L86.5 145.53L77 166.03L71 187.03L68.5 207.53V231.03L73.5 259.03L85.5 290.03L98.5 311.03L121 334.53L141 348.53L156 356.03L172.5 362.53L194.5 367.53L219.5 370.53V436.53H197L176.5 433.03L152 427.03L126.5 417.53L103.5 405.03L81 388.53L56 364.53L35 336.53L21.5 313.03L11.5 287.03L4.5 262.03L0.5 236.53V207.53L2 190.03L4.5 171.53L16 137.03L32 105.53L53.5 76.5297L75 55.0297L101 35.5297L132.5 18.5297L162 7.52966L192.5 2.02966L218.5 0.529663V43.5297V194.03L262.5 149.03C263.833 100.863 266.1 4.82966 264.5 6.02966C297 9.52966 338.5 34.0297 356 49.0297L384.5 77.0297L406.5 106.53L426.5 148.03L436 188.53L438 225.53L436 251.53L428 282.53L412 323.03L381.5 365.03L344 397.53L306 419.03L270.5 431.53V362.53L316.5 337.53L344 306.53L363 270.53L370 235.03L370.5 211.53L370 196.03L363 168.03L351 143.03L336.5 121.53L320 105.03V130.03V196.03L219.5 299.53"
        stroke={`url(#${gradientId})`}
        // FIX #2: 4 unit ≈ 1px di size 120, terlalu tipis
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )

  if (!overlay) return logo

  // Overlay: tanpa warna background, hanya blur konten di belakangnya.
  // Inline style supaya jalan tanpa bergantung pada Tailwind.
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
      }}
    >
      {logo}
    </div>
  )
}

export default LogoLoader