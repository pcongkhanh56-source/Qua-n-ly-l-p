import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { useToast } from '@/src/contexts/ToastContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export function ReportsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [studentStats, setStudentStats] = useState<any>(null);
  const [attendanceStats, setAttendanceStats] = useState<any>(null);
  const [tuitionStats, setTuitionStats] = useState<any>(null);
  const [revenueByMonth, setRevenueByMonth] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
    try {
      // 1. Student Stats
      const { data: students } = await supabase.from('students').select('status');
      let active = 0, inactive = 0, archived = 0;
      students?.forEach(s => {
        if (s.status === 'active') active++;
        else if (s.status === 'inactive') inactive++;
        else archived++;
      });
      setStudentStats([
        { name: 'Đang học', value: active },
        { name: 'Tạm nghỉ', value: inactive },
        { name: 'Đã nghỉ', value: archived }
      ]);

      // 2. Attendance Stats
      const { data: attendance } = await supabase.from('attendance').select('status');
      let present = 0, absent = 0, excused = 0, late = 0;
      attendance?.forEach(a => {
        if (a.status === 'present') present++;
        if (a.status === 'absent') absent++;
        if (a.status === 'excused') excused++;
        if (a.status === 'late') late++;
      });
      setAttendanceStats([
        { name: 'Có mặt', value: present },
        { name: 'Vắng mặt', value: absent },
        { name: 'Có phép', value: excused },
        { name: 'Đi trễ', value: late }
      ]);

      // 3. Tuition Stats (Current month)
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const { data: tuition } = await supabase
        .from('student_tuition')
        .select('amount_due, amount_paid, balance')
        .eq('month', currentMonth)
        .eq('year', currentYear);
      
      let due = 0, paid = 0, balance = 0;
      tuition?.forEach(t => {
        due += t.amount_due;
        paid += t.amount_paid;
        balance += t.balance;
      });
      setTuitionStats([
        { name: 'Đã thu', value: paid },
        { name: 'Còn thiếu', value: balance }
      ]);

      // 4. Revenue By Month (last 6 months)
      const revData = [];
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
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
      setRevenueByMonth(revData);

    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleExportCSV = async (type: string) => {
    try {
      let dataToExport: any[] = [];
      let headers: string[] = [];

      if (type === 'students') {
        const { data } = await supabase.from('students').select('student_code, full_name, date_of_birth, gender, student_phone, parent_phone, status');
        headers = ['Mã HS', 'Họ tên', 'Ngày sinh', 'Giới tính', 'SĐT HS', 'SĐT Phụ huynh', 'Trạng thái'];
        dataToExport = data?.map(d => [d.student_code, d.full_name, d.date_of_birth, d.gender, d.student_phone, d.parent_phone, d.status]) || [];
      } else if (type === 'tuition') {
        const { data } = await supabase.from('student_tuition').select('month, year, amount_due, amount_paid, balance, status, student:students(full_name)');
        headers = ['Học sinh', 'Tháng', 'Năm', 'Phải thu', 'Đã thu', 'Còn nợ', 'Trạng thái'];
        dataToExport = data?.map(d => [(d.student as any)?.full_name, d.month, d.year, d.amount_due, d.amount_paid, d.balance, d.status]) || [];
      }

      if (dataToExport.length === 0) {
        showToast('Không có dữ liệu để xuất', 'info');
        return;
      }

      // Generate CSV
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + dataToExport.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `export_${type}_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Đã xuất file CSV', 'success');

    } catch (error: any) {
      showToast('Lỗi khi xuất file: ' + error.message, 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo cáo & Thống kê</h1>
          <p className="mt-1 text-sm text-slate-500">Xem tổng quan và xuất dữ liệu hệ thống</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExportCSV('students')} className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
            <Download className="w-4 h-4" /> Xuất DS Học sinh
          </button>
          <button onClick={() => handleExportCSV('tuition')} className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
            <Download className="w-4 h-4" /> Xuất Công nợ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Student Stats */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Tình trạng học sinh</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={studentStats?.filter((d:any)=>d.value>0)} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name, percent}: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  <Cell fill="#22c55e" /> {/* Active */}
                  <Cell fill="#f59e0b" /> {/* Inactive */}
                  <Cell fill="#94a3b8" /> {/* Archived */}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Stats */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Tổng quan điểm danh</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={attendanceStats?.filter((d:any)=>d.value>0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  <Cell fill="#22c55e" /> {/* Present */}
                  <Cell fill="#ef4444" /> {/* Absent */}
                  <Cell fill="#f59e0b" /> {/* Excused */}
                  <Cell fill="#3b82f6" /> {/* Late */}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tuition Stats */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Học phí tháng {new Date().getMonth()+1}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tuitionStats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  <Cell fill="#22c55e" /> {/* Paid */}
                  <Cell fill="#ef4444" /> {/* Due */}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm md:col-span-2 lg:col-span-3">
          <h2 className="font-semibold text-slate-900 mb-4">Biểu đồ doanh thu (6 tháng gần nhất)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis tickFormatter={(val) => `${val / 1000000}M`} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
