import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  CalendarDays, 
  CheckSquare, 
  CreditCard, 
  GraduationCap, 
  BarChart3, 
  Settings,
  X,
  LogOut
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Học sinh', href: '/students', icon: Users },
  { name: 'Lớp học', href: '/classes', icon: BookOpen },
  { name: 'Lịch học', href: '/schedule', icon: CalendarDays },
  { name: 'Điểm danh', href: '/attendance', icon: CheckSquare },
  { name: 'Học phí', href: '/tuition', icon: CreditCard },
  { name: 'Kết quả học tập', href: '/results', icon: GraduationCap },
  { name: 'Báo cáo', href: '/reports', icon: BarChart3 },
  { name: 'Cài đặt', href: '/settings', icon: Settings },
];

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const { user, profile, signOut } = useAuth();

  // Close sidebar on mobile when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [window.location.pathname, setSidebarOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/80 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col transform bg-slate-900 text-white transition-transform duration-300 ease-in-out md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-6 bg-slate-950">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-blue-600 text-white p-1.5 rounded-lg">TK</span>
            Thầy Khanh
          </h1>
          <button 
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex flex-1 flex-col overflow-y-auto pt-4 pb-4">
          <nav className="flex-1 space-y-1 px-3">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors'
                  )
                }
              >
                <item.icon
                  className="mr-3 h-5 w-5 flex-shrink-0"
                  aria-hidden="true"
                />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="flex shrink-0 bg-slate-950 p-4 border-t border-slate-800 mt-auto">
          <div className="group block w-full flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold mr-3 shrink-0">
                  {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div className="flex flex-col truncate">
                  <p className="text-sm font-medium text-white truncate max-w-[120px]" title={profile?.full_name || user?.email || ''}>
                    {profile?.full_name || user?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs font-medium text-slate-400 truncate max-w-[120px]" title={user?.email || ''}>
                    {user?.email}
                  </p>
                </div>
              </div>
              <button 
                onClick={signOut}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors shrink-0"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
