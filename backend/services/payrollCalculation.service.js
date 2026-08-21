import { addAmounts, divideAmount, maxAmount, multiplyAmount, subtractAmounts } from '../utils/money.js';

function buildManualBreakdown(manualAdjustments = []) {
    const earnings = [];
    const deductions = [];

    for (const entry of manualAdjustments) {
        const target = entry.type === 'earning' ? earnings : deductions;
        target.push({
            componentCode: entry.code || 'OTHER',
            name: entry.name,
            amount: String(entry.amount)
        });
    }

    return { earnings, deductions };
}

export function calculatePayroll({
    employee,
    salaryStructure,
    attendanceSummary,
    leaveSummary,
    payrollSettings,
    manualAdjustments = [],
    componentOverrides = { earnings: {}, deductions: {} },
    editableFields = {}
}) {
    const warnings = [];
    const workingDaysInCycle = Number(attendanceSummary?.workingDays || salaryStructure?.standardWorkingDays || 26) || 26;
    const basicSalary = String(editableFields?.basicSalary || salaryStructure?.basicSalary || salaryStructure?.monthlySalary || salaryStructure?.baseSalary || employee?.baseSalary || 0);
    const paidLeavesAllowed = Number(salaryStructure?.paidLeavesAllowed || employee?.leaveEntitlement || 0);
    const halfDaysAllowed = Number(salaryStructure?.halfDayAllowance || employee?.halfDayEntitlement || 0);
    const paidLeavesTaken = Number(attendanceSummary?.paidLeaves || 0);
    const halfDaysTaken = Number(attendanceSummary?.halfDays || 0);
    const absentDays = Number(attendanceSummary?.absentDays || 0);
    const extraPaidLeaves = Math.max(0, paidLeavesTaken - paidLeavesAllowed);
    const extraHalfDays = Math.max(0, halfDaysTaken - halfDaysAllowed);
    const dailySalary = divideAmount(basicSalary, workingDaysInCycle);
    const defaultBonus = String(salaryStructure?.defaultBonus || 0);
    const bonusAmount = String(editableFields?.bonus?.amount || defaultBonus || 0);
    const bonusReason = editableFields?.bonus?.reason || '';
    const overtimeDays = Number(editableFields?.overtimeDays ?? attendanceSummary?.overtimeDays ?? 0);
    const overtimeRatePerDay = String(editableFields?.overtimeRatePerDay || salaryStructure?.overtimeRatePerDay || salaryStructure?.overtimeRatePerHour || salaryStructure?.overtimeRate || employee?.overtimeRate || 0);
    const overtimeAmount = multiplyAmount(overtimeRatePerDay, overtimeDays);
    const leaveDeductionBase = multiplyAmount(dailySalary, extraPaidLeaves);
    const leaveDeduction = addAmounts(leaveDeductionBase, editableFields?.leaveAdjustment || '0.00');
    const halfDayDeductionBase = multiplyAmount(dailySalary, extraHalfDays * 0.5);
    const halfDayDeduction = addAmounts(halfDayDeductionBase, editableFields?.halfDayAdjustment || '0.00');
    const absenceDeduction = multiplyAmount(dailySalary, absentDays);
    const otherDeduction = String(editableFields?.otherDeduction || '0.00');
    const manual = buildManualBreakdown(manualAdjustments);
    const earnings = [
        { componentCode: 'BASIC', name: 'Basic Salary', amount: basicSalary },
        { componentCode: 'OVERTIME', name: 'Overtime', amount: overtimeAmount },
        { componentCode: 'BONUS', name: bonusReason ? `Bonus - ${bonusReason}` : 'Bonus', amount: bonusAmount },
        ...manual.earnings
    ].map((entry) => ({
        ...entry,
        amount: componentOverrides.earnings?.[entry.componentCode] ?? entry.amount
    })).filter((entry) => Number(entry.amount) > 0);

    const deductions = [
        { componentCode: 'LEAVE_DEDUCTION', name: 'Leave Deduction', amount: leaveDeduction },
        { componentCode: 'HALF_DAY', name: 'Half Day Deduction', amount: halfDayDeduction },
        { componentCode: 'ABSENT', name: 'Absent Deduction', amount: absenceDeduction },
        { componentCode: 'OTHER', name: 'Other Deduction', amount: otherDeduction },
        ...manual.deductions
    ].map((entry) => ({
        ...entry,
        amount: componentOverrides.deductions?.[entry.componentCode] ?? entry.amount
    })).filter((entry) => Number(entry.amount) > 0);

    const grossSalary = earnings.reduce((total, entry) => addAmounts(total, entry.amount), '0.00');
    const totalDeductions = deductions.reduce((total, entry) => addAmounts(total, entry.amount), '0.00');
    const netSalary = maxAmount(subtractAmounts(grossSalary, totalDeductions));

    return {
        employeeId: employee.id,
        summary: {
            workingDays: attendanceSummary?.workingDays || 0,
            presentDays: attendanceSummary?.presentDays || 0,
            paidLeavesTaken,
            halfDaysTaken,
            absentDays,
            overtimeDays
        },
        cycleSummary: {
            basicSalary,
            paidLeavesAllowed,
            paidLeavesTaken,
            extraPaidLeaves,
            halfDaysAllowed,
            halfDaysTaken,
            extraHalfDays,
            overtimeDays,
            overtimeRatePerDay,
            overtimeAmount,
            bonus: {
                amount: bonusAmount,
                reason: bonusReason
            },
            leaveDeduction,
            halfDayDeduction,
            otherDeduction,
            grossSalary,
            totalDeduction: totalDeductions,
            netSalary
        },
        earnings,
        deductions,
        grossEarnings: grossSalary,
        grossSalary,
        totalDeductions,
        netSalary,
        calculationMetadata: {
            dailySalary,
            workingDaysInCycle,
            paidLeavesAllowed,
            halfDaysAllowed,
            componentOverrides
        },
        warnings
    };
}
