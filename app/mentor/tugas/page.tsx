'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'

export default function VerifikasiTugasPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('Menunggu Verifikasi')
  const router = useRouter()

  useEffect(() => {
    const fetchMentorAndTasks = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: mentorProfile } = await supabase
        .from('users')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single()
      if (mentorProfile) setProfile(mentorProfile)

      const { data: mentees } = await supabase
        .from('users')
        .select('id')
        .eq('mentor_id', user.id)
        .eq('role', 'ojt')

      if (mentees && mentees.length > 0) {
        const menteeIds = mentees.map(m => m.id)
        const { data: taskData } = await supabase
          .from('boost_tasks')
          .select('*, users(name, divisi, nip)')
          .in('user_id', menteeIds)
          .order('created_at', { ascending: false })

        if (taskData) setTasks(taskData)
      }
      setLoading(false)
    }
    fetchMentorAndTasks()
  }, [router])

  const handleUpdateStatus = async (taskId: string, newStatus: 'Disetujui' | 'Ditolak') => {
    const toastId = toast.loading(`Memproses verifikasi...`)
    const { error } = await supabase.from('boost_tasks').update({ status: newStatus }).eq('id', taskId)

    if (error) {
      toast.error('Gagal memperbarui status.', { id: toastId })
    } else {
      toast.success(`Tugas berhasil: ${newStatus}`, { id: toastId })
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  const filteredTasks = tasks.filter(t => t.status === filterStatus)

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8faff] font-bold">Memuat Panel Verifikasi...</div>

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans flex">
      <Toaster position="top-center" richColors />
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Panel</span>
        </div>
        <div className="px-4 flex-1 mt-4 space-y-2">
          <button onClick={() => router.push('/mentor')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <span className="font-semibold text-sm">Ikhtisar Tim</span>
          </button>
          <button onClick={() => router.push('/mentor/data-ojt')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
            <span className="font-semibold text-sm">Data Peserta</span>
          </button>
          <button className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
            <span className="font-semibold text-sm">Verifikasi Tugas</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        <div className="bg-[#1e1b4b] pt-8 pb-20 px-6 rounded-b-[40px] md:mx-6 md:mt-6 md:rounded-3xl shadow-xl relative overflow-hidden shrink-0">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Pusat Validasi Tugas</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 -mt-12 relative z-10">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit mb-6">
              {['Menunggu Verifikasi', 'Disetujui', 'Ditolak'].map(status => (
                <button key={status} onClick={() => setFilterStatus(status)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${filterStatus === status ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500'}`}>
                  {status} ({tasks.filter(t => t.status === status).length})
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
                    <th className="p-4">Peserta</th>
                    <th className="p-4">Tanggal</th>
                    <th className="p-4">Konten</th>
                    <th className="p-4">Bukti</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTasks.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-800 text-sm">{t.users?.name}</td>
                      <td className="p-4 text-xs font-semibold text-slate-500">{formatDate(t.date)}</td>
                      <td className="p-4">
                        <a href={t.post_link} target="_blank" className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100">Link Konten</a>
                      </td>
                      <td className="p-4">
                        <a href={t.proof_link} target="_blank" className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-100">Link Bukti</a>
                      </td>
                      <td className="p-4 text-right">
                        {t.status === 'Menunggu Verifikasi' ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleUpdateStatus(t.id, 'Disetujui')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100">✓ Setujui</button>
                            <button onClick={() => handleUpdateStatus(t.id, 'Ditolak')} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100">✕ Tolak</button>
                          </div>
                        ) : <span className="text-[10px] font-black uppercase">{t.status}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}