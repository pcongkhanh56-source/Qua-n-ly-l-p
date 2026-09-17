import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { Class, ClassSession, Student } from '@/src/types';
import { Loader2, Check, X, Clock, PlayCircle, AlertCircle, Save, CheckCircle2, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';

type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late' | 'makeup';

interface StudentAttendance {
  student: Student;
  status: AttendanceStatus;
  note: string;
}

interface StudentStats {
  total: number;
  present: number;
  absent: number;
  excused: number;
  late: number;
  rate: number;
}

const STATUS_CONFIG = {
  present: { label: 'Có mặt', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200', icon: Check },
  late: { label: 'Đi trễ', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200', icon: Clock },
  excused: { label: 'Có phép', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200', icon: CheckCircle2 },
  absent: { label: 'Vắng', color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200', icon: X },
  makeup: { label: 'Học bù', color: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200', icon: PlayCircle },
};

export function AttendancePage() {
  const location = useLocation();
  const state = location.state as { classId?: string, sessionId?: string } | null;
  const { user } = useAuth();
  const { showToast } = useToast();

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(state?.classId || '');
  
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(state?.sessionId || '');

  const [studentsData, setStudentsData] = useState<StudentAttendance[]>([]);
  const [studentStats, setStudentStats] = useState<Record<string, StudentStats>>({});
  
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch Classes
  useEffect(() => {
    const fetchClasses = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .eq('teacher_id', user.id)
          .eq('status', 'active')
          .order('class_name');

        if (error) throw error;
        setClasses(data || []);
      } catch (error) {
        console.error('Error fetching classes:', error);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchClasses();
  }, [user]);

  // 2. Fetch Sessions when Class changes
  useEffect(() => {
    if (!selectedClassId) {
      setSessions([]);
      setSelectedSessionId('');
      setStudentsData([]);
      return;
    }

    const fetchSessions = async () => {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('class_id', selectedClassId)
          .order('session_date', { ascending: false })
          .order('start_time', { ascending: false })
          .limit(20);

        if (error) throw error;
        setSessions(data || []);
        
        // Auto-select latest session if available
        if (data && data.length > 0) {
          setSelectedSessionId(data[0].id);
        } else {
          setSelectedSessionId('');
        }
      } catch (error) {
        console.error('Error fetching sessions:', error);
      }
    };
    fetchSessions();
  }, [selectedClassId]);

  // 3. Fetch Students and Attendance when Session changes
  useEffect(() => {
    if (!selectedClassId || !selectedSessionId) {
      setStudentsData([]);
      return;
    }

    const fetchAttendanceData = async () => {
      setLoadingData(true);
      try {
        // Fetch active students in class
        const { data: classStudents, error: stuError } = await supabase
          .from('student_classes')
          .select('student:students(*)')
          .eq('class_id', selectedClassId)
          .eq('status', 'active');

        if (stuError) throw stuError;

        // Fetch existing attendance for this session
        const { data: existingAttendance, error: attError } = await supabase
          .from('attendance')
          .select('*')
          .eq('session_id', selectedSessionId);

        if (attError) throw attError;

        const attendanceMap = new Map(existingAttendance?.map(a => [a.student_id, a]));

        // Merge
        const mergedData: StudentAttendance[] = (classStudents || [])
          .filter(sc => sc.student) // Safely ignore nulls
          .map(sc => {
            const student = sc.student as unknown as Student;
            const existingRecord = attendanceMap.get(student.id);
            return {
              student,
              status: (existingRecord?.status as AttendanceStatus) || 'present', // Default to present
              note: existingRecord?.note || '',
            };
          });

        // Sort alphabetically by full_name
        mergedData.sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));
        
        setStudentsData(mergedData);

        // -- Fetch overall class stats for these students --
        const { data: allAttendance, error: statsError } = await supabase
          .from('attendance')
          .select('student_id, status, sessions!inner(class_id)')
          .eq('sessions.class_id', selectedClassId);

        if (!statsError && allAttendance) {
          const statsMap: Record<string, StudentStats> = {};
          
          mergedData.forEach(({ student }) => {
            const studentRecords = allAttendance.filter(a => a.student_id === student.id);
            const total = studentRecords.length;
            const present = studentRecords.filter(a => a.status === 'present').length;
            const absent = studentRecords.filter(a => a.status === 'absent').length;
            const excused = studentRecords.filter(a => a.status === 'excused').length;
            const late = studentRecords.filter(a => a.status === 'late').length;
            
            statsMap[student.id] = {
              total, present, absent, excused, late,
              rate: total > 0 ? Math.round(((present + late) / total) * 100) : 100
            };
          });
          setStudentStats(statsMap);
        }

      } catch (error) {
        console.error('Error fetching attendance data:', error);
        showToast('Không thể tải dữ liệu điểm danh', 'error');
      } finally {
        setLoadingData(false);
      }
    };

    fetchAttendanceData();
  }, [selectedClassId, selectedSessionId]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStudentsData(prev => 
      prev.map(item => item.student.id === studentId ? { ...item, status } : item)
    );
  };

  const setAllStatus = (status: AttendanceStatus) => {
    setStudentsData(prev => prev.map(item => ({ ...item, status })));
  };

  const handleSave = async () => {
    if (!selectedSessionId || studentsData.length === 0) return;
    
    setIsSaving(true);
    try {
      const payload = studentsData.map(item => ({
        teacher_id: user?.id,
        session_id: selectedSessionId,
        student_id: item.student.id,
        status: item.status,
        note: item.note
      }));

      // Upsert attendance records
      const { error } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'session_id,student_id' });

      if (error) throw error;

      // Update session status to completed
      await supabase
        .from('sessions')
        .update({ status: 'completed' })
        .eq('id', selectedSessionId);

      showToast('Đã lưu điểm danh thành công', 'success');
      
      // Update local session status in dropdown to reflect completion
      setSessions(prev => prev.map(s => s.id === selectedSessionId ? { ...s, status: 'completed' } : s));
      
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      showToast('Lỗi khi lưu điểm danh', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingInitial) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Điểm danh</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quản lý điểm danh học sinh nhanh chóng. Đặc biệt tối ưu cho thao tác trên điện thoại.
        </p>
      </div>

      {/* Selectors */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 sticky top-16 z-20">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Lớp học</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Chọn lớp học --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.class_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Buổi học</label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            disabled={!selectedClassId || sessions.length === 0}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
          >
            {sessions.length === 0 ? (
              <option value="">{selectedClassId ? 'Không có buổi học nào' : '-- Chọn buổi học --'}</option>
            ) : (
              sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {format(new Date(s.session_date), 'dd/MM/yyyy')} ({s.start_time.slice(0,5)}) {s.status === 'completed' ? '✓' : ''}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Attendance List */}
      {!selectedClassId || !selectedSessionId ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
          <CheckSquare className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-900">Vui lòng chọn Lớp và Buổi học</p>
        </div>
      ) : loadingData ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : studentsData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
          <AlertCircle className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-900">Lớp học chưa có học sinh</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
            <span className="text-sm font-medium text-blue-900">
              Sĩ số: <span className="font-bold text-blue-700">{studentsData.length}</span> học sinh
            </span>
            <button
              onClick={() => setAllStatus('present')}
              className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-sm font-medium rounded-md shadow-sm hover:bg-blue-100 transition-colors"
            >
              ✓ Tất cả có mặt
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {studentsData.map(({ student, status }) => {
              const stats = studentStats[student.id];
              return (
                <div key={student.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:border-blue-300 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">{student.full_name}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{student.student_code}</p>
                      
                      {/* Mini Stats Line */}
                      {stats && (
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <span className={stats.rate >= 80 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            Chuyên cần: {stats.rate}%
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-500">Vắng: {stats.absent}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Buttons - Mobile optimized grid */}
                  <div className="grid grid-cols-5 gap-2">
                    {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((st) => {
                      const config = STATUS_CONFIG[st];
                      const Icon = config.icon;
                      const isSelected = status === st;
                      return (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(student.id, st)}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all active:scale-95
                            ${isSelected ? config.color : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}
                          `}
                        >
                          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 mb-1 ${isSelected ? '' : 'text-slate-400'}`} />
                          <span className="text-[10px] sm:text-xs font-medium text-center leading-tight">
                            {config.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Save Button */}
      {studentsData.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30 md:left-64">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="text-sm font-medium text-slate-700 hidden sm:block">
              <span className="text-green-600 font-bold">{studentsData.filter(s => s.status === 'present').length}</span> có mặt, {' '}
              <span className="text-red-600 font-bold">{studentsData.filter(s => s.status === 'absent').length}</span> vắng
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto flex justify-center items-center px-8 py-3 bg-blue-600 text-white text-base font-bold rounded-xl shadow-md hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 disabled:opacity-70 transition-all active:scale-95"
            >
              {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
              LƯU ĐIỂM DANH
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
