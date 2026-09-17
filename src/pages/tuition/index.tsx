import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { Class, TuitionRecord } from '@/src/types';
import { Loader2, Plus, Filter, Wallet, TrendingUp, AlertCircle, Coins, Search } from 'lucide-react';
import { PaymentModal } from './PaymentModal';

type EnrichedTuitionRecord = TuitionRecord & { student: any, class: any };

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export function TuitionPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [records, setRecords] = useState<EnrichedTuitionRecord[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [genMonth, setGenMonth] = useState(currentDate.getMonth() + 1);
  const [genYear, setGenYear] = useState(currentDate.getFullYear());
  const [genClass, setGenClass] = useState('');

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedTuition, setSelectedTuition] = useState<EnrichedTuitionRecord | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user) return;
      try {
        const { data } = await supabase.from('classes').select('*').eq('teacher_id', user.id).eq('status', 'active');
        if (data) {
          setClasses(data);
          if (data.length > 0) setGenClass(data[0].id);
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    fetchInitialData();
  }, [user]);

  const fetchRecords = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('student_tuition')
        .select(`
          *,
          student:students(full_name, student_code),
          class:classes(class_name)
        `)
        .eq('teacher_id', user.id)
        .eq('month', filterMonth)
        .eq('year', filterYear)
        .order('created_at', { ascending: false });

      if (filterClass !== 'all') query = query.eq('class_id', filterClass);
      if (filterStatus !== 'all') query = query.eq('status', filterStatus);

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data as EnrichedTuitionRecord[] || []);
    } catch (error) {
      console.error('Error fetching tuition records:', error);
      showToast('Không thể tải dữ liệu học phí', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [filterMonth, filterYear, filterClass, filterStatus, user]);

  const handleGenerateTuition = async () => {
    if (!genClass || !user) {
      showToast('Vui lòng chọn lớp học', 'error');
      return;
    }
    
    setIsGenerating(true);
    try {
      // 1. Get class info for default tuition amount
      const classInfo = classes.find(c => c.id === genClass);
      if (!classInfo) throw new Error('Không tìm thấy thông tin lớp');

      // 2. Get active students in this class
      const { data: studentClasses, error: scError } = await supabase
        .from('student_classes')
        .select('student_id, custom_tuition')
        .eq('class_id', genClass)
        .eq('status', 'active');
        
      if (scError) throw scError;
      if (!studentClasses || studentClasses.length === 0) {
        showToast('Lớp học chưa có học sinh', 'info');
        setIsGenerating(false);
        return;
      }

      // 3. Get existing records for this month to avoid duplicates
      const { data: existingRecords, error: extError } = await supabase
        .from('student_tuition')
        .select('student_id')
        .eq('class_id', genClass)
        .eq('month', genMonth)
        .eq('year', genYear);
        
      if (extError) throw extError;
      
      const existingIds = new Set(existingRecords?.map(r => r.student_id) || []);
      
      // 4. Create new records for students who don't have one yet
      const newRecords = studentClasses
        .filter(sc => !existingIds.has(sc.student_id))
        .map(sc => {
          const totalAmount = sc.custom_tuition !== null && sc.custom_tuition !== undefined 
            ? sc.custom_tuition 
            : classInfo.tuition_amount;
            
          return {
            student_id: sc.student_id,
            class_id: genClass,
            teacher_id: user.id,
            month: genMonth,
            year: genYear,
            amount_due: totalAmount,
            amount_paid: 0,
            balance: totalAmount,
            status: 'unpaid'
          };
        });

      if (newRecords.length === 0) {
        showToast(`Đã tạo đầy đủ học phí cho tháng ${genMonth}/${genYear}. Không có học sinh mới.`, 'info');
      } else {
        const { error: insertError } = await supabase
          .from('student_tuition')
          .insert(newRecords);
          
        if (insertError) throw insertError;
        showToast(`Tạo thành công học phí cho ${newRecords.length} học sinh`, 'success');
        
        // Auto switch filters to show the newly generated records
        setFilterMonth(genMonth);
        setFilterYear(genYear);
        setFilterClass(genClass);
        fetchRecords();
      }
    } catch (error: any) {
      console.error('Error generating tuition:', error);
      showToast(error.message || 'Lỗi khi tạo học phí', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Compute Stats
  const totalDue = records.reduce((sum, r) => sum + r.amount_due, 0);
  const totalPaid = records.reduce((sum, r) => sum + r.amount_paid, 0);
  const totalBalance = records.reduce((sum, r) => sum + r.balance, 0);
  const studentsInDebt = records.filter(r => r.balance > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Học phí & Công nợ</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quản lý thu tiền học phí, theo dõi công nợ học sinh theo tháng.
        </p>
      </div>

      {/* Generator Tool */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
          <Plus className="w-4 h-4 mr-2 text-blue-600" /> Tạo danh sách học phí tháng
        </h3>
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-slate-500 mb-1">Tháng</label>
            <select value={genMonth} onChange={(e) => setGenMonth(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i+1} value={i+1}>Tháng {i+1}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-slate-500 mb-1">Năm</label>
            <select value={genYear} onChange={(e) => setGenYear(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-64">
            <label className="block text-xs font-medium text-slate-500 mb-1">Lớp học</label>
            <select value={genClass} onChange={(e) => setGenClass(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.class_name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerateTuition}
            disabled={isGenerating || !genClass}
            className="w-full sm:w-auto flex justify-center items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-70 transition-colors"
          >
            {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Tạo học phí
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Wallet className="w-4 h-4" /> <h3 className="text-xs font-medium">Tổng phải thu</h3>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalDue)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2 text-green-600">
            <TrendingUp className="w-4 h-4" /> <h3 className="text-xs font-medium">Tổng đã thu</h3>
          </div>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2 text-red-600">
            <AlertCircle className="w-4 h-4" /> <h3 className="text-xs font-medium">Tổng còn thiếu</h3>
          </div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-600">
            <UsersIcon className="w-4 h-4" /> <h3 className="text-xs font-medium">Học sinh nợ</h3>
          </div>
          <p className="text-xl font-bold text-amber-600">{studentsInDebt} HS</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Bộ lọc:</span>
          </div>
          <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i+1} value={i+1}>Tháng {i+1}</option>
            ))}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="all">Tất cả các lớp</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.class_name}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="all">Tất cả trạng thái</option>
            <option value="unpaid">Chưa đóng</option>
            <option value="partial">Đóng một phần</option>
            <option value="paid">Đã đóng đủ</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Học sinh</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Lớp</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Học phí</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Đã đóng</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Còn thiếu</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" /></td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">Không có dữ liệu học phí phù hợp bộ lọc.</td></tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{record.student.full_name}</div>
                      <div className="text-xs text-slate-500">{record.student.student_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{record.class.class_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 text-right">{formatCurrency(record.amount_due)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 text-right">{formatCurrency(record.amount_paid)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">{formatCurrency(record.balance)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold
                        ${record.status === 'paid' ? 'bg-green-100 text-green-700' : 
                          record.status === 'partial' ? 'bg-orange-100 text-orange-700' : 
                          'bg-red-100 text-red-700'}
                      `}>
                        {record.status === 'paid' ? 'Đã đóng' : record.status === 'partial' ? 'Đóng 1 phần' : 'Chưa đóng'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {record.status !== 'paid' ? (
                        <button
                          onClick={() => {
                            setSelectedTuition(record);
                            setPaymentModalOpen(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Coins className="w-4 h-4 mr-1.5" /> Thu tiền
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic flex items-center justify-end"><CheckCircleIcon className="w-4 h-4 mr-1" /> Hoàn tất</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentModal 
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        tuition={selectedTuition}
        onSuccess={() => {
          fetchRecords();
        }}
      />
    </div>
  );
}

// Missing icons fallback
function UsersIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function CheckCircleIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> }
