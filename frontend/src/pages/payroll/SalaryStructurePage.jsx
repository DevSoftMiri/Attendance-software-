import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { fetchSalaryStructures, saveSalaryStructure } from '../../services/payrollService';

export default function SalaryStructurePage() {
    const [employees, setEmployees] = useState([]);
    const [salaryStructures, setSalaryStructures] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [form, setForm] = useState({
        id: null,
        employeeId: '',
        basicSalary: '',
        paidLeaveAllowance: '',
        halfDayAllowance: '',
        overtimeRatePerDay: '',
        effectiveFrom: '',
        isActive: true
    });

    useEffect(() => {
        async function load() {
            const [{ data: employeeData }, structures] = await Promise.all([
                api.get('/employees'),
                fetchSalaryStructures()
            ]);
            setEmployees(employeeData.employees || []);
            setSalaryStructures(structures);
        }

        load().catch(() => {});
    }, []);

    const visibleStructures = useMemo(() => {
        if (!selectedEmployeeId) {
            return salaryStructures;
        }
        return salaryStructures.filter((entry) => Number(entry.employeeId) === Number(selectedEmployeeId));
    }, [salaryStructures, selectedEmployeeId]);

    async function handleSubmit(event) {
        event.preventDefault();
        try {
            const structure = await saveSalaryStructure({
                employeeId: Number(form.employeeId),
                basicSalary: Number(form.basicSalary || 0),
                monthlySalary: Number(form.basicSalary || 0),
                paidLeaveAllowance: Number(form.paidLeaveAllowance || 0),
                halfDayAllowance: Number(form.halfDayAllowance || 0),
                overtimeRatePerDay: Number(form.overtimeRatePerDay || 0),
                effectiveFrom: form.effectiveFrom,
                isActive: Boolean(form.isActive)
            }, form.id);
            setSalaryStructures((current) => {
                const withoutCurrent = current.filter((entry) => Number(entry.id) !== Number(structure.id));
                return [structure, ...withoutCurrent].sort((left, right) => {
                    if (Number(left.employeeId) !== Number(right.employeeId)) {
                        return Number(left.employeeId) - Number(right.employeeId);
                    }
                    return String(right.effectiveFrom).localeCompare(String(left.effectiveFrom));
                });
            });
            setSelectedEmployeeId(String(form.employeeId));
            setForm({
                id: null,
                employeeId: '',
                basicSalary: '',
                paidLeaveAllowance: '',
                halfDayAllowance: '',
                overtimeRatePerDay: '',
                effectiveFrom: '',
                isActive: true
            });
            toast.success(form.id ? 'Employee payroll settings updated' : 'Employee payroll settings saved');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to save payroll settings');
        }
    }

    function handleEdit(entry) {
        setForm({
            id: entry.id,
            employeeId: String(entry.employeeId),
            basicSalary: String(entry.basicSalary || entry.monthlySalary || entry.baseSalary || ''),
            paidLeaveAllowance: String(entry.paidLeavesAllowed ?? entry.paidLeaveAllowance ?? ''),
            halfDayAllowance: String(entry.halfDayAllowance ?? ''),
            overtimeRatePerDay: String(entry.overtimeRatePerDay ?? ''),
            effectiveFrom: entry.effectiveFrom || '',
            isActive: entry.isActive !== false
        });
        setSelectedEmployeeId(String(entry.employeeId));
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Payroll employees</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">{form.id ? 'Edit employee payroll settings' : 'Assign simple payroll settings'}</h2>
                <p className="mt-2 text-sm text-ink-200">
                    Use one effective record per salary change. Older payroll remains correct because each run keeps its snapshot.
                </p>
                <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
                    <select value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white sm:col-span-2">
                        <option value="">Select employee</option>
                        {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                        ))}
                    </select>
                    <input value={form.basicSalary} onChange={(event) => setForm((current) => ({ ...current, basicSalary: event.target.value }))} placeholder="Basic salary" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <input value={form.paidLeaveAllowance} onChange={(event) => setForm((current) => ({ ...current, paidLeaveAllowance: event.target.value }))} placeholder="Paid leave allowance" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <input value={form.halfDayAllowance} onChange={(event) => setForm((current) => ({ ...current, halfDayAllowance: event.target.value }))} placeholder="Half day allowance" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <input value={form.overtimeRatePerDay} onChange={(event) => setForm((current) => ({ ...current, overtimeRatePerDay: event.target.value }))} placeholder="Overtime rate per day" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <input value={form.effectiveFrom} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))} type="date" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    <select value={String(form.isActive)} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === 'true' }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                    <div className="sm:col-span-2 flex flex-wrap gap-3">
                        <button type="submit" className="rounded-full bg-white px-5 py-3 font-medium text-ink-900">
                            {form.id ? 'Update payroll settings' : 'Save payroll settings'}
                        </button>
                        {form.id ? (
                            <button
                                type="button"
                                onClick={() => setForm({
                                    id: null,
                                    employeeId: '',
                                    basicSalary: '',
                                    paidLeaveAllowance: '',
                                    halfDayAllowance: '',
                                    overtimeRatePerDay: '',
                                    effectiveFrom: '',
                                    isActive: true
                                })}
                                className="rounded-full border border-white/10 px-5 py-3 font-medium text-white"
                            >
                                Cancel edit
                            </button>
                        ) : null}
                    </div>
                </form>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">History</div>
                        <h2 className="mt-3 text-3xl font-semibold text-white">Employee payroll settings</h2>
                    </div>
                    <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="">All employees</option>
                        {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                        ))}
                    </select>
                </div>
                <div className="mt-6 space-y-4">
                    {visibleStructures.map((entry) => (
                        <div key={entry.id} className="rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-200">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-white">{employees.find((employee) => Number(employee.id) === Number(entry.employeeId))?.fullName || `Employee #${entry.employeeId}`}</div>
                                <div className="flex items-center gap-3">
                                    <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                                        {entry.effectiveFrom}
                                    </div>
                                    <button onClick={() => handleEdit(entry)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white">
                                        Edit
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div>Basic salary: {entry.basicSalary || entry.monthlySalary || entry.baseSalary}</div>
                                <div>Paid leave allowance: {entry.paidLeavesAllowed ?? entry.paidLeaveAllowance ?? 0}</div>
                                <div>Half day allowance: {entry.halfDayAllowance ?? 0}</div>
                                <div>Overtime rate/day: {entry.overtimeRatePerDay ?? 0}</div>
                                <div>Applies from: {entry.effectiveFrom}</div>
                                <div>Applies until: {entry.effectiveTo || 'Future months'}</div>
                            </div>
                        </div>
                    ))}
                    {!visibleStructures.length ? <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">No employee payroll settings configured yet.</div> : null}
                </div>
            </section>
        </div>
    );
}
