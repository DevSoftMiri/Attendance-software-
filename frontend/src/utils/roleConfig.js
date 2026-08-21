export const roleDashboardConfig = {
    STAFF: {
        title: 'Staff Dashboard',
        accent: 'from-amber-400 via-coral-500 to-ink-800',
        summary: [
            { label: 'Today status', value: 'Checked in', hint: 'Face and geolocation verified' },
            { label: 'Working hours', value: '5h 32m', hint: '2h 28m remaining' },
            { label: 'Leave balance', value: '8.5 days', hint: 'Paid leave balance' },
            { label: 'Salary impact', value: '- Rs 0', hint: 'No deductions today' }
        ],
        highlights: ['Check in', 'Check out', 'Apply leave', 'Download payslip']
    },
    MANAGER: {
        title: 'Manager Dashboard',
        accent: 'from-sky-400 via-cyan-500 to-ink-800',
        summary: [
            { label: 'Checked in', value: '18', hint: 'Team present right now' },
            { label: 'Late', value: '4', hint: 'Requires review' },
            { label: 'On leave', value: '3', hint: 'Approved and pending' },
            { label: 'Pending actions', value: '6', hint: 'Leave and corrections' }
        ],
        highlights: ['Review attendance', 'Approve leave', 'Correction requests', 'Team overtime']
    },
    ADMIN: {
        title: 'Admin Dashboard',
        accent: 'from-emerald-400 via-lime-400 to-ink-800',
        summary: [
            { label: 'Active employees', value: '124', hint: 'Across all branches' },
            { label: 'Payroll draft', value: 'In review', hint: 'Monthly payroll cycle' },
            { label: 'Face failures', value: '2', hint: 'Needs investigation' },
            { label: 'Missing check-outs', value: '7', hint: 'Auto reminders sent' }
        ],
        highlights: ['Employee master data', 'Shift rules', 'Payroll approval', 'Audit logs']
    },
    SUPER_ADMIN: {
        title: 'Super Admin Console',
        accent: 'from-gold-400 via-orange-500 to-ink-800',
        summary: [
            { label: 'Organisations', value: '1', hint: 'Global control center' },
            { label: 'Security alerts', value: '0', hint: 'No critical issues' },
            { label: 'Audit events', value: '312', hint: 'Rolling 30 days' },
            { label: 'Locked payroll', value: '1', hint: 'Controlled unlocks only' }
        ],
        highlights: ['Security settings', 'Organisation config', 'Role management', 'System audit']
    }
};

export const navigationItems = {
    STAFF: ['/dashboard/staff', '/attendance', '/leave', '/reports'],
    MANAGER: ['/dashboard/manager', '/attendance', '/attendance-summary', '/leave', '/employees', '/reports'],
    ADMIN: ['/dashboard/admin', '/employees', '/face-registration', '/attendance', '/attendance-summary', '/leave', '/payroll', '/payroll/run', '/payroll/salary-structures', '/payroll/history', '/payroll/payslips', '/reports', '/settings'],
    SUPER_ADMIN: ['/dashboard/super-admin', '/employees', '/face-registration', '/attendance', '/attendance-summary', '/leave', '/payroll', '/payroll/run', '/payroll/salary-structures', '/payroll/history', '/payroll/payslips', '/reports', '/settings']
};
