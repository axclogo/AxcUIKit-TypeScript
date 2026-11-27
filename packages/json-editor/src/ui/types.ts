import type { ComponentType } from 'react';
import type { SourceTextProps as SourceEditorProps } from '@axclogo/uikit/code-editor';
import type { JsonPath } from '../core/index.js';

export interface InputProps {
	label: string;
	describedBy?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	multiline?: boolean;
	inputMode?: 'decimal';
	format?: 'date' | 'date-time';
	readOnly?: boolean;
	disabled?: boolean;
	invalid?: boolean;
}

export interface SelectOption {
	value: string;
	label: string;
}

/** Emit option IDs from options. Emit undefined only when a single-select placeholder is offered. */
export type SelectProps = {
	label: string;
	options: readonly SelectOption[];
	describedBy?: string;
	placeholder?: string;
	readOnly?: boolean;
	disabled?: boolean;
} & (
	| { multiple?: false; value: string | undefined; onChange: (value: string | undefined) => void }
	| { multiple: true; value: readonly string[]; onChange: (value: string[]) => void }
);

export interface ButtonProps {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	pressed?: boolean;
	expanded?: boolean;
}

export type { SourceEditorProps };

/** Host-owned file picker. Emit only the serializable reference; retain files in the host.
 * In readOnly mode render the display name without a picker; the editor renders the reference.
 * Disabled controls must not select files or emit changes.
 */
export interface FileInputProps {
	label: string;
	describedBy?: string;
	/** Undefined while this value or an ancestor is an unnamed object draft. */
	path?: JsonPath;
	value: string | undefined;
	onChange: (reference: string) => void;
	readOnly?: boolean;
	disabled?: boolean;
}

export interface JsonEditorSlots {
	FileInput?: ComponentType<FileInputProps>;
	Input: ComponentType<InputProps>;
	Select: ComponentType<SelectProps>;
	Button: ComponentType<ButtonProps>;
	SourceEditor: ComponentType<SourceEditorProps>;
}
