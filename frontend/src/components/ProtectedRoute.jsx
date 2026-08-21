import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = null }) {
    const { isAuthenticated, loading, user } = useAuth();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-ink-900 text-white">
                <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm tracking-wide text-ink-100 shadow-soft backdrop-blur">
                    Loading session...
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles?.length && !allowedRoles.includes(user?.roleCode || 'STAFF')) {
        return <Navigate to={`/dashboard/${(user?.roleCode || 'STAFF').toLowerCase().replace('_', '-')}`} replace />;
    }

    return children;
}
