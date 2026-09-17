import { Navigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { DatabaseSetupAlert } from './DatabaseSetupAlert';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, dbSetupRequired } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {dbSetupRequired && <DatabaseSetupAlert />}
      {children}
    </>
  );
}
