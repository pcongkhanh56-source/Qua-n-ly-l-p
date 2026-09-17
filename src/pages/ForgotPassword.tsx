import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setMessage('Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư của bạn.');
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra. Vui lòng kiểm tra lại email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
      </div>
      <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
        Khôi phục mật khẩu
      </h2>
      <p className="mt-2 text-center text-sm text-slate-600">
        Nhập email của bạn để nhận liên kết khôi phục
      </p>

      <div className="mt-8 bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-xl sm:px-10 border border-slate-100">
        <form className="space-y-6" onSubmit={handleReset}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {message && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
              <p className="text-sm text-green-700">{message}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full appearance-none rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="admin@example.com"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-lg border border-transparent bg-blue-600 py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 transition-colors"
            >
              {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : 'GỬI LIÊN KẾT'}
            </button>
          </div>
          
          <div className="text-center text-sm">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Quay lại đăng nhập
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
