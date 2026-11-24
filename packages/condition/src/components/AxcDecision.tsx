import { useId } from 'react';
import { ModelSelect, Button, Checkbox, Input, TextArea, Select, MultiSelect } from '../ui/controls.js';
import { useAxcLocale } from '../ui/provider.js';
import type { AxcConditionCatalog, AxcModelOption, AxcAssistTransport } from '../core/types.js';
import { emptyCondition } from '../core/condition.js';
import { decisionFields, validateDecision, type AxcDecisionField, type AxcDecisionValue } from '../core/decision.js';
import type { AxcIssue, AxcPath } from '../core/issues.js';
import { AxcCondition } from './AxcCondition.js';
import { AxcConditionAssist } from './AxcConditionAssist.js';
import { WordsInput } from '../internal/WordsInput.js';
import { Issues, issueProps, startsWith } from '../internal/Issues.js';
import { useKeys } from '../internal/useKeys.js';

/** Controlled editor for a precondition → AI decision → postcondition configuration. */
export interface AxcDecisionProps extends AxcConditionCatalog {
	value: AxcDecisionValue;
	onChange?: (value: AxcDecisionValue) => void;
	/** Runtime models the user may pick. May be empty. Axc only checks that `value.model` is listed. */
	models: AxcModelOption[];
	disabled?: boolean;
	readOnly?: boolean;
	/** Optional assistant for the precondition and postcondition editors. */
	conditionAssist?: AxcAssistTransport;
}

const OUTPUT_TYPES: AxcDecisionField['type'][] = ['string', 'number', 'boolean', 'enum'];

/**
 * Edits the configuration only. Running it (precondition, model call, postcondition), billing and
 * scheduling are the host's job; see `decisionRequest` and `parseDecisionOutput`.
 */
