import { useEffect, useState } from 'react';
import type { AxcTagsProps } from './types.js';
import { useAxcLocale } from './provider.js';
import { nativeClass } from './native-class.js';

/** Default word list. Enter commits (not while composing with an IME); multi-line paste adds one word per line. */
export function NativeTags({ value, onChange, label, disabled, className, invalid, describedBy }: AxcTagsProps) {
	const locale = useAxcLocale();
	const [draft, setDraft] = useState('');
	const signature = JSON.stringify(value);
	// A new value (another record, an applied candidate) drops the uncommitted draft instead of carrying it over.
	useEffect(() => setDraft(''), [signature]);
	const add = (words: string[]) => {
		const next = [...new Set([...value, ...words].filter((word) => word.trim()))];
		if (JSON.stringify(next) !== signature) onChange(next);
		setDraft('');
	};
	return (
		<div className={['axc-native-tags', className].filter(Boolean).join(' ')} role="group" aria-label={label}>
			{value.map((word, index) => (
				<span className="axc-word" key={word}>
					<span title={word}>{word}</span>
					<button
						className={nativeClass()}
						type="button"
						disabled={disabled}
						aria-label={locale.ui.removeTag(word)}
						onClick={() => onChange(value.filter((_, i) => i !== index))}
					>
						×
					</button>
				</span>
			))}
			<input
				className={nativeClass()}
				aria-label={locale.ui.tagInput(label)}
				aria-invalid={invalid || undefined}
				aria-describedby={describedBy}
				value={draft}
				disabled={disabled}
				placeholder={locale.ui.tagPlaceholder}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
						event.preventDefault();
						add([draft]);
					}
				}}
				onPaste={(event) => {
					const pasted = event.clipboardData.getData('text/plain');
					if (!/[\r\n]/.test(pasted)) return;
					event.preventDefault();
					add(pasted.split(/\r\n|\r|\n/));
				}}
			/>
		</div>
	);
}
