import { useState } from 'react';
import type { AxcUIComponents, AxcSelectProps, AxcMultiSelectProps } from './types.js';
import { NativeTags } from './NativeTags.js';
import { useAxcLocale } from './provider.js';
import { nativeClass } from './native-class.js';

/** Maps the contract's `invalid` / `describedBy` to ARIA attributes. */
const aria = ({ invalid, describedBy }: { invalid?: boolean; describedBy?: string }) => ({
	'aria-invalid': invalid || undefined,
	'aria-describedby': describedBy,
});

/** Plain browser select with an optional search box. No custom popups, focus traps or keyboard state machines. */
function NativeSelect(props: AxcSelectProps | AxcMultiSelectProps) {
	const locale = useAxcLocale();
	const [search, setSearch] = useState('');
	const multiple = Array.isArray(props.value);
	const selected = (value: string) => (multiple ? (props.value as string[]).includes(value) : props.value === value);
	const query = search.toLocaleLowerCase();
	const options = props.options.filter(
		(option) => selected(option.value) || option.label.toLocaleLowerCase().includes(query),
	);
	const select = (
		<select
			className={nativeClass(!props.searchable && props.className)}
			aria-label={props.label}
			{...aria(props)}
			disabled={props.disabled}
			multiple={multiple}
			value={props.value}
			onChange={(event) => {
				if (multiple)
					(props as AxcMultiSelectProps).onChange([...event.target.selectedOptions].map((option) => option.value));
				else (props as AxcSelectProps).onChange(event.target.value);
			}}
		>
			{options.map((option) => (
				<option key={option.value} value={option.value} disabled={option.disabled}>
					{option.label}
				</option>
			))}
		</select>
	);
	if (!props.searchable) return select;
	return (
		<div className={['axc-native-select', props.className].filter(Boolean).join(' ')}>
			<input
				className={nativeClass()}
				aria-label={locale.ui.search(props.label)}
				type="search"
				placeholder={locale.ui.searchPlaceholder}
				disabled={props.disabled}
				value={search}
				onChange={(event) => setSearch(event.target.value)}
			/>
			{select}
		</div>
	);
}

/** Default controls. Hosts replace any subset through `AxcUIProvider`. */
export const nativeComponents: AxcUIComponents = {
	Button: ({ children, label, disabled, className, tone, onClick }) => (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			className={nativeClass(className, tone === 'danger' && 'axc-native-danger')}
			onClick={onClick}
		>
			{children}
		</button>
	),
	Input: ({ label, onChange, className, type = 'text', invalid, describedBy, ...props }) => (
		<input
			{...props}
			{...aria({ invalid, describedBy })}
			type={type}
			step={type === 'number' ? 'any' : undefined}
			className={nativeClass(className)}
			aria-label={label}
			onChange={(event) => onChange(event.target.value)}
		/>
	),
	TextArea: ({ label, onChange, className, invalid, describedBy, ...props }) => (
		<textarea
			{...props}
			{...aria({ invalid, describedBy })}
			className={nativeClass(className)}
			aria-label={label}
			onChange={(event) => onChange(event.target.value)}
		/>
	),
	Select: NativeSelect,
	MultiSelect: NativeSelect,
	Checkbox: ({ label, onChange, className, checked, disabled, ...rest }) => (
		<label className={['axc-native-checkbox', className].filter(Boolean).join(' ')}>
			<input
				type="checkbox"
				className={nativeClass()}
				checked={checked}
				disabled={disabled}
				{...aria(rest)}
				onChange={(event) => onChange(event.target.checked)}
			/>
			<span>{label}</span>
		</label>
	),
	Tags: NativeTags,
	DateInput: ({ label, kind, onChange, className, invalid, describedBy, ...props }) => (
		<input
			{...props}
			{...aria({ invalid, describedBy })}
			className={nativeClass(className)}
			type={kind === 'date' ? 'date' : 'datetime-local'}
			step={kind === 'date' ? undefined : 1}
			aria-label={label}
			onChange={(event) => onChange(event.target.value)}
		/>
	),
};
