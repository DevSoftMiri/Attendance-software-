import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Camera, FileText, CalendarCheck2, LayoutDashboard, LogOut, Settings, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navigationItems } from '../utils/roleConfig';

const iconMap = {
    dashboard: LayoutDashboard,
    attendance: CalendarCheck2,
    leave: FileText,
    reports: FileText,
    employees: Users,
    settings: Settings,
    payroll: ShieldCheck,
    'face-registration': Camera
};

function formatLabel(path) {
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path === '/payroll/run') return 'Run Payroll';
    if (path === '/payroll/history') return 'Payroll History';
    if (path === '/payroll/payments') return 'Salary Payments';
    if (path === '/payroll/salary-structures') return 'Salary Structure';
    if (path === '/payroll/payslips') return 'Payslips';
    return path.replace('/', '').replace('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AppShell({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const role = user?.roleCode || 'STAFF';
    const items = navigationItems[role] || navigationItems.STAFF;

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,205,102,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(77,197,255,0.16),_transparent_32%),linear-gradient(180deg,_#090e1b_0%,_#111627_42%,_#0b1020_100%)] text-white">
            <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-4 lg:p-6">
                <aside className="hidden w-72 shrink-0 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-soft backdrop-blur-xl lg:flex lg:flex-col">
                    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/15 to-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Attendance</div>
                        <div className="mt-2 text-2xl font-semibold">Workforce OS</div>
                        <p className="mt-2 text-sm text-ink-200">Face, geofence, payroll, leave, and audit in one flow.</p>
                    </div>

                    <nav className="mt-6 space-y-2">
                        {items.map((itemPath) => {
                            const active = location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
                            const Icon = iconMap[itemPath.replace('/', '')] || LayoutDashboard;
                            return (
                                <NavLink
                                    key={itemPath}
                                    to={itemPath}
                                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${active ? 'bg-white text-ink-900' : 'text-ink-100 hover:bg-white/10'}`}
                                >
                                    <Icon size={17} />
                                    <span>{formatLabel(itemPath)}</span>
                                </NavLink>
                            );
                        })}
                    </nav>

                    <div className="mt-auto rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-ink-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium text-white">{user?.email || 'demo@company.local'}</div>
                                <div>{role.replaceAll('_', ' ')}</div>
                            </div>
                            <Bell size={18} />
                        </div>
                        <button
                            onClick={handleLogout}
                            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.25em] text-white"
                        >
                            <LogOut size={14} />
                            Sign out
                        </button>
                    </div>
                </aside>

                <main className="flex-1 rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-soft backdrop-blur-xl lg:p-6">
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div>
                            <div className="text-xs uppercase tracking-[0.35em] text-ink-300">{role.replaceAll('_', ' ')}</div>
                            <h1 className="mt-2 text-2xl font-semibold text-white">Attendance and workforce control center</h1>
                        </div>
                        <button
                            onClick={() => navigate('/attendance')}
                            className="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900 transition hover:scale-[1.02]"
                        >
                            Open attendance
                        </button>
                    </div>
                    <div className="pt-6">{children}</div>
                </main>
            </div>
        </div>
    );
}
