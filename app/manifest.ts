import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MDU Portal - Absensi & Tugas OJT',
    short_name: 'MDU Portal',
    description: 'Portal resmi magang OJT Mandiri Digital Universe: Absensi, Jurnal Tugas, Izin, dan Penilaian.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    background_color: '#0B1528',
    theme_color: '#2563eb',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/logo-mdu.PNG',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
