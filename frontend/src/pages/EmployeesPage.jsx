import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatDateInput, parseDateInput } from '../utils/date';

function formatDatePickerValue(value) {
    const parsed = parseDateInput(value);
    return parsed || '';
}

export default function EmployeesPage() {
    const { register, handleSubmit, reset, setValue } = useForm();
    const [employees, setEmployees] = useState([]);
    const [branches, setBranches] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [editingEmployeeId, setEditingEmployeeId] = useState(null);
    const [editingEmployeeName, setEditingEmployeeName] = useState('');

    useEffect(() => {
        async function loadEmployees() {
            try {
                const { data } = await api.get('/employees');
                setEmployees(data.employees || []);
            } catch {
                setEmployees([]);
            }
        }

        async function loadSettings() {
            try {
                const { data } = await api.get('/settings');
                setBranches(data.branches || []);
                setShifts(data.shifts || []);
            } catch {
                setBranches([]);
                setShifts([]);
            }
        }

        loadEmployees();
        loadSettings();
    }, []);

    useEffect(() => {
        if (!editingEmployeeId && shifts.length === 1) {
            setValue('shiftId', String(shifts[0].id));
        }
    }, [editingEmployeeId, setValue, shifts]);

    function beginEdit(employee) {
        setEditingEmployeeId(employee.id);
        setEditingEmployeeName(employee.fullName);
        reset({
            fullName: employee.fullName || '',
            email: employee.email || '',
            phone: employee.phone || '',
            joiningDate: formatDatePickerValue(employee.joiningDate),
            loginTime: employee.loginTime || '',
            jobTitleCode: employee.roleCode || '',
            roleCode: employee.roleCode || '',
            branchId: employee.branchId ? String(employee.branchId) : '',
            shiftId: employee.shiftId ? String(employee.shiftId) : '',
            baseSalary: employee.baseSalary ?? '',
            leaveEntitlement: employee.leaveEntitlement ?? '',
            unpaidLeaveEntitlement: employee.unpaidLeaveEntitlement ?? '',
            password: ''
        });
    }

    function cancelEdit() {
        setEditingEmployeeId(null);
        setEditingEmployeeName('');
        reset();
    }

    async function removeEmployee(employee) {
        const shouldDelete = window.confirm(`Delete ${employee.fullName}? This action cannot be undone.`);
        if (!shouldDelete) {
            return;
        }

        try {
            await api.delete(`/employees/${employee.id}`);
            setEmployees((current) => current.filter((entry) => Number(entry.id) !== Number(employee.id)));
            if (Number(editingEmployeeId) === Number(employee.id)) {
                cancelEdit();
            }
            toast.success(`${employee.fullName} deleted`);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete employee');
        }
    }

    async function onSubmit(values) {
        try {
            const payload = {
                ...values,
                organisationId: 1,
                organisationInitial: 'M',
                joiningDate: parseDateInput(values.joiningDate),
                loginTime: values.loginTime || null,
                branchId: values.branchId ? Number(values.branchId) : null,
                shiftId: values.shiftId ? Number(values.shiftId) : null,
                baseSalary: Number(values.baseSalary || 0),
                leaveEntitlement: Number(values.leaveEntitlement || 0),
                unpaidLeaveEntitlement: Number(values.unpaidLeaveEntitlement || 0)
            };

            if (editingEmployeeId) {
                const { data } = await api.patch(`/employees/${editingEmployeeId}`, payload);
                setEmployees((current) => current.map((employee) => (
                    Number(employee.id) === Number(editingEmployeeId) ? data.employee : employee
                )));
                toast.success('Employee updated');
                cancelEdit();
            } else {
                const { data } = await api.post('/employees', payload);
                setEmployees((current) => [data.employee, ...current]);
                reset();
                toast.success('Employee created');
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || (editingEmployeeId ? 'Failed to update employee' : 'Failed to create employee'));
        }
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Employee onboarding</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">{editingEmployeeId ? 'Edit employee details' : 'Create employee account'}</h2>
                {editingEmployeeId ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-ink-200">
                        <span>Editing {editingEmployeeName}</span>
                        <button type="button" onClick={cancelEdit} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white">
                            Cancel edit
                        </button>
                    </div>
                ) : null}
                <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4 sm:grid-cols-2">
                    <input {...register('fullName')} placeholder="Full name" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400 sm:col-span-2" />
                    <input {...register('email')} type="email" placeholder="Email" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input {...register('phone')} placeholder="Phone" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <label className="grid gap-2">
                        <span className="text-xs uppercase tracking-[0.28em] text-ink-300">Joining date</span>
                        <input {...register('joiningDate')} type="date" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    </label>
                    <label className="grid gap-2">
                        <span className="text-xs uppercase tracking-[0.28em] text-ink-300">Office reporting time</span>
                        <input {...register('loginTime')} type="time" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                    </label>
                    <input {...register('jobTitleCode')} placeholder="Job title code" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input {...register('roleCode')} placeholder="Role code" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <select {...register('branchId')} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="">Select branch</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                    <select {...register('shiftId')} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="">Select shift</option>
                        {shifts.map((shift) => (
                            <option key={shift.id} value={shift.id}>{shift.name}</option>
                        ))}
                    </select>
                    {shifts.length === 1 ? (
                        <div className="sm:col-span-2 text-sm text-ink-200">
                            The only company shift is selected automatically for new employees.
                        </div>
                    ) : null}
                    <input {...register('baseSalary')} placeholder="Base salary" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input {...register('leaveEntitlement')} type="number" step="0.5" placeholder="Paid leave per month" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input {...register('unpaidLeaveEntitlement')} type="number" step="0.5" placeholder="Unpaid leave allowance" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input {...register('password')} type="password" placeholder="Temporary password" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <button type="submit" className="rounded-full bg-white px-5 py-3 font-medium text-ink-900 sm:col-span-2">
                        {editingEmployeeId ? 'Update employee' : 'Create employee'}
                    </button>
                </form>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Records</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Recent employees</h2>
                <div className="mt-6 space-y-4">
                    {employees.length ? (
                        employees.map((employee) => (
                            <div key={employee.id} className="rounded-3xl border border-white/10 bg-black/15 p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-lg font-medium text-white">{employee.fullName}</div>
                                        <div className="text-sm text-ink-200">{employee.employeeCode}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => removeEmployee(employee)}
                                            className="rounded-full border border-red-400/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-100"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => beginEdit(employee)}
                                            className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white"
                                        >
                                            Edit
                                        </button>
                                        <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">{employee.status || 'ACTIVE'}</div>
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-2 text-sm text-ink-200 sm:grid-cols-2">
                                    <div>Email: {employee.email}</div>
                                    <div>Joining date: {formatDateInput(employee.joiningDate) || 'Not set'}</div>
                                    <div>Office reporting time: {employee.loginTime || 'Not set'}</div>
                                    <div>Role: {employee.roleCode}</div>
                                    <div>Branch: {branches.find((branch) => Number(branch.id) === Number(employee.branchId))?.name || 'Not assigned'}</div>
                                    <div>Shift: {shifts.find((shift) => Number(shift.id) === Number(employee.shiftId))?.name || 'Not assigned'}</div>
                                    <div>Salary type: {employee.salaryType}</div>
                                    <div>Base salary: {employee.baseSalary}</div>
                                    <div>Paid leave per month: {employee.leaveEntitlement || 0}</div>
                                    <div>Unpaid leave allowance: {employee.unpaidLeaveEntitlement || 0}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">
                            No employee records loaded yet.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
