import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchPayrollPayments, markPayrollPaid } from '../../services/payrollService';

function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function currentPeriod() {
    const now = new Date();
    return { month: String(now.getMonth() + 1), year: String(now.getFullYear()) };
}

export default function PayrollPaymentsPage() {
    const [filters, setFilters] = useState({ ...currentPeriod(), status: '' });
    const [records, setRecords] = useState([]);
    const [paymentForms, setPaymentForms] = useState({});

    async function load(nextFilters = filters) {
        try {
            const data = await fetchPayrollPayments({
                month: Number(nextFilters.month),
                year: Number(nextFilters.year),
                status: nextFilters.status || undefined
            });
            setRecords(data);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to load payment records');
        }
    }

    useEffect(() => {
        load().catch(() => {});
    }, []);

    function updateForm(id, key, value) {
        setPaymentForms((current) => ({
            ...current,
            [id]: {
                method: current[id]?.method || 'BANK_TRANSFER',
                reference: current[id]?.reference || '',
                amount: current[id]?.amount || '',
                notes: current[id]?.notes || '',
                [key]: value
            }
        }));
    }

    async function handleMarkPaid(record) {
        const form = paymentForms[record.id] || {};
        try {
            await markPayrollPaid(record.id, {
                method: form.method || 'BANK_TRANSFER',
                reference: form.reference || '',
                amount: form.amount || record.netSalary,
                notes: form.notes || ''
            });
            toast.success('Salary marked as paid');
            await load(filters);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to mark salary as paid');
        }
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Salary payment management</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Mark employee salary as paid</h2>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <input value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} placeholder="Cycle start month" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <input value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))} placeholder="Cycle start year" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="">Finalized and paid</option>
                        <option value="FINALIZED">Finalized only</option>
                        <option value="PAID">Paid only</option>
                    </select>
                </div>
                <button onClick={() => load(filters)} className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900">Refresh payments</button>
            </section>

            <section className="space-y-4">
                {records.map((record) => {
                    const form = paymentForms[record.id] || {};
                    const paymentHistory = record.payment_records || record.paymentRecords || [];
                    return (
                        <div key={record.id} className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <div className="text-lg font-medium text-white">{record.employee?.fullName || `Employee #${record.employeeId}`}</div>
                                    <div className="text-sm text-ink-200">
                                        Period: {record.payrollRun?.payrollPeriod?.startDate || '-'} to {record.payrollRun?.payrollPeriod?.endDate || '-'}
                                    </div>
                                    <div className="text-sm text-ink-200">
                                        Pay date: {record.payrollRun?.payrollPeriod?.payDate || '-'}
                                    </div>
                                </div>
                                <div className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white">
                                    {record.status} / {record.paymentStatus}
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm text-ink-200">
                                <div>Net salary: <span className="text-white">{formatCurrency(record.netSalary)}</span></div>
                                <div>Gross: <span className="text-white">{formatCurrency(record.grossEarnings || record.grossSalary)}</span></div>
                                <div>Deductions: <span className="text-white">{formatCurrency(record.totalDeductions)}</span></div>
                                <div>Payment history count: <span className="text-white">{paymentHistory.length}</span></div>
                            </div>

                            {record.status !== 'PAID' ? (
                                <div className="mt-5 grid gap-3 rounded-3xl border border-white/10 bg-black/15 p-4 md:grid-cols-4">
                                    <select value={form.method || 'BANK_TRANSFER'} onChange={(event) => updateForm(record.id, 'method', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                                        <option value="BANK_TRANSFER">Bank transfer</option>
                                        <option value="CASH">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="CHEQUE">Cheque</option>
                                    </select>
                                    <input value={form.reference || ''} onChange={(event) => updateForm(record.id, 'reference', event.target.value)} placeholder="Reference number" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                                    <input value={form.amount || record.netSalary || ''} onChange={(event) => updateForm(record.id, 'amount', event.target.value)} placeholder="Amount paid" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                                    <button onClick={() => handleMarkPaid(record)} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900">
                                        Mark paid
                                    </button>
                                    <textarea value={form.notes || ''} onChange={(event) => updateForm(record.id, 'notes', event.target.value)} rows={3} placeholder="Payment notes" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white md:col-span-4" />
                                </div>
                            ) : null}

                            <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-4">
                                <div className="text-sm font-medium text-white">Payment history</div>
                                <div className="mt-4 space-y-3 text-sm text-ink-200">
                                    {paymentHistory.length ? paymentHistory.map((entry) => (
                                        <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>{entry.method || 'Payment'}</div>
                                                <div className="text-white">{formatCurrency(entry.amount)}</div>
                                            </div>
                                            <div className="mt-2 grid gap-2 md:grid-cols-3">
                                                <div>Reference: {entry.reference || '-'}</div>
                                                <div>Paid at: {entry.paidAt ? new Date(entry.paidAt).toLocaleString() : '-'}</div>
                                                <div>Notes: {entry.notes || '-'}</div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div>No payment history stored yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {!records.length ? (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">
                        No employee salary payment records found for the selected filters.
                    </div>
                ) : null}
            </section>
        </div>
    );
}

