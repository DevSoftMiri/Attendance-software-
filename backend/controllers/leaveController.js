import { asyncHandler } from '../utils/asyncHandler.js';
import { models } from '../models/store.js';

const DEFAULT_LEAVE_TYPES = [
    { id: 1, code: 'PAID_LEAVE', name: 'Paid Leave', paid: true },
    { id: 2, code: 'WFH', name: 'Work From Home', paid: true },
    { id: 3, code: 'SICK_LEAVE', name: 'Sick Leave', paid: true },
    { id: 4, code: 'CASUAL_LEAVE', name: 'Casual Leave', paid: true },
    { id: 5, code: 'UNPAID_LEAVE', name: 'Unpaid Leave', paid: false }
];

function canReviewAllRequests(roleCode) {
    return ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(roleCode);
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
        carryForwardUnusedPaidLeave: source?.carryForwardUnusedPaidLeave !== false
    };
}

async function resolveLeaveTypes() {
    const leaveTypes = await models.LeaveType?.findAll({ order: [['id', 'ASC']] });
    return leaveTypes?.length ? leaveTypes : DEFAULT_LEAVE_TYPES;
}

async function resolveLeaveBalances(employeeId, year = new Date().getUTCFullYear()) {
    const leaveTypes = await resolveLeaveTypes();
    const balances = await models.LeaveBalance?.findAll?.({
        where: { employeeId, year },
        order: [['leaveTypeId', 'ASC']]
    }) || [];
    const balanceMap = new Map(balances.map((entry) => [Number(entry.leaveTypeId), entry]));

    return leaveTypes.map((leaveType) => {
        const existing = balanceMap.get(Number(leaveType.id));
        return {
            leaveTypeId: leaveType.id,
            code: leaveType.code,
            name: leaveType.name,
            paid: leaveType.paid !== false,
            openingBalance: Number(existing?.openingBalance || 0),
            currentBalance: Number(existing?.currentBalance || 0),
            year
        };
    });
}

function countLeaveDays(startDate, endDate, leaveMode) {
    if (!startDate || !endDate) {
        return 0;
    }

    if (leaveMode === 'HALF_DAY') {
        return 0.5;
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, days);
}

function isValidIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function monthsBetweenInclusive(startDate, endDate) {
    if (!startDate || !endDate) {
        return 0;
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return 0;
    }

    return ((end.getUTCFullYear() - start.getUTCFullYear()) * 12) + (end.getUTCMonth() - start.getUTCMonth()) + 1;
}

function formatMonthBoundary(value) {
    const current = new Date(`${value}T00:00:00Z`);
    return `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

async function resolvePaidLeaveSummary(employee, leaveRequests, asOfDate = new Date().toISOString().slice(0, 10)) {
    const organisation = employee?.organisationId
        ? await models.Organisation.findByPk?.(employee.organisationId)
        : null;
    const attendancePolicies = normalizeAttendancePolicies(organisation?.attendancePolicies);
    const leaveBalances = await resolveLeaveBalances(employee.id, new Date(`${asOfDate}T00:00:00Z`).getUTCFullYear());
    const assignedPaidLeaveBalance = leaveBalances.find((entry) => entry.code === 'PAID_LEAVE');
    const usedPaidLeave = leaveRequests
        .filter((request) => request.status === 'APPROVED' && request.leaveTypeCode === 'PAID_LEAVE')
        .reduce((total, request) => total + countLeaveDays(request.startDate, request.endDate, request.leaveMode), 0);
    const assignedPaidLeave = assignedPaidLeaveBalance
        ? Number(assignedPaidLeaveBalance.openingBalance || assignedPaidLeaveBalance.currentBalance || 0)
        : Number(employee?.leaveEntitlement || 0);
    const availablePaidLeave = assignedPaidLeaveBalance
        ? Number(assignedPaidLeaveBalance.currentBalance || 0)
        : Number(Math.max(0, assignedPaidLeave - usedPaidLeave).toFixed(2));

    return {
        assignedPaidLeave,
        carryForwardUnusedPaidLeave: attendancePolicies.carryForwardUnusedPaidLeave,
        usedPaidLeave: Number(usedPaidLeave.toFixed(2)),
        availablePaidLeave,
        balances: leaveBalances
    };
}

async function enrichLeaveRequests(requests) {
    const [employees, leaveTypes] = await Promise.all([
        models.Employee?.findAll?.() || [],
        resolveLeaveTypes()
    ]);

    const employeeMap = new Map(employees.map((employee) => [String(employee.id), employee]));
    const leaveTypeMap = new Map(leaveTypes.map((leaveType) => [String(leaveType.id), leaveType]));

    return requests.map((leaveRequest) => {
        const employee = employeeMap.get(String(leaveRequest.employeeId));
        const leaveType = leaveTypeMap.get(String(leaveRequest.leaveTypeId));

        return {
            ...leaveRequest.toJSON(),
            employeeName: employee?.fullName || `Employee #${leaveRequest.employeeId}`,
            employeeCode: employee?.employeeCode || null,
            leaveTypeCode: leaveType?.code || null,
            leaveTypeName: leaveType?.name || `Leave Type ${leaveRequest.leaveTypeId}`
        };
    });
}

