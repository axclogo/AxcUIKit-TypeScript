import type { JsonEditorSlots } from './types.js';

export const native: JsonEditorSlots = {
	Input: ({ label, describedBy, value, onChange, placeholder, multiline, inputMode, readOnly, disabled, invalid }) => {
		const props = {
			'aria-label': label,
			'aria-describedby': describedBy,
			'aria-invalid': invalid,
			className: 'axc-json-native-input',
			value,
			placeholder,
			readOnly,
			disabled,
		};
		return multiline ? (
			<textarea {...props} onChange={(event) => onChange(event.currentTarget.value)} />
		) : (
			<input {...props} inputMode={inputMode} onChange={(event) => onChange(event.currentTarget.value)} />
		);
	},
	Select: (props) => {
		const { label, describedBy, options, value, multiple, placeholder, readOnly, disabled } = props;
		if (readOnly && !disabled) {
			const values = multiple ? value : [value];
			return (
				<output aria-label={label} aria-describedby={describedBy}>
					{options
						.filter((option) => values.includes(option.value))
						.map((option) => option.label)
						.join(', ')}
				</output>
			);
		}
		return (
			<select
				aria-label={label}
				aria-describedby={describedBy}
				className="axc-json-native-select"
				value={value ?? ''}
				multiple={multiple}
				disabled={disabled}
				onChange={(event) => {
					if (props.multiple) {
						props.onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value));
					} else {
						props.onChange(event.currentTarget.value || undefined);
					}
				}}
			>
				{placeholder && !multiple && <option value="">{placeholder}</option>}
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		);
	},
	Button: ({ label, onClick, disabled, pressed, expanded }) => (
		<button
			className="axc-json-native-button"
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-pressed={pressed}
			aria-expanded={expanded}
		>
			{label}
		</button>
	),
	SourceEditor: ({ label, describedBy, value, onChange, height, placeholder, readOnly, disabled, invalid }) => (
		<textarea
			aria-label={label}
			aria-describedby={describedBy}
			aria-invalid={invalid}
			className="axc-json-native-input axc-json-native-source"
			value={value}
			placeholder={placeholder}
			style={{ height }}
			readOnly={readOnly}
			disabled={disabled}
			onChange={(event) => onChange(event.currentTarget.value)}
		/>
	),
};
