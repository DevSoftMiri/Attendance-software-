import { Op } from 'sequelize';
import { models } from '../models/store.js';

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function daysInUtcMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsUtc(year, month, offset) {
    const totalMonths = (year * 12) + (month - 1) + offset;
    return {
        year: Math.floor(totalMonths / 12),
        month: (totalMonths % 12) + 1
    };
}

export function normalizePayrollCycleSettings(settings = {}) {
    const periodStartDay = Math.max(1, Math.min(31, Number(settings?.periodStartDay || 1)));
    const periodEndDay = Math.max(1, Math.min(31, Number(settings?.periodEndDay || 31)));
    const defaultEndOffset = periodEndDay < periodStartDay ? 1 : 0;
    const periodEndMonthOffset = Number(settings?.periodEndMonthOffset ?? defaultEndOffset);
    const payDayOfMonth = Math.max(1, Math.min(31, Number(settings?.payDayOfMonth || 7)));
    const payMonthOffset = Number(settings?.payMonthOffset ?? 1);

    return {
        periodStartDay,
        periodEndDay,
        periodEndMonthOffset,
        payDayOfMonth,
        payMonthOffset
    };
}

export function getPayrollPeriodBounds(month, year, payrollSettings = {}) {
    const cycle = normalizePayrollCycleSettings(payrollSettings);
    const startMonthMeta = addMonthsUtc(year, month, 0);
    const endMonthMeta = addMonthsUtc(year, month, cycle.periodEndMonthOffset);
    const payMonthMeta = addMonthsUtc(endMonthMeta.year, endMonthMeta.month, cycle.payMonthOffset);

    const periodStart = new Date(Date.UTC(
        startMonthMeta.year,
        startMonthMeta.month - 1,
        Math.min(cycle.periodStartDay, daysInUtcMonth(startMonthMeta.year, startMonthMeta.month - 1))
    ));
    const periodEnd = new Date(Date.UTC(
        endMonthMeta.year,
        endMonthMeta.month - 1,
        Math.min(cycle.periodEndDay, daysInUtcMonth(endMonthMeta.year, endMonthMeta.month - 1))
    ));
    const payDate = new Date(Date.UTC(
        payMonthMeta.year,
        payMonthMeta.month - 1,
        Math.min(cycle.payDayOfMonth, daysInUtcMonth(payMonthMeta.year, payMonthMeta.month - 1))
    ));

    return {
        startDate: formatDate(periodStart),
        endDate: formatDate(periodEnd),
        payDate: formatDate(payDate),
        cycle
    };
}

function toSnapshot(structure, employee) {
    if (!structure) {
        return null;
    }

    return {
        id: structure.id,
        employeeId: structure.employeeId,
        salaryType: structure.salaryType || employee?.salaryType || 'MONTHLY',
        monthlySalary: String(structure.monthlySalary || structure.baseSalary || structure.basicSalary || employee?.baseSalary || 0),
        basicSalary: String(structure.basicSalary || structure.monthlySalary || structure.baseSalary || employee?.baseSalary || 0),
        hra: String(structure.hra || 0),
        allowances: String(structure.allowances || 0),
        standardWorkingHoursPerDay: Number(structure.standardWorkingHoursPerDay || 8),
        standardWorkingDays: Number(structure.standardWorkingDays || structure.monthlyWorkingDays || 26),
        overtimeEnabled: structure.overtimeEnabled !== false,
        overtimeRatePerHour: String(structure.overtimeRatePerHour || structure.overtimeRate || employee?.overtimeRate || 0),
        overtimeRatePerDay: String(structure.overtimeRatePerDay || structure.overtimeRatePerHour || structure.overtimeRate || employee?.overtimeRate || 0),
        paidLeavesAllowed: String(structure.paidLeavesAllowed || employee?.leaveEntitlement || 0),
        halfDayAllowance: String(structure.halfDayAllowance || employee?.halfDayEntitlement || 0),
        defaultBonus: String(structure.defaultBonus || 0),
        shortHoursDeductionEnabled: structure.shortHoursDeductionEnabled !== false,
        unpaidLeaveDeductionEnabled: structure.unpaidLeaveDeductionEnabled !== false,
        effectiveFrom: structure.effectiveFrom,
        effectiveTo: structure.effectiveTo
    };
}

export async function resolveEffectiveSalaryStructure(employee, month, year, payrollSettings = {}) {
    const { startDate, endDate } = getPayrollPeriodBounds(month, year, payrollSettings);
    const structures = await models.SalaryStructure.findAll({
        where: {
            employeeId: employee.id,
            isActive: { [Op.not]: false },
            effectiveFrom: { [Op.lte]: startDate },
            [Op.or]: [
                { effectiveTo: null },
                { effectiveTo: { [Op.gte]: startDate } }
            ]
        },
        order: [['effectiveFrom', 'DESC']]
    });

    const structure = structures[0] || null;
    if (!structure) {
        return { structure: null, snapshot: null, warnings: ['No effective salary structure found'] };
    }

    const midMonthChange = await models.SalaryStructure.findOne({
        where: {
            employeeId: employee.id,
            isActive: { [Op.not]: false },
            effectiveFrom: { [Op.gt]: startDate, [Op.lte]: endDate }
        },
        order: [['effectiveFrom', 'ASC']]
    });

    const warnings = [];
    if (midMonthChange) {
        warnings.push(`Salary structure changes on ${midMonthChange.effectiveFrom} and requires manual review before finalization.`);
    }

    return { structure, snapshot: toSnapshot(structure, employee), warnings };
}
