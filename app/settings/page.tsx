'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'

// Kumpulan Avatar yang udah lu kurasi
const AVATAR_OPTIONS = [
  "https://api.dicebear.com/7.x/micah/svg?seed=Naufal",
  "https://api.dicebear.com/7.x/micah/svg?seed=TimMDU",
  "https://api.dicebear.com/7.x/micah/svg?seed=Kreatif",
  "https://api.dicebear.com/7.x/micah/svg?seed=Editor",
  "https://api.dicebear.com/7.x/micah/svg?seed=Kamera",
  "https://api.dicebear.com/7.x/micah/svg?seed=OJT",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Naufal",
  "https://api.dicebear.com/7.x/bottts/svg?seed=RobotMDU"
]

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [currentAvatar, setCurrentAvatar] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profile } = await supabase
        .from('users')
        .select('avatar_url, role')
        .eq('id', user.id)
        .single()

      if (profile) setCurrentAvatar(profile.avatar_url || AVATAR_OPTIONS[0])
      setLoading(false)
    }
    fetchProfile()
  }, [router])

  const handleSaveAvatar = async (selectedAvatar: string) => {
    setSaving(true)
    setCurrentAvatar(selectedAvatar)

    const { error } = await supabase
      .from('users')
      .update({ avatar_url: selectedAvatar })
      .eq('id', user.id)

    setSaving(false)
    if (!error) {
      // Kembali ke dashboard masing-masing setelah sukses
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') router.push('/admin')
      else if (profile?.role === 'mentor') router.push('/mentor')
      else router.push('/')
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Memuat...</div>

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Pengaturan Profil</h1>
            <p className="text-slate-500 mt-1">Pilih avatar yang paling menggambarkan diri lu.</p>
          </div>
          <button onClick={() => router.back()} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium transition-all shadow-sm">
            Kembali
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-32 h-32 rounded-full border-4 border-slate-50 overflow-hidden shadow-lg bg-slate-100 mb-4 relative">
              <img src={currentAvatar} alt="Current Avatar" className="w-full h-full object-cover" />
              {saving && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-slate-800">Menyimpan...</div>}
            </div>
            <h3 className="text-lg font-bold text-slate-800">Avatar Saat Ini</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {AVATAR_OPTIONS.map((avatarUrl, idx) => (
              <button
                key={idx}
                onClick={() => handleSaveAvatar(avatarUrl)}
                disabled={saving}
                className={`group relative rounded-2xl p-2 transition-all duration-200 border-2 ${currentAvatar === avatarUrl ? 'border-blue-600 bg-blue-50/50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-slate-100">
                  <img src={avatarUrl} alt={`Avatar ${idx}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}