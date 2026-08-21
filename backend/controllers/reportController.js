import { asyncHandler } from '../utils/asyncHandler.js';
import { Op } from 'sequelize';
import { models } from '../models/store.js';

function formatCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const normalized = String(value).replace(/"/g, '""');
    return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
}

function sendCsv(response, filename, rows = []) {
    const entries = Array.isArray(rows) ? rows : [];
    const headers = entries.length ? Object.keys(entries[0]) : [];
    const csv = [
        headers.join(','),
        ...entries.map((row) => headers.map((header) => formatCsvValue(row[header])).join(','))
    ].join('\n');

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return response.send(csv);
}

function shouldDownloadCsv(request) {
    return String(request.query.format || '').toLowerCase() === 'csv';
}

function normalizeAttendancePolicies(value = {}) {
    const source = typeof value === 'string'
        ? (() => {
            try {
                return JSON.parse(value);
            } catch {
                return {};
            }
        })()
        : value;

    return {
        geofenceRadius: Number(source?.geofenceRadius || 150),
        maxLateArrivalMinutes: Number(source?.maxLateArrivalMinutes || 0),
        carryForwardUnusedPaidLeave: source?.carryForwardUnusedPaidLeave !== false
    };
}

async function buildAttendanceSummaryRows(filters = {}) {
    const {
        employeeId,
        departmentId,
        branchId,
        startDate,
        endDate,
        status
    } = filters;

    const employeeWhere = {};
    if (employeeId) {
        employeeWhere.id = employeeId;
    }
    if (departmentId) {
        employeeWhere.departmentId = departmentId;
    }
    if (branchId) {
        employeeWhere.branchId = branchId;
    }

    const employees = await models.Employee.findAll({
        where: employeeWhere,
        order: [['fullName', 'ASC']]
    });

    const employeeIds = employees.map((employee) => employee.id);
    if (!employeeIds.length) {
        return [];
    }

    const summaryWhere = {
        employeeId: { [Op.in]: employeeIds }
    };

    if (startDate || endDate) {
        summaryWhere.attendanceDate = {};
        if (startDate) {
            summaryWhere.attendanceDate[Op.gte] = startDate;
        }
        if (endDate) {
            summaryWhere.attendanceDate[Op.lte] = endDate;
        }
    }

    if (status) {
        summaryWhere.attendanceStatus = status;
    }

    const summaries = await models.AttendanceSummary.findAll({
        where: summaryWhere,
        order: [['attendanceDate', 'DESC'], ['employeeId', 'ASC']]
    });

    const departments = await models.Department.findAll({ where: employeeWhere.departmentId ? { id: employeeWhere.departmentId } : {} });
    const branches = await models.Branch.findAll({ where: employeeWhere.branchId ? { id: employeeWhere.branchId } : {} });
    const shifts = await models.Shift.findAll({ where: employeeIds.length ? { id: { [Op.in]: employees.map((employee) => employee.shiftId).filter(Boolean) } } : {} });

    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
    const departmentMap = new Map(departments.map((department) => [department.id, department]));
    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));
    const shiftMap = new Map(shifts.map((shift) => [shift.id, shift]));

    return summaries.map((summary) => {
        const employee = employeeMap.get(summary.employeeId);
        return {
            id: summary.id,
            employeeId: summary.employeeId,
            employeeName: employee?.fullName || 'Unknown',
            employeeCode: employee?.employeeCode || '',
            departmentId: employee?.departmentId || null,
            departmentName: departmentMap.get(employee?.departmentId)?.name || '-',
            branchId: employee?.branchId || null,
            branchName: branchMap.get(employee?.branchId)?.name || '-',
            shiftId: summary.shiftId || employee?.shiftId || null,
            shiftName: shiftMap.get(summary.shiftId || employee?.shiftId)?.name || '-',
            attendanceDate: summary.attendanceDate,
            firstCheckIn: summary.firstCheckIn,
            lastCheckOut: summary.lastCheckOut,
            totalWorkingMinutes: summary.totalWorkingMinutes,
            lateMinutes: summary.lateMinutes,
            overtimeMinutes: summary.overtimeMinutes,
            attendanceStatus: summary.attendanceStatus,
            regularized: summary.regularized,
            payrollProcessed: summary.payrollProcessed
        };
    });
}

export const attendanceReport = asyncHandler(async (request, response) => {
    const summaries = await models.AttendanceSummary.findAll({ order: [['attendanceDate', 'DESC']], limit: 200 });
    const rows = summaries.map((entry) => entry.toJSON());
    if (shouldDownloadCsv(request)) {
        return sendCsv(response, 'attendance-report.csv', rows);
    }
    return response.json({ summaries: rows });
});

export const leaveReport = asyncHandler(async (request, response) => {
    const leaveRequests = await models.LeaveRequest.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
    const rows = leaveRequests.map((entry) => entry.toJSON());
    if (shouldDownloadCsv(request)) {
        return sendCsv(response, 'leave-report.csv', rows);
    }
    return response.json({ leaveRequests: rows });
});

export const payrollReport = asyncHandler(async (request, response) => {
    const payrollRuns = await models.PayrollRun.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
    const rows = payrollRuns.map((entry) => entry.toJSON());
    if (shouldDownloadCsv(request)) {
        return sendCsv(response, 'payroll-report.csv', rows);
    }
    return response.json({ payrollRuns: rows });
});

export const attendanceSummaryReport = asyncHandler(async (request, response) => {
    const rows = await buildAttendanceSummaryRows(request.query);

    if (shouldDownloadCsv(request)) {
        return sendCsv(response, 'attendance-summary-report.csv', rows);
    }

    return response.json({ summaries: rows });
});

export const lateArrivalReport = asyncHandler(async (request, response) => {
    const organisation = await models.Organisation.findOne({ order: [['createdAt', 'DESC']] });
    const attendancePolicies = normalizeAttendancePolicies(organisation?.attendancePolicies);
    const threshold = Number(request.query.minLateMinutes ?? attendancePolicies.maxLateArrivalMinutes ?? 0);
    const rows = await buildAttendanceSummaryRows(request.query);
    const lateRows = rows
        .filter((row) => Number(row.lateMinutes || 0) > threshold)
        .map((row) => ({
            ...row,
            lateThresholdMinutes: threshold
        }));

    if (shouldDownloadCsv(request)) {
        return sendCsv(response, 'late-arrival-report.csv', lateRows);
    }

    return response.json({ summaries: lateRows, minLateMinutes: threshold });
});
