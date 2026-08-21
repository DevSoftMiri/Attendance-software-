import { Op } from 'sequelize';
import { sequelize } from '../config/db.js';
import { models } from '../models/store.js';
import { aggregateAttendanceForPayroll } from './payrollAttendanceAggregationService.js';
import { calculatePayroll } from './payrollCalculation.service.js';
import { aggregateApprovedLeaves } from './payrollLeaveAggregationService.js';
import { getPayrollPeriodBounds, normalizePayrollCycleSettings, resolveEffectiveSalaryStructure } from './salaryStructureService.js';
import { parseEditablePayrollFields, parsePayrollFilters, validateComponentOverrides, validateManualAdjustments, validatePayrollMonthYear } from '../validators/payrollValidators.js';

function normalizePayrollSettings(source = {}) {
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
        ...normalizePayrollCycleSettings(source)
    };
}

function buildPeriodLabel(month, year, payrollSettings = {}) {
    const bounds = getPayrollPeriodBounds(month, year, payrollSettings);
    return `${bounds.startDate} to ${bounds.endDate}`;
}

function toBusinessStatus(status) {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PAID') {
        return 'paid';
    }
    if (normalized === 'FINALIZED') {
        return 'approved';
    }
    return 'pending';
}

function toStorageStatus(status) {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PAID') {
        return 'PAID';
    }
    if (normalized === 'APPROVED' || normalized === 'FINALIZED') {
        return 'FINALIZED';
    }
    if (normalized === 'PENDING' || normalized === 'DRAFT') {
        return 'DRAFT';
    }
    return normalized || undefined;
}

function buildSimplifiedPayrollView(record) {
    const payload = serializeModel(record);
    const payrollSettings = payload.payrollSettingsSnapshot || {};
    const bounds = getPayrollPeriodBounds(payload.month, payload.year, payrollSettings);
    const attendance = payload.attendanceSummarySnapshot || {};
    const inputs = payload.payrollInputs || {};
    const structure = payload.salaryStructureSnapshot || {};
    const baseSalary = String(inputs.basicSalary || structure.basicSalary || structure.monthlySalary || structure.baseSalary || 0);
    const paidLeavesAllowed = Number(structure.paidLeavesAllowed || 0);
    const halfDaysAllowed = Number(structure.halfDayAllowance || 0);
    const paidLeavesTaken = Number(attendance.paidLeaves || 0);
    const halfDaysTaken = Number(attendance.halfDays || 0);
    const extraPaidLeaves = Math.max(0, paidLeavesTaken - paidLeavesAllowed);
    const extraHalfDays = Math.max(0, halfDaysTaken - halfDaysAllowed);
    const earnings = payload.payroll_earnings || payload.payrollEarnings || [];
    const deductions = payload.payroll_deductions || payload.payrollDeductions || [];
    const overtimeEntry = earnings.find((entry) => entry.componentCode === 'OVERTIME');
    const bonusEntry = earnings.find((entry) => entry.componentCode === 'BONUS');
    const leaveEntry = deductions.find((entry) => entry.componentCode === 'LEAVE_DEDUCTION');
    const halfDayEntry = deductions.find((entry) => entry.componentCode === 'HALF_DAY');
    const otherEntry = deductions.find((entry) => entry.componentCode === 'OTHER');

    return {
        ...payload,
        status: toBusinessStatus(payload.status),
        cycleStartDate: bounds.startDate,
        cycleEndDate: bounds.endDate,
        salaryCreditDate: bounds.payDate,
        basicSalary: baseSalary,
        paidLeavesAllowed,
        paidLeavesTaken,
        extraPaidLeaves,
        halfDaysAllowed,
        halfDaysTaken,
        extraHalfDays,
        overtimeDays: Number(inputs.overtimeDays ?? attendance.overtimeDays ?? 0),
        overtimeRatePerDay: String(inputs.overtimeRatePerDay || structure.overtimeRatePerDay || structure.overtimeRate || 0),
        overtimeAmount: String(overtimeEntry?.amount || 0),
        bonus: {
            amount: String(inputs?.bonus?.amount || bonusEntry?.amount || 0),
            reason: String(inputs?.bonus?.reason || '').trim()
        },
        leaveDeduction: String(leaveEntry?.amount || 0),
        halfDayDeduction: String(halfDayEntry?.amount || 0),
        otherDeduction: String(otherEntry?.amount || 0),
        totalDeduction: payload.totalDeductions,
        paymentHistory: payload.payment_records || payload.paymentRecords || []
    };
}

