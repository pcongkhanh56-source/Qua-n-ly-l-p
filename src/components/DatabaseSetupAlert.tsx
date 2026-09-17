import { Database, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';

export function DatabaseSetupAlert() {
  const [copied, setCopied] = useState(false);
  const [sqlContent, setSqlContent] = useState('');

  useEffect(() => {
    fetch('/schema.sql')
      .then(res => res.text())
      .then(setSqlContent)
      .catch(() => setSqlContent('-- Could not load schema.sql'));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
              <Database className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-900">Yêu cầu thiết lập Cơ sở dữ liệu</h2>
              <p className="text-amber-700 text-sm mt-1">Hệ thống phát hiện Supabase của bạn chưa được khởi tạo các bảng dữ liệu.</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 flex flex-col">
          <h3 className="font-semibold text-slate-900 mb-2">Hướng dẫn khắc phục (Chỉ thực hiện 1 lần):</h3>
          <ol className="list-decimal list-inside space-y-2 text-slate-700 mb-6 text-sm">
            <li>Truy cập vào trang quản trị <a href="https://supabase.com/dashboard" target="_blank" className="text-blue-600 font-medium hover:underline inline-flex items-center gap-1">Supabase Dashboard <ExternalLink className="w-3 h-3"/></a>.</li>
            <li>Chọn dự án của bạn, mở menu <strong>SQL Editor</strong> ở thanh công cụ bên trái.</li>
            <li>Copy toàn bộ mã SQL dưới đây và dán vào SQL Editor.</li>
            <li>Bấm nút <strong>RUN</strong> để khởi tạo cơ sở dữ liệu.</li>
            <li>Sau khi chạy thành công, hãy tải lại trang web này.</li>
          </ol>

          <div className="relative group flex-1 min-h-[300px]">
            <div className="absolute right-3 top-3">
              <button 
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Đã copy' : 'Copy mã SQL'}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-300 p-5 rounded-xl text-xs overflow-auto h-full font-mono border border-slate-800 shadow-inner">
              {sqlContent}
            </pre>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors shadow-sm">
            Đã chạy xong, Tải lại trang
          </button>
        </div>
      </div>
    </div>
  );
}
