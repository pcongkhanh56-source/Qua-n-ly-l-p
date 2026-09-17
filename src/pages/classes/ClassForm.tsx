import { useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { Class } from '@/src/types';
import { Loader2 } from 'lucide-react';

interface ClassFormProps {
  classItem?: Class | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ClassForm({ classItem, onSuccess, onCancel }: ClassFormProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    class_code: classItem?.class_code || '',
    class_name: classItem?.class_name || '',
    subject: classItem?.subject || '',
    grade: classItem?.grade || '',
    academic_year: classItem?.academic_year || new Date().getFullYear().toString(),
    tuition_type: classItem?.tuition_type || 'per_month',
    tuition_amount: classItem?.tuition_amount || 0,
    sessions_per_month: classItem?.sessions_per_month || 4,
    location: classItem?.location || '',
    status: classItem?.status || 'active',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!formData.class_code || !formData.class_name) {
      showToast('Vui lòng điền mã lớp và tên lớp', 'error');
      return;
    }

    setIsSaving(true);
    
    const payload = {
      ...formData,
      teacher_id: user.id,
      tuition_amount: Number(formData.tuition_amount),
      sessions_per_month: Number(formData.sessions_per_month),
    };

    try {
      if (classItem?.id) {
        // Update
        const { error } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', classItem.id);
          
        if (error) {
          if (error.code === '23505') throw new Error('Mã lớp đã tồn tại');
          throw error;
        }
        showToast('Cập nhật lớp học thành công', 'success');
      } else {
        // Insert
        const { error } = await supabase
          .from('classes')
          .insert([payload]);
          
        if (error) {
          if (error.code === '23505') throw new Error('Mã lớp đã tồn tại');
          throw error;
        }
        showToast('Thêm lớp học mới thành công', 'success');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving class:', error);
      showToast(error.message || 'Có lỗi xảy ra khi lưu lớp học', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mã lớp *</label>
          <input
            type="text"
            name="class_code"
            required
            value={formData.class_code}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="T12A"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tên lớp *</label>
          <input
            type="text"
            name="class_name"
            required
            value={formData.class_name}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Toán 12 Cơ bản"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Môn học</label>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Toán, Lý, Hóa..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Khối/Cấp</label>
          <input
            type="text"
            name="grade"
            value={formData.grade}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Khối 12"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Năm học</label>
          <input
            type="text"
            name="academic_year"
            value={formData.academic_year}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="2024-2025"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hình thức học phí</label>
          <select
            name="tuition_type"
            value={formData.tuition_type}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="per_month">Theo tháng</option>
            <option value="per_session">Theo buổi</option>
            <option value="course">Khóa học</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mức học phí (VNĐ)</label>
          <input
            type="number"
            name="tuition_amount"
            value={formData.tuition_amount}
            onChange={handleChange}
            min={0}
            step={1000}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Số buổi/tháng</label>
          <input
            type="number"
            name="sessions_per_month"
            value={formData.sessions_per_month}
            onChange={handleChange}
            min={1}
            max={31}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Địa điểm</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Phòng 101, Cơ sở A"
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="active">Đang mở</option>
            <option value="completed">Đã kết thúc</option>
            <option value="cancelled">Hủy</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-5 mt-5 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 transition-colors"
        >
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {classItem ? 'Cập nhật' : 'Thêm mới'}
        </button>
      </div>
    </form>
  );
}
