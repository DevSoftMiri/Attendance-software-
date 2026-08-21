import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchPayrollById, finalizePayroll, fetchPayslip, markPayrollPaid, reopenPayroll, updatePayroll } from '../../services/payrollService';

function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function createEditableFields(payroll) {
    return {
        basicSalary: payroll?.basicSalary || '',
        bonus: {
            amount: payroll?.bonus?.amount || '',
            reason: payroll?.bonus?.reason || ''
        },
        overtimeDays: payroll?.overtimeDays ?? 0,
        overtimeRatePerDay: payroll?.overtimeRatePerDay || '',
        leaveAdjustment: '0.00',
        halfDayAdjustment: '0.00',
        otherDeduction: payroll?.otherDeduction || '0.00'
    };
}

export default function PayrollDetailPage() {
    const { id } = useParams();
    const [payroll, setPayroll] = useState(null);
    const [notes, setNotes] = useState('');
    const [payslip, setPayslip] = useState(null);
    const [editableFields, setEditableFields] = useState(createEditableFields(null));
    const [paymentForm, setPaymentForm] = useState({ method: 'BANK_TRANSFER', reference: '', amount: '', notes: '' });

    useEffect(() => {
        async function load() {
            const data = await fetchPayrollById(id);
            setPayroll(data);
            setNotes(data.notes || '');
            setEditableFields(createEditableFields(data));
        }

        load().catch(() => {});
    }, [id]);

    function updateField(key, value) {
        setEditableFields((current) => ({ ...current, [key]: value }));
    }

    function updateBonus(key, value) {
        setEditableFields((current) => ({
            ...current,
            bonus: {
                ...current.bonus,
                [key]: value
            }
        }));
    }

    async function handleSaveDraft() {
        try {
            const updated = await updatePayroll(id, {
                editableFields,
                notes
            });
            setPayroll(updated);
            setEditableFields(createEditableFields(updated));
            toast.success('Pending payroll updated');
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message || 'Failed to update payroll');
        }
    }

    async function handleApprove() {
        try {
            const updated = await finalizePayroll(id);
            setPayroll(updated);
            toast.success('Payroll approved');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to approve payroll');
        }
    }

    async function handleReopen() {
        try {
            const updated = await reopenPayroll(id);
            setPayroll(updated);
            toast.success('Payroll moved back to pending');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to reopen payroll');
        }
    }

    async function handleMarkPaid() {
        try {
            const updated = await markPayrollPaid(id, {
                method: paymentForm.method,
                reference: paymentForm.reference,
                amount: paymentForm.amount || payroll.netSalary,
                notes: paymentForm.notes
            });
            setPayroll(updated);
            toast.success('Salary payment saved');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to mark payroll as paid');
        }
    }

    async function handlePayslip() {
        try {
            const data = await fetchPayslip(id);
            setPayslip(data);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to load payslip');
        }
    }

    if (!payroll) {
        return <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-ink-200">Loading payroll details...</div>;
    }

    const isPending = payroll.status === 'pending';
    const paymentHistory = payroll.paymentHistory || [];

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Payroll detail</div>
                        <h2 className="mt-3 text-3xl font-semibold text-white">{payroll.employee?.fullName || `Payroll #${payroll.id}`}</h2>
                        <div className="mt-2 text-sm text-ink-200">
                            Cycle {payroll.cycleStartDate} to {payroll.cycleEndDate} | Salary date {payroll.salaryCreditDate}
                        </div>
                    </div>
                    <div className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white">
                        {payroll.status}
                    </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm text-ink-200">
                    <div className="rounded-3xl border border-white/10 bg-black/15 p-4">Basic salary: <span className="text-white">{formatCurrency(payroll.basicSalary)}</span></div>
                    <div className="rounded-3xl border border-white/10 bg-black/15 p-4">Total deduction: <span className="text-white">{formatCurrency(payroll.totalDeduction)}</span></div>
                    <div className="rounded-3xl border border-white/10 bg-black/15 p-4">Net salary: <span className="text-white">{formatCurrency(payroll.netSalary)}</span></div>
                    <div className="rounded-3xl border border-white/10 bg-black/15 p-4">Payment status: <span className="text-white">{payroll.status === 'paid' ? 'Paid' : 'Unpaid'}</span></div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Breakdown</div>
                    <div className="mt-4 space-y-4 text-sm text-ink-200">
                        <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div>Paid leave allowed: {payroll.paidLeavesAllowed}</div>
                                <div>Paid leave taken: {payroll.paidLeavesTaken}</div>
                                <div>Extra paid leaves: {payroll.extraPaidLeaves}</div>
                                <div>Leave deduction: {formatCurrency(payroll.leaveDeduction)}</div>
                                <div>Half days allowed: {payroll.halfDaysAllowed}</div>
                                <div>Half days taken: {payroll.halfDaysTaken}</div>
                                <div>Extra half days: {payroll.extraHalfDays}</div>
                                <div>Half day deduction: {formatCurrency(payroll.halfDayDeduction)}</div>
                                <div>Overtime days: {payroll.overtimeDays}</div>
                                <div>Overtime rate/day: {formatCurrency(payroll.overtimeRatePerDay)}</div>
                                <div>Overtime amount: {formatCurrency(payroll.overtimeAmount)}</div>
                                <div>Bonus: {formatCurrency(payroll.bonus?.amount)}</div>
                                <div className="sm:col-span-2">Bonus reason: {payroll.bonus?.reason || '-'}</div>
                                <div>Gross salary: {formatCurrency(payroll.grossSalary)}</div>
                                <div>Other deduction: {formatCurrency(payroll.otherDeduction)}</div>
                            </div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                            <div className="text-sm font-medium text-white">Snapshots kept for history</div>
                            <div className="mt-3 grid gap-3">
                                <pre className="overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-ink-200">{JSON.stringify(payroll.attendanceSummarySnapshot, null, 2)}</pre>
                                <pre className="overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-ink-200">{JSON.stringify(payroll.salaryStructureSnapshot, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Actions</div>
                    <div className="mt-4 space-y-4">
                        <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                            <div className="text-sm font-medium text-white">Editable payroll inputs</div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <input disabled={!isPending} value={editableFields.basicSalary} onChange={(event) => updateField('basicSalary', event.target.value)} placeholder="Basic salary" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white disabled:opacity-60" />
                                <input disabled={!isPending} value={editableFields.overtimeDays} onChange={(event) => updateField('overtimeDays', event.target.value)} placeholder="Overtime days" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white disabled:opacity-60" />
                                <input disabled={!isPending} value={editableFields.overtimeRatePerDay} onChange={(event) => updateField('overtimeRatePerDay', event.target.value)} placeholder="Overtime rate per day" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white disabled:opacity-60" />
                                <input disabled={!isPending} value={editableFields.bonus.amount} onChange={(event) => updateBonus('amount', event.target.value)} placeholder="Bonus amount" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white disabled:opacity-60" />
                                <input disabled={!isPending} value={editableFields.leaveAdjustment} onChange={(event) => updateField('leaveAdjustment', event.target.value)} placeholder="Leave adjustment" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white disabled:opacity-60" />
                                <input disabled={!isPending} value={editableFields.halfDayAdjustment} onChange={(event) => updateField('halfDayAdjustment', event.target.value)} placeholder="Half day adjustment" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white disabled:opacity-60" />
                                <input disabled={!isPending} value={editableFields.otherDeduction} onChange={(event) => updateField('otherDeduction', event.target.value)} placeholder="Other deduction" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white disabled:opacity-60" />
                                <input disabled={!isPending} value={editableFields.bonus.reason} onChange={(event) => updateBonus('reason', event.target.value)} placeholder="Bonus reason" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white disabled:opacity-60" />
                            </div>
                        </div>

                        <textarea value={notes} disabled={!isPending} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Payroll notes" className="w-full rounded-3xl border border-white/10 bg-black/15 p-4 text-sm text-white disabled:opacity-60" />

                        <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                            <div className="text-sm font-medium text-white">Salary payment</div>
                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                <select value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                                    <option value="BANK_TRANSFER">Bank transfer</option>
                                    <option value="CASH">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="CHEQUE">Cheque</option>
                                </select>
                                <input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Reference number" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                                <input value={paymentForm.amount || payroll.netSalary || ''} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Amount paid" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                                <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Payment notes" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white md:col-span-3" />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button onClick={handleSaveDraft} disabled={!isPending} className="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900 disabled:opacity-60">Save edits</button>
                            <button onClick={handleApprove} disabled={!isPending} className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">Approve payroll</button>
                            <button onClick={handleReopen} className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white">Reopen</button>
                            <button onClick={handleMarkPaid} disabled={payroll.status === 'pending'} className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">Mark as paid</button>
                            <button onClick={handlePayslip} className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white">View payslip</button>
                        </div>

                        {payslip ? (
                            <pre className="overflow-auto rounded-3xl border border-white/10 bg-black/15 p-4 text-xs text-ink-200">{JSON.stringify(payslip, null, 2)}</pre>
                        ) : null}

                        <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                            <div className="text-sm font-medium text-white">Salary payment history</div>
                            <div className="mt-4 space-y-3 text-sm text-ink-200">
                                {paymentHistory.length ? paymentHistory.map((entry) => (
                                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>{entry.method || 'Payment'}</div>
                                            <div className="text-white">{formatCurrency(entry.amount)}</div>
                                        </div>
                                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                                            <div>Reference: {entry.reference || '-'}</div>
                                            <div>Paid at: {entry.paidAt ? new Date(entry.paidAt).toLocaleString() : '-'}</div>
                                            <div>Notes: {entry.notes || '-'}</div>
                                        </div>
                                    </div>
                                )) : <div>No salary payment history stored yet.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
