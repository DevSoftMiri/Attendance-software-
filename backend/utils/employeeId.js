function sanitizeInitials(value) {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function sanitizeCode(value, length = 3) {
    return String(value || '')
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, length)
        .toUpperCase();
}

function formatDateCode(dateValue) {
    const date = new Date(dateValue);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
}

export function generateEmployeeId({ organisationInitial, titleCode, employeeName, joiningDate, phoneNumber, duplicateIndex = 0 }) {
    const prefix = sanitizeCode(organisationInitial, 3) || 'ORG';
    const title = sanitizeCode(titleCode, 4) || 'EMP';
    const initials = sanitizeInitials(employeeName) || 'XX';
    const dateCode = formatDateCode(joiningDate || new Date());
    const phoneSuffix = String(phoneNumber || '').replace(/\D/g, '').slice(-2).padStart(2, '0');
    const suffix = duplicateIndex > 0 ? `-${String(duplicateIndex).padStart(2, '0')}` : '';

    return `${prefix}-${title}-${initials}-${dateCode}-${phoneSuffix}${suffix}`;
}
