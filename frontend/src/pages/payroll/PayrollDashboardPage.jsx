import { useEffect, useState } from 'react';
import { fetchPayrollList } from '../../services/payrollService';

function currentPeriod() {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function PayrollDashboardPage() {
    const [summary, setSummary] = useState({
        pending: 0,
        approved: 0,
        paid: 0,
        gross: 0,
        deductions: 0,
        net: 0,
        items: []
    });

    useEffect(() => {
        async function load() {
            const { month, year } = currentPeriod();
            const payroll = await fetchPayrollList({ month, year });
            setSummary({
                pending: payroll.filter((entry) => entry.status === 'pending').length,
                approved: payroll.filter((entry) => entry.status === 'approved').length,
                paid: payroll.filter((entry) => entry.status === 'paid').length,
                gross: payroll.reduce((total, entry) => total + Number(entry.grossSalary || 0), 0),
                deductions: payroll.reduce((total, entry) => total + Number(entry.totalDeduction || 0), 0),
                net: payroll.reduce((total, entry) => total + Number(entry.netSalary || 0), 0),
                items: payroll.slice(0, 6)
            });
        }

        load().catch(() => {});
    }, []);

    const cards = [
        { label: 'Pending payroll', value: summary.pending },
        { label: 'Approved payroll', value: summary.approved },
        { label: 'Paid payroll', value: summary.paid },
        { label: 'Gross payroll', value: formatCurrency(summary.gross) },
        { label: 'Total deductions', value: formatCurrency(summary.deductions) },
        { label: 'Net payroll', value: formatCurrency(summary.net) }
    ];

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Payroll dashboard</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Monthly payroll control</h2>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {cards.map((card) => (
                        <div key={card.label} className="rounded-3xl border border-white/10 bg-black/15 p-5">
                            <div className="text-sm text-ink-200">{card.label}</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{card.value}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Recent payroll</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Latest generated records</h2>
                <div className="mt-6 space-y-4">
                    {summary.items.length ? summary.items.map((entry) => (
                        <div key={entry.id} className="rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-200">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-lg font-medium text-white">{entry.employee?.fullName || `Employee #${entry.employeeId}`}</div>
                                    <div>{entry.cycleStartDate} to {entry.cycleEndDate}</div>
                                </div>
                                <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                                    {entry.status}
                                </div>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <div>Gross: {formatCurrency(entry.grossSalary)}</div>
                                <div>Deductions: {formatCurrency(entry.totalDeduction)}</div>
                                <div>Net: {formatCurrency(entry.netSalary)}</div>
                            </div>
                        </div>
                    )) : (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">
                            No payroll has been generated yet for the current month.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
