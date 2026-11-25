import type { JsonIssueCode, JsonValueType } from '../types.js';

export interface JsonEditorLocale {
	enable: string;
	deactivate: string;
	inactive: string;
	key: string;
	type: string;
	value: string;
	true: string;
	false: string;
	add: string;
	remove: string;
	expand: string;
	collapse: string;
	empty: string;
	extra: string;
	required: string;
	params: string;
	json: string;
	choose: string;
	invalidNumber: string;
	missingKey: string;
	duplicateKey: string;
	types: Readonly<Record<JsonValueType, string>>;
	issues: Readonly<Record<JsonIssueCode, string>>;
}

export const en: JsonEditorLocale = {
	enable: 'Enable',
	deactivate: 'Deactivate',
	inactive: 'Inactive',
	key: 'Key',
	type: 'Type',
	value: 'Value',
	true: 'True',
	false: 'False',
	add: 'Add',
	remove: 'Remove',
	expand: 'Expand',
	collapse: 'Collapse',
	empty: 'Parameters',
	extra: 'Extra parameters',
	required: 'Required',
	params: 'Parameters',
	json: 'JSON',
	choose: 'Choose a value',
	invalidNumber: 'Enter a finite JSON number',
	missingKey: 'Enter a key',
	duplicateKey: 'Duplicate key',
	types: { string: 'String', number: 'Number', boolean: 'Boolean', null: 'Null', object: 'Object', array: 'Array' },
	issues: {
		invalid_schema: 'Invalid JSON Schema structure',
		unsupported_schema_keyword: 'Unsupported JSON Schema keyword',
		unsupported_schema_value: 'Unsupported JSON Schema keyword value',
		duplicate_field: 'Field names must be unique',
		missing_file_slot: 'Provide the FileInput slot for file fields',
		invalid_json: 'Enter valid JSON',
		invalid_value: 'The value is not finite JSON data',
	},
};