async function createAuditLog({ userId, actionType, entityName, entityId, oldValue = null, newValue = null }) {
    if (!models.AuditLog?.create) {
        return null;
    }

    return models.AuditLog.create({
        userId: userId || null,
        actionType,
        entityName,
        entityId: entityId ? String(entityId) : null,
        oldValue,
        newValue
    });
}

async function ensurePayrollPeriod({ organisationId, month, year }, transaction) {
    const organisation = await models.Organisation.findByPk(organisationId);
    const payrollSettings = normalizePayrollSettings(organisation?.salaryRules || organisation?.settings?.payrollSettings || {});
    const bounds = getPayrollPeriodBounds(month, year, payrollSettings);
    const [period] = await models.PayrollPeriod.findOrCreate({
        where: { organisationId, month, year },
        defaults: {
            organisationId,
            month,
            year,
            startDate: bounds.startDate,
            endDate: bounds.endDate,
            payDate: bounds.payDate,
            status: 'DRAFT'
        },
        transaction
    });

    if (
        period.startDate !== bounds.startDate ||
        period.endDate !== bounds.endDate ||
        period.payDate !== bounds.payDate
    ) {
        await period.update({
            startDate: bounds.startDate,
            endDate: bounds.endDate,
            payDate: bounds.payDate
        }, { transaction });
    }

    return { period, bounds, payrollSettings };
}

async function ensurePayrollRun({ payrollPeriodId, departmentId = null, employeeId = null, userId = null }, transaction) {
    const [run] = await models.PayrollRun.findOrCreate({
        where: {
            payrollPeriodId,
            departmentId,
            employeeId,
            status: 'DRAFT'
        },
        defaults: {
            payrollPeriodId,
            departmentId,
            employeeId,
            status: 'DRAFT',
            generatedByUserId: userId
        },
        transaction
    });
    return run;
}

function getTransactionRunner() {
    return typeof sequelize?.transaction === 'function'
        ? (handler) => sequelize.transaction(handler)
        : async (handler) => handler(null);
}

async function loadOrganisation(employee) {
    return models.Organisation.findByPk(employee.organisationId || 1);
}

function serializeModel(instance) {
    return instance?.toJSON ? instance.toJSON() : instance;
}

async function persistPayrollBreakdown(employeePayroll, calculation, transaction) {
    await models.PayrollEarning.destroy({ where: { employeePayrollId: employeePayroll.id }, transaction });
    await models.PayrollDeduction.destroy({ where: { employeePayrollId: employeePayroll.id }, transaction });

    if (calculation.earnings.length) {
        await models.PayrollEarning.bulkCreate(calculation.earnings.map((entry) => ({
            employeePayrollId: employeePayroll.id,
            componentCode: entry.componentCode,
            name: entry.name,
            amount: entry.amount
        })), { transaction });
    }

    if (calculation.deductions.length) {
        await models.PayrollDeduction.bulkCreate(calculation.deductions.map((entry) => ({
            employeePayrollId: employeePayroll.id,
            componentCode: entry.componentCode,
            name: entry.name,
            amount: entry.amount
        })), { transaction });
    }
}

