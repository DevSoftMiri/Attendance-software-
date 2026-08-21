import { Op } from 'sequelize';
import { models } from '../models/store.js';

function enumerateDates(startDate, endDate) {
    const dates = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const limit = new Date(`${endDate}T00:00:00Z`);
    while (cursor <= limit) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
}

function isWithinEmployment(employee, isoDate) {
    if (employee?.joiningDate && isoDate < employee.joiningDate) {
        return false;
    }
    const endDate = employee?.exitDate || employee?.resignationDate;
    if (endDate && isoDate > endDate) {
        return false;
    }
    return true;
}

function resolveWeekOffs(weeklyWorkingDays) {
    if (Array.isArray(weeklyWorkingDays) && weeklyWorkingDays.length) {
        const normalized = weeklyWorkingDays.map((entry) => String(entry).toUpperCase());
        const allDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        return allDays.filter((day) => !normalized.includes(day));
    }

    if (weeklyWorkingDays && typeof weeklyWorkingDays === 'object') {
        return Object.entries(weeklyWorkingDays)
            .filter(([, isWorking]) => isWorking === false)
            .map(([key]) => key.toUpperCase());
    }

    return ['SUNDAY'];
}

function weekdayName(isoDate) {
    return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toUpperCase();
}

export async function aggregateAttendanceForPayroll({ employee, organisation, salaryStructure, period, leaveSummary, payrollSettings }) {
    const summaries = await models.AttendanceSummary.findAll({
        where: {
            employeeId: employee.id,
            attendanceDate: { [Op.between]: [period.startDate, period.endDate] }
        },
        order: [['attendanceDate', 'ASC']]
    });

    const holidays = await models.Holiday.findAll({
        where: {
            organisationId: employee.organisationId || organisation?.id || 1,
            holidayDate: { [Op.between]: [period.startDate, period.endDate] },
            isActive: { [Op.not]: false },
            ...(employee.branchId ? { [Op.or]: [{ branchId: null }, { branchId: employee.branchId }] } : {})
        }
    });

    const holidaySet = new Set(holidays.map((entry) => entry.holidayDate));
    const summaryMap = new Map(summaries.map((entry) => [entry.attendanceDate, entry]));
    const weekOffs = resolveWeekOffs(organisation?.weeklyWorkingDays);
    const requiredMinutesPerDay = Number(
        salaryStructure?.standardWorkingHoursPerDay ||
        payrollSettings?.standardWorkingHoursPerDay ||
        8
    ) * 60;
    const halfDayMinimumMinutes = Number(payrollSettings?.halfDayMinimumMinutes || Math.floor(requiredMinutesPerDay / 2));

    const result = {
        workingDays: 0,
        presentDays: 0,
        halfDays: 0,
        paidLeaves: 0,
        unpaidLeaves: 0,
        absentDays: 0,
        holidayDays: 0,
        weekOffDays: 0,
        requiredWorkingMinutes: 0,
        actualWorkingMinutes: 0,
        overtimeMinutes: 0,
        overtimeDays: 0,
        shortMinutes: 0,
        dailyStatus: []
    };

    for (const date of enumerateDates(period.startDate, period.endDate)) {
        if (!isWithinEmployment(employee, date)) {
            continue;
        }

        const leaveEntry = leaveSummary?.leaveByDate?.[date] || null;
        const summary = summaryMap.get(date) || null;
        const isHoliday = holidaySet.has(date);
        const isWeekOff = weekOffs.includes(weekdayName(date));
        const actualMinutes = Number(summary?.totalWorkingMinutes || 0);
        const overtimeMinutes = Number(summary?.overtimeMinutes || 0);
        if (overtimeMinutes > 0) {
            result.overtimeDays += 1;
        }

        if (isHoliday) {
            result.holidayDays += 1;
            if (payrollSettings?.holidaysPaid !== false) {
                result.requiredWorkingMinutes += requiredMinutesPerDay;
            }
            result.dailyStatus.push({ date, status: 'HOLIDAY', actualMinutes, overtimeMinutes });
            continue;
        }

        if (isWeekOff) {
            result.weekOffDays += 1;
            if (payrollSettings?.weekOffPaid !== false) {
                result.requiredWorkingMinutes += requiredMinutesPerDay;
            }
            result.dailyStatus.push({ date, status: 'WEEK_OFF', actualMinutes, overtimeMinutes });
            continue;
        }

        result.workingDays += 1;
        result.requiredWorkingMinutes += requiredMinutesPerDay;
        result.actualWorkingMinutes += actualMinutes;
        result.overtimeMinutes += overtimeMinutes;
        result.shortMinutes += Math.max(0, requiredMinutesPerDay - actualMinutes);

        if (leaveEntry) {
            if (leaveEntry.quantity === 0.5) {
                result.halfDays += 1;
                result.presentDays += actualMinutes >= halfDayMinimumMinutes ? 0.5 : 0;
                result.shortMinutes += Math.max(0, halfDayMinimumMinutes - actualMinutes);
                result.dailyStatus.push({ date, status: 'HALF_DAY', actualMinutes, overtimeMinutes });
            } else if (leaveEntry.paid) {
                result.paidLeaves += 1;
                result.dailyStatus.push({ date, status: 'PAID_LEAVE', actualMinutes, overtimeMinutes });
            } else {
                result.unpaidLeaves += 1;
                result.dailyStatus.push({ date, status: 'UNPAID_LEAVE', actualMinutes, overtimeMinutes });
            }
            continue;
        }

        if (!summary) {
            result.absentDays += 1;
            result.dailyStatus.push({ date, status: 'ABSENT', actualMinutes: 0, overtimeMinutes: 0 });
            continue;
        }

        if (actualMinutes >= requiredMinutesPerDay) {
            result.presentDays += 1;
            result.dailyStatus.push({ date, status: 'PRESENT', actualMinutes, overtimeMinutes });
        } else if (actualMinutes >= halfDayMinimumMinutes) {
            result.halfDays += 1;
            result.dailyStatus.push({ date, status: 'HALF_DAY', actualMinutes, overtimeMinutes });
        } else if (actualMinutes > 0) {
            result.halfDays += 1;
            result.dailyStatus.push({ date, status: 'HALF_DAY', actualMinutes, overtimeMinutes });
        } else {
            result.absentDays += 1;
            result.dailyStatus.push({ date, status: 'ABSENT', actualMinutes: 0, overtimeMinutes: 0 });
        }
    }

    return result;
}
