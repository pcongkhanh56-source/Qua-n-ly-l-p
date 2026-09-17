import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { useToast } from '@/src/contexts/ToastContext';
import { Class, Student } from '@/src/types';
import { Loader2, Check, Plus, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export function ResultsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    test_name: '',
    test_date: format(new Date(), 'yyyy-MM-dd'),
    score: '',
    max_score: '10',
    comment: ''
  });

  // Data
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents();
      fetchResults();
    } else {
      setStudents([]);
      setResults([]);
    }
  }, [selectedClassId]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('status', 'active')
        .order('class_name');
      if (error) throw error;
      setClasses(data || []);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('student_classes')
        .select('student_id, students(*)')
        .eq('class_id', selectedClassId);
      
      if (error) throw error;
      const studs = data?.map(d => d.students) || [];
      setStudents(studs as any);
    } catch (error: any) {
      console.error(error);
    }
  };

  const fetchResults = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('academic_results')
        .select('*, student:students(full_name, student_code)')
        .eq('class_id', selectedClassId)
        .order('test_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResults(data || []);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        teacher_id: user?.id,
        class_id: selectedClassId,
        student_id: formData.student_id,
        test_name: formData.test_name,
        test_date: formData.test_date,
        score: parseFloat(formData.score),
        max_score: parseFloat(formData.max_score),
        comment: formData.comment
      };

      const { error } = await supabase.from('academic_results').insert([payload]);
      if (error) throw error;

      showToast('Thêm kết quả thành công', 'success');
      setShowForm(false);
      setFormData({
        ...formData,
        student_id: '',
        test_name: '',
        score: '',
        comment: ''
      });
      fetchResults();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá kết quả này?')) return;
    try {
      const { error } = await supabase.from('academic_results').delete().eq('id', id);
      if (error) throw error;
      showToast('Đã xoá kết quả', 'success');
      fetchResults();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kết quả học tập</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý điểm số và bài kiểm tra</p>
        </div>
        {selectedClassId && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Thêm kết quả
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <label className="block text-sm font-medium text-slate-700 mb-1">Chọn lớp học</label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Chọn lớp --</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.class_name}</option>
          ))}
        </select>
      </div>

      {showForm && selectedClassId && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-200 bg-blue-50/30">
          <h3 className="font-medium text-slate-900 mb-4">Nhập điểm mới</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Học sinh</label>
              <select required value={formData.student_id} onChange={e => setFormData({...formData, student_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">-- Chọn học sinh --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.student_code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên bài kiểm tra</label>
              <input required type="text" value={formData.test_name} onChange={e => setFormData({...formData, test_name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Ví dụ: Giữa kỳ 1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ngày thi</label>
              <input required type="date" value={formData.test_date} onChange={e => setFormData({...formData, test_date: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Điểm đạt được</label>
              <input required type="number" step="0.1" value={formData.score} onChange={e => setFormData({...formData, score: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Thang điểm (Điểm tối đa)</label>
              <input required type="number" step="0.1" value={formData.max_score} onChange={e => setFormData({...formData, max_score: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nhận xét</label>
              <input type="text" value={formData.comment} onChange={e => setFormData({...formData, comment: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Nhận xét bài làm..." />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Huỷ</button>
              <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Lưu kết quả</button>
            </div>
          </form>
        </div>
      )}

      {selectedClassId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Học sinh</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bài thi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ngày thi</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Điểm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nhận xét</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-sm">
                      Chưa có dữ liệu điểm số nào cho lớp này.
                    </td>
                  </tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{r.student?.full_name}</div>
                        <div className="text-xs text-slate-500">{r.student?.student_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{r.test_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{format(new Date(r.test_date), 'dd/MM/yyyy')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          r.score / r.max_score >= 0.8 ? 'bg-green-100 text-green-800' :
                          r.score / r.max_score >= 0.5 ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {r.score} / {r.max_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">{r.comment}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
