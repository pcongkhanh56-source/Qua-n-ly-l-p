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
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { Student } from '@/src/types';
import { Modal } from '@/src/components/ui/Modal';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { StudentForm } from './StudentForm';
import { format } from 'date-fns';

const PAGE_SIZE = 10;

export function StudentList() {
  const { user, setDbSetupRequired } = useAuth();
  const { showToast } = useToast();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle status filter change
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1); // Reset page on new filter
  };

  const fetchStudents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('students')
        .select('*', { count: 'exact' })
        .eq('teacher_id', user.id);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (debouncedSearch) {
        query = query.or(`full_name.ilike.%${debouncedSearch}%,student_code.ilike.%${debouncedSearch}%,parent_phone.ilike.%${debouncedSearch}%,school_name.ilike.%${debouncedSearch}%`);
      }

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      
      setStudents(data || []);
      if (count !== null) setTotalCount(count);
    } catch (error: any) {
      if (error?.code === "PGRST205") setDbSetupRequired(true);
      console.error('Error fetching students:', error);
      showToast('Không thể tải danh sách học sinh', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [user, page, debouncedSearch, statusFilter]);

  const handleDelete = async () => {
    if (!studentToDelete || !user) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentToDelete.id);

      if (error) throw error;
      
      showToast('Đã xóa học sinh thành công', 'success');
      setIsDeleteModalOpen(false);
      
      // If we deleted the last item on a page, go back a page
      if (students.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchStudents();
      }
    } catch (error: any) {
      if (error?.code === "PGRST205") setDbSetupRequired(true);
      console.error('Error deleting student:', error);
      showToast('Lỗi khi xóa học sinh', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (student: Student) => {
    setSelectedStudent(student);
    setIsFormModalOpen(true);
  };

  const openAddModal = () => {
    setSelectedStudent(null);
    setIsFormModalOpen(true);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Học sinh</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý danh sách, thông tin và trạng thái của tất cả học sinh.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Thêm học sinh
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
            placeholder="Tìm theo tên, mã HS, SĐT, trường..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            className="block w-full sm:w-48 py-2 px-3 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang học</option>
            <option value="inactive">Tạm nghỉ</option>
            <option value="archived">Đã nghỉ</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  STT
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Học sinh
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Trường / Lớp
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Liên hệ Phụ huynh
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Ngày tham gia
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                    <p className="mt-2 text-sm text-slate-500">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                      <AlertCircle className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-base font-medium text-slate-900">Không tìm thấy học sinh</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'Thử thay đổi bộ lọc tìm kiếm.' 
                        : 'Bắt đầu bằng cách thêm học sinh mới.'}
                    </p>
                  </td>
                </tr>
              ) : (
                students.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">{student.full_name}</span>
                        <span className="text-xs text-slate-500">{student.student_code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-900">{student.school_name || '-'}</span>
                        <span className="text-xs text-slate-500">{student.school_class || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-900">{student.parent_name || '-'}</span>
                        <span className="text-xs text-slate-500">{student.parent_phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {student.enrollment_date ? format(new Date(student.enrollment_date), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${student.status === 'active' ? 'bg-green-100 text-green-800' : 
                          student.status === 'inactive' ? 'bg-amber-100 text-amber-800' : 
                          'bg-slate-100 text-slate-800'}
                      `}>
                        {student.status === 'active' ? 'Đang học' : 
                         student.status === 'inactive' ? 'Tạm nghỉ' : 'Đã nghỉ'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/students/${student.id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          title="Sửa thông tin"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setStudentToDelete(student);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Xóa học sinh"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalCount > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-slate-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  Hiển thị <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> đến{' '}
                  <span className="font-medium">{Math.min(page * PAGE_SIZE, totalCount)}</span> trong{' '}
                  <span className="font-medium">{totalCount}</span> kết quả
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <div className="px-4 py-2 border-t border-b border-slate-300 bg-white text-sm font-medium text-slate-700">
                    Trang {page} / {totalPages}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal 
        isOpen={isFormModalOpen} 
        onClose={() => setIsFormModalOpen(false)}
        title={selectedStudent ? "Sửa thông tin học sinh" : "Thêm học sinh mới"}
        maxWidth="2xl"
      >
        <StudentForm 
          student={selectedStudent} 
          onSuccess={() => {
            setIsFormModalOpen(false);
            fetchStudents();
          }}
          onCancel={() => setIsFormModalOpen(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Xóa học sinh"
        message={
          <>
            Bạn có chắc chắn muốn xóa học sinh <span className="font-semibold text-slate-900">{studentToDelete?.full_name}</span>?
            <br />
            Hành động này sẽ xóa toàn bộ dữ liệu liên quan và không thể hoàn tác.
          </>
        }
        isConfirming={isDeleting}
        confirmText="Xóa học sinh"
      />
    </div>
  );
}
