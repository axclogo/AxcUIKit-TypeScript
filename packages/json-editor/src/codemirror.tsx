import { useMemo } from 'react';
import { json } from '@codemirror/lang-json';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import type { SourceEditorProps } from './ui/types.js';

export type { SourceEditorProps } from './ui/types.js';

const language = json();

export interface CodeMirrorSourceEditorProps extends SourceEditorProps {
	theme?: 'light' | 'dark' | 'none';
}

/** A JSON source control backed by CodeMirror 6 and its official JSON language extension. */
export function CodeMirrorSourceEditor({
	label,
	describedBy,
	value,
	onChange,
	height,
	placeholder,
	readOnly,
	disabled,
	invalid,
	theme,
}: CodeMirrorSourceEditorProps) {
	const extensions = useMemo(
		() => [
			language,
			EditorView.lineWrapping,
			EditorView.contentAttributes.of({
				'aria-label': label,
				...(describedBy ? { 'aria-describedby': describedBy } : {}),
				'aria-invalid': String(Boolean(invalid)),
				'aria-disabled': String(Boolean(disabled)),
				'aria-readonly': String(Boolean(readOnly || disabled)),
				...(disabled ? { tabindex: '-1' } : {}),
			}),
		],
		[describedBy, disabled, invalid, label, readOnly],
	);

	return (
		<CodeMirror
			value={value}
			onChange={(text) => {
				if (!readOnly && !disabled) onChange(text);
			}}
			height={typeof height === 'number' ? height + 'px' : height}
			placeholder={placeholder}
			extensions={extensions}
			theme={theme}
			readOnly={readOnly || disabled}
			editable={!disabled}
			indentWithTab={false}
		/>
	);
}
