export interface ColumnGeometry {
	key: string;
	width?: number;
	minWidth?: number;
	maxWidth?: number;
	fixed?: 'left' | 'right';
	actionLayout?: boolean;
}
export function positive(name: string, value: number | undefined) {
	if (value !== undefined && (!Number.isFinite(value) || value <= 0))
		throw new TypeError(name + ' must be finite and positive, received ' + value);
}
export function columnWidths(columns: readonly ColumnGeometry[], widths: Record<string, number>) {
	const keys = new Set<string>();
	const result: Record<string, number> = Object.create(null);
	for (const c of columns) {
		if (keys.has(c.key) || ['__selection', '__drag', '__actions'].includes(c.key))
			throw new TypeError('Invalid or duplicate column key: ' + c.key);
		keys.add(c.key);
		for (const k of ['width', 'minWidth', 'maxWidth'] as const) positive(c.key + '.' + k, c[k]);
		const width = Object.hasOwn(widths, c.key) ? widths[c.key] : c.width;
		positive(c.key + '.width', width);
		if (c.fixed && width === undefined && !c.actionLayout) throw new TypeError('Fixed column requires width: ' + c.key);
		if (
			(c.minWidth ?? 0) > (c.maxWidth ?? Infinity) ||
			(width !== undefined && (width < (c.minWidth ?? 0) || width > (c.maxWidth ?? Infinity)))
		)
			throw new TypeError('Width outside bounds: ' + c.key);
		result[c.key] = width ?? Math.max(c.minWidth ?? 1, Math.min(c.maxWidth ?? Infinity, 160));
	}
	return result;
}
export function cellValue(row: unknown, path: string | number | readonly (string | number)[]): unknown {
	let value = row;
	for (const key of typeof path === 'object' ? path : [path]) {
		if (value == null) return undefined;
		value = (value as Record<string | number, unknown>)[key];
	}
	return value;
}

export function tableHeight({ fillHeight, height }: { fillHeight?: boolean; height?: string | number }) {
	if (fillHeight && height !== undefined) throw new TypeError('fillHeight and height are exclusive');
	return fillHeight ? '100%' : height;
}

/** Compare each value of a cell with a color rule. Missing values have no match. */
export function matchesColor(value: unknown, operator: '=' | '!=' | 'contains', expected: string | number | boolean) {
	const target = String(expected);
	const values: readonly unknown[] = Array.isArray(value) ? value : [value];
	const found = values.some((item) => {
		if (item == null) return false;
		const text = typeof item === 'object' ? JSON.stringify(item) : String(item);
		return operator === 'contains' ? text.includes(target) : text === target;
	});
	return operator === '!=' ? !found : found;
}
