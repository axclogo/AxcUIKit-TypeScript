/** Location of a problem inside the validated value, e.g. `['rules', 0, 'value']`. Empty means the root. */
export type AxcPath = Array<string | number>;

/**
 * Stable, language-neutral reason for a validation failure. Hosts branch on `code`;
 * the human-readable text comes from a locale (`formatIssue`).
 */
export type AxcIssueCode =
	| 'type'
	| 'unknownKey'
	| 'required'
	| 'empty'
	| 'duplicate'
	| 'combinator'
	| 'tooDeep'
	| 'negationDisabled'
	| 'unknownField'
	| 'unknownOperator'
	| 'fieldRefInvalid'
	| 'fieldRefRequired'
	| 'rangeLength'
	| 'rangeOrder'
	| 'option'
	| 'date'
	| 'datetime'
	| 'regex'
	| 'outputName'
	| 'enumOptions';

/** Expected JSON type reported by the `type` issue. */
export type AxcExpectedType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

/** Parameters carried by each issue code; codes not listed here carry none. */
export interface AxcIssueParams {
	type: { expected: AxcExpectedType };
	unknownKey: { key: string };
	duplicate: { value: string };
	tooDeep: { max: number };
	unknownField: { field: string };
	unknownOperator: { operator: string };
	option: { value: string };
	outputName: { name: string };
}

/** One validation problem. Validators report every problem they can find, not just the first. */
export type AxcIssue = {
	[C in AxcIssueCode]: C extends keyof AxcIssueParams
		? { code: C; path: AxcPath; params: AxcIssueParams[C] }
		: { code: C; path: AxcPath; params?: undefined };
}[AxcIssueCode];

/** `['rules', 0, 'value']` → `$.rules[0].value`. Used in error messages and logs only. */
export function formatPath(path: AxcPath): string {
	return path.reduce<string>((text, key) => (typeof key === 'number' ? `${text}[${key}]` : `${text}.${key}`), '$');
}

/**
 * Thrown by every `parse*` function and request builder when input is invalid.
 * `issues` is the machine-readable payload; `message` is a language-neutral
 * debug summary (`$.rules[0].value: type`) and must not be shown to end users.
 */
export class AxcValidationError extends Error {
	readonly issues: AxcIssue[];
	constructor(issues: AxcIssue[]) {
		super(issues.map((issue) => `${formatPath(issue.path)}: ${issue.code}`).join('; '));
		this.name = 'AxcValidationError';
		this.issues = issues;
	}
}

/** Throws when `issues` is non-empty, otherwise returns `value` unchanged. */
export function ensureValid<T>(value: unknown, issues: AxcIssue[]): T {
	if (issues.length) throw new AxcValidationError(issues);
	return value as T;
}

/** Collects issues while a validator walks a value. */
export type Report = (issue: AxcIssue) => void;

/** An issue list plus a `report` function that appends to it. */
export function collect(issues: AxcIssue[] = []): [AxcIssue[], Report] {
	return [issues, (issue) => void issues.push(issue)];
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Reports a `type` issue for non-objects and an `unknownKey` issue per extra key. */
export function checkObject(
	value: unknown,
	keys: readonly string[],
	path: AxcPath,
	report: Report,
): value is Record<string, unknown> {
	if (!isObject(value)) {
		report({ code: 'type', path, params: { expected: 'object' } });
		return false;
	}
	for (const key of Object.keys(value))
		if (!keys.includes(key)) report({ code: 'unknownKey', path: [...path, key], params: { key } });
	return true;
}

/** Reports `required` unless `value` is a string with at least one non-space character. */
export function checkText(value: unknown, path: AxcPath, report: Report): value is string {
	if (typeof value !== 'string') report({ code: 'type', path, params: { expected: 'string' } });
	else if (!value.trim()) report({ code: 'required', path });
	else return true;
	return false;
}

export const prefixIssues = (prefix: AxcPath, issues: AxcIssue[]): AxcIssue[] =>
	issues.map((issue) => ({ ...issue, path: [...prefix, ...issue.path] }) as AxcIssue);
