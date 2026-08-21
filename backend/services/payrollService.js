export function calculatePayroll(employee, summary, structure, options = {}) {
    const grossSalary = Number(structure?.baseSalary || employee.baseSalary || 0);
    const overtimePay = Number(options.overtimePay || 0);
    const bonus = Number(options.bonus || 0);
    const allowances = Number(options.allowances || 0);
    const reimbursements = Number(options.reimbursements || 0);
    const unpaidLeaveDeduction = Number(options.unpaidLeaveDeduction || 0);
    const halfDayDeduction = Number(options.halfDayDeduction || 0);
    const latePenalty = Number(options.latePenalty || 0);
    const earlyLogoutDeduction = Number(options.earlyLogoutDeduction || 0);
    const otherDeductions = Number(options.otherDeductions || 0);
    const totalEarnings = grossSalary + overtimePay + bonus + allowances + reimbursements;
    const totalDeductions = unpaidLeaveDeduction + halfDayDeduction + latePenalty + earlyLogoutDeduction + otherDeductions;
    const netSalary = Math.max(0, totalEarnings - totalDeductions);

    return {
        employeeId: employee.id,
        attendanceDate: summary?.attendanceDate || null,
        grossSalary,
        totalEarnings,
        totalDeductions,
        netSalary
    };
}
