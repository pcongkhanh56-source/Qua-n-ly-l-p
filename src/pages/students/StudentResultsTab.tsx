import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { AcademicResult } from '@/src/types';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function StudentResultsTab({ studentId }: { studentId: string }) {
  const [results, setResults] = useState<AcademicResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [studentId]);

  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_results')
        .select('*, class:classes(class_name)')
        .eq('student_id', studentId)
        .order('test_date', { ascending: true }); // ASC for chart
      
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = results.map(r => ({
    name: r.test_name,
    score: (r.score / r.max_score) * 10, // Normalize to 10 for chart
    rawScore: r.score,
    maxScore: r.max_score,
    date: format(new Date(r.test_date), 'dd/MM')
  }));

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="space-y-6">
      {results.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Biểu đồ tiến bộ (Hệ số 10)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip 
                  formatter={(val: any, name: any, props: any) => [`${props.payload.rawScore}/${props.payload.maxScore}`, 'Điểm']}
                  labelFormatter={(label, props) => props[0]?.payload.name}
                />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ngày thi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bài kiểm tra</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Lớp</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Điểm</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nhận xét</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {results.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">Chưa có kết quả học tập nào.</td>
              </tr>
            ) : (
              [...results].reverse().map(r => (
                <tr key={r.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{format(new Date(r.test_date), 'dd/MM/yyyy')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{r.test_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{r.class?.class_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <span className={`inline-flex px-2 py-1 rounded text-xs ${r.score/r.max_score >= 0.8 ? 'bg-green-100 text-green-800' : r.score/r.max_score >= 0.5 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                      {r.score} / {r.max_score}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{r.comment}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