export async function previewPayroll({ employeeId, month, year, manualAdjustments = [], componentOverrides = { earnings: {}, deductions: {} }, editableFields = {} }) {
    const validated = validatePayrollMonthYear(month, year);
    const employee = await models.Employee.findByPk(employeeId);
    if (!employee) {
        throw new Error('Employee not found');
    }

    const organisation = await loadOrganisation(employee);
    const { bounds, payrollSettings } = await ensurePayrollPeriod({
        organisationId: employee.organisationId || organisation?.id || 1,
        month: validated.month,
        year: validated.year
    });
    const adjustments = validateManualAdjustments(manualAdjustments);
    const overrides = validateComponentOverrides(componentOverrides);
    const normalizedEditableFields = parseEditablePayrollFields(editableFields);
    const salaryResolution = await resolveEffectiveSalaryStructure(employee, validated.month, validated.year, payrollSettings);
    if (!salaryResolution.structure) {
        throw new Error('No effective salary structure found for the selected payroll period');
    }

    const leaveSummary = await aggregateApprovedLeaves(employee, validated.month, validated.year, bounds);
    const attendanceSummary = await aggregateAttendanceForPayroll({
        employee,
        organisation,
        salaryStructure: salaryResolution.snapshot,
        period: bounds,
        leaveSummary,
        payrollSettings
    });
    const calculation = calculatePayroll({
        employee,
        salaryStructure: salaryResolution.snapshot,
        attendanceSummary,
        leaveSummary,
        payrollSettings,
        manualAdjustments: adjustments,
        componentOverrides: overrides,
        editableFields: normalizedEditableFields
    });

    return {
        employee: serializeModel(employee),
        month: validated.month,
        year: validated.year,
        period: bounds,
        salaryStructure: salaryResolution.snapshot,
        leaveSummary,
        attendanceSummary,
        payrollSettings,
        editableFields: normalizedEditableFields,
        payroll: calculation,
        componentOverrides: overrides,
        warnings: [...salaryResolution.warnings, ...calculation.warnings]
    };
}

async function upsertDraftPayroll({
    employee,
    month,
    year,
    payrollRun,
    salaryStructure,
    payrollSettings,
    leaveSummary,
    attendanceSummary,
    calculation,
    manualAdjustments,
    componentOverrides,
    editableFields,
    userId
}, transaction) {
    const existing = await models.EmployeePayroll.findOne({
        where: {
            payrollRunId: payrollRun.id,
            employeeId: employee.id
        },
        transaction
    });

    if (existing && String(existing.status).toUpperCase() !== 'DRAFT') {
        throw new Error('Payroll must be reopened before it can be recalculated');
    }

    const payload = {
        payrollRunId: payrollRun.id,
        employeeId: employee.id,
        month,
        year,
        status: 'DRAFT',
        salaryStructureSnapshot: salaryStructure,
        payrollSettingsSnapshot: payrollSettings,
        attendanceSummarySnapshot: attendanceSummary,
        leaveSummarySnapshot: {
            approvedPaidLeaveDays: leaveSummary.approvedPaidLeaveDays,
            approvedUnpaidLeaveDays: leaveSummary.approvedUnpaidLeaveDays,
            approvedSickLeaveDays: leaveSummary.approvedSickLeaveDays,
            approvedCasualLeaveDays: leaveSummary.approvedCasualLeaveDays,
            leaveBreakdown: leaveSummary.leaveBreakdown
        },
        payrollInputs: editableFields,
        manualAdjustments,
        componentOverrides,
        grossEarnings: calculation.grossEarnings,
        grossSalary: calculation.grossSalary,
        totalDeductions: calculation.totalDeductions,
        netSalary: calculation.netSalary,
        paymentStatus: 'PENDING',
        generatedAt: existing?.generatedAt || new Date(),
        generatedByUserId: existing?.generatedByUserId || userId || null,
        lastCalculatedAt: new Date()
    };

    let employeePayroll = existing;
    if (employeePayroll) {
        await employeePayroll.update(payload, { transaction });
    } else {
        employeePayroll = await models.EmployeePayroll.create(payload, { transaction });
    }

    await persistPayrollBreakdown(employeePayroll, calculation, transaction);
    return employeePayroll;
}