export const listLeaveRequests = asyncHandler(async (request, response) => {
    const where = canReviewAllRequests(request.user?.roleCode)
        ? {}
        : { employeeId: request.user?.employeeId || null };
    const requests = await models.LeaveRequest.findAll({ where, order: [['createdAt', 'DESC']] });
    const enrichedRequests = await enrichLeaveRequests(requests);
    const currentEmployee = request.user?.employeeId ? await models.Employee.findByPk(request.user.employeeId) : null;
    const leaveSummary = currentEmployee
        ? await resolvePaidLeaveSummary(
            currentEmployee,
            enrichedRequests.filter((entry) => Number(entry.employeeId) === Number(currentEmployee.id))
        )
        : null;

    return response.json({ requests: enrichedRequests, leaveSummary });
});

export const listLeaveTypes = asyncHandler(async (request, response) => {
    const leaveTypes = await resolveLeaveTypes();
    return response.json({ leaveTypes });
});

export const listEmployeeLeaveBalances = asyncHandler(async (request, response) => {
    const employeeId = Number(request.query.employeeId || request.user?.employeeId);
    const year = Number(request.query.year || new Date().getUTCFullYear());
    if (!employeeId) {
        return response.status(422).json({ message: 'Employee is required' });
    }

    const balances = await resolveLeaveBalances(employeeId, year);
    return response.json({ balances, year, employeeId });
});

export const assignEmployeeLeaveBalances = asyncHandler(async (request, response) => {
    const employeeId = Number(request.params.employeeId);
    const year = Number(request.body.year || new Date().getUTCFullYear());
    const balances = Array.isArray(request.body.balances) ? request.body.balances : [];
    const employee = await models.Employee.findByPk(employeeId);
    if (!employee) {
        return response.status(404).json({ message: 'Employee not found' });
    }

    for (const entry of balances) {
        const leaveTypeId = Number(entry.leaveTypeId);
        if (!leaveTypeId) {
            continue;
        }

        const [balance] = await models.LeaveBalance.findOrCreate({
            where: { employeeId, leaveTypeId, year },
            defaults: {
                employeeId,
                leaveTypeId,
                year,
                openingBalance: Number(entry.openingBalance || 0),
                currentBalance: Number(entry.currentBalance || 0)
            }
        });

        await balance.update({
            openingBalance: Number(entry.openingBalance || 0),
            currentBalance: Number(entry.currentBalance || 0)
        });
    }

    const updatedBalances = await resolveLeaveBalances(employeeId, year);
    return response.json({ balances: updatedBalances, year, employeeId });
});