export function AxcDecision({
	value,
	onChange,
	fields,
	maxLevels,
	allowNot,
	models,
	disabled,
	readOnly,
	conditionAssist,
}: AxcDecisionProps) {
	const locale = useAxcLocale();
	const outputKeys = useKeys(value.outputs);
	const catalog = { fields, maxLevels, allowNot };
	const locked = Boolean(disabled || readOnly || !onChange);
	const patch = (changes: Partial<AxcDecisionValue>) => onChange?.({ ...value, ...changes });
	const setOutputs = (outputs: AxcDecisionField[], keys: number[]) => {
		outputKeys.track(outputs, keys);
		patch({ outputs });
	};
	const output = (index: number, changes: Partial<AxcDecisionField>) =>
		setOutputs(
			value.outputs.map((field, i) => (i === index ? { ...field, ...changes } : field)),
			outputKeys.keys,
		);
	// Condition issues are shown by the nested editors; everything else is shown here, next to its control.
	const issues = validateDecision(value, catalog, models).filter(
		(issue) => issue.path[0] !== 'precondition' && issue.path[0] !== 'postcondition',
	);
	const at = (path: AxcPath): AxcIssue[] => issues.filter((issue) => startsWith(issue.path, path));
	const id = useId();
	/** Issue element id for `key` (`model`, `input_fields`, `outputs-0`, …) and the props linking a control to it. */
	const ref = (key: string) => `${id}-${key}`;
	const link = (path: AxcPath) => issueProps(issues, path, ref(path.slice(0, 2).join('-')));
	const condition = (part: 'precondition' | 'postcondition') => {
		const current = value[part];
		if (current === null) return null;
		const props = {
			fields: part === 'precondition' ? fields : [...fields, ...decisionFields(value.outputs, locale)],
			maxLevels,
			allowNot,
			value: current,
			disabled: locked,
			readOnly,
			onChange: (next: typeof current) => patch({ [part]: next }),
		};
		return conditionAssist ? <AxcConditionAssist {...props} assist={conditionAssist} /> : <AxcCondition {...props} />;
	};
	const toggle = (part: 'precondition' | 'postcondition', label: string) => (
		<Checkbox
			label={label}
			checked={value[part] !== null}
			disabled={locked}
			onChange={(checked) => patch({ [part]: checked ? emptyCondition() : null })}
		/>
	);
	return (
		<div className="axc-decision">
			<section className="axc-panel">
				{toggle('precondition', locale.ui.precondition)}
				{value.precondition === null ? <small>{locale.ui.preconditionOff}</small> : condition('precondition')}
			</section>
			<section className="axc-panel">
				<strong>{locale.ui.aiDecision}</strong>
				<ModelSelect
					label={locale.ui.runModel}
					{...link(['model'])}
					models={models}
					value={value.model}
					disabled={locked}
					onChange={(model) => patch({ model })}
				/>
				<Issues issues={at(['model'])} id={ref('model')} />
				<MultiSelect
					label={locale.ui.inputFields}
					{...link(['input_fields'])}
					value={value.input_fields}
					disabled={locked}
					searchable
					options={fields.map((field) => ({ value: field.name, label: field.label, disabled: field.disabled }))}
					onChange={(input_fields) => patch({ input_fields })}
				/>
				<Issues issues={at(['input_fields'])} id={ref('input_fields')} />
				<TextArea
					label={locale.ui.instruction}
					{...link(['instruction'])}
					value={value.instruction}
					rows={5}
					disabled={locked}
					onChange={(instruction) => patch({ instruction })}
				/>
				<Issues issues={at(['instruction'])} id={ref('instruction')} />
				<small>{locale.ui.fixedOutputs}</small>
				{value.outputs.map((field, index) => (
					<div className="axc-output" key={outputKeys.keys[index]}>
						<Input
							label={locale.ui.outputName(index)}
							{...link(['outputs', index, 'name'])}
							placeholder={locale.ui.outputNamePlaceholder}
							value={field.name}
							disabled={locked}
							onChange={(name) => output(index, { name })}
						/>
						<Input
							label={locale.ui.outputLabel(index)}
							{...link(['outputs', index, 'label'])}
							placeholder={locale.ui.outputLabelPlaceholder}
							value={field.label}
							disabled={locked}
							onChange={(label) => output(index, { label })}
						/>
						<Select
							label={locale.ui.outputType(index)}
							{...link(['outputs', index, 'type'])}
							value={field.type}
							disabled={locked}
							options={OUTPUT_TYPES.map((type) => ({ value: type, label: locale.ui.outputTypes[type] }))}
							onChange={(type) => output(index, { type: type as AxcDecisionField['type'], options: [] })}
						/>
						{field.type === 'enum' && (
							<WordsInput
								label={locale.ui.outputOptions(index)}
								{...link(['outputs', index, 'options'])}
								value={field.options}
								disabled={locked}
								onChange={(options) => output(index, { options })}
							/>
						)}
						{!readOnly && (
							<Button
								tone="danger"
								disabled={locked}
								onClick={() =>
									setOutputs(
										value.outputs.filter((_, i) => i !== index),
										outputKeys.keys.filter((_, i) => i !== index),
									)
								}
							>
								{locale.ui.removeOutput}
							</Button>
						)}
						<Issues issues={at(['outputs', index])} id={ref(`outputs-${index}`)} />
					</div>
				))}
				<Issues issues={issues.filter((issue) => issue.path[0] === 'outputs' && issue.path.length === 1)} />
				{!readOnly && (
					<Button
						disabled={locked}
						onClick={() =>
							setOutputs(
								[...value.outputs, { name: '', label: '', type: 'string', options: [] }],
								[...outputKeys.keys, outputKeys.fresh()],
							)
						}
					>
						{locale.ui.addOutput}
					</Button>
				)}
			</section>
			<section className="axc-panel">
				{toggle('postcondition', locale.ui.postcondition)}
				{value.postcondition === null ? (
					<small>{locale.ui.postconditionOff}</small>
				) : (
					<>
						<small>{locale.ui.postconditionOn}</small>
						{condition('postcondition')}
					</>
				)}
			</section>
		</div>
	);
}
