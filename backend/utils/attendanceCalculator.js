export function calculateMinutesBetween(startValue, endValue) {
    if (!startValue || !endValue) {
        return 0;
    }

    const start = new Date(startValue).getTime();
    const end = new Date(endValue).getTime();
    return Math.max(0, Math.round((end - start) / 60000));
}


export function evaluateAttendanceWindow({ shift, loginTime, checkInAt, checkOutAt }) {
    const response = {
        lateMinutes: 0,
        earlyLogoutMinutes: 0,
        overtimeMinutes: 0,
        totalWorkingMinutes: calculateMinutesBetween(checkInAt, checkOutAt)
    };

    if (!shift && !loginTime) {
        return response;
    }

    const [startHour, startMinute] = String(loginTime || shift.startTime || '09:00').split(':').map(Number);
    const shiftStart = new Date(checkInAt || new Date());
    shiftStart.setHours(startHour, startMinute, 0, 0);

    if (checkInAt) {
        response.lateMinutes = Math.max(0, Math.round((new Date(checkInAt).getTime() - shiftStart.getTime()) / 60000));
    }

    if (checkOutAt && shift?.endTime) {
        const [endHour, endMinute] = String(shift.endTime).split(':').map(Number);
        const shiftEnd = new Date(checkOutAt || new Date());
        shiftEnd.setHours(endHour, endMinute, 0, 0);
        response.earlyLogoutMinutes = Math.max(0, Math.round((shiftEnd.getTime() - new Date(checkOutAt).getTime()) / 60000));
        response.overtimeMinutes = Math.max(0, Math.round((new Date(checkOutAt).getTime() - shiftEnd.getTime()) / 60000));
    }

    return response;
}
