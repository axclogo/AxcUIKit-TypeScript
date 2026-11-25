import { useId } from 'react';
import type { JsonFieldDefinition, JsonFieldOption, JsonPath, JsonValue } from '../core/index.js';
import { useJsonEditorContext } from '../ui/provider.js';
import { equal, isValidNumber, readDraft, toDraft, validDraft, type Node } from './tree.js';

export interface Editability {
	readOnly?: boolean;
	disabled?: boolean;
}

type Primitive = boolean | number | string;

function isPrimitive(value: JsonValue | undefined): value is Primitive {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function fieldPlaceholder(field: JsonFieldDefinition | undefined) {
	return isPrimitive(field?.default) ? String(field.default) : undefined;
}

type OptionsField = JsonFieldDefinition & { options: readonly JsonFieldOption[] };

function OptionsEditor({
	field,
	draft,
	present,
	label,
	describedBy,
	access,
	onChange,
	removable,
}: {
	field: OptionsField;
	draft: Node['draft'];
	present: boolean;
	label: string;
	describedBy?: string;
	access: Editability;
	onChange: (value: JsonValue | undefined) => void;
	removable: boolean;
}) {
	const {
		slots: { Select },
		locale,
	} = useJsonEditorContext();
	const selected = !present
		? []
		: draft.type === 'array' && field.multiple
			? draft.children.map((child) => readDraft(child.draft))
			: [readDraft(draft)];
	const options = [...field.options];
	for (const value of selected) {
		if (!options.some((option) => equal(option.value, value))) options.push({ value });
	}
	const choices = options.map((option, index) => ({
		label: option.label ?? (typeof option.value === 'string' ? option.value : JSON.stringify(option.value)),
		value: String(index),
	}));
	const values = selected.map((value) => String(options.findIndex((option) => equal(option.value, value))));
	if (field.multiple) {
		return (
			<Select
				{...access}
				label={label}
				describedBy={describedBy}
				options={choices}
				multiple
				value={values}
				onChange={(next) => onChange(next.map((id) => options[Number(id)].value))}
			/>
		);
	}
	return (
		<Select
			{...access}
			label={label}
			describedBy={describedBy}
			placeholder={removable ? (fieldPlaceholder(field) ?? locale.choose) : undefined}
			options={choices}
			value={values[0]}
			onChange={(id) => onChange(id === undefined ? undefined : options[Number(id)].value)}
		/>
	);
}

export function hasOptions(
	field: JsonFieldDefinition | undefined,
	draft: Node['draft'],
	present: boolean,
): field is OptionsField {
	if (!field?.options) return false;
	if (!present) return true;
	if (field.multiple) return draft.type === 'array' && draft.children.every((child) => validDraft(child.draft));
	return validDraft(draft);
}

export function ValueEditor({
	node,
	field,
	present,
	label,
	describedBy,
	access,
	onDraft,
	onRemove,
	path,
}: {
	node: Node;
	field?: JsonFieldDefinition;
	present: boolean;
	label: string;
	describedBy?: string;
	access: Editability;
	onDraft: (draft: Node['draft']) => void;
	onRemove?: () => void;
	path: JsonPath | undefined;
}) {
	const {
		slots: { Input, Select, FileInput },
		locale,
	} = useJsonEditorContext();
	const { draft } = node;
	const issueId = useId();
	if (field?.type === 'file' && draft.type === 'string') {
		// Public editor entries have already checked that every file field has this slot.
		const FileControl = FileInput!;
		return (
			<div className="axc-json-value">
				{access.readOnly && present && <output>{draft.text}</output>}
				<FileControl
					{...access}
					label={label}
					describedBy={describedBy}
					path={path}
					value={present ? draft.text : undefined}
					onChange={(text) => onDraft({ type: 'string', text })}
				/>
			</div>
		);
	}
	if (field && hasOptions(field, draft, present)) {
		return (
			<OptionsEditor
				field={field}
				draft={draft}
				label={label}
				describedBy={describedBy}
				access={access}
				present={present}
				removable={onRemove !== undefined}
				onChange={(value) => (value === undefined ? onRemove!() : onDraft(toDraft(value)))}
			/>
		);
	}
	if (draft.type === 'boolean') {
		return (
			<Select
				{...access}
				label={label}
				describedBy={describedBy}
				value={present ? String(draft.value) : undefined}
				options={[
					{ value: 'true', label: locale.true },
					{ value: 'false', label: locale.false },
				]}
				placeholder={field && onRemove ? (fieldPlaceholder(field) ?? locale.choose) : undefined}
				onChange={(value) =>
					value === undefined ? onRemove!() : onDraft({ type: 'boolean', value: value === 'true' })
				}
			/>
		);
	}
	if (draft.type === 'string' || draft.type === 'number') {
		const invalid = present && draft.type === 'number' && !isValidNumber(draft.text);
		const type = draft.type;
		const description = [describedBy, invalid ? issueId : undefined].filter(Boolean).join(' ') || undefined;
		return (
			<div className="axc-json-value">
				<Input
					{...access}
					label={label}
					describedBy={description}
					value={present ? draft.text : ''}
					placeholder={fieldPlaceholder(field)}
					onChange={(text) => onDraft({ type, text })}
					format={type === 'string' ? field?.format : undefined}
					multiline={type === 'string' && field?.multiline}
					inputMode={type === 'number' ? 'decimal' : undefined}
					invalid={invalid}
				/>
				{invalid && (
					<span className="axc-json-error" id={issueId} role="alert">
						{locale.invalidNumber}
					</span>
				)}
			</div>
		);
	}
	if (draft.type === 'null' && present) return <span>{locale.types.null}</span>;
	return null;
}