async function buildPersistedDetail(employeePayroll) {
    const record = await models.EmployeePayroll.findByPk(employeePayroll.id, {
        include: [
            { model: models.Employee },
            { model: models.PayrollRun, include: [{ model: models.PayrollPeriod }] },
            { model: models.PayrollEarning },
            { model: models.PayrollDeduction },
            { model: models.SalarySlip },
            { model: models.PaymentRecord }
        ]
    });
    return record;
}

export async function generatePayrollForEmployee({ employeeId, month, year, manualAdjustments = [], componentOverrides = { earnings: {}, deductions: {} }, editableFields = {}, userId, payrollRunId = null }) {
    const validated = validatePayrollMonthYear(month, year);
    const employee = await models.Employee.findByPk(employeeId);
    if (!employee) {
        throw new Error('Employee not found');
    }

    const organisation = await loadOrganisation(employee);
    const payrollSettings = normalizePayrollSettings(organisation?.salaryRules || organisation?.settings?.payrollSettings || {});
    const adjustments = validateManualAdjustments(manualAdjustments);
    const overrides = validateComponentOverrides(componentOverrides);
    const normalizedEditableFields = parseEditablePayrollFields(editableFields);
    const salaryResolution = await resolveEffectiveSalaryStructure(employee, validated.month, validated.year, payrollSettings);
    if (!salaryResolution.structure) {
        throw new Error('Payroll generation requires a salary structure');
    }

    return getTransactionRunner()(async (transaction) => {
        const { period, bounds } = await ensurePayrollPeriod({
            organisationId: employee.organisationId || organisation?.id || 1,
            month: validated.month,
            year: validated.year
        }, transaction);
        const payrollRun = payrollRunId
            ? await models.PayrollRun.findByPk(payrollRunId, { transaction })
            : await ensurePayrollRun({
                payrollPeriodId: period.id,
                departmentId: employee.departmentId || null,
                employeeId: employee.id,
                userId
            }, transaction);

        const leaveSummary = await aggregateApprovedLeaves(employee, validated.month, validated.year, bounds);
        const attendanceSummary = await aggregateAttendanceForPayroll({
            employee,
            organisation,
            salaryStructure: salaryResolution.snapshot,
            period: bounds,
            leaveSummary,
            payrollSettings
        });
        const calculation = calculatePayroll({
            employee,
            salaryStructure: salaryResolution.snapshot,
            attendanceSummary,
            leaveSummary,
            payrollSettings,
            manualAdjustments: adjustments,
            componentOverrides: overrides,
            editableFields: normalizedEditableFields
        });
        const employeePayroll = await upsertDraftPayroll({
            employee,
            month: validated.month,
            year: validated.year,
            payrollRun,
            salaryStructure: salaryResolution.snapshot,
            payrollSettings,
            leaveSummary,
            attendanceSummary,
            calculation,
            manualAdjustments: adjustments,
            componentOverrides: overrides,
            editableFields: normalizedEditableFields,
            userId
        }, transaction);

        await createAuditLog({
            userId,
            actionType: 'PAYROLL_GENERATED',
            entityName: 'EmployeePayroll',
            entityId: employeePayroll.id,
            newValue: { employeeId, month, year }
        });

        const detail = await buildPersistedDetail(employeePayroll);
        return {
            payrollRun: serializeModel(payrollRun),
            employeePayroll: buildSimplifiedPayrollView(detail),
            warnings: [...salaryResolution.warnings, ...calculation.warnings]
        };
    });
}

