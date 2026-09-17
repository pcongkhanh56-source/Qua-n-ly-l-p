import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { Users, BookOpen, CreditCard, TrendingUp, Calendar, Loader2, CalendarClock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

// Utilities
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function Dashboard() {
  const { user, setDbSetupRequired } = useAuth();
  const [loading, setLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    sessionsToday: 0,
    studentsToday: 0,
    tuitionMonthTotal: 0,
    tuitionPaid: 0,
    tuitionMissing: 0,
    studentsInDebt: 0
  });

  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [classData, setClassData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [tuitionStatusData, setTuitionStatusData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      // 1. Total Students
      const { count: studentsCount, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      if (studentsError) throw studentsError;

      // 2. Total Classes
      const { count: classesCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      if (studentsError) throw studentsError;

      // 3. Sessions Today with student count
      const { data: sessionsTodayData } = await supabase
        .from('sessions')
        .select('*, class:classes(class_name, id)')
        .eq('session_date', todayStr);

      const sessionIds = sessionsTodayData?.map(s => s.id) || [];
      const classIdsForSessions = sessionsTodayData?.map(s => s.class_id) || [];
      
      // 4. Students in today's sessions
      const { data: studentClassesToday } = await supabase
        .from('student_classes')
        .select('class_id')
        .in('class_id', classIdsForSessions);

      const studentsTodayCount = studentClassesToday?.length || 0;
      
      const sessionsWithCounts = sessionsTodayData?.map(session => {
        const count = studentClassesToday?.filter(sc => sc.class_id === session.class_id).length || 0;
        return { ...session, studentCount: count };
      }) || [];

      // 5. Tuition this month
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      const { data: tuitionData } = await supabase
        .from('student_tuition')
        .select('amount_due, amount_paid, balance')
        .eq('month', currentMonth)
        .eq('year', currentYear);

      let totalDue = 0, totalPaid = 0, totalMissing = 0, inDebtCount = 0;
      if (tuitionData) {
        tuitionData.forEach(t => {
          totalDue += t.amount_due;
          totalPaid += t.amount_paid;
          totalMissing += t.balance;
          if (t.balance > 0) inDebtCount++;
        });
      }

      setStats({
        totalStudents: studentsCount || 0,
        totalClasses: classesCount || 0,
        sessionsToday: sessionsTodayData?.length || 0,
        studentsToday: studentsTodayCount || 0,
        tuitionMonthTotal: totalDue,
        tuitionPaid: totalPaid,
        tuitionMissing: totalMissing,
        studentsInDebt: inDebtCount
      });

      setTodaySessions(sessionsWithCounts);

      // 6. Charts Data
      // Revenue 12 months
      const revData = [];
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(today, i);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        
        const { data: monthPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('transaction_status', 'active')
          .gte('payment_date', format(startOfMonth(d), 'yyyy-MM-dd'))
          .lte('payment_date', format(endOfMonth(d), 'yyyy-MM-dd'));
          
        const mTotal = monthPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        revData.push({ name: `T${m}/${y}`, total: mTotal });
      }
      setRevenueData(revData);

      // Students per class
      const { data: activeClasses } = await supabase.from('classes').select('id, class_name').eq('status', 'active');
      if (studentsError) throw studentsError;
      const { data: studentClasses } = await supabase.from('student_classes').select('class_id');
      
      const cData = activeClasses?.map(c => {
        const count = studentClasses?.filter(sc => sc.class_id === c.id).length || 0;
        return { name: c.class_name, count };
      }) || [];
      setClassData(cData.filter(c => c.count > 0));

      // Attendance Rate (last 30 days)
      const { data: attendanceLogs } = await supabase
        .from('attendance')
        .select('status');
      
      let pCount = 0, aCount = 0, eCount = 0, lCount = 0;
      attendanceLogs?.forEach(a => {
        if (a.status === 'present') pCount++;
        if (a.status === 'absent') aCount++;
        if (a.status === 'excused') eCount++;
        if (a.status === 'late') lCount++;
      });
      setAttendanceData([
        { name: 'Có mặt', value: pCount },
        { name: 'Vắng', value: aCount },
        { name: 'Có phép', value: eCount },
        { name: 'Đi trễ', value: lCount }
      ]);

      // Paid vs Debt
      setTuitionStatusData([
        { name: 'Đã thu', value: totalPaid },
        { name: 'Còn nợ', value: totalMissing }
      ]);

    } catch (error: any) {
      if (error?.code === "PGRST205") setDbSetupRequired(true);
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Hiệu suất và tình hình hoạt động của trung tâm
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Row 1 */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="rounded-lg bg-blue-50 p-3 text-blue-600"><Users className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Học sinh đang học</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalStudents}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="rounded-lg bg-indigo-50 p-3 text-indigo-600"><BookOpen className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Lớp học đang mở</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalClasses}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600"><CalendarClock className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Buổi học hôm nay</p>
            <p className="text-2xl font-bold text-slate-900">{stats.sessionsToday}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="rounded-lg bg-amber-50 p-3 text-amber-600"><Users className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Lượt học sinh hôm nay</p>
            <p className="text-2xl font-bold text-slate-900">{stats.studentsToday}</p>
          </div>
        </div>

        {/* Row 2 */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="rounded-lg bg-slate-50 p-3 text-slate-600"><CreditCard className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Tổng học phí T{new Date().getMonth()+1}</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.tuitionMonthTotal)}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="rounded-lg bg-green-50 p-3 text-green-600"><TrendingUp className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Đã thu</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.tuitionPaid)}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="rounded-lg bg-red-50 p-3 text-red-600"><TrendingUp className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Còn thiếu</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.tuitionMissing)}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="rounded-lg bg-orange-50 p-3 text-orange-600"><Users className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Học sinh còn nợ</p>
            <p className="text-xl font-bold text-slate-900">{stats.studentsInDebt}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-slate-900">Lịch học hôm nay</h2>
            <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{format(new Date(), 'dd/MM/yyyy')}</span>
          </div>
          <div className="p-4 flex-1 overflow-auto">
            {todaySessions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm flex flex-col items-center">
                <Calendar className="w-12 h-12 text-slate-200 mb-2" />
                Không có lịch học nào hôm nay.
              </div>
            ) : (
              <div className="space-y-4">
                {todaySessions.map((session) => (
                  <div key={session.id} className="border border-slate-100 rounded-lg p-3 hover:border-blue-100 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-slate-900">{session.class?.class_name} <span className="text-xs text-slate-500 font-normal ml-1">({session.studentCount} HS)</span></div>
                      <div className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {session.start_time.slice(0,5)} - {session.end_time.slice(0,5)}
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <div className="text-xs text-slate-500">
                        {session.status === 'completed' ? (
                          <span className="text-green-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Đã hoàn thành</span>
                        ) : (
                          <span className="text-blue-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Đã lên lịch</span>
                        )}
                      </div>
                      <Link
                        to="/attendance"
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                      >
                        Điểm danh
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chart: Revenue */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Doanh thu 12 tháng gần nhất</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis tickFormatter={(val) => `${val / 1000000}M`} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <RechartsTooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  cursor={{fill: '#f8fafc'}}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart: Students by class */}
        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Học sinh theo lớp</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={classData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {classData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '12px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart: Attendance */}
        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Tỷ lệ chuyên cần</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({name, percent}: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {attendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={
                      entry.name === 'Có mặt' ? '#22c55e' : 
                      entry.name === 'Vắng' ? '#ef4444' : 
                      entry.name === 'Có phép' ? '#f59e0b' : '#3b82f6'
                    } />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart: Tuition */}
        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Tình trạng thu học phí tháng</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tuitionStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Pie>
                <RechartsTooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '12px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
