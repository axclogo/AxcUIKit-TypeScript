import { useState } from 'react';
import {
	AxcCondition,
	validateCondition,
	emptyCondition,
	type AxcConditionValue,
	type ConditionField,
} from '@axclogo/uikit/condition';
import { useTableUI } from './ui/provider.js';
import type { AnalysisConfig, DataAnalysisField } from './types.js';
export function ConditionDialog({
	fields,
	value,
	onApply,
	onClose,
}: {
	fields: ConditionField[];
	value: AnalysisConfig['condition'];
	onApply: (v: AnalysisConfig['condition']) => void;
	onClose: () => void;
}) {
	const {
		controls: { Modal, Button },
		locale,
	} = useTableUI();
	const [draft, setDraft] = useState<AxcConditionValue>(() => value?.query ?? emptyCondition());
	const invalid = validateCondition(draft, { fields, maxLevels: 6 }, { allowEmpty: true }).length > 0;
	return (
		<Modal title={locale.filters} onClose={onClose}>
			<AxcCondition value={draft} onChange={setDraft} fields={fields} allowEmpty maxLevels={6} />
			<Button label={locale.cancel} onClick={onClose}>
				{locale.cancel}
			</Button>
			<Button
				label={locale.confirm}
				disabled={invalid}
				onClick={() => {
					onApply(draft.rules.length || draft.not ? { query: draft } : null);
					onClose();
				}}
			>
				{locale.confirm}
			</Button>
		</Modal>
	);
}
export function conditionCatalog(fields: readonly DataAnalysisField[]): ConditionField[] {
	const names = new Set<string>();
	for (const f of fields) {
		if (names.has(f.name)) throw new TypeError('Duplicate field name: ' + f.name);
		names.add(f.name);
		if (!['string', 'number', 'boolean', 'enum', 'array', 'object', 'date', 'datetime'].includes(f.dataType))
			throw new TypeError('Unknown dataType for ' + f.name + ': ' + f.dataType);
		if (f.dataType === 'enum' && !f.options?.length) throw new TypeError('Enum requires options: ' + f.name);
	}
	return fields
		.filter((f) => f.conditionable)
		.map((f) => {
			if (f.conditionField) return f.conditionField;
			const base = { name: f.name, label: f.label };
			const dataType = f.dataType;
			if (dataType === 'string' || dataType === 'array' || dataType === 'enum')
				return {
					...base,
					dataType,
					values: f.options?.map((o) => {
						if (typeof o.value !== 'string')
							throw new TypeError('conditionField required for non-string options: ' + f.name);
						return { ...o, value: o.value };
					}),
				};
			return { ...base, dataType };
		});
}
