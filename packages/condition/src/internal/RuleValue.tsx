import type { AxcRule, ConditionField, ConditionOperator } from '../core/types.js';
import { timestamp } from '../core/date-time.js';
import { WordsInput } from './WordsInput.js';
import { Input, TextArea, Select, MultiSelect, DateInput } from '../ui/controls.js';
import { useAxcLocale } from '../ui/provider.js';

interface RuleValueProps {
	rule: AxcRule;
	field: ConditionField;
	operator: ConditionOperator;
	disabled?: boolean;
	/** `invalid` / `describedBy` for every control of this value. */
	link: { invalid?: boolean; describedBy?: string };
	onChange: (value: unknown) => void;
}

/** Plain decimal or exponent notation. Rejects what `Number()` would silently accept: '', ' ', '0x10', 'Infinity'. */
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/** UTC ISO → local wall-clock `YYYY-MM-DDTHH:mm:ss` for the DateInput control. */
function localDateTime(value: unknown): string {
	if (typeof value !== 'string' || !Number.isFinite(timestamp(value))) return '';
	const date = new Date(value);
	const part = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
}

/**
 * Converts a control's string draft to a protocol value. Text that is not a number stays a string,
 * so validation reports it instead of the editor silently turning it into something else.
 */
function convert(type: ConditionField['dataType'], text: string): unknown {
	if (text === '') return '';
	if (type === 'number') return NUMBER.test(text) ? Number(text) : text;
	if (type === 'datetime') {
		const date = new Date(text);
		return Number.isFinite(date.getTime()) ? date.toISOString() : text;
	}
	return text;
}

export function RuleValue({ rule, field, operator, disabled, link, onChange }: RuleValueProps) {
	const locale = useAxcLocale();
	const type = field.dataType;
	const scalar = (value: unknown, changed: (value: unknown) => void, label: string) => {
		if (type === 'boolean')
			return (
				<Select
					label={label}
					disabled={disabled}
					{...link}
					value={String(value)}
					onChange={(next) => changed(next === 'true')}
					options={[
						{ value: 'true', label: locale.ui.yes },
						{ value: 'false', label: locale.ui.no },
					]}
				/>
			);
		if (field.values !== undefined)
			return (
				<Select
					label={label}
					disabled={disabled}
					{...link}
					searchable
					value={String(value ?? '')}
					onChange={changed}
					options={[{ value: '', label: locale.ui.choose }, ...field.values]}
				/>
			);
		if (type === 'object')
			return <TextArea label={label} disabled={disabled} {...link} value={String(value ?? '')} onChange={changed} />;
		if (type === 'date' || type === 'datetime')
			return (
				<DateInput
					label={label}
					disabled={disabled}
					{...link}
					kind={type}
					value={type === 'datetime' ? localDateTime(value) : String(value ?? '')}
					onChange={(next) => changed(convert(type, next))}
				/>
			);
		return (
			<Input
				label={label}
				disabled={disabled}
				{...link}
				type={type === 'number' ? 'number' : 'text'}
				value={String(value ?? '')}
				onChange={(next) => changed(convert(type, next))}
			/>
		);
	};
	const label = locale.ui.value(field.label);
	switch (operator.valueShape) {
		case 'none':
			return null;
		case 'range': {
			const values = Array.isArray(rule.value) ? rule.value : ['', ''];
			return (
				<div className="axc-range">
					{[0, 1].map((index) => (
						<span key={index}>
							{scalar(
								values[index],
								(value) => onChange(values.map((item, i) => (i === index ? value : item))),
								`${label} ${index ? locale.ui.rangeTo : locale.ui.rangeFrom}`,
							)}
						</span>
					))}
				</div>
			);
		}
		case 'list': {
			const values = Array.isArray(rule.value) ? rule.value.map(String) : [];
			return field.values !== undefined ? (
				<MultiSelect
					label={label}
					disabled={disabled}
					{...link}
					searchable
					value={values}
					options={field.values}
					onChange={onChange}
				/>
			) : (
				<WordsInput
					label={label}
					disabled={disabled}
					{...link}
					value={values}
					onChange={(items) => onChange(type === 'number' ? items.map((item) => convert(type, item)) : items)}
				/>
			);
		}
		default:
			return scalar(rule.value, onChange, label);
	}
}
