import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { Student, StudentClass } from '@/src/types';
import { Loader2, UserPlus, Search, UserMinus, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';

interface StudentClassManagerProps {
  classId: string;
}

type EnrichedStudentClass = StudentClass & { student: Student };

export function StudentClassManager({ classId }: StudentClassManagerProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [studentClasses, setStudentClasses] = useState<EnrichedStudentClass[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add students state
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  // Remove state
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<EnrichedStudentClass | null>(null);

  const fetchStudentClasses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_classes')
        .select(`
          *,
          student:students(*)
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Filter out records where student is null (just in case of broken references)
      setStudentClasses(data?.filter(sc => sc.student) as EnrichedStudentClass[] || []);
    } catch (error) {
      console.error('Error fetching student classes:', error);
      showToast('Không thể tải danh sách học sinh', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentClasses();
  }, [classId]);

  // Search available students
  useEffect(() => {
    if (!isAddingMode || !user) return;
    
    const fetchAvailable = async () => {
      try {
        // Find all students for this teacher
        let query = supabase
          .from('students')
          .select('*')
          .eq('teacher_id', user.id)
          .eq('status', 'active');
          
        if (searchQuery) {
          query = query.or(`full_name.ilike.%${searchQuery}%,student_code.ilike.%${searchQuery}%`);
        }
        
        const { data, error } = await query.limit(20);
        if (error) throw error;
        
        // Filter out students already in the class
        const existingIds = new Set(studentClasses.map(sc => sc.student_id));
        const available = data?.filter(s => !existingIds.has(s.id)) || [];
        
        setAvailableStudents(available);
      } catch (error) {
        console.error('Error fetching available students:', error);
      }
    };
    
    // Debounce search
    const timer = setTimeout(() => fetchAvailable(), 300);
    return () => clearTimeout(timer);
  }, [isAddingMode, searchQuery, studentClasses, user]);

  const toggleStudentSelection = (studentId: string) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  const handleAddStudents = async () => {
    if (!user || selectedStudentIds.size === 0) return;
    
    setIsAdding(true);
    try {
      const inserts = Array.from(selectedStudentIds).map(studentId => ({
        teacher_id: user.id,
        class_id: classId,
        student_id: studentId,
        status: 'active'
      }));
      
      const { error } = await supabase
        .from('student_classes')
        .insert(inserts);

      if (error) {
        if (error.code === '23505') throw new Error('Học sinh đã có trong lớp');
        throw error;
      }
      
      showToast(`Đã thêm ${selectedStudentIds.size} học sinh vào lớp`, 'success');
      setIsAddingMode(false);
      setSelectedStudentIds(new Set());
      fetchStudentClasses();
    } catch (error: any) {
      console.error('Error adding students:', error);
      showToast(error.message || 'Lỗi khi thêm học sinh', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;
    
    try {
      // Mark as dropped instead of hard deleting to preserve history
      const { error } = await supabase
        .from('student_classes')
        .update({ status: 'dropped' })
        .eq('id', studentToRemove.id);

      if (error) throw error;
      
      showToast('Đã cho học sinh rời lớp', 'success');
      setIsRemoveModalOpen(false);
      fetchStudentClasses();
    } catch (error: any) {
      console.error('Error removing student:', error);
      showToast('Lỗi khi thao tác', 'error');
    }
  };

  const handleRestoreStudent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('student_classes')
        .update({ status: 'active', join_date: new Date().toISOString().split('T')[0] })
        .eq('id', id);

      if (error) throw error;
      
      showToast('Đã khôi phục học sinh', 'success');
      fetchStudentClasses();
    } catch (error: any) {
      console.error('Error restoring student:', error);
      showToast('Lỗi khi thao tác', 'error');
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-slate-900">
          Sĩ số: {studentClasses.filter(s => s.status === 'active').length} học sinh
        </h3>
        {!isAddingMode && (
          <button
            onClick={() => setIsAddingMode(true)}
            className="flex items-center px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Thêm học sinh
          </button>
        )}
      </div>

      {/* Adding Mode UI */}
      {isAddingMode && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-slate-900">Thêm học sinh vào lớp</h4>
            <button 
              onClick={() => {
                setIsAddingMode(false);
                setSelectedStudentIds(new Set());
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Đóng
            </button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm học sinh theo tên, mã..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-md bg-white divide-y divide-slate-100">
            {availableStudents.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                Không tìm thấy học sinh nào. (Đã loại trừ học sinh đang trong lớp)
              </div>
            ) : (
              availableStudents.map(student => (
                <label key={student.id} className="flex items-center p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.has(student.id)}
                    onChange={() => toggleStudentSelection(student.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{student.full_name}</p>
                      <p className="text-xs text-slate-500">{student.student_code} • {student.parent_phone}</p>
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm text-slate-600">
              Đã chọn: <strong className="text-blue-600">{selectedStudentIds.size}</strong> học sinh
            </span>
            <button
              onClick={handleAddStudents}
              disabled={selectedStudentIds.size === 0 || isAdding}
              className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Xác nhận thêm
            </button>
          </div>
        </div>
      )}

      {/* Student List Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Học sinh</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trường / Lớp</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ngày vào lớp</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trạng thái</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {studentClasses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                  Lớp học chưa có học sinh.
                </td>
              </tr>
            ) : (
              studentClasses.map((sc) => (
                <tr key={sc.id} className={sc.status === 'dropped' ? 'bg-slate-50 opacity-70' : 'hover:bg-slate-50 transition-colors'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{sc.student.full_name}</div>
                    <div className="text-xs text-slate-500">{sc.student.student_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">{sc.student.school_name || '-'}</div>
                    <div className="text-xs text-slate-500">{sc.student.school_class || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {sc.join_date ? new Date(sc.join_date).toLocaleDateString('vi-VN') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                      ${sc.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-800'}
                    `}>
                      {sc.status === 'active' ? 'Đang học' : 'Rời lớp'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/students/${sc.student_id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md"
                        title="Hồ sơ học sinh"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {sc.status === 'active' ? (
                        <button
                          onClick={() => {
                            setStudentToRemove(sc);
                            setIsRemoveModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
                          title="Rời lớp"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestoreStudent(sc.id)}
                          className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
                        >
                          Khôi phục
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={isRemoveModalOpen}
        onClose={() => setIsRemoveModalOpen(false)}
        onConfirm={handleRemoveStudent}
        title="Rời lớp học"
        message={
          <>
            Đánh dấu học sinh <span className="font-semibold">{studentToRemove?.student.full_name}</span> là đã rời lớp?
            <br />
            Học sinh sẽ không còn hiển thị trong danh sách điểm danh, nhưng lịch sử học phí và điểm số cũ vẫn được giữ lại.
          </>
        }
        confirmText="Xác nhận"
      />
    </div>
  );
}
