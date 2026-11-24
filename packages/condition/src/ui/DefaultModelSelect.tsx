import type { AxcModelSelectProps } from './types.js';
import { Select } from './controls.js';
import { useAxcLocale } from './provider.js';

/** Searchable model picker. `''` in the select maps to `null` (no model chosen). */
export function DefaultModelSelect({ models, value, onChange, disabled, label, ...link }: AxcModelSelectProps) {
	const locale = useAxcLocale();
	return (
		<Select
			label={label}
			{...link}
			disabled={disabled}
			searchable
			value={value ?? ''}
			onChange={(next) => onChange(next || null)}
			options={[
				{ value: '', label: locale.ui.chooseModel },
				...models.map((model) => ({
					value: model.id,
					label: model.provider ? `${model.provider} / ${model.label}` : model.label,
				})),
			]}
		/>
	);
}
