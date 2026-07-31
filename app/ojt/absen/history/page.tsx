import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';

export default function AttendanceHistory() {
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .order('check_in_time', { ascending: false });

      if (error) {
        console.error(error);
        toast.error('Gagal mengambil riwayat presensi');
      } else {
        setHistory(data);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans flex">
      <Toaster position="top-center" richColors />
      {/* SIDEBAR DESKTOP */}
      <nav className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen fixed z-20 shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <img src="/logo-mdu.PNG" alt="MDU Logo" className="w-8 h-8 object-contain" />
          <span className="text-xl font-bold text-slate-800 tracking-tight">MDU Portal</span>
        </div>
        <div className="px-4 flex-1 mt-2 space-y-2">
          <button onClick={() => router.push('/ojt')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">Beranda</button>
          <button onClick={() => router.push('/ojt/absen')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-indigo-600 text-white shadow-md">Presensi</button>
          <button onClick={() => router.push('/ojt/tugas')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">Tugas</button>
          <button onClick={() => router.push('/ojt/izin')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">Izin</button>
        </div>
      </nav>

      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
        <header className="px-5 py-5 md:px-8 md:py-6 flex items-center justify-between bg-white md:bg-transparent border-b border-slate-100 md:border-none shadow-sm md:shadow-none z-10">
          <h1 className="text-2xl font-bold text-slate-800">Riwayat Presensi</h1>
          <button onClick={() => router.back()} className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-all">← Kembali</button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          {loading ? (
            <p className="text-center text-slate-500">Memuat riwayat...</p>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
              {history.length === 0 ? (
                <p className="text-center text-slate-400">Tidak ada catatan presensi.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold
                          ${item.status === 'Terlambat' ? 'bg-red-50 text-red-500' : item.check_out_time ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-600'}`}
                        >
                          {item.check_out_time ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{formatDate(item.check_in_time)}</p>
                          <p className={`text-xs font-semibold ${item.status === 'Terlambat' ? 'text-red-500' : 'text-slate-500'}`}>{item.status}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-medium">Masuk: <span className={`font-bold ${item.status === 'Terlambat' ? 'text-red-500' : 'text-slate-800'}`}>{formatTime(item.check_in_time)}</span></p>
                        {item.check_out_time && (
                          <p className="text-xs text-slate-400 font-medium">Pulang: <span className="text-emerald-600 font-bold">{formatTime(item.check_out_time)}</span></p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
