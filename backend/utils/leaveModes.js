export const LEAVE_MODE = {
    FULL_DAY: 'FULL_DAY',
    FIRST_HALF: 'FIRST_HALF',
    SECOND_HALF: 'SECOND_HALF',
    LEGACY_HALF_DAY: 'HALF_DAY'
};

export const SUPPORTED_LEAVE_MODES = [
    LEAVE_MODE.FULL_DAY,
    LEAVE_MODE.FIRST_HALF,
    LEAVE_MODE.SECOND_HALF
];

export const HALF_DAY_LEAVE_MODES = new Set([
    LEAVE_MODE.FIRST_HALF,
    LEAVE_MODE.SECOND_HALF,
    LEAVE_MODE.LEGACY_HALF_DAY
]);

export function isHalfDayLeaveMode(value) {
    return HALF_DAY_LEAVE_MODES.has(String(value || '').toUpperCase());
}

export function isSupportedLeaveMode(value) {
    return SUPPORTED_LEAVE_MODES.includes(String(value || '').toUpperCase());
}

export function formatLeaveModeLabel(value) {
    const normalized = String(value || '').toUpperCase();
    if (normalized === LEAVE_MODE.FULL_DAY) {
        return 'Full day';
    }
    if (normalized === LEAVE_MODE.FIRST_HALF) {
        return 'First half';
    }
    if (normalized === LEAVE_MODE.SECOND_HALF) {
        return 'Second half';
    }
    if (normalized === LEAVE_MODE.LEGACY_HALF_DAY) {
        return 'Half day';
    }
    return normalized ? normalized.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Full day';
}
