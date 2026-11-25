import type { JsonField, JsonFieldDefinition, JsonValue } from './core/index.js';
import { ParamEditor } from './internal/ParamEditor.js';
import { useJsonEditorContext } from './ui/provider.js';
import { checkFields } from './core/fields.js';

export interface ParamObjectEditorProps {
	value: JsonValue;
	onChange: (value: JsonValue) => void;
	fields?: readonly JsonField[];
	/** Metadata for any root type. Explicit fields override rootField.fields. */
	rootField?: JsonFieldDefinition;
	schemaMode?: 'form' | 'rows';
	allowExtraParams?: boolean;
	emptyLabel?: string;
	extraLabel?: string;
	/** Presentation state only; missing keys and order are preserved. */
	disabledKeys?: readonly string[];
	onDisabledKeysChange?: (keys: string[]) => void;
	readOnly?: boolean;
	disabled?: boolean;
	className?: string;
}

/** Edits any JSON value as a tree, emitting only complete JSON drafts. Invalid metadata throws JsonConfigurationError. */
export function ParamObjectEditor({ fields, rootField, ...props }: ParamObjectEditorProps) {
	const { slots } = useJsonEditorContext();
	const field = fields ? { ...rootField, fields } : rootField;
	checkFields(field, slots.FileInput !== undefined);
	return <ParamEditor {...props} rootField={field} />;
}