export const createLeaveRequest = asyncHandler(async (request, response) => {
    const employeeId = request.user?.employeeId || request.body.employeeId;
    if (!employeeId) {
        return response.status(422).json({ message: 'Employee profile is required to submit a leave request' });
    }

    if (!isValidIsoDate(request.body.startDate) || !isValidIsoDate(request.body.endDate)) {
        return response.status(422).json({ message: 'Please enter valid leave dates in DD/MM/YYYY format' });
    }

    const employee = await models.Employee.findByPk(employeeId);
    if (!employee) {
        return response.status(404).json({ message: 'Employee not found for this leave request' });
    }

    const leaveTypes = await resolveLeaveTypes();
    const leaveType = leaveTypes.find((entry) => Number(entry.id) === Number(request.body.leaveTypeId));
    if (!leaveType) {
        return response.status(422).json({ message: 'Please choose a valid leave type' });
    }

    const existingRequests = await enrichLeaveRequests(await models.LeaveRequest.findAll({
        where: { employeeId },
        order: [['createdAt', 'DESC']]
    }));
    const leaveSummary = await resolvePaidLeaveSummary(employee, existingRequests, request.body.endDate || request.body.startDate);
    const requestedDays = countLeaveDays(request.body.startDate, request.body.endDate, request.body.leaveMode);

    if (leaveType.code === 'PAID_LEAVE' && requestedDays > leaveSummary.availablePaidLeave) {
        return response.status(422).json({
            message: `Only ${leaveSummary.availablePaidLeave} paid leave day(s) are available for this employee`
        });
    }

    const leaveRequest = await models.LeaveRequest.create({
        ...request.body,
        employeeId,
        submittedAt: new Date(),
        status: 'PENDING',
        approverComment: null,
        approverUserId: null,
        decidedAt: null
    });

    const [enrichedLeaveRequest] = await enrichLeaveRequests([leaveRequest]);
    return response.status(201).json({ leaveRequest: enrichedLeaveRequest });
});

export const decideLeaveRequest = asyncHandler(async (request, response) => {
    const { id } = request.params;
    const { status, approverComment } = request.body;
    const leaveRequest = await models.LeaveRequest.findByPk(id);

    if (!leaveRequest) {
        return response.status(404).json({ message: 'Leave request not found' });
    }

    if (!['APPROVED', 'REJECTED'].includes(String(status || '').toUpperCase())) {
        return response.status(422).json({ message: 'Leave request status must be APPROVED or REJECTED' });
    }

    const employee = await models.Employee.findByPk(leaveRequest.employeeId);
    const existingRequests = await enrichLeaveRequests(await models.LeaveRequest.findAll({
        where: { employeeId: leaveRequest.employeeId },
        order: [['createdAt', 'DESC']]
    }));
    const requestedLeaveTypeCode = existingRequests.find((entry) => Number(entry.id) === Number(leaveRequest.id))?.leaveTypeCode;
    const availableSummary = employee
        ? await resolvePaidLeaveSummary(employee, existingRequests.filter((entry) => Number(entry.id) !== Number(leaveRequest.id)), leaveRequest.endDate || leaveRequest.startDate)
        : null;
    const requestedDays = countLeaveDays(leaveRequest.startDate, leaveRequest.endDate, leaveRequest.leaveMode);

    if (String(status).toUpperCase() === 'APPROVED' && requestedLeaveTypeCode === 'PAID_LEAVE' && availableSummary && requestedDays > availableSummary.availablePaidLeave) {
        return response.status(422).json({
            message: `Cannot approve. Only ${availableSummary.availablePaidLeave} paid leave day(s) are available`
        });
    }

    leaveRequest.status = String(status).toUpperCase();
    leaveRequest.approverComment = approverComment || null;
    leaveRequest.decidedAt = new Date();
    leaveRequest.approverUserId = request.user?.userId || null;
    await leaveRequest.save();

    if (String(status).toUpperCase() === 'APPROVED' && requestedLeaveTypeCode) {
        const leaveTypes = await resolveLeaveTypes();
        const leaveType = leaveTypes.find((entry) => entry.code === requestedLeaveTypeCode);
        if (leaveType) {
            const year = new Date(`${leaveRequest.startDate}T00:00:00Z`).getUTCFullYear();
            const [balance] = await models.LeaveBalance.findOrCreate({
                where: { employeeId: leaveRequest.employeeId, leaveTypeId: leaveType.id, year },
                defaults: {
                    employeeId: leaveRequest.employeeId,
                    leaveTypeId: leaveType.id,
                    year,
                    openingBalance: 0,
                    currentBalance: 0
                }
            });

            if (leaveType.paid !== false) {
                const nextBalance = Math.max(0, Number(balance.currentBalance || 0) - requestedDays);
                await balance.update({ currentBalance: nextBalance });
            }
        }
    }

    const [enrichedLeaveRequest] = await enrichLeaveRequests([leaveRequest]);
    return response.json({ leaveRequest: enrichedLeaveRequest });
});
