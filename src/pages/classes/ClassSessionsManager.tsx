import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { ClassSession } from '@/src/types';
import { Loader2, CalendarPlus, CalendarDays, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';

interface ClassSessionsManagerProps {
  classId: string;
}

export function ClassSessionsManager({ classId }: ClassSessionsManagerProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Default to current month
  const currentDate = new Date();
  const [genMonth, setGenMonth] = useState(currentDate.getMonth() + 1);
  const [genYear, setGenYear] = useState(currentDate.getFullYear());

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('class_id', classId)
        .order('session_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      showToast('Không thể tải danh sách buổi học', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [classId]);

  const handleGenerateSessions = async () => {
    setIsGenerating(true);
    try {
      // Gọi RPC function create_monthly_sessions
      const { data, error } = await supabase.rpc('create_monthly_sessions', {
        p_class_id: classId,
        p_month: genMonth,
        p_year: genYear,
      });

      if (error) throw error;

      showToast(`Đã tạo lịch học tháng ${genMonth}/${genYear} thành công`, 'success');
      fetchSessions(); // Reload list
    } catch (error: any) {
      console.error('Error generating sessions:', error);
      showToast(error.message || 'Lỗi khi tạo buổi học tự động', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Action Bar for Generating Sessions */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center">
          <CalendarPlus className="w-4 h-4 mr-2 text-blue-600" />
          Tự động tạo buổi học theo tháng
        </h4>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select
            value={genMonth}
            onChange={(e) => setGenMonth(Number(e.target.value))}
            className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
            ))}
          </select>
          <select
            value={genYear}
            onChange={(e) => setGenYear(Number(e.target.value))}
            className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
          <button
            onClick={handleGenerateSessions}
            disabled={isGenerating}
            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-70 transition-colors"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Tạo lịch tháng
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Hệ thống sẽ dựa vào Lịch học định kỳ để tạo ra các buổi học cho tháng đã chọn. Tránh tạo trùng lặp.
        </p>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-900">Chưa có buổi học nào</p>
            <p className="text-xs text-slate-500 mt-1">Hãy sử dụng công cụ tạo lịch phía trên.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ngày</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Thời gian</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nội dung / Bài tập</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Hành động</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {format(new Date(session.session_date), 'dd/MM/yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">
                        {session.start_time.slice(0,5)} - {session.end_time.slice(0,5)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900 line-clamp-1">{session.lesson_title || <span className="text-slate-400 italic">Chưa có nội dung</span>}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{session.homework ? `BTVN: ${session.homework}` : ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                        ${session.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          session.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                          'bg-blue-100 text-blue-800'}
                      `}>
                        {session.status === 'completed' ? 'Đã học' : 
                         session.status === 'cancelled' ? 'Hủy' : 'Sắp tới'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-slate-400 hover:text-slate-600 p-1">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
