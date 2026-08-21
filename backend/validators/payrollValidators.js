function asNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function validatePayrollMonthYear(month, year) {
    const parsedMonth = asNumber(month);
    const parsedYear = asNumber(year);

    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        throw new Error('Month must be between 1 and 12');
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        throw new Error('Year must be between 2000 and 2100');
    }

    return { month: parsedMonth, year: parsedYear };
}

export function validateManualAdjustments(manualAdjustments = []) {
    if (!Array.isArray(manualAdjustments)) {
        throw new Error('Manual adjustments must be an array');
    }

    return manualAdjustments.map((entry, index) => {
        const amount = Number(entry?.amount);
        if (!entry || !['earning', 'deduction'].includes(entry.type)) {
            throw new Error(`Manual adjustment #${index + 1} must have type earning or deduction`);
        }
        if (!entry.name || typeof entry.name !== 'string') {
            throw new Error(`Manual adjustment #${index + 1} must include a name`);
        }
        if (!Number.isFinite(amount) || amount < 0) {
            throw new Error(`Manual adjustment #${index + 1} must include a non-negative amount`);
        }

        return {
            type: entry.type,
            code: String(entry.code || 'OTHER').toUpperCase(),
            name: entry.name.trim(),
            amount: amount.toFixed(2)
        };
    });
}

export function validateComponentOverrides(componentOverrides = {}) {
    if (!componentOverrides || typeof componentOverrides !== 'object' || Array.isArray(componentOverrides)) {
        return { earnings: {}, deductions: {} };
    }

    function normalizeBucket(source = {}) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(source)
                .filter(([key]) => Boolean(key))
                .map(([key, value]) => {
                    const amount = Number(value);
                    if (!Number.isFinite(amount) || amount < 0) {
                        throw new Error(`Override for ${key} must be a non-negative amount`);
                    }
                    return [String(key).toUpperCase(), amount.toFixed(2)];
                })
        );
    }

    return {
        earnings: normalizeBucket(componentOverrides.earnings),
        deductions: normalizeBucket(componentOverrides.deductions)
    };
}

export function parseEditablePayrollFields(source = {}) {
    const fields = source && typeof source === 'object' && !Array.isArray(source)
        ? source
        : {};

    const asAmount = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : Number(fallback || 0).toFixed(2);
    };
    const asCount = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : Number(fallback || 0);
    };

    return {
        basicSalary: fields.basicSalary !== undefined ? asAmount(fields.basicSalary) : null,
        bonus: {
            amount: asAmount(fields?.bonus?.amount ?? fields.bonusAmount ?? 0),
            reason: String(fields?.bonus?.reason || fields.bonusReason || '').trim()
        },
        overtimeDays: asCount(fields.overtimeDays, 0),
        overtimeRatePerDay: fields.overtimeRatePerDay !== undefined ? asAmount(fields.overtimeRatePerDay) : null,
        leaveAdjustment: asAmount(fields.leaveAdjustment, 0),
        halfDayAdjustment: asAmount(fields.halfDayAdjustment, 0),
        otherDeduction: asAmount(fields.otherDeduction, 0)
    };
}

export function parsePayrollFilters(source = {}) {
    const filters = {};

    if (source.month !== undefined && source.year !== undefined) {
        const validated = validatePayrollMonthYear(source.month, source.year);
        filters.month = validated.month;
        filters.year = validated.year;
    }

    if (source.departmentId !== undefined && source.departmentId !== '') {
        const departmentId = asNumber(source.departmentId);
        if (!Number.isInteger(departmentId) || departmentId <= 0) {
            throw new Error('Department filter must be a positive number');
        }
        filters.departmentId = departmentId;
    }

    if (source.employeeId !== undefined && source.employeeId !== '') {
        const employeeId = asNumber(source.employeeId);
        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            throw new Error('Employee filter must be a positive number');
        }
        filters.employeeId = employeeId;
    }

    if (source.status) {
        filters.status = String(source.status).toUpperCase();
    }

    return filters;
}

export function assertDraftEditable(payroll) {
    if (!payroll) {
        throw new Error('Payroll record not found');
    }

    if (String(payroll.status || '').toUpperCase() !== 'DRAFT') {
        throw new Error('Only draft payroll can be edited');
    }
}
