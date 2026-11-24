import type { ComponentType } from 'react';

export interface InputProps {
	label: string;
	describedBy?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	multiline?: boolean;
	inputMode?: 'decimal';
	readOnly?: boolean;
	disabled?: boolean;
	invalid?: boolean;
}

export interface SelectOption {
	value: string;
	label: string;
}

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

export interface SourceEditorProps {
	label: string;
	describedBy?: string;
	value: string;
	onChange: (value: string) => void;
	height?: string | number;
	placeholder?: string;
	readOnly?: boolean;
	disabled?: boolean;
	invalid?: boolean;
}

export interface JsonEditorSlots {
	Input: ComponentType<InputProps>;
	Select: ComponentType<SelectProps>;
	Button: ComponentType<ButtonProps>;
	SourceEditor: ComponentType<SourceEditorProps>;
}
