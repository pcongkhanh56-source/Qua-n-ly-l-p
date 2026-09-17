import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { ClassSchedule } from '@/src/types';
import { Clock, Plus, Trash2, Loader2 } from 'lucide-react';

interface ClassScheduleManagerProps {
  classId: string;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Thứ Hai' },
  { value: 2, label: 'Thứ Ba' },
  { value: 3, label: 'Thứ Tư' },
  { value: 4, label: 'Thứ Năm' },
  { value: 5, label: 'Thứ Sáu' },
  { value: 6, label: 'Thứ Bảy' },
  { value: 7, label: 'Chủ Nhật' },
];

export function ClassScheduleManager({ classId }: ClassScheduleManagerProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New Schedule State
  const [newDay, setNewDay] = useState(1);
  const [newStartTime, setNewStartTime] = useState('18:00');
  const [newEndTime, setNewEndTime] = useState('19:30');

  const fetchSchedules = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('class_id', classId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      showToast('Không thể tải lịch học', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [classId]);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !classId) return;

    if (newStartTime >= newEndTime) {
      showToast('Thời gian kết thúc phải sau thời gian bắt đầu', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('class_schedules')
        .insert([{
          teacher_id: user.id,
          class_id: classId,
          day_of_week: newDay,
          start_time: newStartTime,
          end_time: newEndTime
        }]);

      if (error) throw error;
      
      showToast('Thêm lịch học thành công', 'success');
      setIsAdding(false);
      fetchSchedules();
    } catch (error: any) {
      console.error('Error adding schedule:', error);
      showToast('Lỗi khi thêm lịch học', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('class_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      showToast('Đã xóa lịch học', 'success');
      fetchSchedules();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      showToast('Lỗi khi xóa lịch học', 'error');
    }
  };

  if (loading) {
    return <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-slate-900">Lịch học định kỳ</h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4 mr-1" /> Thêm lịch
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleAddSchedule} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Thứ</label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DAYS_OF_WEEK.map(day => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Từ giờ</label>
              <input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Đến giờ</label>
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-70 transition-colors"
            >
              {isSaving && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
              Lưu lịch
            </button>
          </div>
        </form>
      )}

      {schedules.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
          <Clock className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">Lớp chưa có lịch học nào.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {schedules.map((schedule) => {
            const dayLabel = DAYS_OF_WEEK.find(d => d.value === schedule.day_of_week)?.label;
            return (
              <div key={schedule.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-md">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{dayLabel}</p>
                    <p className="text-xs text-slate-500">{schedule.start_time.slice(0,5)} - {schedule.end_time.slice(0,5)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSchedule(schedule.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Xóa lịch"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
