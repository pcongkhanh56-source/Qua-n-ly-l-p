import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { Class, ClassSchedule } from '@/src/types';
import { Modal } from '@/src/components/ui/Modal';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { ClassForm } from './ClassForm';

const DAYS_OF_WEEK = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export function ClassList() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [classes, setClasses] = useState<(Class & { student_count?: number, schedules?: ClassSchedule[] })[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<Class | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchClasses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        query = query.or(`class_name.ilike.%${searchQuery}%,class_code.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch related data (student count and schedules) for each class
      if (data && data.length > 0) {
        const classIds = data.map(c => c.id);
        
        // Parallel fetch for schedules and counts
        const [schedulesRes, studentClassesRes] = await Promise.all([
          supabase.from('class_schedules').select('*').in('class_id', classIds),
          supabase.from('student_classes').select('class_id').in('class_id', classIds).eq('status', 'active')
        ]);
        
        const enrichedClasses = data.map(cls => {
          const classSchedules = schedulesRes.data?.filter(s => s.class_id === cls.id) || [];
          const studentCount = studentClassesRes.data?.filter(sc => sc.class_id === cls.id).length || 0;
          return { ...cls, schedules: classSchedules, student_count: studentCount };
        });
        
        setClasses(enrichedClasses);
      } else {
        setClasses([]);
      }
      
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      showToast('Không thể tải danh sách lớp học', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if it's not a real-time keypress (simple debounce could be added)
    const timer = setTimeout(() => fetchClasses(), 300);
    return () => clearTimeout(timer);
  }, [user, searchQuery, statusFilter]);

  const handleDelete = async () => {
    if (!classToDelete || !user) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classToDelete.id);

      if (error) throw error;
      
      showToast('Đã xóa lớp học thành công', 'success');
      setIsDeleteModalOpen(false);
      fetchClasses();
    } catch (error: any) {
      console.error('Error deleting class:', error);
      showToast('Lỗi khi xóa lớp học. Vui lòng kiểm tra dữ liệu liên quan.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (classItem: Class) => {
    setSelectedClass(classItem);
    setIsFormModalOpen(true);
  };

  const openAddModal = () => {
    setSelectedClass(null);
    setIsFormModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Lớp học</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý các lớp, lịch học, học phí và học sinh trong lớp.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Thêm lớp học
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên lớp, mã lớp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full sm:w-48 py-2 px-3 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang mở</option>
            <option value="completed">Đã kết thúc</option>
            <option value="cancelled">Hủy</option>
          </select>
        </div>
      </div>

      {/* Grid or Table */}
      {loading ? (
        <div className="flex justify-center items-center h-48 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-base font-medium text-slate-900">Không tìm thấy lớp học</p>
          <p className="mt-1 text-sm text-slate-500">
            {searchQuery || statusFilter !== 'all' 
              ? 'Thử thay đổi bộ lọc tìm kiếm.' 
              : 'Bắt đầu bằng cách thêm lớp học mới.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-shadow hover:shadow-md">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        <Link to={`/classes/${cls.id}`} className="hover:text-blue-600 transition-colors">
                          {cls.class_name}
                        </Link>
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                        ${cls.status === 'active' ? 'bg-green-100 text-green-800' : 
                          cls.status === 'completed' ? 'bg-slate-100 text-slate-800' : 
                          'bg-red-100 text-red-800'}
                      `}>
                        {cls.status === 'active' ? 'Đang mở' : 
                         cls.status === 'completed' ? 'Đã kết thúc' : 'Hủy'}
                      </span>
                    </div>
                    <div className="text-sm font-mono text-slate-500 mt-1">{cls.class_code}</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(cls)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                      title="Sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setClassToDelete(cls);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mb-4">
                  <div>
                    <span className="text-slate-500 block">Khối / Môn:</span>
                    <span className="font-medium text-slate-900">{cls.grade || '-'} / {cls.subject || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Sĩ số:</span>
                    <span className="font-medium text-slate-900">{cls.student_count} hs</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Học phí ({cls.tuition_type === 'per_month' ? 'Tháng' : cls.tuition_type === 'per_session' ? 'Buổi' : 'Khóa'}):</span>
                    <span className="font-medium text-slate-900">{formatCurrency(cls.tuition_amount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Địa điểm:</span>
                    <span className="font-medium text-slate-900 truncate" title={cls.location || ''}>{cls.location || '-'}</span>
                  </div>
                </div>

                {/* Schedules preview */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2 block">Lịch học ({cls.schedules?.length || 0})</span>
                  {cls.schedules && cls.schedules.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {cls.schedules.map(schedule => (
                        <span key={schedule.id} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium border border-blue-100">
                          {DAYS_OF_WEEK[schedule.day_of_week === 7 ? 0 : schedule.day_of_week]} • {schedule.start_time.slice(0,5)} - {schedule.end_time.slice(0,5)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Chưa xếp lịch</span>
                  )}
                </div>
              </div>
              
              <div className="bg-slate-50 border-t border-slate-100 px-5 py-3">
                <Link
                  to={`/classes/${cls.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500 flex items-center justify-center"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Xem chi tiết & Quản lý
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal 
        isOpen={isFormModalOpen} 
        onClose={() => setIsFormModalOpen(false)}
        title={selectedClass ? "Sửa lớp học" : "Thêm lớp học mới"}
        maxWidth="2xl"
      >
        <ClassForm 
          classItem={selectedClass} 
          onSuccess={() => {
            setIsFormModalOpen(false);
            fetchClasses();
          }}
          onCancel={() => setIsFormModalOpen(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Xóa lớp học"
        message={
          <>
            Bạn có chắc chắn muốn xóa lớp học <span className="font-semibold text-slate-900">{classToDelete?.class_name}</span>?
            <br />
            Việc này sẽ xóa lịch học và các liên kết học sinh trong lớp.
          </>
        }
        isConfirming={isDeleting}
        confirmText="Xóa lớp học"
      />
    </div>
  );
}
