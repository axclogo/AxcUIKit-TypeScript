export type JsonValue = null | boolean | number | string | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonContent = { kind: 'object'; value: JsonObject } | { kind: 'text'; text: string };
export type JsonValueType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

export interface JsonFieldOption {
	value: string | number | boolean;
	label?: string;
}

export interface JsonField {
	name: string;
	label?: string;
	description?: string;
	type?: JsonValueType;
	/** Displays a required marker. The application validates required values. */
	required?: boolean;
	default?: JsonValue;
	options?: readonly JsonFieldOption[];
	multiline?: boolean;
	multiple?: boolean;
}

export type JsonIssueCode = 'expected_object' | 'invalid_json' | 'invalid_value';
export type JsonPath = readonly (string | number)[];

export interface JsonIssue {
	code: JsonIssueCode;
	path: JsonPath;
	params: Readonly<Record<string, string | number>>;
}
