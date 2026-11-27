import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import ReactCodeMirror, { EditorView, keymap, Prec, type Extension, type KeyBinding } from '@uiw/react-codemirror';

export interface SourceTextProps {
	value: string;
	onChange: (value: string) => void;
	label: string;
	describedBy?: string;
	invalid?: boolean;
	readOnly?: boolean;
	disabled?: boolean;
	height?: number | string;
	placeholder?: string;
}

export interface CodeEditorProps extends Omit<SourceTextProps, 'onChange'> {
	onChange?: (value: string) => void;
	language?: Extension;
	extensions?: readonly Extension[];
	theme?: 'light' | 'dark' | 'none';
	autoFocus?: boolean;
	wordWrap?: boolean;
	className?: string;
	onRun?: () => void;
	onSave?: () => void;
}
/** Edit controlled source text using CodeMirror 6. Language, completion and diagnostic extensions
 * come from the caller. Mod-Enter and Mod-S invoke the supplied callbacks; exceptions propagate. */
export function CodeEditor({
	value,
	onChange,
	label,
	describedBy,
	invalid,
	language,
	extensions,
	theme,
	readOnly,
	disabled,
	height = 220,
	placeholder,
	autoFocus,
	wordWrap,
	className,
	onRun,
	onSave,
}: CodeEditorProps) {
	// The React wrapper reconfigures the view whenever its callbacks change identity.
	const latest = useRef({ onChange, onRun, onSave });
	useLayoutEffect(() => {
		latest.current = { onChange, onRun, onSave };
	}, [onChange, onRun, onSave]);
	const change = useCallback((text: string) => latest.current.onChange?.(text), []);
	const canRun = !!onRun,
		canSave = !!onSave;
	const setup = useMemo(() => {
		const result: Extension[] = [
			EditorView.contentAttributes.of({
				'aria-label': label,
				...(describedBy ? { 'aria-describedby': describedBy } : {}),
				'aria-invalid': String(!!invalid),
				'aria-disabled': String(!!disabled),
				'aria-readonly': String(!!readOnly || !!disabled),
				...(disabled ? { tabindex: '-1' } : {}),
			}),
		];
		if (language) result.push(language);
		if (wordWrap) result.push(EditorView.lineWrapping);
		const keys: KeyBinding[] = [];
		if (canRun)
			keys.push({
				key: 'Mod-Enter',
				run: () => {
					latest.current.onRun?.();
					return true;
				},
			});
		if (canSave)
			keys.push({
				key: 'Mod-s',
				run: () => {
					latest.current.onSave?.();
					return true;
				},
			});
		if (!disabled && keys.length) result.push(Prec.highest(keymap.of(keys)));
		if (extensions) result.push(...extensions);
		return result;
	}, [label, describedBy, invalid, readOnly, disabled, language, wordWrap, extensions, canRun, canSave]);
	return (
		<ReactCodeMirror
			className={className}
			value={value}
			onChange={onChange ? change : undefined}
			extensions={setup}
			theme={theme}
			height={typeof height === 'number' ? height + 'px' : height}
			placeholder={placeholder}
			autoFocus={autoFocus}
			readOnly={readOnly || disabled}
			editable={!disabled}
			indentWithTab={false}
		/>
	);
}
