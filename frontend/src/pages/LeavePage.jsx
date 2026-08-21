import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateTime, parseDateInput } from '../utils/date';
import { fetchEmployeeLeaveBalances, fetchLeaveTypes, saveEmployeeLeaveBalances } from '../services/payrollService';

const leaveTypeOptions = [
    { id: 1, code: 'PAID_LEAVE', label: 'Paid Leave' },
    { id: 2, code: 'WFH', label: 'Work From Home' },
    { id: 3, code: 'SICK_LEAVE', label: 'Sick Leave' },
    { id: 4, code: 'CASUAL_LEAVE', label: 'Casual Leave' },
    { id: 5, code: 'UNPAID_LEAVE', label: 'Unpaid Leave' }
];

function formatStatusTone(status) {
    if (status === 'APPROVED') {
        return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
    }

    if (status === 'REJECTED') {
        return 'border-rose-400/30 bg-rose-400/10 text-rose-100';
    }

    return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
}

export default function LeavePage() {
    const { user } = useAuth();
    const { register, handleSubmit, reset } = useForm({
        defaultValues: {
            leaveTypeId: '1',
            leaveMode: 'FULL_DAY',
            startDate: '',
            endDate: '',
            reason: ''
        }
    });
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [decisionLoadingId, setDecisionLoadingId] = useState(null);
    const [leaveSummary, setLeaveSummary] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState(leaveTypeOptions);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [balanceRows, setBalanceRows] = useState([]);
    const isApprover = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.roleCode);

    async function loadRequests() {
        try {
            const [requestResponse, employeesResponse, typeData] = await Promise.all([
                api.get('/leave/requests'),
                isApprover ? api.get('/employees') : Promise.resolve({ data: { employees: [] } }),
                fetchLeaveTypes()
            ]);
            const data = requestResponse.data;
            setRequests(data.requests || []);
            setLeaveSummary(data.leaveSummary || null);
            setEmployees(employeesResponse.data.employees || []);
            setLeaveTypes((typeData || []).map((entry) => ({ id: entry.id, code: entry.code, label: entry.name })));
        } catch {
            setRequests([]);
            setLeaveSummary(null);
        }
    }

    useEffect(() => {
        loadRequests();
    }, []);

    useEffect(() => {
        if (!selectedEmployeeId) {
            setBalanceRows([]);
            return;
        }

        async function loadBalances() {
            try {
                const balances = await fetchEmployeeLeaveBalances(selectedEmployeeId);
                setBalanceRows(balances);
            } catch {
                setBalanceRows([]);
            }
        }

        loadBalances();
    }, [selectedEmployeeId]);

    async function onSubmit(values) {
        setLoading(true);
        try {
            const { data } = await api.post('/leave/requests', {
                ...values,
                leaveTypeId: Number(values.leaveTypeId),
                startDate: parseDateInput(values.startDate),
                endDate: parseDateInput(values.endDate)
            });
            setRequests((current) => [data.leaveRequest, ...current]);
            reset();
            toast.success('Leave request submitted');
            await loadRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to submit leave request');
        } finally {
            setLoading(false);
        }
    }

    async function decideRequest(id, status) {
        setDecisionLoadingId(id);
        try {
            const { data } = await api.patch(`/leave/requests/${id}`, { status });
            setRequests((current) => current.map((request) => (request.id === id ? data.leaveRequest : request)));
            toast.success(`Leave request ${status.toLowerCase()}`);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to update leave request');
        } finally {
            setDecisionLoadingId(null);
        }
    }

    const pendingRequests = requests.filter((request) => request.status === 'PENDING');
    const approvedRequests = requests.filter((request) => request.status === 'APPROVED');

    async function saveBalances() {
        if (!selectedEmployeeId) {
            toast.error('Select an employee first');
            return;
        }

        try {
            const balances = await saveEmployeeLeaveBalances(selectedEmployeeId, balanceRows);
            setBalanceRows(balances);
            toast.success('Employee leave balances saved');
            await loadRequests();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to save leave balances');
        }
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Leave request</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Apply for leave</h2>
                <p className="mt-2 text-sm text-ink-200">
                    Submit paid leave, work-from-home, sick leave, casual leave, or unpaid leave requests. They will stay pending until an admin approves or rejects them.
                </p>
                {leaveSummary ? (
                    <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-200">
                        <div className="text-xs uppercase tracking-[0.3em] text-ink-300">Paid leave balance</div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div>Assigned: {leaveSummary.assignedPaidLeave}</div>
                            <div>Carry forward: {leaveSummary.carryForwardUnusedPaidLeave ? 'Enabled' : 'Disabled'}</div>
                            <div>Used: {leaveSummary.usedPaidLeave}</div>
                            <div>Available: {leaveSummary.availablePaidLeave}</div>
                        </div>
                        <div className="mt-3 text-base font-medium text-white">Employee leave balance is managed from the employee leave assignment section.</div>
                    </div>
                ) : null}
                <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                    <select {...register('leaveTypeId')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        {leaveTypeOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                    </select>
                    <input {...register('startDate')} type="text" placeholder="DD/MM/YYYY" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input {...register('endDate')} type="text" placeholder="DD/MM/YYYY" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <select {...register('leaveMode')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="FULL_DAY">Full day</option>
                        <option value="HALF_DAY">Half day</option>
                    </select>
                    <textarea {...register('reason')} rows="4" placeholder="Reason" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <button type="submit" disabled={loading} className="rounded-full bg-white px-5 py-3 font-medium text-ink-900">
                        {loading ? 'Submitting...' : 'Submit leave request'}
                    </button>
                </form>
            </section>

            <section className="space-y-6">
                {isApprover ? (
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Leave assignment</div>
                        <h2 className="mt-3 text-3xl font-semibold text-white">Assign leave balances to employees</h2>
                        <div className="mt-6 space-y-4">
                            <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                                <option value="">Select employee</option>
                                {employees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                                ))}
                            </select>
                            <div className="space-y-3">
                                {balanceRows.map((row, index) => (
                                    <div key={`${row.leaveTypeId}-${row.code}`} className="grid gap-3 rounded-3xl border border-white/10 bg-black/15 p-4 md:grid-cols-[1.2fr_1fr_1fr]">
                                        <div>
                                            <div className="font-medium text-white">{row.name}</div>
                                            <div className="text-xs uppercase tracking-[0.25em] text-ink-300">{row.paid ? 'Paid leave' : 'Unpaid leave'}</div>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={row.openingBalance}
                                            onChange={(event) => setBalanceRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, openingBalance: event.target.value } : entry))}
                                            placeholder="Opening balance"
                                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                                        />
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={row.currentBalance}
                                            onChange={(event) => setBalanceRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, currentBalance: event.target.value } : entry))}
                                            placeholder="Current balance"
                                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={saveBalances} className="rounded-full bg-white px-5 py-3 font-medium text-ink-900">
                                Save employee leave balances
                            </button>
                        </div>
                    </div>
                ) : null}

                {isApprover ? (
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Approval queue</div>
                        <h2 className="mt-3 text-3xl font-semibold text-white">Pending admin actions</h2>
                        <div className="mt-6 space-y-4">
                            {pendingRequests.length ? pendingRequests.map((request) => (
                                <div key={request.id} className="rounded-3xl border border-white/10 bg-black/15 p-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-lg font-medium text-white">{request.employeeName}</div>
                                            <div className="text-sm text-ink-200">{request.employeeCode || 'No employee code'}</div>
                                        </div>
                                        <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-amber-100">
                                            Pending
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-2 text-sm text-ink-200">
                                        <div>Request type: {request.leaveTypeName}</div>
                                        <div>Duration: {request.leaveMode || 'FULL_DAY'}</div>
                                        <div>Dates: {formatDate(request.startDate)} to {formatDate(request.endDate)}</div>
                                        <div>Reason: {request.reason || 'No reason provided'}</div>
                                    </div>
                                    <div className="mt-5 flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={() => decideRequest(request.id, 'APPROVED')}
                                            disabled={decisionLoadingId === request.id}
                                            className="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900 disabled:opacity-60"
                                        >
                                            {decisionLoadingId === request.id ? 'Saving...' : 'Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => decideRequest(request.id, 'REJECTED')}
                                            disabled={decisionLoadingId === request.id}
                                            className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">
                                    No pending leave requests right now.
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">History</div>
                    <h2 className="mt-3 text-3xl font-semibold text-white">
                        {isApprover ? 'Approved and recent requests' : 'My leave requests'}
                    </h2>
                    <div className="mt-2 text-sm text-ink-200">
                        {isApprover ? `${approvedRequests.length} approved request(s) shown below.` : 'Your latest request status will appear here after admin review.'}
                    </div>
                    <div className="mt-6 space-y-4">
                        {requests.length ? (
                            requests.map((request) => (
                                <div key={request.id} className="rounded-3xl border border-white/10 bg-black/15 p-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-lg font-medium text-white">{request.leaveTypeName || request.leaveMode || 'Leave request'}</div>
                                            <div className="text-sm text-ink-200">{formatDate(request.startDate)} to {formatDate(request.endDate)}</div>
                                        </div>
                                        <div className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.3em] ${formatStatusTone(request.status)}`}>
                                            {request.status || 'PENDING'}
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-2 text-sm text-ink-200">
                                        {isApprover ? <div>Employee: {request.employeeName} {request.employeeCode ? `(${request.employeeCode})` : ''}</div> : null}
                                        <div>Request type: {request.leaveTypeName || '-'}</div>
                                        <div>Duration: {request.leaveMode || 'FULL_DAY'}</div>
                                        <div>Reason: {request.reason || 'No reason provided'}</div>
                                        <div>Submitted: {formatDateTime(request.submittedAt)}</div>
                                        <div>Approved by: {request.approverUserId || (request.status === 'APPROVED' ? 'Admin' : '-')}</div>
                                    </div>
                                    {request.approverComment ? (
                                        <p className="mt-3 text-sm text-ink-200">Admin comment: {request.approverComment}</p>
                                    ) : null}
                                </div>
                            ))
                        ) : (
                            <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">
                                No leave requests available.
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