export async function generatePayrollForScope({ filters = {}, userId, manualAdjustments = [], componentOverrides = { earnings: {}, deductions: {} }, editableFields = {} }) {
    const parsedFilters = parsePayrollFilters(filters);
    if (parsedFilters.month === undefined || parsedFilters.year === undefined) {
        throw new Error('Month and year are required to generate payroll');
    }

    const employeeWhere = { status: 'ACTIVE' };
    if (parsedFilters.departmentId) {
        employeeWhere.departmentId = parsedFilters.departmentId;
    }
    if (parsedFilters.employeeId) {
        employeeWhere.id = parsedFilters.employeeId;
    }

    const employees = await models.Employee.findAll({ where: employeeWhere, order: [['fullName', 'ASC']] });
    const generated = [];
    const errors = [];

    for (const employee of employees) {
        try {
            const entry = await generatePayrollForEmployee({
                employeeId: employee.id,
                month: parsedFilters.month,
                year: parsedFilters.year,
                manualAdjustments,
                componentOverrides,
                editableFields,
                userId
            });
            generated.push(entry.employeePayroll);
        } catch (error) {
            errors.push({ employeeId: employee.id, employeeName: employee.fullName, message: error.message });
        }
    }

    return {
        generatedCount: generated.length,
        generated,
        errors
    };
}

export async function listPayroll(filters = {}) {
    const parsedFilters = parsePayrollFilters(filters);
    const where = {};
    if (parsedFilters.month !== undefined) {
        where.month = parsedFilters.month;
        where.year = parsedFilters.year;
    }
    if (parsedFilters.status) {
        where.status = toStorageStatus(parsedFilters.status);
    }
    if (parsedFilters.employeeId) {
        where.employeeId = parsedFilters.employeeId;
    }

    const include = [
        { model: models.Employee, where: parsedFilters.departmentId ? { departmentId: parsedFilters.departmentId } : undefined, required: Boolean(parsedFilters.departmentId) },
        { model: models.PayrollRun, include: [{ model: models.PayrollPeriod }] },
        { model: models.PaymentRecord, required: false }
    ];

    const payroll = await models.EmployeePayroll.findAll({
        where,
        include,
        order: [['year', 'DESC'], ['month', 'DESC'], ['updatedAt', 'DESC']]
    });
    return payroll.map(buildSimplifiedPayrollView);
}

export async function getPayrollById(id) {
    const payroll = await models.EmployeePayroll.findByPk(id, {
        include: [
            { model: models.Employee },
            { model: models.PayrollRun, include: [{ model: models.PayrollPeriod }] },
            { model: models.PayrollEarning },
            { model: models.PayrollDeduction },
            { model: models.SalarySlip },
            { model: models.PaymentRecord }
        ]
    });
    if (!payroll) {
        throw new Error('Payroll record not found');
    }
    return buildSimplifiedPayrollView(payroll);
}

export async function updateDraftPayroll({ id, manualAdjustments = [], componentOverrides = { earnings: {}, deductions: {} }, editableFields = {}, notes = null, userId }) {
    const payroll = await getPayrollById(id);
    if (String(payroll.status).toUpperCase() !== 'PENDING') {
        throw new Error('Only draft payroll can be edited');
    }

    const result = await generatePayrollForEmployee({
        employeeId: payroll.employeeId,
        month: payroll.month,
        year: payroll.year,
        manualAdjustments,
        componentOverrides,
        editableFields,
        userId,
        payrollRunId: payroll.payrollRunId
    });

    const refreshed = await models.EmployeePayroll.findByPk(id);
    await refreshed.update({ notes }, {});

    await createAuditLog({
        userId,
        actionType: 'PAYROLL_UPDATED',
        entityName: 'EmployeePayroll',
        entityId: id,
        oldValue: { manualAdjustments: payroll.manualAdjustments, componentOverrides: payroll.componentOverrides, editableFields: payroll.payrollInputs },
        newValue: { manualAdjustments, componentOverrides, editableFields, notes }
    });

    return getPayrollById(id);
}

