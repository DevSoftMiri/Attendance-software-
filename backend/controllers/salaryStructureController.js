import { asyncHandler } from '../utils/asyncHandler.js';
import { models } from '../models/store.js';

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function addDays(dateString, offsetDays) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return formatDate(date);
}

function normalizeStructurePayload(body = {}) {
    return {
        employeeId: Number(body.employeeId),
        salaryType: body.salaryType || 'MONTHLY',
        baseSalary: Number(body.baseSalary || body.monthlySalary || body.basicSalary || 0),
        monthlySalary: Number(body.monthlySalary || body.baseSalary || body.basicSalary || 0),
        basicSalary: Number(body.basicSalary || body.monthlySalary || body.baseSalary || 0),
        hra: Number(body.hra || 0),
        allowances: Number(body.allowances || 0),
        standardWorkingHoursPerDay: Number(body.standardWorkingHoursPerDay || 8),
        standardWorkingDays: Number(body.standardWorkingDays || 26),
        monthlyWorkingDays: Number(body.standardWorkingDays || body.monthlyWorkingDays || 26),
        overtimeEnabled: body.overtimeEnabled !== false && body.overtimeEnabled !== 'false',
        overtimeRatePerHour: Number(body.overtimeRatePerHour || body.overtimeRate || 0),
        overtimeRate: Number(body.overtimeRatePerHour || body.overtimeRate || 0),
        overtimeRatePerDay: Number(body.overtimeRatePerDay || body.overtimeRatePerHour || body.overtimeRate || 0),
        paidLeavesAllowed: Number(body.paidLeavesAllowed || body.paidLeaveAllowance || 0),
        halfDayAllowance: Number(body.halfDayAllowance || 0),
        defaultBonus: Number(body.defaultBonus || 0),
        shortHoursDeductionEnabled: body.shortHoursDeductionEnabled !== false && body.shortHoursDeductionEnabled !== 'false',
        unpaidLeaveDeductionEnabled: body.unpaidLeaveDeductionEnabled !== false && body.unpaidLeaveDeductionEnabled !== 'false',
        effectiveFrom: body.effectiveFrom || formatDate(new Date()),
        effectiveTo: body.effectiveTo || null,
        isActive: body.isActive !== false && body.isActive !== 'false'
    };
}

async function ensureEmployeeExists(employeeId) {
    const employee = await models.Employee.findByPk(employeeId);
    if (!employee) {
        throw new Error('Employee not found');
    }
    return employee;
}

export const listSalaryStructures = asyncHandler(async (request, response) => {
    const where = request.query.employeeId ? { employeeId: Number(request.query.employeeId) } : {};
    const salaryStructures = await models.SalaryStructure.findAll({
        where,
        order: [['employeeId', 'ASC'], ['effectiveFrom', 'DESC']]
    });
    return response.json({ salaryStructures });
});

export const createSalaryStructure = asyncHandler(async (request, response) => {
    const payload = normalizeStructurePayload(request.body);
    await ensureEmployeeExists(payload.employeeId);
    const existingSameStart = await models.SalaryStructure.findOne({
        where: {
            employeeId: payload.employeeId,
            effectiveFrom: payload.effectiveFrom
        }
    });

    if (existingSameStart) {
        await existingSameStart.update(payload);
        return response.status(200).json({ salaryStructure: existingSameStart });
    }

    const previousActive = await models.SalaryStructure.findOne({
        where: {
            employeeId: payload.employeeId,
            isActive: true
        },
        order: [['effectiveFrom', 'DESC']]
    });

    const salaryStructure = await models.SalaryStructure.create(payload);

    if (previousActive && previousActive.effectiveFrom < payload.effectiveFrom) {
        await previousActive.update({
            effectiveTo: addDays(payload.effectiveFrom, -1)
        });
    }

    return response.status(201).json({ salaryStructure });
});

export const updateSalaryStructure = asyncHandler(async (request, response) => {
    const salaryStructure = await models.SalaryStructure.findByPk(request.params.id);
    if (!salaryStructure) {
        return response.status(404).json({ message: 'Salary structure not found' });
    }

    const payload = normalizeStructurePayload({ ...salaryStructure.toJSON(), ...request.body, employeeId: salaryStructure.employeeId });
    await salaryStructure.update(payload);
    return response.json({ salaryStructure });
});
