import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMyPayroll, fetchPayslip, fetchPayrollList } from '../../services/payrollService';

function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function PayslipsPage() {
    const { user } = useAuth();
    const [records, setRecords] = useState([]);
    const [selectedPayslip, setSelectedPayslip] = useState(null);

    useEffect(() => {
        async function load() {
            const data = ['SUPER_ADMIN', 'ADMIN'].includes(user?.roleCode)
                ? await fetchPayrollList({})
                : await fetchMyPayroll();
            setRecords(data);
        }

        load().catch(() => {});
    }, [user?.roleCode]);

    async function handleOpen(id) {
        try {
            const payload = await fetchPayslip(id);
            setSelectedPayslip(payload);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to load payslip');
        }
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Payslips</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Available payroll slips</h2>
                <div className="mt-6 space-y-4">
                    {records.map((entry) => (
                        <div key={entry.id} className="rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-200">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-lg font-medium text-white">{entry.employee?.fullName || `Employee #${entry.employeeId}`}</div>
                                    <div>{entry.month}/{entry.year}</div>
                                </div>
                                <button onClick={() => handleOpen(entry.id)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white">
                                    View payslip
                                </button>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div>Status: {entry.status}</div>
                                <div>Net salary: {formatCurrency(entry.netSalary)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Slip preview</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">View / print / download-ready payload</h2>
                {selectedPayslip ? (
                    <pre className="mt-6 overflow-auto rounded-3xl border border-white/10 bg-black/15 p-4 text-xs text-ink-200">{JSON.stringify(selectedPayslip, null, 2)}</pre>
                ) : (
                    <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">
                        Select a payslip to preview its generated payload.
                    </div>
                )}
            </section>
        </div>
    );
}