export async function finalizePayroll({ id, userId }) {
    return getTransactionRunner()(async (transaction) => {
        const payroll = await models.EmployeePayroll.findByPk(id, { transaction });
        if (!payroll) {
            throw new Error('Payroll record not found');
        }
        if (String(payroll.status).toUpperCase() !== 'DRAFT') {
            throw new Error('Only draft payroll can be finalized');
        }

        const duplicate = await models.EmployeePayroll.findOne({
            where: {
                employeeId: payroll.employeeId,
                month: payroll.month,
                year: payroll.year,
                status: { [Op.in]: ['FINALIZED', 'PAID'] },
                id: { [Op.ne]: payroll.id }
            },
            transaction
        });
        if (duplicate) {
            throw new Error('A finalized payroll already exists for this employee and period');
        }

        await payroll.update({
            status: 'FINALIZED',
            finalizedAt: new Date(),
            finalizedByUserId: userId
        }, { transaction });

        await models.PayrollRun.update({
            status: 'FINALIZED',
            finalizedAt: new Date(),
            finalizedByUserId: userId
        }, { where: { id: payroll.payrollRunId }, transaction });

        await models.AttendanceSummary.update(
            { payrollProcessed: true },
            {
                where: {
                    employeeId: payroll.employeeId,
                    attendanceDate: {
                        [Op.between]: [
                            getPayrollPeriodBounds(payroll.month, payroll.year, payroll.payrollSettingsSnapshot || {}).startDate,
                            getPayrollPeriodBounds(payroll.month, payroll.year, payroll.payrollSettingsSnapshot || {}).endDate
                        ]
                    }
                },
                transaction
            }
        );

        await createAuditLog({
            userId,
            actionType: 'PAYROLL_FINALIZED',
            entityName: 'EmployeePayroll',
            entityId: payroll.id,
            newValue: { status: 'FINALIZED' }
        });

        return getPayrollById(id);
    });
}

export async function reopenPayroll({ id, userId }) {
    return getTransactionRunner()(async (transaction) => {
        const payroll = await models.EmployeePayroll.findByPk(id, { transaction });
        if (!payroll) {
            throw new Error('Payroll record not found');
        }
        if (!['FINALIZED', 'PAID'].includes(String(payroll.status).toUpperCase())) {
            throw new Error('Only finalized payroll can be reopened');
        }

        await payroll.update({
            status: 'DRAFT',
            finalizedAt: null,
            finalizedByUserId: null,
            paidAt: null,
            paidByUserId: null,
            paymentStatus: 'PENDING'
        }, { transaction });

        await models.PayrollRun.update({
            status: 'DRAFT',
            reopenedAt: new Date(),
            reopenedByUserId: userId
        }, { where: { id: payroll.payrollRunId }, transaction });

        await createAuditLog({
            userId,
            actionType: 'PAYROLL_REOPENED',
            entityName: 'EmployeePayroll',
            entityId: payroll.id,
            oldValue: { status: 'FINALIZED' },
            newValue: { status: 'DRAFT' }
        });

        return getPayrollById(id);
    });
}

export async function markPayrollPaid({ id, userId, method = null, reference = null, notes = null, amount = null }) {
    return getTransactionRunner()(async (transaction) => {
        const payroll = await models.EmployeePayroll.findByPk(id, { transaction });
        if (!payroll) {
            throw new Error('Payroll record not found');
        }
        if (!['FINALIZED', 'PAID'].includes(String(payroll.status).toUpperCase())) {
            throw new Error('Only finalized payroll can be marked as paid');
        }

        const paymentAmount = amount ?? payroll.netSalary;
        await payroll.update({
            status: 'PAID',
            paymentStatus: 'PAID',
            paymentDate: new Date(),
            paidAt: new Date(),
            paidByUserId: userId
        }, { transaction });

        await models.PaymentRecord.create({
            employeePayrollId: payroll.id,
            amount: paymentAmount,
            method,
            reference,
            notes,
            createdByUserId: userId,
            paidAt: new Date()
        }, { transaction });

        await createAuditLog({
            userId,
            actionType: 'PAYROLL_MARKED_PAID',
            entityName: 'EmployeePayroll',
            entityId: payroll.id,
            newValue: { status: 'PAID', reference, method, amount: paymentAmount, notes }
        });

        return getPayrollById(id);
    });
}

