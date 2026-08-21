function pad(value) {
    return String(value).padStart(2, '0');
}

function padYear(value) {
    return String(value).padStart(4, '0');
}

function normalizeToDate(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (slashMatch) {
            const [, day, month, year] = slashMatch;
            const parsed = new Date(Number(year), Number(month) - 1, Number(day));
            return Number.isNaN(parsed.getTime()) || parsed.getDate() !== Number(day) || parsed.getMonth() !== Number(month) - 1 || parsed.getFullYear() !== Number(year)
                ? null
                : parsed;
        }

        const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
        if (isoMatch) {
            const parsed = new Date(trimmed);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value) {
    const date = normalizeToDate(value);
    if (!date) {
        return '-';
    }

    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${padYear(date.getFullYear())}`;
}

export function formatDateTime(value) {
    const date = normalizeToDate(value);
    if (!date) {
        return '-';
    }

    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${padYear(date.getFullYear())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateInput(value) {
    const date = normalizeToDate(value);
    if (!date) {
        return '';
    }

    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${padYear(date.getFullYear())}`;
}

export function parseDateInput(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        return '';
    }

    const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!slashMatch) {
        const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!isoMatch) {
            return '';
        }

        const date = normalizeToDate(trimmed);
        return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '';
    }

    const date = normalizeToDate(trimmed);
    if (!date) {
        return '';
    }

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
