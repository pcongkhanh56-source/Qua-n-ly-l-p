import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { Student } from '@/src/types';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  GraduationCap, 
  BookOpen, 
  CheckSquare, 
  CreditCard, 
  BarChart3, 
  FileText,
  Loader2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/src/contexts/ToastContext';
import { StudentTuitionTab } from './StudentTuitionTab';
import { StudentResultsTab } from './StudentResultsTab';
import { StudentNotesTab } from './StudentNotesTab';

const TABS = [
  { id: 'info', name: 'Thông tin', icon: User },
  { id: 'classes', name: 'Lớp đang học', icon: BookOpen },
  { id: 'attendance', name: 'Điểm danh', icon: CheckSquare },
  { id: 'tuition', name: 'Học phí', icon: CreditCard },
  { id: 'results', name: 'Kết quả', icon: BarChart3 },
  { id: 'notes', name: 'Ghi chú', icon: FileText },
];

export function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    const fetchStudent = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setStudent(data);
      } catch (error) {
        console.error('Error fetching student detail:', error);
        showToast('Không thể tải thông tin học sinh', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [id, showToast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
        <User className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-sm font-semibold text-slate-900">Không tìm thấy học sinh</h3>
        <p className="mt-1 text-sm text-slate-500">Học sinh không tồn tại hoặc bạn không có quyền truy cập.</p>
        <div className="mt-6">
          <Link to="/students" className="text-blue-600 hover:text-blue-500 font-medium text-sm">
            &larr; Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Profile */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        <div className="px-6 sm:px-8 pb-6 relative">
          <div className="flex justify-between items-end -mt-12 sm:-mt-16 mb-4">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-2xl shadow-lg border-4 border-white flex items-center justify-center">
              <span className="text-4xl sm:text-5xl font-bold text-blue-600 uppercase">
                {student.full_name.charAt(0)}
              </span>
            </div>
            <div className="flex gap-3 mb-2 sm:mb-4">
              <Link 
                to="/students" 
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại
              </Link>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{student.full_name}</h1>
              <div className="flex items-center gap-2 mt-1 text-slate-500">
                <span className="font-mono text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold">
                  {student.student_code}
                </span>
                <span>•</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${student.status === 'active' ? 'bg-green-100 text-green-800' : 
                    student.status === 'inactive' ? 'bg-amber-100 text-amber-800' : 
                    'bg-slate-100 text-slate-800'}
                `}>
                  {student.status === 'active' ? 'Đang học' : 
                   student.status === 'inactive' ? 'Tạm nghỉ' : 'Đã nghỉ'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="border-t border-slate-200 bg-slate-50/50 px-4 sm:px-8">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-blue-500' : 'text-slate-400')} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {activeTab === 'info' && (
          <div className="p-6 sm:p-8">
            <h3 className="text-lg font-medium text-slate-900 mb-6">Thông tin cá nhân</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Ngày sinh</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {student.date_of_birth ? format(new Date(student.date_of_birth), 'dd/MM/yyyy') : 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Giới tính</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {student.gender === 'male' ? 'Nam' : student.gender === 'female' ? 'Nữ' : 'Khác'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <GraduationCap className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Trường / Lớp</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {student.school_name || 'Chưa cập nhật trường'} {student.school_class ? ` - Lớp ${student.school_class}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Liên hệ</p>
                  <p className="mt-1 text-sm text-slate-900">
                    HS: {student.student_phone || 'Không có'}<br />
                    PH: {student.parent_phone} ({student.parent_name || 'Chưa cập nhật tên'})
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Địa chỉ</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {student.address || 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Ngày tham gia</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {student.enrollment_date ? format(new Date(student.enrollment_date), 'dd/MM/yyyy') : 'Chưa cập nhật'}
                  </p>
                </div>
              </div>

              {student.note && (
                <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-6 mt-2">
                  <p className="text-sm font-medium text-slate-500 mb-2">Ghi chú</p>
                  <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap border border-slate-100">
                    {student.note}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tuition' && (
          <div className="p-6 sm:p-8">
            <StudentTuitionTab studentId={id!} />
          </div>
        )}

        {activeTab === 'results' && (
          <div className="p-6 sm:p-8">
            <StudentResultsTab studentId={id!} />
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="p-6 sm:p-8">
            <StudentNotesTab studentId={id!} />
          </div>
        )}

        {/* Placeholder contents for other tabs */}
        {!['info', 'tuition', 'results', 'notes'].includes(activeTab) && (
          <div className="p-12 text-center">
            <h4 className="text-lg font-medium text-slate-900 mb-2">Module đang phát triển</h4>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Chức năng quản lý {TABS.find(t => t.id === activeTab)?.name.toLowerCase()} sẽ được tích hợp trong các bản cập nhật tiếp theo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
