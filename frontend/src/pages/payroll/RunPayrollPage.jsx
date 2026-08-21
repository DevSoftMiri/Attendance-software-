import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { fetchPayrollList, fetchPayrollPreview, generatePayroll, generatePayrollBatch } from '../../services/payrollService';

function currentPeriod() {
    const now = new Date();
    return { month: String(now.getMonth() + 1), year: String(now.getFullYear()) };
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function RunPayrollPage() {
    const [filters, setFilters] = useState({ ...currentPeriod(), departmentId: '', employeeId: '' });
    const [employees, setEmployees] = useState([]);
    const [payroll, setPayroll] = useState([]);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function loadBasics() {
            const [{ data: employeeData }, payrollData] = await Promise.all([
                api.get('/employees'),
                fetchPayrollList(currentPeriod())
            ]);
            setEmployees(employeeData.employees || []);
            setPayroll(payrollData || []);
        }

        loadBasics().catch(() => {});
    }, []);

    async function refreshPayroll(nextFilters = filters) {
        try {
            const data = await fetchPayrollList({
                month: Number(nextFilters.month),
                year: Number(nextFilters.year),
                employeeId: nextFilters.employeeId || undefined
            });
            setPayroll(data);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to load payroll');
        }
    }

    async function handlePreview() {
        if (!filters.employeeId) {
            toast.error('Select an employee to preview payroll');
            return;
        }

        try {
            setLoading(true);
            const data = await fetchPayrollPreview(filters.employeeId, {
                month: Number(filters.month),
                year: Number(filters.year)
            });
            setPreview(data);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to preview payroll');
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerateSingle() {
        if (!filters.employeeId) {
            toast.error('Select an employee first');
            return;
        }

        try {
            setLoading(true);
            await generatePayroll({
                employeeId: Number(filters.employeeId),
                month: Number(filters.month),
                year: Number(filters.year)
            });
            toast.success('Pending payroll generated');
            await refreshPayroll(filters);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to generate payroll');
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerateBatch() {
        try {
            setLoading(true);
            const result = await generatePayrollBatch({
                month: Number(filters.month),
                year: Number(filters.year),
                departmentId: filters.departmentId || undefined,
                employeeId: filters.employeeId || undefined
            });
            toast.success(`Generated ${result.generatedCount} payroll record(s)`);
            await refreshPayroll(filters);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to generate payroll batch');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Run payroll</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Generate payroll for a fixed salary cycle</h2>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <input value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} placeholder="Reference month" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <input value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))} placeholder="Reference year" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <input value={filters.departmentId} onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))} placeholder="Department ID" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <select value={filters.employeeId} onChange={(event) => setFilters((current) => ({ ...current, employeeId: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="">All employees</option>
                        {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                        ))}
                    </select>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                    <button onClick={handlePreview} disabled={loading} className="rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white">
                        Preview employee
                    </button>
                    <button onClick={handleGenerateSingle} disabled={loading} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900">
                        Generate selected employee
                    </button>
                    <button onClick={handleGenerateBatch} disabled={loading} className="rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm font-medium text-white">
                        Generate for scope
                    </button>
                    <button onClick={() => refreshPayroll(filters)} disabled={loading} className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white">
                        Refresh list
                    </button>
                </div>
            </section>

            {preview ? (
                <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Preview</div>
                    <h2 className="mt-3 text-3xl font-semibold text-white">{preview.employee?.fullName}</h2>
                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-200">
                            <div className="text-lg font-medium text-white">Cycle summary</div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div>Cycle start: {preview.period?.startDate}</div>
                                <div>Cycle end: {preview.period?.endDate}</div>
                                <div>Salary date: {preview.period?.payDate || '-'}</div>
                                <div>Present days: {preview.payroll?.summary?.presentDays}</div>
                                <div>Paid leaves: {preview.payroll?.cycleSummary?.paidLeavesTaken}</div>
                                <div>Half days: {preview.payroll?.cycleSummary?.halfDaysTaken}</div>
                                <div>Overtime days: {preview.payroll?.cycleSummary?.overtimeDays}</div>
                                <div>Extra paid leaves: {preview.payroll?.cycleSummary?.extraPaidLeaves}</div>
                            </div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-200">
                            <div className="text-lg font-medium text-white">Payroll totals</div>
                            <div className="mt-3 grid gap-2">
                                <div>Basic salary: {formatCurrency(preview.payroll?.cycleSummary?.basicSalary)}</div>
                                <div>Overtime amount: {formatCurrency(preview.payroll?.cycleSummary?.overtimeAmount)}</div>
                                <div>Bonus: {formatCurrency(preview.payroll?.cycleSummary?.bonus?.amount)}</div>
                                <div>Total deduction: {formatCurrency(preview.payroll?.cycleSummary?.totalDeduction)}</div>
                                <div className="text-base font-medium text-white">Net salary: {formatCurrency(preview.payroll?.cycleSummary?.netSalary)}</div>
                            </div>
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Payroll results</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Generated payroll</h2>
                <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-ink-200">
                        <thead>
                            <tr className="border-b border-white/10 text-xs uppercase tracking-[0.3em] text-ink-300">
                                <th className="px-3 py-3">Employee</th>
                                <th className="px-3 py-3">Salary cycle</th>
                                <th className="px-3 py-3">Basic salary</th>
                                <th className="px-3 py-3">Leaves</th>
                                <th className="px-3 py-3">Half days</th>
                                <th className="px-3 py-3">Overtime</th>
                                <th className="px-3 py-3">Bonus</th>
                                <th className="px-3 py-3">Deductions</th>
                                <th className="px-3 py-3">Net salary</th>
                                <th className="px-3 py-3">Salary date</th>
                                <th className="px-3 py-3">Status</th>
                                <th className="px-3 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payroll.map((entry) => (
                                <tr key={entry.id} className="border-b border-white/5">
                                    <td className="px-3 py-3 text-white">{entry.employee?.fullName || `Employee #${entry.employeeId}`}</td>
                                    <td className="px-3 py-3">{entry.cycleStartDate} to {entry.cycleEndDate}</td>
                                    <td className="px-3 py-3">{formatCurrency(entry.basicSalary)}</td>
                                    <td className="px-3 py-3">{entry.paidLeavesTaken}</td>
                                    <td className="px-3 py-3">{entry.halfDaysTaken}</td>
                                    <td className="px-3 py-3">{entry.overtimeDays}</td>
                                    <td className="px-3 py-3">{formatCurrency(entry.bonus?.amount)}</td>
                                    <td className="px-3 py-3">{formatCurrency(entry.totalDeduction)}</td>
                                    <td className="px-3 py-3">{formatCurrency(entry.netSalary)}</td>
                                    <td className="px-3 py-3">{entry.salaryCreditDate || '-'}</td>
                                    <td className="px-3 py-3">{entry.status}</td>
                                    <td className="px-3 py-3">
                                        <Link to={`/payroll/history/${entry.id}`} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white">
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!payroll.length ? (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">
                            No payroll records found for the selected filters.
                        </div>
                    ) : null}
                </div>
            </section>
        </div>
    );
}
