import { useParams } from 'react-router-dom';
import MetricCard from '../components/MetricCard';
import RoleBadge from '../components/RoleBadge';
import { roleDashboardConfig } from '../utils/roleConfig';

export default function DashboardPage() {
    const { role } = useParams();
    const roleCode = (role || 'staff').replace(/-/g, '_').toUpperCase();
    const config = roleDashboardConfig[roleCode] || roleDashboardConfig.STAFF;

    return (
        <div className="space-y-8">
            <section className={`rounded-[28px] bg-gradient-to-br ${config.accent} p-[1px] shadow-soft`}>
                <div className="rounded-[27px] bg-[#0f1528]/95 p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <RoleBadge role={roleCode} />
                            <h2 className="mt-5 text-4xl font-semibold text-white">{config.title}</h2>
                            <p className="mt-3 max-w-3xl text-ink-200">
                                A controlled view of the attendance lifecycle, leave balance, payroll state, and security posture for the current role.
                            </p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-ink-200">
                            Server time <span className="block text-2xl font-semibold text-white">{new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {config.summary.map((item) => (
                    <MetricCard key={item.label} {...item} />
                ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Primary actions</div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {config.highlights.map((item) => (
                            <div key={item} className="rounded-3xl border border-white/10 bg-black/15 p-5 text-white">
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Operational focus</div>
                    <ul className="mt-4 space-y-3 text-sm text-ink-100">
                        <li>Face verification stays behind the backend boundary.</li>
                        <li>Attendance is validated against office geolocation and approved IP addresses.</li>
                        <li>Payroll locks require audit trails before any change.</li>
                        <li>Job titles and roles remain separate throughout the workflow.</li>
                    </ul>
                </div>
            </section>
        </div>
    );
}
