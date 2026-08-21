import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import AppShell from '../layouts/AppShell';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import AttendancePage from '../pages/AttendancePage';
import LeavePage from '../pages/LeavePage';
import PayrollDashboardPage from '../pages/payroll/PayrollDashboardPage';
import RunPayrollPage from '../pages/payroll/RunPayrollPage';
import PayrollDetailPage from '../pages/payroll/PayrollDetailPage';
import PayrollHistoryPage from '../pages/payroll/PayrollHistoryPage';
import PayrollPaymentsPage from '../pages/payroll/PayrollPaymentsPage';
import SalaryStructurePage from '../pages/payroll/SalaryStructurePage';
import PayslipsPage from '../pages/payroll/PayslipsPage';
import ReportsPage from '../pages/ReportsPage';
import EmployeesPage from '../pages/EmployeesPage';
import FaceRegistrationPage from '../pages/FaceRegistrationPage';
import AttendanceSummaryPage from '../pages/AttendanceSummaryPage';
import PublicAttendancePage from '../pages/PublicAttendancePage';
import SettingsPage from '../pages/SettingsPage';
import NotFoundPage from '../pages/NotFoundPage';

function RoleRedirect() {
    const { user, isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/public-attendance" replace />;
    }

    const role = user?.roleCode || 'STAFF';
    return <Navigate to={`/dashboard/${role.toLowerCase().replace('_', '-')}`} replace />;
}

export default function AppRouter() {
    return (
        <Routes>
            <Route path="/public-attendance" element={<PublicAttendancePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RoleRedirect />} />
            <Route
                path="/dashboard/:role"
                element={
                    <ProtectedRoute>
                        <AppShell>
                            <DashboardPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/attendance"
                element={
                    <ProtectedRoute>
                        <AppShell>
                            <AttendancePage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/face-registration"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <AppShell>
                            <FaceRegistrationPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/leave"
                element={
                    <ProtectedRoute>
                        <AppShell>
                            <LeavePage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/payroll"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <AppShell>
                            <PayrollDashboardPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/payroll/run"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <AppShell>
                            <RunPayrollPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/payroll/history"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <AppShell>
                            <PayrollHistoryPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/payroll/payments"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <AppShell>
                            <PayrollPaymentsPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/payroll/history/:id"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <AppShell>
                            <PayrollDetailPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/payroll/salary-structures"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <AppShell>
                            <SalaryStructurePage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/payroll/payslips"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'STAFF', 'MANAGER']}>
                        <AppShell>
                            <PayslipsPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/reports"
                element={
                    <ProtectedRoute>
                        <AppShell>
                            <ReportsPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/attendance-summary"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                        <AppShell>
                            <AttendanceSummaryPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/employees"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                        <AppShell>
                            <EmployeesPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/settings"
                element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <AppShell>
                            <SettingsPage />
                        </AppShell>
                    </ProtectedRoute>
                }
            />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}
