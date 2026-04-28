'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { submitOJTGrades, generateCertificatePDF } from '../actions'
import { Toaster, toast } from 'sonner'


export default function PenilaianPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mentees, setMentees] = useState<any[]>([])
  const [gradesData, setGradesData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // STATE UNTUK PINDAH LAYAR (list vs form)
  const [activeView, setActiveView] = useState<'list' | 'form'>('list')
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // STATE FORM NILAI
  const [grades, setGrades] = useState({
    q1: 0, q2: 0, q3: 0, q4: 0,
    q5: 0, q6: 0, q7: 0,
    q8: 0, q9: 0, q10: 0,
    q11: 0, q12: 0, q13: 0,
    catatan: ''
  })

  // FETCH DATA
  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)

    const { data: mentorProfile } = await supabase.from('users').select('name, avatar_url').eq('id', user.id).single()
    if (mentorProfile) setProfile(mentorProfile)

    // Tarik data anak OJT
    const { data: teamData } = await supabase.from('users').select('*').eq('mentor_id', user.id).eq('role', 'ojt')
    if (teamData) setMentees(teamData)

    // Tarik data nilai yang udah ada
    const { data: existingGrades } = await supabase.from('ojt_grades').select('*').eq('mentor_id', user.id)
    if (existingGrades) setGradesData(existingGrades)

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [router])

  // RUMUS MENGHITUNG RATA-RATA & HURUF
  const calculateAverage = () => {
    const total = grades.q1 + grades.q2 + grades.q3 + grades.q4 + grades.q5 + grades.q6 + grades.q7 + grades.q8 + grades.q9 + grades.q10 + grades.q11 + grades.q12 + grades.q13
    return (total / 13).toFixed(1)
  }

  const getLetterGrade = (avg: number) => {
    if (avg >= 96) return 'A+'
    if (avg >= 91) return 'A'
    if (avg >= 86) return 'A-'
    if (avg >= 81) return 'B+'
    if (avg >= 76) return 'B'
    if (avg >= 71) return 'B-'
    if (avg >= 66) return 'C'
    return 'D'
  }

  // BUKA FORM PENILAIAN
  const openGradeForm = (student: any) => {
    setSelectedStudent(student)
    // Cek apakah udah punya nilai sebelumnya
    const existing = gradesData.find(g => g.user_id === student.id)
    if (existing) {
      setGrades({
        q1: existing.q1_waktu, q2: existing.q2_sikap, q3: existing.q3_tanggung_jawab, q4: existing.q4_kehadiran,
        q5: existing.q5_kemampuan, q6: existing.q6_keterampilan, q7: existing.q7_kualitas,
        q8: existing.q8_komunikasi, q9: existing.q9_kerjasama, q10: existing.q10_inisiatif,
        q11: existing.q11_percaya_diri || 0, q12: existing.q12_patuh_aturan || 0, q13: existing.q13_penampilan || 0,
        catatan: existing.catatan || ''
      })
    } else {
      setGrades({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0, q10: 0, q11: 0, q12: 0, q13: 0, catatan: '' })
    }
    setActiveView('form')
  }

  // SIMPAN NILAI
  const executeSubmitGrades = async () => {
    setIsSubmitting(true)
    const toastId = toast.loading(`Menyimpan rapor ${selectedStudent?.name}...`)
    
    const payload = {
      user_id: selectedStudent.id,
      mentor_id: user.id,
      q1_waktu: grades.q1, q2_sikap: grades.q2, q3_tanggung_jawab: grades.q3, q4_kehadiran: grades.q4,
      q5_kemampuan: grades.q5, q6_keterampilan: grades.q6, q7_kualitas: grades.q7,
      q8_komunikasi: grades.q8, q9_kerjasama: grades.q9, q10_inisiatif: grades.q10,
      q11_percaya_diri: grades.q11, q12_patuh_aturan: grades.q12, q13_penampilan: grades.q13,
      catatan: grades.catatan
    }

    const result = await submitOJTGrades(payload)
    if (result.success) {
      toast.success('Rapor berhasil disimpan!', { id: toastId })
      await fetchData() // Refresh data biar statusnya update
      setActiveView('list') // Balik ke daftar
    } else {
      toast.error(`Gagal: ${result.message}`, { id: toastId })
    }
    setIsSubmitting(false)
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f4f7fe]">Memuat Modul Penilaian...</div>

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fe] flex flex-col md:flex-row font-sans">
      <Toaster position="top-center" richColors />
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col shadow-sm z-10 shrink-0">
        <div className="p-6 flex items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-xl bg-slate-100 shadow-sm object-cover" />
          ) : (
            <div className="w-10 h-10 bg-[#1e1b4b] rounded-xl flex items-center justify-center text-white font-bold text-xl">M</div>
          )}
          <span className="text-xl font-bold text-slate-800 tracking-tight">Mentor Panel</span>
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu Kelola</p>
          <nav className="space-y-1.5">
            <button onClick={() => router.push('/mentor')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <span className="font-medium">Overview Tim</span>
            </button>
            <button onClick={() => router.push('/mentor/data-ojt')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <span className="font-medium">Data Anak OJT</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-[#1e1b4b] text-white shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="font-medium">Penilaian & Sertifikat</span>
            </button>
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-[100dvh] md:h-screen overflow-hidden relative">
        <header className="px-5 py-5 md:px-8 md:py-6 flex items-center justify-between bg-white md:bg-transparent border-b border-slate-100 md:border-none z-10">
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">
              {activeView === 'list' ? 'Penilaian OJT' : 'Lembar Evaluasi Akhir'}
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              {activeView === 'list' ? 'Evaluasi performa tim anda dan terbitkan sertifikat.' : `Mengisi nilai untuk ${selectedStudent?.name}`}
            </p>
          </div>
          {activeView === 'form' && (
            <button onClick={() => setActiveView('list')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all">
              Kembali
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-28 md:pb-8">
          {/* LAYAR 1: DAFTAR ANAK OJT */}
          {activeView === 'list' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mentees.map(m => {
                const grade = gradesData.find(g => g.user_id === m.id)
                let avg = 0, letter = '-'
                if (grade) {
                  const total = grade.q1_waktu + grade.q2_sikap + grade.q3_tanggung_jawab + grade.q4_kehadiran + grade.q5_kemampuan + grade.q6_keterampilan + grade.q7_kualitas + grade.q8_komunikasi + grade.q9_kerjasama + grade.q10_inisiatif + (grade.q11_percaya_diri||0) + (grade.q12_patuh_aturan||0) + (grade.q13_penampilan||0)
                  avg = total / 13
                  letter = getLetterGrade(avg)
                }

                return (
                  <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-all">
                    {grade && <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10"></div>}
                    
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{m.name}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">{m.divisi}</p>
                      </div>
                      {grade && (
                        <div className="bg-emerald-100 text-emerald-700 font-black text-xl w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                          {letter}
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-50 flex gap-2">
                      <button 
                        onClick={() => openGradeForm(m)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${grade ? 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100' : 'bg-blue-600 text-white shadow-md hover:bg-blue-700'}`}
                      >
                        {grade ? 'Edit Rapor' : 'Beri Nilai'}
                      </button>
                      {grade && (
                        <button 
  onClick={async () => {
    const res = await generateCertificatePDF(m.id)
    if (res.success && res.pdfBase64) {
      // Trik download file otomatis
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${res.pdfBase64}`
      link.download = res.fileName
      link.click()
      toast.success("Sertifikat berhasil di-generate!")
    } else {
      toast.error(res.message)
    }
  }}
  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#1e1b4b] text-white shadow-md flex items-center justify-center gap-1.5 hover:bg-blue-900 transition-all"
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
  Sertifikat
</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* LAYAR 2: FORM PENILAIAN */}
          {activeView === 'form' && (
            <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col lg:flex-row">
              
              {/* Kolom Kiri: Input Nilai */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[75vh] custom-scrollbar border-r border-slate-100">
                <div className="space-y-8">
                  {/* Kategori 1 */}
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                      Kedisiplinan
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[{id: 'q1', label: 'Ketepatan waktu/disiplin'}, {id: 'q2', label: 'Sikap & prosedur kerja'}, {id: 'q3', label: 'Tanggung jawab tugas'}, {id: 'q4', label: 'Kehadiran/absensi'}].map(q => (
                        <div key={q.id} className="bg-slate-50 p-4 rounded-2xl flex flex-col">
                          <span className="text-xs font-semibold text-slate-500 mb-2">{q.label}</span>
                          <input type="number" min="0" max="100" value={(grades as any)[q.id] || ''} onChange={(e) => setGrades({...grades, [q.id]: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 text-lg font-black text-slate-800 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0-100" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kategori 2 */}
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">2</span>
                      Prestasi Kerja
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[{id: 'q5', label: 'Kemampuan Kerja'}, {id: 'q6', label: 'Keterampilan Kerja'}, {id: 'q7', label: 'Kualitas Hasil Kerja'}].map(q => (
                        <div key={q.id} className="bg-slate-50 p-4 rounded-2xl flex flex-col">
                          <span className="text-xs font-semibold text-slate-500 mb-2">{q.label}</span>
                          <input type="number" min="0" max="100" value={(grades as any)[q.id] || ''} onChange={(e) => setGrades({...grades, [q.id]: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 text-lg font-black text-slate-800 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0-100" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kategori 3 */}
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">3</span>
                      Adaptasi & Lainnya
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[{id: 'q8', label: 'Komunikasi'}, {id: 'q9', label: 'Kerjasama'}, {id: 'q10', label: 'Kerajinan/Inisiatif'}, {id: 'q11', label: 'Percaya Diri'}, {id: 'q12', label: 'Mematuhi Aturan'}, {id: 'q13', label: 'Penampilan/Kerapihan'}].map(q => (
                        <div key={q.id} className="bg-slate-50 p-4 rounded-2xl flex flex-col">
                          <span className="text-xs font-semibold text-slate-500 mb-2">{q.label}</span>
                          <input type="number" min="0" max="100" value={(grades as any)[q.id] || ''} onChange={(e) => setGrades({...grades, [q.id]: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 text-lg font-black text-slate-800 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0-100" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Hasil & Tombol */}
              <div className="w-full lg:w-80 bg-slate-50 p-6 md:p-8 flex flex-col">
                <div className="bg-[#1e1b4b] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden mb-6">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                  <p className="text-blue-200 text-xs font-semibold tracking-wider uppercase mb-1">Total Rata-rata</p>
                  <p className="text-5xl font-black tracking-tighter mb-4">{calculateAverage()}</p>
                  
                  <div className="border-t border-white/20 pt-4 flex justify-between items-end">
                    <span className="text-sm font-medium text-blue-200">Predikat</span>
                    <span className="text-3xl font-black text-amber-400 leading-none">{getLetterGrade(parseFloat(calculateAverage()))}</span>
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Catatan Tambahan (Opsional)</label>
                  <textarea 
                    value={grades.catatan} 
                    onChange={(e) => setGrades({...grades, catatan: e.target.value})}
                    className="w-full h-32 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 resize-none custom-scrollbar"
                    placeholder="Ketik pesan atau evaluasi buat anak OJT..."
                  ></textarea>
                </div>

                <button 
                  onClick={executeSubmitGrades} 
                  disabled={isSubmitting} 
                  className="w-full mt-6 py-4 rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Nilai Permanen'}
                </button>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  )
}