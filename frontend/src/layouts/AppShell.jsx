import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Camera, FileText, CalendarCheck2, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, X } from 'lucide-react';
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const role = user?.roleCode || 'STAFF';
    const items = navigationItems[role] || navigationItems.STAFF;

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    async function handleLogout() {
        await logout();
        setMobileMenuOpen(false);
        navigate('/login');
    }

    function renderNavigation() {
        return (
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
        );
    }

    function renderProfileCard() {
        return (
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
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,205,102,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(77,197,255,0.16),_transparent_32%),linear-gradient(180deg,_#090e1b_0%,_#111627_42%,_#0b1020_100%)] text-white">
            {mobileMenuOpen ? (
                <div className="fixed inset-0 z-40 bg-[#050811]/75 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenuOpen(false)} />
            ) : null}

            <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-4 lg:p-6">
                <aside className={`fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-sm flex-col border-r border-white/10 bg-[#0b1020] p-5 shadow-2xl transition-transform duration-200 lg:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="flex items-start justify-between gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-white/15 to-white/5 p-4">
                        <div>
                            <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Attendance</div>
                            <div className="mt-2 text-2xl font-semibold">Workforce OS</div>
                            <p className="mt-2 text-sm text-ink-200">Face, geofence, payroll, leave, and audit in one flow.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(false)}
                            className="rounded-full border border-white/10 bg-white/5 p-2 text-white"
                            aria-label="Close menu"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {renderNavigation()}
                    {renderProfileCard()}
                </aside>

                <aside className="hidden w-72 shrink-0 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-soft backdrop-blur-xl lg:flex lg:flex-col">
                    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/15 to-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Attendance</div>
                        <div className="mt-2 text-2xl font-semibold">Workforce OS</div>
                        <p className="mt-2 text-sm text-ink-200">Face, geofence, payroll, leave, and audit in one flow.</p>
                    </div>

                    {renderNavigation()}
                    {renderProfileCard()}
                </aside>

                <main className="flex-1 rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-soft backdrop-blur-xl lg:p-6">
                    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                        <div className="flex items-start gap-3">
                            <button
                                type="button"
                                onClick={() => setMobileMenuOpen(true)}
                                className="mt-0.5 inline-flex shrink-0 self-start rounded-full border border-white/15 bg-white/5 p-2.5 text-white lg:hidden"
                                aria-label="Open menu"
                            >
                                <Menu size={18} />
                            </button>
                            <div>
                                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">{role.replaceAll('_', ' ')}</div>
                                <h1 className="mt-2 text-2xl font-semibold text-white">Attendance and workforce control center</h1>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/attendance')}
                            className="rounded-full bg-white px-4 py-3 text-sm font-medium text-ink-900 transition hover:scale-[1.02] sm:px-5"
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
