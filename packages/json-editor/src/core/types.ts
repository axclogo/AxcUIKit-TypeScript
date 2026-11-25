export type JsonValue = null | boolean | number | string | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonContent = { kind: 'value'; value: JsonValue } | { kind: 'text'; text: string };
export type JsonValueType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
export type JsonFieldType = JsonValueType | 'file';

export interface JsonFieldOption {
	value: JsonValue;
	label?: string;
}

/** Rendering metadata for a root value, object property, or array element. */
export interface JsonFieldDefinition {
	label?: string;
	description?: string;
	type?: JsonFieldType;
	/** Displays a required marker. The application validates required values. */
	required?: boolean;
	default?: JsonValue;
	options?: readonly JsonFieldOption[];
	multiline?: boolean;
	multiple?: boolean;
	format?: 'date' | 'date-time';
	fields?: readonly JsonField[];
	items?: JsonFieldDefinition;
	/** Controls extra-property editing, without deleting or validating existing values. */
	additionalProperties?: boolean | JsonFieldDefinition;
}

export interface JsonField extends JsonFieldDefinition {
	name: string;
}

export type JsonIssueCode =
	| 'invalid_json'
	| 'invalid_value'
	| 'invalid_schema'
	| 'unsupported_schema_keyword'
	| 'unsupported_schema_value'
	| 'duplicate_field'
	| 'missing_file_slot';
export type JsonPath = readonly (string | number)[];

export interface JsonIssue {
	code: JsonIssueCode;
	path: JsonPath;
	params: Readonly<Record<string, string | number>>;
}
