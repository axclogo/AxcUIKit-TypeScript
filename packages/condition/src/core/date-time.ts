/** `YYYY-MM-DD` that names a real calendar day (no rollover from Feb 30 to Mar 2). */
export function validDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Epoch milliseconds for an ISO datetime with seconds and an explicit `Z` or `±HH:mm` offset; NaN otherwise.
 * Datetimes without an offset are rejected because their meaning depends on the host's time zone.
 */
export function timestamp(value: string): number {
	const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
	if (!parts || !validDate(parts[1]) || +parts[2] > 23 || +parts[3] > 59 || +parts[4] > 59) return NaN;
	const offset = parts[6];
	if (offset !== 'Z' && (+offset.slice(1, 3) > 23 || +offset.slice(4) > 59)) return NaN;
	return Date.parse(value);
}
