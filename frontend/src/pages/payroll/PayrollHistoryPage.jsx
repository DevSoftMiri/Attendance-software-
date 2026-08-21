import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPayrollList } from '../../services/payrollService';

function currentPeriod() {
    const now = new Date();
    return { month: String(now.getMonth() + 1), year: String(now.getFullYear()), status: '' };
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function PayrollHistoryPage() {
    const [filters, setFilters] = useState(currentPeriod());
    const [payroll, setPayroll] = useState([]);

    async function load(nextFilters = filters) {
        const data = await fetchPayrollList({
            month: Number(nextFilters.month),
            year: Number(nextFilters.year),
            status: nextFilters.status || undefined
        });
        setPayroll(data);
    }

    useEffect(() => {
        load().catch(() => {});
    }, []);

    return (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
            <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Payroll history</div>
            <h2 className="mt-3 text-3xl font-semibold text-white">Browse payroll records</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
                <input value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                <input value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                </select>
            </div>
            <button onClick={() => load(filters)} className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900">Apply filters</button>
            <div className="mt-6 space-y-4">
                {payroll.map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-200">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-lg font-medium text-white">{entry.employee?.fullName || `Employee #${entry.employeeId}`}</div>
                                <div>{entry.month}/{entry.year}</div>
                                <div className="mt-1 text-xs text-ink-300">{entry.cycleStartDate} to {entry.cycleEndDate}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">{entry.status}</div>
                                <Link to={`/payroll/history/${entry.id}`} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white">Open</Link>
                            </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <div>Basic salary: {formatCurrency(entry.basicSalary)}</div>
                            <div>Deductions: {formatCurrency(entry.totalDeduction)}</div>
                            <div>Net: {formatCurrency(entry.netSalary)}</div>
                        </div>
                    </div>
                ))}
                {!payroll.length ? <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">No payroll history found.</div> : null}
            </div>
        </div>
    );
}
