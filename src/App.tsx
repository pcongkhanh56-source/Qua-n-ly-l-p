import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { StudentList } from './pages/students';
import { StudentDetail } from './pages/students/StudentDetail';
import { ClassList } from './pages/classes';
import { ClassDetail } from './pages/classes/ClassDetail';
import { AttendancePage } from './pages/attendance';
import { TuitionPage } from './pages/tuition';
import { ResultsPage } from './pages/results';
import { ReportsPage } from './pages/reports';
import { SchedulePage } from './pages/schedule';

// Placeholders for future pages
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="py-8 text-center">
    <h2 className="text-2xl font-semibold text-slate-800">{title}</h2>
    <p className="mt-2 text-slate-500">Module này sẽ được phát triển ở các bước tiếp theo.</p>
  </div>
);

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>
            
            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* Students Module */}
              <Route path="students">
                <Route index element={<StudentList />} />
                <Route path=":id" element={<StudentDetail />} />
              </Route>

              {/* Classes Module */}
              <Route path="classes">
                <Route index element={<ClassList />} />
                <Route path=":id" element={<ClassDetail />} />
              </Route>

              {/* Attendance */}
              <Route path="attendance" element={<AttendancePage />} />
              
              {/* Tuition */}
              <Route path="tuition" element={<TuitionPage />} />

              <Route path="schedule" element={<SchedulePage />} />
              <Route path="results" element={<ResultsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<PlaceholderPage title="Cài đặt" />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
