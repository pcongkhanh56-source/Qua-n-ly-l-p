import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { Class } from '@/src/types';
import { 
  ArrowLeft, 
  BookOpen, 
  Users, 
  Clock, 
  Calendar, 
  CheckSquare, 
  CreditCard,
  Loader2,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useToast } from '@/src/contexts/ToastContext';
import { ClassScheduleManager } from './ClassScheduleManager';
import { StudentClassManager } from './StudentClassManager';
import { ClassSessionsManager } from './ClassSessionsManager';

const TABS = [
  { id: 'overview', name: 'Tổng quan', icon: BookOpen },
  { id: 'students', name: 'Học sinh', icon: Users },
  { id: 'schedules', name: 'Lịch học', icon: Clock },
  { id: 'sessions', name: 'Buổi học', icon: Calendar },
  { id: 'attendance', name: 'Điểm danh', icon: CheckSquare },
  { id: 'tuition', name: 'Học phí', icon: CreditCard },
];

export function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  
  const [classItem, setClassItem] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dashboard Metrics
  const [studentCount, setStudentCount] = useState(0);
  const [scheduleCount, setScheduleCount] = useState(0);

  useEffect(() => {
    const fetchClassDetail = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setClassItem(data);
        
        // Fetch small dashboard stats
        const [scRes, schedRes] = await Promise.all([
          supabase.from('student_classes').select('id', { count: 'exact' }).eq('class_id', id).eq('status', 'active'),
          supabase.from('class_schedules').select('id', { count: 'exact' }).eq('class_id', id)
        ]);
        
        if (scRes.count !== null) setStudentCount(scRes.count);
        if (schedRes.count !== null) setScheduleCount(schedRes.count);

      } catch (error) {
        console.error('Error fetching class detail:', error);
        showToast('Không thể tải thông tin lớp học', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchClassDetail();
  }, [id, showToast]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!classItem) {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
        <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-sm font-semibold text-slate-900">Không tìm thấy lớp học</h3>
        <div className="mt-6">
          <Link to="/classes" className="text-blue-600 hover:text-blue-500 font-medium text-sm">
            &larr; Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          to="/classes" 
          className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{classItem.class_name}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${classItem.status === 'active' ? 'bg-green-100 text-green-800' : 
                classItem.status === 'completed' ? 'bg-slate-100 text-slate-800' : 
                'bg-red-100 text-red-800'}
            `}>
              {classItem.status === 'active' ? 'Đang mở' : 
               classItem.status === 'completed' ? 'Đã kết thúc' : 'Hủy'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 font-mono">{classItem.class_code} • {classItem.subject || 'Chưa cập nhật môn'}</p>
        </div>
      </div>

      {/* Mini Dashboard for Class Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users className="w-5 h-5" /></div>
            <h3 className="text-sm font-medium text-slate-500">Sĩ số</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{studentCount}</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Clock className="w-5 h-5" /></div>
            <h3 className="text-sm font-medium text-slate-500">Lịch/Tuần</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{scheduleCount}</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg text-green-600"><TrendingUp className="w-5 h-5" /></div>
            <h3 className="text-sm font-medium text-slate-500">Học phí</h3>
          </div>
          <p className="text-xl font-bold text-slate-900 truncate" title={formatCurrency(classItem.tuition_amount)}>
            {formatCurrency(classItem.tuition_amount)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {classItem.tuition_type === 'per_month' ? '/tháng' : classItem.tuition_type === 'per_session' ? '/buổi' : '/khóa'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Calendar className="w-5 h-5" /></div>
            <h3 className="text-sm font-medium text-slate-500">Buổi dự kiến</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{classItem.sessions_per_month}</p>
          <p className="text-xs text-slate-500 mt-1">/tháng</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 bg-slate-50/50 px-4">
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

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-slate-900">Thông tin chi tiết</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <span className="text-sm text-slate-500 block mb-1">Môn học / Khối</span>
                  <span className="font-medium text-slate-900">{classItem.subject || '-'} / {classItem.grade || '-'}</span>
                </div>
                <div>
                  <span className="text-sm text-slate-500 block mb-1">Năm học</span>
                  <span className="font-medium text-slate-900">{classItem.academic_year || '-'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-sm text-slate-500 block mb-1">Địa điểm</span>
                  <span className="font-medium text-slate-900">{classItem.location || 'Chưa cập nhật'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <StudentClassManager classId={id!} />
          )}

          {activeTab === 'schedules' && (
            <ClassScheduleManager classId={id!} />
          )}
          
          {activeTab === 'sessions' && (
            <ClassSessionsManager classId={id!} />
          )}

          {/* Placeholders for upcoming features */}
          {['attendance', 'tuition'].includes(activeTab) && (
            <div className="text-center py-12">
              <h4 className="text-lg font-medium text-slate-900 mb-2">Module đang phát triển</h4>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Chức năng {TABS.find(t => t.id === activeTab)?.name.toLowerCase()} cho lớp học sẽ được cập nhật trong các bản phát hành tới.
              </p>
              
              {activeTab === 'attendance' && (
                <Link to="/attendance" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  Đến trang Điểm danh chung
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
