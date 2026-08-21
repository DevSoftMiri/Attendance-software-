function normalizeAmount(value) {
    if (value === null || value === undefined || value === '') {
        return '0';
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toFixed(2) : '0';
    }

    const raw = String(value).trim().replace(/,/g, '');
    return raw || '0';
}

export function toCents(value) {
    const normalized = normalizeAmount(value);
    const negative = normalized.startsWith('-');
    const unsigned = negative ? normalized.slice(1) : normalized;
    const [wholePart = '0', decimalPart = '0'] = unsigned.split('.');
    const whole = BigInt(wholePart || '0');
    const decimals = BigInt((decimalPart + '00').slice(0, 2));
    const cents = (whole * 100n) + decimals;
    return negative ? -cents : cents;
}

export function fromCents(value) {
    const cents = typeof value === 'bigint' ? value : BigInt(value || 0);
    const negative = cents < 0n;
    const absolute = negative ? -cents : cents;
    const whole = absolute / 100n;
    const decimals = String(absolute % 100n).padStart(2, '0');
    return `${negative ? '-' : ''}${whole}.${decimals}`;
}

export function addAmounts(...values) {
    return fromCents(values.reduce((total, value) => total + toCents(value), 0n));
}

export function subtractAmounts(left, right) {
    return fromCents(toCents(left) - toCents(right));
}

export function maxAmount(value, minimum = '0.00') {
    return fromCents(toCents(value) < toCents(minimum) ? toCents(minimum) : toCents(value));
}

export function multiplyAmount(value, multiplier) {
    const numericMultiplier = Number(multiplier || 0);
    const result = Number(fromCents(toCents(value))) * numericMultiplier;
    return result.toFixed(2);
}

export function divideAmount(value, divisor) {
    const numericDivisor = Number(divisor || 0);
    if (!numericDivisor) {
        return '0.00';
    }

    const result = Number(fromCents(toCents(value))) / numericDivisor;
    return result.toFixed(2);
}

export function amountToNumber(value) {
    return Number(fromCents(toCents(value)));
}

