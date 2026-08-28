import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateTime, parseDateInput } from '../utils/date';
import { fetchLeaveTypes } from '../services/payrollService';

const leaveTypeOptions = [
    { id: 1, code: 'PAID_LEAVE', label: 'Paid Leave', allowHalfDay: false },
    { id: 2, code: 'WFH', label: 'Work From Home', allowHalfDay: true },
    { id: 3, code: 'SICK_LEAVE', label: 'Sick Leave', allowHalfDay: true },
    { id: 4, code: 'SHORT_LEAVE', label: 'Short Leave', allowHalfDay: true },
    { id: 5, code: 'UNPAID_LEAVE', label: 'Unpaid Leave', allowHalfDay: false },
    { id: 6, code: 'HALF_DAY', label: 'Half Day', allowHalfDay: true }
];

function formatLeaveModeLabel(value) {
    if (value === 'FIRST_HALF') {
        return 'First half';
    }
    if (value === 'SECOND_HALF') {
        return 'Second half';
    }
    if (value === 'HALF_DAY') {
        return 'Half day';
    }
    return 'Full day';
}

function parseTimeToMinutes(value) {
    const [hours, minutes] = String(value || '09:00').split(':').map(Number);
    return ((Number(hours) || 0) * 60) + (Number(minutes) || 0);
}

function formatMinutesAsTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function buildHalfDayTimeOptions(shift) {
    const startMinutes = parseTimeToMinutes(shift?.startTime || '09:00');
    const endRawMinutes = parseTimeToMinutes(shift?.endTime || '18:00');
    const endMinutes = endRawMinutes <= startMinutes ? endRawMinutes + (24 * 60) : endRawMinutes;
    const midpointMinutes = startMinutes + Math.floor((endMinutes - startMinutes) / 2);

    return {
        firstHalfLabel: `First half (${formatMinutesAsTime(startMinutes)} - ${formatMinutesAsTime(midpointMinutes)})`,
        secondHalfLabel: `Second half (${formatMinutesAsTime(midpointMinutes)} - ${formatMinutesAsTime(endMinutes)})`
    };
}

