import { useId } from 'react';
import type { JsonField, JsonValue, JsonValueType } from '../core/index.js';
import { useJsonEditorContext } from '../ui/provider.js';
import { initialValue, isValidNumber, toDraft, type Node } from './tree.js';

export interface Editability {
	readOnly?: boolean;
	disabled?: boolean;
}

type Primitive = boolean | number | string;

function isPrimitive(value: JsonValue | undefined): value is Primitive {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function fieldPlaceholder(field: JsonField | undefined) {
	return isPrimitive(field?.default) ? String(field.default) : undefined;
}

function selectedValue(draft: Node['draft']) {
	if (draft.type === 'string') return draft.text;
	if (draft.type === 'boolean') return draft.value;
	if (draft.type === 'number' && isValidNumber(draft.text)) return Number(draft.text);
	return undefined;
}

function OptionsEditor({
	field,
	draft,
	present,
	label,
	describedBy,
	access,
	onChange,
}: {
	field: JsonField;
	draft: Node['draft'];
	present: boolean;
	label: string;
	describedBy?: string;
	access: Editability;
	onChange: (value: JsonValue | undefined) => void;
}) {
	const {
		slots: { Select },
		locale,
	} = useJsonEditorContext();
	const selected = !present
		? []
		: draft.type === 'array'
			? draft.children.map((child) => selectedValue(child.draft))
			: [selectedValue(draft)];
	const options = [...(field.options ?? [])];
	for (const value of selected) {
		if (value !== undefined && !options.some((option) => Object.is(option.value, value))) options.push({ value });
	}
	const choices = options.map((option, index) => ({
		label: option.label ?? String(option.value),
		value: String(index),
	}));
	const values = selected.flatMap((value) => {
		const index = options.findIndex((option) => Object.is(option.value, value));
		return index < 0 ? [] : [String(index)];
	});
	if (field.multiple) {
		return (
			<Select
				{...access}
				label={label}
				describedBy={describedBy}
				options={choices}
				multiple
				value={values}
				onChange={(next) =>
					onChange(
						next.flatMap((id) => {
							const option = options[Number(id)];
							return option ? [option.value] : [];
						}),
					)
				}
			/>
		);
	}
	return (
		<Select
			{...access}
			label={label}
			describedBy={describedBy}
			placeholder={fieldPlaceholder(field) ?? locale.choose}
			options={choices}
			value={values[0]}
			onChange={(id) => onChange(id === undefined ? undefined : options[Number(id)]?.value)}
		/>
	);
}

export function hasOptions(field: JsonField | undefined, draft: Node['draft'], present: boolean): boolean {
	if (!field?.options) return false;
	if (!present) return true;
	if (field.multiple)
		return draft.type === 'array' && draft.children.every((child) => selectedValue(child.draft) !== undefined);
	return selectedValue(draft) !== undefined;
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
}: {
	node: Node;
	field?: JsonField;
	present: boolean;
	label: string;
	describedBy?: string;
	access: Editability;
	onDraft: (draft: Node['draft']) => void;
	onRemove: () => void;
}) {
	const {
		slots: { Input, Select },
		locale,
	} = useJsonEditorContext();
	const { draft } = node;
	const issueId = useId();
	if (field && hasOptions(field, draft, present)) {
		return (
			<OptionsEditor
				field={field}
				draft={draft}
				label={label}
				describedBy={describedBy}
				access={access}
				present={present}
				onChange={(value) => (value === undefined ? onRemove() : onDraft(toDraft(value)))}
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
				placeholder={field ? (fieldPlaceholder(field) ?? locale.choose) : undefined}
				onChange={(value) => (value === undefined ? onRemove() : onDraft({ type: 'boolean', value: value === 'true' }))}
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

export function declaredType(field: JsonField): JsonValueType {
	return field.multiple ? 'array' : (field.type ?? 'string');
}

export function newFieldValue(field: JsonField) {
	return field.default === undefined ? initialValue(declaredType(field)) : field.default;
}
