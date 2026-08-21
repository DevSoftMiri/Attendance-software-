import { asyncHandler } from '../utils/asyncHandler.js';
import {
    buildPayslipPayload,
    finalizePayroll,
    generatePayrollForEmployee,
    generatePayrollForScope,
    getPayrollById,
    listPayroll,
    listPayrollPayments,
    markPayrollPaid,
    previewPayroll,
    reopenPayroll,
    updateDraftPayroll
} from '../services/payrollGenerationService.js';
import { parseEditablePayrollFields, parsePayrollFilters, validateComponentOverrides, validateManualAdjustments, validatePayrollMonthYear } from '../validators/payrollValidators.js';

export const previewEmployeePayroll = asyncHandler(async (request, response) => {
    const { month, year } = validatePayrollMonthYear(request.query.month, request.query.year);
    const manualAdjustments = validateManualAdjustments(request.body?.manualAdjustments || []);
    const componentOverrides = validateComponentOverrides(request.body?.componentOverrides || {});
    const editableFields = parseEditablePayrollFields(request.body?.editableFields || request.query || {});
    const preview = await previewPayroll({
        employeeId: Number(request.params.employeeId),
        month,
        year,
        manualAdjustments,
        componentOverrides,
        editableFields
    });
    return response.json(preview);
});

export const generateEmployeePayroll = asyncHandler(async (request, response) => {
    const payload = await generatePayrollForEmployee({
        employeeId: Number(request.body.employeeId),
        month: request.body.month,
        year: request.body.year,
        manualAdjustments: request.body.manualAdjustments || [],
        componentOverrides: request.body.componentOverrides || {},
        editableFields: request.body.editableFields || {},
        payrollRunId: request.body.payrollRunId ? Number(request.body.payrollRunId) : null,
        userId: request.user?.userId
    });
    return response.status(201).json(payload);
});

export const generatePayrollBatch = asyncHandler(async (request, response) => {
    const result = await generatePayrollForScope({
        filters: request.body,
        userId: request.user?.userId,
        manualAdjustments: request.body.manualAdjustments || [],
        componentOverrides: request.body.componentOverrides || {},
        editableFields: request.body.editableFields || {}
    });
    return response.status(201).json(result);
});

export const listPayrollRecords = asyncHandler(async (request, response) => {
    const payroll = await listPayroll(parsePayrollFilters(request.query));
    return response.json({ payroll });
});

export const getPayrollRecord = asyncHandler(async (request, response) => {
    const employeePayroll = await getPayrollById(request.params.id);
    return response.json({ employeePayroll });
});

export const updatePayrollRecord = asyncHandler(async (request, response) => {
    const employeePayroll = await updateDraftPayroll({
        id: Number(request.params.id),
        manualAdjustments: request.body.manualAdjustments || [],
        componentOverrides: request.body.componentOverrides || {},
        editableFields: request.body.editableFields || {},
        notes: request.body.notes || null,
        userId: request.user?.userId
    });
    return response.json({ employeePayroll });
});

export const finalizePayrollRecord = asyncHandler(async (request, response) => {
    const employeePayroll = await finalizePayroll({ id: Number(request.params.id), userId: request.user?.userId });
    return response.json({ employeePayroll });
});

export const reopenPayrollRecord = asyncHandler(async (request, response) => {
    const employeePayroll = await reopenPayroll({ id: Number(request.params.id), userId: request.user?.userId });
    return response.json({ employeePayroll });
});

export const markPayrollRecordPaid = asyncHandler(async (request, response) => {
    const employeePayroll = await markPayrollPaid({
        id: Number(request.params.id),
        userId: request.user?.userId,
        method: request.body?.method || null,
        reference: request.body?.reference || null,
        notes: request.body?.notes || null,
        amount: request.body?.amount || null
    });
    return response.json({ employeePayroll });
});

export const listPayrollPaymentRecords = asyncHandler(async (request, response) => {
    const payroll = await listPayrollPayments(parsePayrollFilters(request.query));
    return response.json({ payroll });
});

export const getPayrollPayslip = asyncHandler(async (request, response) => {
    const employeePayroll = await getPayrollById(request.params.id);
    const isOwner = Number(employeePayroll.employeeId) === Number(request.user?.employeeId);
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(request.user?.roleCode);
    if (!isOwner && !isAdmin) {
        return response.status(403).json({ message: 'You can only view your own payslips' });
    }

    const payslip = await buildPayslipPayload(Number(request.params.id));
    return response.json({ payslip });
});

export const listMyPayroll = asyncHandler(async (request, response) => {
    const payroll = await listPayroll({ employeeId: request.user?.employeeId });
    const filtered = payroll.filter((entry) => ['approved', 'paid'].includes(String(entry.status).toLowerCase()));
    return response.json({ payroll: filtered });
});

export const getMyPayrollRecord = asyncHandler(async (request, response) => {
    const employeePayroll = await getPayrollById(request.params.id);
    if (Number(employeePayroll.employeeId) !== Number(request.user?.employeeId)) {
        return response.status(403).json({ message: 'You can only view your own payroll' });
    }
    return response.json({ employeePayroll });
});