function addDaysToIsoDate(value, daysToAdd) {
    if (!value) {
        return '';
    }

    const parts = String(value).split('-').map(Number);
    if (parts.length !== 3) {
        return '';
    }

    const [year, month, day] = parts;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    parsed.setUTCDate(parsed.getUTCDate() + Math.max(0, daysToAdd));
    return parsed.toISOString().slice(0, 10);
}

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
    const { register, handleSubmit, reset, watch, setValue } = useForm({
        defaultValues: {
            leaveTypeId: '1',
            leaveDuration: 'FULL_DAY',
            halfDaySlot: 'FIRST_HALF',
            startDate: '',
            numberOfDays: '1',
            reason: ''
        }
    });
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [decisionLoadingId, setDecisionLoadingId] = useState(null);
    const [leaveSummary, setLeaveSummary] = useState(null);
    const [leaveTypes, setLeaveTypes] = useState(leaveTypeOptions);
    const [shifts, setShifts] = useState([]);
    const isApprover = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.roleCode);
    const selectedLeaveTypeId = watch('leaveTypeId');
    const selectedLeaveDuration = watch('leaveDuration');
    const startDate = watch('startDate');
    const numberOfDays = watch('numberOfDays');
    const selectedLeaveType = leaveTypes.find((entry) => String(entry.id) === String(selectedLeaveTypeId)) || leaveTypeOptions[0];
    const isHalfDayType = selectedLeaveType?.code === 'HALF_DAY';
    const canUseHalfDay = isHalfDayType;
    const halfDayTimeOptions = useMemo(() => buildHalfDayTimeOptions(shifts[0]), [shifts]);
    const computedEndDate = useMemo(() => {
        if (!startDate) {
            return '';
        }

        if (isHalfDayType) {
            return startDate;
        }

        const totalDays = Math.max(1, Number.parseInt(numberOfDays || '1', 10) || 1);
        return addDaysToIsoDate(startDate, totalDays - 1);
    }, [isHalfDayType, numberOfDays, startDate]);

    async function loadRequests() {
        try {
            const [requestResponse, typeData, settingsResponse] = await Promise.all([
                api.get('/leave/requests'),
                fetchLeaveTypes(),
                api.get('/settings')
            ]);
            const data = requestResponse.data;
            setRequests(data.requests || []);
            setLeaveSummary(data.leaveSummary || null);
            setShifts(settingsResponse.data.shifts || []);
            setLeaveTypes((typeData || []).map((entry) => ({
                id: entry.id,
                code: entry.code,
                label: entry.name,
                allowHalfDay: entry.allowHalfDay !== false
            })));
        } catch {
            setRequests([]);
            setLeaveSummary(null);
            setShifts([]);
        }
    }

    useEffect(() => {
        loadRequests();
    }, []);

    useEffect(() => {
        if (!canUseHalfDay && selectedLeaveDuration !== 'FULL_DAY') {
            setValue('leaveDuration', 'FULL_DAY');
        }
    }, [canUseHalfDay, selectedLeaveDuration, setValue]);

    useEffect(() => {
        if (isHalfDayType) {
            setValue('leaveDuration', 'HALF_DAY');
            setValue('numberOfDays', '1');
        }
    }, [isHalfDayType, setValue]);

    async function onSubmit(values) {
        setLoading(true);
        try {
            const leaveMode = selectedLeaveType?.code === 'HALF_DAY'
                ? values.halfDaySlot
                : 'FULL_DAY';
            const { data } = await api.post('/leave/requests', {
                ...values,
                leaveTypeId: Number(values.leaveTypeId),
                leaveMode,
                startDate: parseDateInput(values.startDate),
                endDate: parseDateInput(computedEndDate)
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

    return (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Leave request</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Apply for leave</h2>
                <p className="mt-2 text-sm text-ink-200">
                    Submit paid leave, work-from-home, sick leave, short leave, or unpaid leave requests. They will stay pending until an admin approves or rejects them.
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
                        <div className="mt-3 text-base font-medium text-white">Paid leave is managed from the employee creation and edit section.</div>
                    </div>
                ) : null}
                <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                    <label className="grid gap-2">
                        <span className="text-xs uppercase tracking-[0.28em] text-ink-300">Type of leave</span>
                        <select {...register('leaveTypeId')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                            {leaveTypes.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2">
                            <span className="text-xs uppercase tracking-[0.28em] text-ink-300">Number of days</span>
                            <input
                                {...register('numberOfDays')}
                                type="number"
                                min="1"
                                step="1"
                                disabled={canUseHalfDay}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white disabled:opacity-60"
                            />
                            <span className="text-xs text-ink-300">
                                {canUseHalfDay ? 'Half-day leave always uses 1 selected date.' : 'Enter how many calendar days you want to apply for.'}
                            </span>
                        </label>
                        <label className="grid gap-2">
                            <span className="text-xs uppercase tracking-[0.28em] text-ink-300">Start date</span>
                            <input {...register('startDate')} type="date" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                            <span className="text-xs text-ink-300">Pick the first day of the leave period.</span>
                        </label>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.28em] text-ink-300">Leave dates</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.24em] text-ink-300">Starts on</div>
                                <div className="mt-1 text-base font-medium text-white">{startDate ? formatDate(startDate) : 'Select a start date'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.24em] text-ink-300">Ends on</div>
                                <div className="mt-1 text-base font-medium text-white">{computedEndDate ? formatDate(computedEndDate) : 'Will appear automatically'}</div>
                            </div>
                        </div>
                    </div>
                    {canUseHalfDay ? (
                        <label className="grid gap-2">
                            <span className="text-xs uppercase tracking-[0.28em] text-ink-300">Half-day time slot</span>
                            <select {...register('halfDaySlot')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                                <option value="FIRST_HALF">{halfDayTimeOptions.firstHalfLabel}</option>
                                <option value="SECOND_HALF">{halfDayTimeOptions.secondHalfLabel}</option>
                            </select>
                            <span className="text-xs text-ink-300">Choose which half of the shift you want to take as leave.</span>
                        </label>
                    ) : null}
                    {canUseHalfDay ? (
                        <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-ink-200">
                            Half-day leave is always applied for a single selected date.
                        </div>
                    ) : null}
                    <textarea {...register('reason')} rows="4" placeholder="Reason" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <button type="submit" disabled={loading} className="rounded-full bg-white px-5 py-3 font-medium text-ink-900">
                        {loading ? 'Submitting...' : 'Submit leave request'}
                    </button>
                </form>
            </section>

            <section className="space-y-6">
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
                                        <div>Duration: {request.leaveModeLabel || formatLeaveModeLabel(request.leaveMode)}</div>
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
                                            <div className="text-lg font-medium text-white">{request.leaveTypeName || request.leaveModeLabel || 'Leave request'}</div>
                                            <div className="text-sm text-ink-200">{formatDate(request.startDate)} to {formatDate(request.endDate)}</div>
                                        </div>
                                        <div className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.3em] ${formatStatusTone(request.status)}`}>
                                            {request.status || 'PENDING'}
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-2 text-sm text-ink-200">
                                        {isApprover ? <div>Employee: {request.employeeName} {request.employeeCode ? `(${request.employeeCode})` : ''}</div> : null}
                                        <div>Request type: {request.leaveTypeName || '-'}</div>
                                        <div>Duration: {request.leaveModeLabel || formatLeaveModeLabel(request.leaveMode)}</div>
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
