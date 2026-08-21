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

export async function aggregateApprovedLeaves(employee, month, year, period) {
    const requests = await models.LeaveRequest.findAll({
        where: {
            employeeId: employee.id,
            status: 'APPROVED',
            startDate: { [Op.lte]: period.endDate },
            endDate: { [Op.gte]: period.startDate }
        },
        order: [['startDate', 'ASC']]
    });

    const leaveTypeIds = [...new Set(requests.map((entry) => entry.leaveTypeId).filter(Boolean))];
    const leaveTypes = leaveTypeIds.length
        ? await models.LeaveType.findAll({ where: { id: { [Op.in]: leaveTypeIds } } })
        : [];
    const leaveTypeMap = new Map(leaveTypes.map((entry) => [Number(entry.id), entry]));

    const leaveByDate = {};
    const summary = {
        approvedPaidLeaveDays: 0,
        approvedUnpaidLeaveDays: 0,
        approvedSickLeaveDays: 0,
        approvedCasualLeaveDays: 0,
        leaveBreakdown: []
    };

    for (const request of requests) {
        const leaveType = leaveTypeMap.get(Number(request.leaveTypeId));
        const paid = leaveType?.paid !== false;
        const overlapStart = request.startDate > period.startDate ? request.startDate : period.startDate;
        const overlapEnd = request.endDate < period.endDate ? request.endDate : period.endDate;
        const quantity = request.leaveMode === 'HALF_DAY' ? 0.5 : enumerateDates(overlapStart, overlapEnd).length;

        if (paid) {
            summary.approvedPaidLeaveDays += quantity;
        } else {
            summary.approvedUnpaidLeaveDays += quantity;
        }

        if (leaveType?.code === 'SICK_LEAVE') {
            summary.approvedSickLeaveDays += quantity;
        }
        if (leaveType?.code === 'CASUAL_LEAVE') {
            summary.approvedCasualLeaveDays += quantity;
        }

        const dayEntries = request.leaveMode === 'HALF_DAY'
            ? [request.startDate]
            : enumerateDates(overlapStart, overlapEnd);
        for (const date of dayEntries) {
            leaveByDate[date] = {
                paid,
                quantity: request.leaveMode === 'HALF_DAY' ? 0.5 : 1,
                code: leaveType?.code || 'LEAVE',
                name: leaveType?.name || 'Leave'
            };
        }

        summary.leaveBreakdown.push({
            id: request.id,
            leaveTypeId: request.leaveTypeId,
            leaveTypeCode: leaveType?.code || null,
            leaveTypeName: leaveType?.name || 'Leave',
            paid,
            startDate: request.startDate,
            endDate: request.endDate,
            leaveMode: request.leaveMode,
            quantity
        });
    }

    return {
        ...summary,
        approvedPaidLeaveDays: Number(summary.approvedPaidLeaveDays.toFixed(2)),
        approvedUnpaidLeaveDays: Number(summary.approvedUnpaidLeaveDays.toFixed(2)),
        approvedSickLeaveDays: Number(summary.approvedSickLeaveDays.toFixed(2)),
        approvedCasualLeaveDays: Number(summary.approvedCasualLeaveDays.toFixed(2)),
        leaveByDate
    };
}

