export function parseIsoUtc(iso: string | undefined | null): Date {
    if (!iso) return new Date(NaN);
    return new Date(iso);
}

export function addUtcDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

export function toYmdUtc(date: Date): string {
    const y = date.getUTCFullYear();
    const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const d = `${date.getUTCDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function startOfDayUtc(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

export function endOfDayUtc(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}


