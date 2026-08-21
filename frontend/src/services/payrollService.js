import api from './api';

export async function fetchPayrollList(params = {}) {
    const { data } = await api.get('/payroll', { params });
    return data.payroll || [];
}

export async function fetchPayrollPayments(params = {}) {
    const { data } = await api.get('/payroll/payments', { params });
    return data.payroll || [];
}

export async function fetchPayrollPreview(employeeId, params = {}) {
    const { data } = await api.get(`/payroll/preview/${employeeId}`, { params });
    return data;
}

export async function generatePayroll(payload) {
    const { data } = await api.post('/payroll/generate', payload);
    return data;
}

export async function generatePayrollBatch(payload) {
    const { data } = await api.post('/payroll/generate-all', payload);
    return data;
}

export async function fetchPayrollById(id) {
    const { data } = await api.get(`/payroll/${id}`);
    return data.employeePayroll;
}

export async function updatePayroll(id, payload) {
    const { data } = await api.put(`/payroll/${id}`, payload);
    return data.employeePayroll;
}

export async function finalizePayroll(id) {
    const { data } = await api.post(`/payroll/${id}/finalize`);
    return data.employeePayroll;
}

export async function reopenPayroll(id) {
    const { data } = await api.post(`/payroll/${id}/reopen`);
    return data.employeePayroll;
}

export async function markPayrollPaid(id, payload = {}) {
    const { data } = await api.post(`/payroll/${id}/mark-paid`, payload);
    return data.employeePayroll;
}

export async function fetchPayslip(id) {
    const { data } = await api.get(`/payroll/${id}/payslip`);
    return data.payslip;
}

export async function fetchMyPayroll() {
    const { data } = await api.get('/payroll/my');
    return data.payroll || [];
}

export async function fetchMyPayrollById(id) {
    const { data } = await api.get(`/payroll/my/${id}`);
    return data.employeePayroll;
}

export async function fetchSalaryStructures(employeeId = '') {
    const { data } = await api.get('/salary-structures', { params: employeeId ? { employeeId } : {} });
    return data.salaryStructures || [];
}

export async function saveSalaryStructure(payload, id = null) {
    const { data } = id
        ? await api.patch(`/salary-structures/${id}`, payload)
        : await api.post('/salary-structures', payload);
    return data.salaryStructure;
}

export async function fetchLeaveTypes() {
    const { data } = await api.get('/leave/types');
    return data.leaveTypes || [];
}

export async function fetchEmployeeLeaveBalances(employeeId, year = new Date().getFullYear()) {
    const { data } = await api.get('/leave/balances', { params: { employeeId, year } });
    return data.balances || [];
}

export async function saveEmployeeLeaveBalances(employeeId, balances, year = new Date().getFullYear()) {
    const { data } = await api.put(`/leave/balances/${employeeId}`, { balances, year });
    return data.balances || [];
}
