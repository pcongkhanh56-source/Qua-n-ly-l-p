import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { useToast } from '@/src/contexts/ToastContext';
import { ClassSession, Class } from '@/src/types';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  BookOpen, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Edit2,
  Trash2,
  ClipboardCheck
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth, 
  isSameDay,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  parseISO,
  isToday,
  addDays
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { SessionModal } from './SessionModal';
import { SessionFormModal } from './SessionFormModal';

type ViewMode = 'today' | 'week' | 'month';

export interface EnrichedSession extends ClassSession {
  class?: Class;
  studentCount?: number;
}

export function SchedulePage() {
  const { user, setDbSetupRequired } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<EnrichedSession[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Generate sessions
  const [isGenerating, setIsGenerating] = useState(false);
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genClassId, setGenClassId] = useState<string>('');

  // Modals
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<EnrichedSession | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchClasses();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchSessions();
  }, [user, currentDate, viewMode, selectedClassId]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('status', 'active');
      
      if (error) throw error;
      setClasses(data || []);
      if (data && data.length > 0) {
        setGenClassId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      if (error?.code === "PGRST205") setDbSetupRequired(true);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let start, end;
      
      if (viewMode === 'today') {
        start = currentDate;
        end = currentDate;
      } else if (viewMode === 'week') {
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
      } else {
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
      }

      let query = supabase
        .from('sessions')
        .select('*, class:classes(*)')
        .gte('session_date', format(start, 'yyyy-MM-dd'))
        .lte('session_date', format(end, 'yyyy-MM-dd'))
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (selectedClassId !== 'all') {
        query = query.eq('class_id', selectedClassId);
      }

      const { data: sessionData, error: sessionError } = await query;
      if (sessionError) throw sessionError;

      // Get student counts for active classes
      const { data: studentClassesData, error: scError } = await supabase
        .from('student_classes')
        .select('class_id')
        .eq('status', 'active');
        
      if (scError) throw scError;

      // Map counts
      const counts: Record<string, number> = {};
      studentClassesData?.forEach(sc => {
        counts[sc.class_id] = (counts[sc.class_id] || 0) + 1;
      });

      const enriched = sessionData?.map(s => ({
        ...s,
        studentCount: counts[s.class_id] || 0
      })) || [];

      setSessions(enriched);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      showToast('Không thể tải lịch học', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSessions = async () => {
    if (!genClassId) {
      showToast('Vui lòng chọn lớp để tạo lịch', 'error');
      return;
    }
    
    setIsGenerating(true);
    try {
      const { error } = await supabase.rpc('create_monthly_sessions', {
        p_class_id: genClassId,
        p_month: genMonth,
        p_year: genYear,
      });

      if (error) throw error;
      showToast(`Đã tạo lịch học tháng ${genMonth}/${genYear} thành công`, 'success');
      fetchSessions();
    } catch (error: any) {
      console.error('Error generating sessions:', error);
      showToast('Lỗi khi tạo lịch học (kiểm tra lớp đã có lịch học chưa)', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'today') {
      setCurrentDate(prev => direction === 'next' ? addDays(prev, 1) : addDays(prev, -1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
    } else {
      setCurrentDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    }
  };

  const openSessionDetail = (session: EnrichedSession) => {
    setSelectedSession(session);
    setIsDetailModalOpen(true);
  };

  const handleAttendanceClick = (session: EnrichedSession) => {
    navigate('/attendance', { state: { classId: session.class_id, sessionId: session.id } });
  };

  // Render parts
  const renderHeader = () => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Lịch học</h1>
        <p className="text-slate-500 text-sm mt-1">Quản lý và theo dõi lịch giảng dạy</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">Tất cả lớp</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.class_name}</option>
          ))}
        </select>

        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('today')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Hôm nay
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Tuần
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Tháng
          </button>
        </div>

        <button
          onClick={() => {
            setSessionToEdit(null);
            setIsFormModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Tạo buổi học</span>
        </button>
      </div>
    </div>
  );

  const renderGenerateBox = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row items-center gap-4">
      <div className="flex items-center gap-2 text-slate-700 font-medium whitespace-nowrap">
        <CalendarIcon className="w-5 h-5 text-blue-600" />
        Tạo lịch tự động:
      </div>
      <div className="flex flex-wrap items-center gap-3 w-full">
        <select
          value={genClassId}
          onChange={(e) => setGenClassId(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white flex-1 min-w-[120px]"
        >
          {classes.length === 0 && <option value="">Chưa có lớp</option>}
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.class_name}</option>
          ))}
        </select>
        <select
          value={genMonth}
          onChange={(e) => setGenMonth(Number(e.target.value))}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>Tháng {m}</option>
          ))}
        </select>
        <select
          value={genYear}
          onChange={(e) => setGenYear(Number(e.target.value))}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          {[0, 1, 2].map(offset => {
            const y = new Date().getFullYear() + offset - 1;
            return <option key={y} value={y}>Năm {y}</option>;
          })}
        </select>
        <button
          onClick={handleGenerateSessions}
          disabled={isGenerating || !genClassId}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tạo lịch ngay'}
        </button>
      </div>
    </div>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200'; // scheduled
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Đã xong';
      case 'cancelled': return 'Đã hủy';
      default: return 'Sắp học';
    }
  };

  const renderSessionCard = (session: EnrichedSession, compact = false) => {
    return (
      <div 
        key={session.id}
        onClick={() => openSessionDetail(session)}
        className={`rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(session.status)} border bg-white`}
      >
        <div className="flex justify-between items-start mb-1.5">
          <h4 className="font-semibold text-slate-800 text-sm truncate pr-2">{session.class?.class_name}</h4>
          {session.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
          {session.status === 'cancelled' && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
        </div>
        
        <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{session.start_time.substring(0, 5)} - {session.end_time.substring(0, 5)}</span>
        </div>
        
        {!compact && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="truncate">{session.lesson_title || session.class?.subject || 'Chưa có nội dung'}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100/50">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" />
            <span>{session.studentCount || 0}</span>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); handleAttendanceClick(session); }}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              session.status === 'completed' 
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium'
            }`}
          >
            Điểm danh
          </button>
        </div>
      </div>
    );
  };

  const renderDateNavigation = () => {
    let title = '';
    if (viewMode === 'today') {
      title = format(currentDate, 'EEEE, dd/MM/yyyy', { locale: vi });
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      title = `${format(start, 'dd/MM')} - ${format(end, 'dd/MM/yyyy')}`;
    } else {
      title = `Tháng ${format(currentDate, 'MM/yyyy')}`;
    }

    return (
      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg border border-slate-200">
        <button onClick={() => navigateDate('prev')} className="p-1.5 hover:bg-slate-100 rounded-md">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800 capitalize">{title}</h2>
        <button onClick={() => navigateDate('next')} className="p-1.5 hover:bg-slate-100 rounded-md">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>
    );
  };

  const renderTodayView = () => {
    const todaySessions = sessions.filter(s => s.session_date === format(currentDate, 'yyyy-MM-dd'));
    
    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
    
    if (todaySessions.length === 0) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-1">Không có lịch học</h3>
          <p className="text-slate-500">Bạn không có buổi học nào được lên lịch vào ngày này.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        {todaySessions.map(session => (
          <div 
            key={session.id}
            onClick={() => openSessionDetail(session)}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row gap-4"
          >
            <div className="flex-shrink-0 w-24 text-center sm:text-left">
              <div className="text-lg font-bold text-slate-800">{session.start_time.substring(0, 5)}</div>
              <div className="text-sm text-slate-500">{session.end_time.substring(0, 5)}</div>
            </div>
            
            <div className={`flex-1 rounded-xl p-4 border ${getStatusColor(session.status)} bg-opacity-50`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-slate-800">{session.class?.class_name}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.status)} bg-white`}>
                  {getStatusText(session.status)}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <BookOpen className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{session.class?.subject || 'Chưa có môn học'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{session.class?.location || 'Chưa cập nhật'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                  <ClipboardCheck className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{session.lesson_title || 'Chưa có nội dung bài học'}</span>
                </div>
              </div>
              
              <div className="flex justify-end pt-3 border-t border-slate-200/50">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleAttendanceClick(session); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Users className="w-4 h-4" />
                  Điểm danh lớp
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[600px]">
        {/* Mobile: List view per day */}
        <div className="md:hidden overflow-y-auto p-4 space-y-6">
          {days.map(day => {
            const daySessions = sessions.filter(s => s.session_date === format(day, 'yyyy-MM-dd'));
            if (daySessions.length === 0) return null;
            
            return (
              <div key={day.toString()}>
                <h3 className="font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isToday(day) ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                    {format(day, 'dd')}
                  </span>
                  {format(day, 'EEEE', { locale: vi })}
                </h3>
                <div className="space-y-3">
                  {daySessions.map(session => renderSessionCard(session, false))}
                </div>
              </div>
            );
          })}
          {sessions.length === 0 && (
            <div className="text-center py-10 text-slate-500">Không có lịch học trong tuần này</div>
          )}
        </div>

        {/* Desktop: Grid view */}
        <div className="hidden md:flex flex-col h-full">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {days.map(day => (
              <div key={day.toString()} className="py-3 px-2 text-center border-r border-slate-200 last:border-r-0">
                <div className="text-xs font-medium text-slate-500 uppercase">{format(day, 'EEEE', { locale: vi })}</div>
                <div className={`mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${isToday(day) ? 'bg-blue-600 text-white' : 'text-slate-800'}`}>
                  {format(day, 'dd')}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex-1 grid grid-cols-7 overflow-y-auto">
            {days.map((day, i) => {
              const daySessions = sessions.filter(s => s.session_date === format(day, 'yyyy-MM-dd'));
              return (
                <div key={day.toString()} className="border-r border-slate-200 last:border-r-0 p-2 min-h-[500px]">
                  <div className="space-y-2">
                    {daySessions.map(session => renderSessionCard(session, true))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-slate-600 border-r border-slate-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const daySessions = sessions.filter(s => s.session_date === format(day, 'yyyy-MM-dd'));
            const isCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div 
                key={day.toString()} 
                onClick={() => {
                  if (daySessions.length > 0) {
                    setCurrentDate(day);
                    setViewMode('today');
                  }
                }}
                className={`min-h-[100px] p-2 border-r border-b border-slate-200 last:border-r-0 relative cursor-pointer transition-colors hover:bg-slate-50
                  ${!isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : ''}
                  ${i % 7 === 6 ? 'border-r-0' : ''}
                `}
              >
                <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1
                  ${isToday(day) ? 'bg-blue-600 text-white' : 'text-slate-700'}
                `}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-1 mt-1">
                  {daySessions.slice(0, 3).map(session => (
                    <div 
                      key={session.id} 
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate ${getStatusColor(session.status)} border-none bg-opacity-40`}
                      title={`${session.start_time.substring(0, 5)} - ${session.class?.class_name}`}
                    >
                      {session.start_time.substring(0, 5)} {session.class?.class_name}
                    </div>
                  ))}
                  {daySessions.length > 3 && (
                    <div className="text-[10px] text-slate-500 font-medium pl-1">
                      +{daySessions.length - 3} buổi
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {renderHeader()}
      {renderGenerateBox()}
      {renderDateNavigation()}
      
      {viewMode === 'today' && renderTodayView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'month' && renderMonthView()}

      {selectedSession && (
        <SessionModal 
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          session={selectedSession}
          onEdit={() => {
            setIsDetailModalOpen(false);
            setSessionToEdit(selectedSession);
            setIsFormModalOpen(true);
          }}
          onAttendance={() => {
            setIsDetailModalOpen(false);
            handleAttendanceClick(selectedSession);
          }}
          onStatusChange={fetchSessions}
        />
      )}

      {isFormModalOpen && (
        <SessionFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          session={sessionToEdit}
          classes={classes}
          onSuccess={() => {
            setIsFormModalOpen(false);
            fetchSessions();
          }}
        />
      )}
    </div>
  );
}

export default SchedulePage;
