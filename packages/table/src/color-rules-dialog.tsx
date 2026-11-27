import { useState } from 'react';
import { ColorPicker } from './ui/controls.js';
import { useTableUI } from './ui/provider.js';
import type { AnalysisConfig, DataAnalysisField, TableOption } from './types.js';

type Rule = AnalysisConfig['colorRules'][number];
type Draft = Pick<Rule, 'operator' | 'color'> & { id?: string; field?: string; value?: Rule['value'] };

export function ColorsDialog({
	fields,
	rules,
	onChange,
	onClose,
}: {
	fields: readonly DataAnalysisField[];
	rules: readonly Rule[];
	onChange: (rules: Rule[]) => void;
	onClose: () => void;
}) {
	const {
		controls: { Modal, Button, Select, NumberInput, Input },
		locale,
	} = useTableUI();
	const [draft, setDraft] = useState<Draft>({ field: fields[0]?.name, operator: '=', color: 'red' });
	const field = fields.find((f) => f.name === draft.field);
	const options =
		field?.dataType === 'boolean'
			? [
					{ label: locale.yes, value: true },
					{ label: locale.no, value: false },
				]
			: field?.options;
	const ready = !!field && draft.value !== undefined && draft.value !== '';
	function save() {
		const value = draft.value!;
		const label = options?.find((o) => o.value === value)?.label ?? String(value);
		const rule: Rule = {
			id: draft.id ?? crypto.getRandomValues(new Uint32Array(4)).join('-'),
			name: [
				field!.label,
				draft.operator === 'contains' ? locale.contains : draft.operator,
				label,
				locale[draft.color],
			].join(' '),
			field: field!.name,
			operator: draft.operator,
			value,
			color: draft.color,
		};
		onChange(draft.id === undefined ? [...rules, rule] : rules.map((r) => (r.id === rule.id ? rule : r)));
		setDraft({ ...draft, id: undefined, value: undefined });
	}
	const setValue = (value: TableOption['value'] | undefined) => setDraft({ ...draft, value });
	return (
		<Modal title={locale.colors} onClose={onClose}>
			<div className="axc-table-color-editor">
				{rules.length > 0 && (
					<ul className="axc-table-color-rules">
						{rules.map((rule) => (
							<li key={rule.id}>
								<span className="axc-table-swatch" data-color={rule.color} aria-label={locale[rule.color]} role="img" />
								<span>{rule.name}</span>
								<Button label={locale.edit + ' ' + rule.name} onClick={() => setDraft(rule)}>
									{locale.edit}
								</Button>
								<Button
									label={locale.remove + ' ' + rule.name}
									onClick={() => {
										onChange(rules.filter((r) => r.id !== rule.id));
										if (draft.id === rule.id) setDraft({ field: fields[0]?.name, operator: '=', color: 'red' });
									}}
								>
									{locale.remove}
								</Button>
							</li>
						))}
					</ul>
				)}
				<div className="axc-table-color-fields">
					<label>
						{locale.field}
						<Select
							label={locale.field}
							options={fields.map((f) => ({ value: f.name, label: f.label }))}
							value={draft.field}
							onChange={(v) => setDraft({ ...draft, field: v as string | undefined, value: undefined, operator: '=' })}
						/>
					</label>
					<label>
						{locale.operator}
						<Select
							label={locale.operator}
							options={[
								'=',
								'!=',
								...(field?.dataType === 'number' || field?.dataType === 'boolean' ? [] : ['contains']),
							].map((v) => ({ value: v, label: v === 'contains' ? locale.contains : v }))}
							value={draft.operator}
							onChange={(v) => setDraft({ ...draft, operator: v as Rule['operator'] })}
						/>
					</label>
					<label>
						{locale.value}
						{options?.length ? (
							<Select label={locale.value} options={options} value={draft.value} onChange={setValue} />
						) : field?.dataType === 'number' ? (
							<NumberInput
								label={locale.value}
								value={typeof draft.value === 'number' ? draft.value : undefined}
								onChange={setValue}
							/>
						) : (
							<Input
								type={field?.dataType === 'date' ? 'date' : field?.dataType === 'datetime' ? 'datetime-local' : 'text'}
								label={locale.value}
								value={String(draft.value ?? '')}
								onChange={setValue}
							/>
						)}
					</label>
				</div>
				<ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} locale={locale} />
				<div className="axc-table-tools">
					<Button label={draft.id === undefined ? locale.add : locale.save} disabled={!ready} onClick={save}>
						{draft.id === undefined ? locale.add : locale.save}
					</Button>
					<Button
						label={locale.confirm}
						disabled={draft.id !== undefined && !ready}
						onClick={() => {
							if (ready) save();
							onClose();
						}}
					>
						{locale.confirm}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
