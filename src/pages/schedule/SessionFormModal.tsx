import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { Class } from '@/src/types';
import { Modal } from '@/src/components/ui/Modal';
import { EnrichedSession } from './index';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface SessionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: EnrichedSession | null;
  classes: Class[];
  onSuccess: () => void;
}

export function SessionFormModal({ isOpen, onClose, session, classes, onSuccess }: SessionFormModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    class_id: '',
    session_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '18:00',
    end_time: '19:30',
    lesson_title: '',
    lesson_content: '',
    homework: '',
    note: '',
    status: 'scheduled' as 'scheduled' | 'completed' | 'cancelled'
  });

  useEffect(() => {
    if (session) {
      setFormData({
        class_id: session.class_id,
        session_date: session.session_date,
        start_time: session.start_time.substring(0, 5),
        end_time: session.end_time.substring(0, 5),
        lesson_title: session.lesson_title || '',
        lesson_content: session.lesson_content || '',
        homework: session.homework || '',
        note: session.note || '',
        status: session.status
      });
    } else {
      setFormData(prev => ({
        ...prev,
        class_id: classes.length > 0 ? classes[0].id : '',
        session_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '18:00',
        end_time: '19:30',
        lesson_title: '',
        lesson_content: '',
        homework: '',
        note: '',
        status: 'scheduled'
      }));
    }
  }, [session, classes, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.class_id || !formData.session_date || !formData.start_time || !formData.end_time) {
      showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
      return;
    }

    if (formData.start_time >= formData.end_time) {
      showToast('Giờ kết thúc phải lớn hơn giờ bắt đầu', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        teacher_id: user.id,
        class_id: formData.class_id,
        session_date: formData.session_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        lesson_title: formData.lesson_title,
        lesson_content: formData.lesson_content,
        homework: formData.homework,
        note: formData.note,
        status: formData.status
      };

      if (session) {
        // Update
        const { error } = await supabase
          .from('sessions')
          .update(payload)
          .eq('id', session.id);

        if (error) {
          if (error.code === '23505') throw new Error('Buổi học này đã tồn tại (trùng ngày và giờ)');
          throw error;
        }
        showToast('Cập nhật buổi học thành công', 'success');
      } else {
        // Check for duplicates
        const { data: existing } = await supabase
          .from('sessions')
          .select('id')
          .eq('class_id', payload.class_id)
          .eq('session_date', payload.session_date)
          .eq('start_time', payload.start_time)
          .single();

        if (existing) {
          throw new Error('Buổi học này đã tồn tại (trùng ngày và giờ)');
        }

        // Insert
        const { error } = await supabase
          .from('sessions')
          .insert([payload]);

        if (error) throw error;
        showToast('Thêm buổi học mới thành công', 'success');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving session:', error);
      showToast(error.message || 'Có lỗi xảy ra khi lưu', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={session ? 'Sửa buổi học' : 'Thêm buổi học mới'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Lớp học <span className="text-red-500">*</span>
          </label>
          <select
            name="class_id"
            value={formData.class_id}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={!!session}
          >
            {classes.length === 0 && <option value="">Chưa có lớp</option>}
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.class_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ngày học <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="session_date"
              value={formData.session_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Giờ bắt đầu <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              name="start_time"
              value={formData.start_time}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Giờ kết thúc <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              name="end_time"
              value={formData.end_time}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề / Tên bài học</label>
          <input
            type="text"
            name="lesson_title"
            value={formData.lesson_title}
            onChange={handleChange}
            placeholder="VD: Bài 5: Phân tích đa thức thành nhân tử"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung chi tiết</label>
          <textarea
            name="lesson_content"
            value={formData.lesson_content}
            onChange={handleChange}
            rows={3}
            placeholder="Tóm tắt nội dung bài học..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          ></textarea>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Bài tập về nhà</label>
          <textarea
            name="homework"
            value={formData.homework}
            onChange={handleChange}
            rows={2}
            placeholder="Ghi chú bài tập về nhà..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          ></textarea>
        </div>

        {session && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="scheduled">Sắp học</option>
              <option value="completed">Đã hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {session ? 'Cập nhật' : 'Thêm buổi học'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
