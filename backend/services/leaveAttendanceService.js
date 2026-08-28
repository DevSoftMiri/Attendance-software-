import { Op } from 'sequelize';
import { models } from '../models/store.js';
import { LEAVE_MODE } from '../utils/leaveModes.js';

export const SHORT_LEAVE_THRESHOLD_MINUTES = 120;

function resolveStartMinutes({ shift, loginTime }) {
    const source = String(loginTime || shift?.startTime || '09:00');
    const [hours, minutes] = source.split(':').map(Number);
    return ((Number(hours) || 0) * 60) + (Number(minutes) || 0);
}

function resolveEndMinutes({ shift, startMinutes }) {
    if (shift?.endTime) {
        const [hours, minutes] = String(shift.endTime).split(':').map(Number);
        let endMinutes = ((Number(hours) || 0) * 60) + (Number(minutes) || 0);
        if (endMinutes <= startMinutes) {
            endMinutes += 24 * 60;
        }
        return endMinutes;
    }

    return startMinutes + (Number(shift?.requiredWorkingHours || 8) * 60);
}

function applyMinutes(isoDate, minutesFromStartOfDay) {
    const value = new Date(`${isoDate}T00:00:00Z`);
    value.setUTCMinutes(minutesFromStartOfDay, 0, 0);
    return value;
}

function buildWindowLabel(leaveMode) {
    if (leaveMode === LEAVE_MODE.FIRST_HALF) {
        return 'Second-half attendance window';
    }
    if (leaveMode === LEAVE_MODE.SECOND_HALF) {
        return 'First-half attendance window';
    }
    return 'Full-day attendance window';
}

export function buildEffectiveAttendanceWindow({ shift, loginTime, attendanceDate, leaveMode = null, leaveRequestId = null }) {
    const startMinutes = resolveStartMinutes({ shift, loginTime });
    const endMinutes = resolveEndMinutes({ shift, startMinutes });
    const midpointMinutes = startMinutes + Math.floor((endMinutes - startMinutes) / 2);

    let expectedStartMinutes = startMinutes;
    let expectedEndMinutes = endMinutes;

    if (leaveMode === LEAVE_MODE.FIRST_HALF) {
        expectedStartMinutes = midpointMinutes;
    } else if (leaveMode === LEAVE_MODE.SECOND_HALF) {
        expectedEndMinutes = midpointMinutes;
    }

    const expectedCheckInTime = applyMinutes(attendanceDate, expectedStartMinutes);
    const expectedCheckOutTime = applyMinutes(attendanceDate, expectedEndMinutes);

    return {
        leaveRequestId,
        leaveMode,
        appliesHalfDayWindow: leaveMode === LEAVE_MODE.FIRST_HALF || leaveMode === LEAVE_MODE.SECOND_HALF,
        expectedStartMinutes,
        expectedEndMinutes,
        midpointMinutes,
        expectedCheckInTime,
        expectedCheckOutTime,
        expectedWorkingMinutes: Math.max(0, expectedEndMinutes - expectedStartMinutes),
        windowLabel: buildWindowLabel(leaveMode)
    };
}

export async function resolveApprovedHalfDayLeave({ employeeId, attendanceDate }) {
    if (!employeeId || !attendanceDate) {
        return null;
    }

    const leaveRequest = await models.LeaveRequest.findOne({
        where: {
            employeeId,
            status: 'APPROVED',
            leaveMode: { [Op.in]: [LEAVE_MODE.FIRST_HALF, LEAVE_MODE.SECOND_HALF] },
            startDate: { [Op.lte]: attendanceDate },
            endDate: { [Op.gte]: attendanceDate }
        },
        order: [['createdAt', 'DESC']]
    });

    if (!leaveRequest) {
        return null;
    }

    return {
        id: leaveRequest.id,
        leaveMode: leaveRequest.leaveMode,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate
    };
}

export async function resolveAttendanceLeaveWindow({ employee, shift, attendanceDate }) {
    const approvedHalfDayLeave = await resolveApprovedHalfDayLeave({
        employeeId: employee?.id,
        attendanceDate
    });

    const window = buildEffectiveAttendanceWindow({
        shift,
        loginTime: employee?.loginTime,
        attendanceDate,
        leaveMode: approvedHalfDayLeave?.leaveMode || null,
        leaveRequestId: approvedHalfDayLeave?.id || null
    });

    return {
        approvedHalfDayLeave,
        effectiveWindow: window
    };
}

export function resolveAttendanceStatus({ effectiveWindow, lateMinutes = 0 }) {
    if (effectiveWindow?.appliesHalfDayWindow) {
        return 'HALF_DAY';
    }

    return Number(lateMinutes || 0) >= SHORT_LEAVE_THRESHOLD_MINUTES ? 'SHORT_LEAVE' : 'PRESENT';
}

export function buildAttendanceState(summary, effectiveWindow) {
    const hasCheckedIn = Boolean(summary?.firstCheckIn);
    const hasCheckedOut = Boolean(summary?.lastCheckOut);
    const leaveMode = effectiveWindow?.leaveMode || summary?.appliedLeaveMode || null;

    let actionMode = 'CHECK_IN';
    if (hasCheckedIn && !hasCheckedOut) {
        actionMode = 'CHECK_OUT';
    } else if (hasCheckedIn && hasCheckedOut) {
        actionMode = 'COMPLETE';
    }

    let actionDetail = 'Present available';
    if (actionMode === 'CHECK_OUT') {
        actionDetail = leaveMode === LEAVE_MODE.FIRST_HALF
            ? 'Second-half logout pending'
            : leaveMode === LEAVE_MODE.SECOND_HALF
                ? 'First-half logout pending'
                : 'Logout available';
    } else if (actionMode === 'COMPLETE') {
        actionDetail = leaveMode ? `${effectiveWindow?.windowLabel || 'Half-day'} completed` : 'Attendance completed';
    } else {
        actionDetail = leaveMode === LEAVE_MODE.FIRST_HALF
            ? 'Second-half check-in pending'
            : leaveMode === LEAVE_MODE.SECOND_HALF
                ? 'First-half check-in pending'
                : 'Present available';
    }

    return {
        hasCheckedIn,
        hasCheckedOut,
        actionMode,
        actionDetail,
        leaveMode,
        effectiveWindow: effectiveWindow ? {
            leaveRequestId: effectiveWindow.leaveRequestId,
            leaveMode: effectiveWindow.leaveMode,
            appliesHalfDayWindow: effectiveWindow.appliesHalfDayWindow,
            expectedCheckInTime: effectiveWindow.expectedCheckInTime,
            expectedCheckOutTime: effectiveWindow.expectedCheckOutTime,
            expectedWorkingMinutes: effectiveWindow.expectedWorkingMinutes,
            windowLabel: effectiveWindow.windowLabel
        } : null
    };
}