export async function listPayrollPayments(filters = {}) {
    const parsedFilters = parsePayrollFilters(filters);
    const where = {};
    if (parsedFilters.month !== undefined) {
        where.month = parsedFilters.month;
        where.year = parsedFilters.year;
    }
    if (parsedFilters.employeeId) {
        where.employeeId = parsedFilters.employeeId;
    }
    if (parsedFilters.status) {
        where.status = toStorageStatus(parsedFilters.status);
    } else {
        where.status = { [Op.in]: ['FINALIZED', 'PAID'] };
    }

    const payroll = await models.EmployeePayroll.findAll({
        where,
        include: [
            { model: models.Employee, where: parsedFilters.departmentId ? { departmentId: parsedFilters.departmentId } : undefined, required: Boolean(parsedFilters.departmentId) },
            { model: models.PayrollRun, include: [{ model: models.PayrollPeriod }] },
            { model: models.PaymentRecord, required: false }
        ],
        order: [['updatedAt', 'DESC']]
    });

    return payroll.map(buildSimplifiedPayrollView);
}

export async function buildPayslipPayload(id) {
    const payroll = await getPayrollById(id);
    if (!['approved', 'paid'].includes(String(payroll.status).toLowerCase())) {
        throw new Error('Payslip is available only for approved payroll');
    }

    const organisation = await loadOrganisation(payroll.Employee || payroll.employee);
    const payload = {
        company: {
            name: organisation?.name || 'Organisation',
            officeAddress: organisation?.officeAddress || null
        },
        employee: {
            id: payroll.Employee?.id,
            employeeCode: payroll.Employee?.employeeCode,
            fullName: payroll.Employee?.fullName,
            email: payroll.Employee?.email,
            departmentId: payroll.Employee?.departmentId
        },
        payroll: {
            id: payroll.id,
            month: payroll.month,
            year: payroll.year,
            monthLabel: buildPeriodLabel(payroll.month, payroll.year, payroll.payrollSettingsSnapshot || {}),
            periodStartDate: getPayrollPeriodBounds(payroll.month, payroll.year, payroll.payrollSettingsSnapshot || {}).startDate,
            periodEndDate: getPayrollPeriodBounds(payroll.month, payroll.year, payroll.payrollSettingsSnapshot || {}).endDate,
            payDate: getPayrollPeriodBounds(payroll.month, payroll.year, payroll.payrollSettingsSnapshot || {}).payDate,
            status: toBusinessStatus(payroll.status),
            paymentStatus: payroll.paymentStatus,
            generatedAt: payroll.generatedAt,
            finalizedAt: payroll.finalizedAt,
            paidAt: payroll.paidAt
        },
        attendanceSummary: payroll.attendanceSummarySnapshot,
        leaveSummary: payroll.leaveSummarySnapshot,
        salaryStructure: payroll.salaryStructureSnapshot,
        payrollSettings: payroll.payrollSettingsSnapshot,
        earnings: (payroll.payroll_earnings || payroll.payrollEarnings || []).map(serializeModel),
        deductions: (payroll.payroll_deductions || payroll.payrollDeductions || []).map(serializeModel),
        totals: {
            grossEarnings: payroll.grossEarnings || payroll.grossSalary,
            grossSalary: payroll.grossSalary,
            totalDeductions: payroll.totalDeductions,
            netSalary: payroll.netSalary
        }
    };

    const [salarySlip] = await models.SalarySlip.findOrCreate({
        where: { employeePayrollId: payroll.id },
        defaults: {
            employeePayrollId: payroll.id,
            generatedAt: new Date(),
            status: 'GENERATED',
            payload
        }
    });

    if (!salarySlip.payload) {
        await salarySlip.update({ payload, generatedAt: new Date() });
    }

    return payload;
}
