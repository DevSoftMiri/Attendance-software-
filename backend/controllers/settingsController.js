import { asyncHandler } from '../utils/asyncHandler.js';
import { models } from '../models/store.js';

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
        ...source,
        geofenceRadius: Number(source?.geofenceRadius || 150),
        maxLateArrivalMinutes: Number(source?.maxLateArrivalMinutes || 0),
        carryForwardUnusedPaidLeave: source?.carryForwardUnusedPaidLeave !== false
    };
}

function normalizePayrollSettings(value = {}) {
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
        standardWorkingHoursPerDay: Number(source?.standardWorkingHoursPerDay || 8),
        graceMinutes: Number(source?.graceMinutes || 15),
        halfDayMinimumMinutes: Number(source?.halfDayMinimumMinutes || 240),
        overtimeEnabled: source?.overtimeEnabled !== false,
        overtimeMinimumMinutes: Number(source?.overtimeMinimumMinutes || 0),
        overtimeRateType: source?.overtimeRateType || 'fixed',
        salaryCalculationMethod: source?.salaryCalculationMethod || 'working-days',
        holidaysPaid: source?.holidaysPaid !== false,
        weekOffPaid: source?.weekOffPaid !== false,
        shortHoursDeductionEnabled: source?.shortHoursDeductionEnabled !== false,
        shortHoursDeductionMethod: source?.shortHoursDeductionMethod || 'accumulated',
        periodStartDay: Number(source?.periodStartDay || 1),
        periodEndDay: Number(source?.periodEndDay || 31),
        periodEndMonthOffset: Number(source?.periodEndMonthOffset ?? 0),
        payDayOfMonth: Number(source?.payDayOfMonth || 7),
        payMonthOffset: Number(source?.payMonthOffset ?? 1)
    };
}

export const getSettings = asyncHandler(async (request, response) => {
    const organisation = await models.Organisation.findOne({ order: [['createdAt', 'DESC']] });
    const shifts = await models.Shift.findAll({ order: [['createdAt', 'DESC']] });
    const branches = await models.Branch.findAll({ order: [['createdAt', 'DESC']] });
    const approvedIpAddresses = await models.ApprovedIpAddress.findAll({ order: [['createdAt', 'DESC']] });
    return response.json({
        organisation: organisation ? {
            ...organisation.toJSON(),
            attendancePolicies: normalizeAttendancePolicies(organisation.attendancePolicies),
            payrollSettings: normalizePayrollSettings(organisation.salaryRules || organisation.settings?.payrollSettings)
        } : null,
        shifts,
        branches,
        approvedIpAddresses
    });
});

export const updateOrganisation = asyncHandler(async (request, response) => {
    const payload = {
        ...request.body,
        attendancePolicies: normalizeAttendancePolicies(request.body.attendancePolicies),
        salaryRules: normalizePayrollSettings(request.body.payrollSettings),
        settings: {
            ...(request.body.settings || {}),
            payrollSettings: normalizePayrollSettings(request.body.payrollSettings)
        }
    };

    const [organisation] = await models.Organisation.findOrCreate({
        where: { id: request.body.id || 1 },
        defaults: payload
    });

    await organisation.update(payload);
    return response.json({
        organisation: {
            ...organisation.toJSON(),
            attendancePolicies: normalizeAttendancePolicies(organisation.attendancePolicies),
            payrollSettings: normalizePayrollSettings(organisation.salaryRules || organisation.settings?.payrollSettings)
        }
    });
});

export const createShift = asyncHandler(async (request, response) => {
    const shift = await models.Shift.create(request.body);
    return response.status(201).json({ shift });
});

export const updateShift = asyncHandler(async (request, response) => {
    const shift = await models.Shift.findByPk(request.params.id);
    if (!shift) {
        return response.status(404).json({ message: 'Shift not found' });
    }

    await shift.update(request.body);
    return response.json({ shift });
});

export const deleteShift = asyncHandler(async (request, response) => {
    const shift = await models.Shift.findByPk(request.params.id);
    if (!shift) {
        return response.status(404).json({ message: 'Shift not found' });
    }

    await shift.destroy();
    return response.status(204).send();
});

export const createBranch = asyncHandler(async (request, response) => {
    const branch = await models.Branch.create(request.body);
    return response.status(201).json({ branch });
});

export const updateBranch = asyncHandler(async (request, response) => {
    const branch = await models.Branch.findByPk(request.params.id);
    if (!branch) {
        return response.status(404).json({ message: 'Branch not found' });
    }

    await branch.update(request.body);
    return response.json({ branch });
});

export const deleteBranch = asyncHandler(async (request, response) => {
    const branch = await models.Branch.findByPk(request.params.id);
    if (!branch) {
        return response.status(404).json({ message: 'Branch not found' });
    }

    await branch.destroy();
    return response.status(204).send();
});

export const createApprovedIpAddress = asyncHandler(async (request, response) => {
    const approvedIpAddress = await models.ApprovedIpAddress.create(request.body);
    return response.status(201).json({ approvedIpAddress });
});

export const updateApprovedIpAddress = asyncHandler(async (request, response) => {
    const approvedIpAddress = await models.ApprovedIpAddress.findByPk(request.params.id);
    if (!approvedIpAddress) {
        return response.status(404).json({ message: 'Approved office network not found' });
    }

    await approvedIpAddress.update(request.body);
    return response.json({ approvedIpAddress });
});

export const deleteApprovedIpAddress = asyncHandler(async (request, response) => {
    const approvedIpAddress = await models.ApprovedIpAddress.findByPk(request.params.id);
    if (!approvedIpAddress) {
        return response.status(404).json({ message: 'Approved office network not found' });
    }

    await approvedIpAddress.destroy();
    return response.status(204).send();
});
