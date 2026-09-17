import { Menu } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, profile } = useAuth();

  return (
    <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-white shadow-sm border-b border-slate-200">
      <button
        type="button"
        className="border-r border-slate-200 px-4 text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden hover:bg-slate-50"
        onClick={onMenuClick}
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>
      <div className="flex flex-1 justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center">
          {/* Breadcrumbs or Page Title could go here in the future */}
        </div>
        <div className="ml-4 flex items-center md:ml-6 gap-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-slate-700">
              {profile?.full_name || user?.email?.split('@')[0] || 'Giáo viên'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
            {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}
