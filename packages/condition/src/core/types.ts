/** A JSON Schema (draft 2020-12) document. */
export type AxcSchema = Record<string, unknown>;

/**
 * Value type of a field. `array` is a set of strings; `object` is edited as plain text.
 * Values are typed accordingly: `number` → JS number, `boolean` → JS boolean, everything else → string.
 */
export type ConditionDataType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'enum' | 'array' | 'object';

/** `none`: no value (`null`); `scalar`: one value; `list`: non-empty unique array; `range`: `[from, to]` with from ≤ to. */
export type ConditionValueShape = 'none' | 'scalar' | 'list' | 'range';

/** A selectable option. Option values are always strings. */
export interface ConditionOption {
	value: string;
	label: string;
	disabled?: boolean;
}

/**
 * An operator the editor can offer. Axc validates the value shape only; evaluating
 * the operator is the host's job. `label` overrides the locale's label for `name`.
 */
export interface ConditionOperator {
	name: string;
	valueShape: ConditionValueShape;
	label?: string;
}

/** Properties shared by every `ConditionField` variant. */
export interface ConditionFieldBase {
	/** Unique field key, used verbatim. Dots are not interpreted as paths. */
	name: string;
	label: string;
	description?: string;
	disabled?: boolean;
	/** Replaces the built-in operator list for this field. */
	operators?: ConditionOperator[];
	/** Defaults to fixed values only. Include `'field'` to allow comparing with another field of the same type. */
	valueSources?: Array<'value' | 'field'>;
}

/**
 * A field the host offers for conditions.
 *
 * `values` (an option list) is only allowed on string-valued types (`string`, `enum`, `array`),
 * because option values are strings. Declaring it on `number`, `boolean`, `date`, `datetime`
 * or `object` is a type error and a runtime `TypeError`.
 */
export type ConditionField = ConditionFieldBase &
	(
		| { dataType: 'number' | 'boolean' | 'date' | 'datetime' | 'object'; values?: never }
		| {
				dataType?: 'string' | 'enum' | 'array';
				/** For `array`, turns the field into an option set (hasAny/hasAll/hasNone). */
				values?: ConditionOption[];
		  }
	);

/** A leaf rule. It carries no editor IDs. A missing `valueSource` means `value` is a fixed value. */
export interface AxcRule {
	field: string;
	operator: string;
	value: unknown;
	valueSource?: 'field';
}

/** A group. The root and nested groups share this shape; `not` negates the whole group. */
export interface AxcConditionValue {
	combinator: 'and' | 'or';
	not: boolean;
	rules: Array<AxcRule | AxcConditionValue>;
}

export interface AxcConditionCatalog {
	fields: ConditionField[];
	/** Maximum group depth including the root. Default 5. Must be a positive integer. */
	maxLevels?: number;
	/** Default true. When false, `not: true` is rejected and the editor hides the toggle. */
	allowNot?: boolean;
}

/** A model the host can call. `id` is opaque to Axc. */
export interface AxcModelOption {
	id: string;
	label: string;
	provider?: string;
}

/** What Axc hands to the host for one model call. Axc never performs network requests itself. */
export interface AxcAssistRequest {
	model: string;
	prompt: string;
	response_schema: AxcSchema;
}

/**
 * Host-provided model access. `generate` must resolve to already-parsed JSON (not text, not an HTTP envelope).
 * `signal` aborts when the user cancels or the request becomes stale; whether the provider stops work is up to the host.
 */
export interface AxcAssistTransport {
	models: AxcModelOption[];
	generate: (request: AxcAssistRequest, signal: AbortSignal) => Promise<unknown>;
}

/** A validated assist candidate. It is only written back when the user applies it. */
export interface AxcAssistResult<T> {
	explanation: string;
	value: T;
}
