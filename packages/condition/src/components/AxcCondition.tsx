import { useId } from 'react';
import { Button, Select, Checkbox } from '../ui/controls.js';
import { useAxcLocale } from '../ui/provider.js';
import type { AxcConditionCatalog, AxcConditionValue, AxcRule, ConditionField } from '../core/types.js';
import { emptyCondition, fieldRefOnly, validateCondition } from '../core/condition.js';
import { operatorsFor } from '../core/operators.js';
import { DEFAULT_MAX_LEVELS, sameType } from '../core/catalog.js';
import type { AxcIssue, AxcPath } from '../core/issues.js';
import { initialValue, operatorLabel, ruleFor } from '../internal/condition-editor.js';
import { RuleValue } from '../internal/RuleValue.js';
import { Issues, issueProps, ownIssues, startsWith } from '../internal/Issues.js';
import { useKeys } from '../internal/useKeys.js';

/**
 * Controlled condition editor. `onChange` receives drafts that may be incomplete; problems are shown
 * next to the row they belong to. Call `parseCondition` before saving.
 */
export interface AxcConditionProps extends AxcConditionCatalog {
	value: AxcConditionValue;
	/** Without it the editor is read-only. */
	onChange?: (value: AxcConditionValue) => void;
	/** Keeps the layout but disables every control. */
	disabled?: boolean;
	/** Disables every control and hides add/remove buttons. */
	readOnly?: boolean;
	/** Accept an empty root group. Default false. What an empty condition means is up to the host. */
	allowEmpty?: boolean;
}

interface GroupProps {
	catalog: AxcConditionCatalog;
	value: AxcConditionValue;
	onChange: (value: AxcConditionValue) => void;
	locked: boolean;
	readOnly?: boolean;
	depth: number;
	path: AxcPath;
	issues: AxcIssue[];
}

function RuleRow({
	rule,
	path,
	fields,
	locked,
	issues,
	onChange,
	remove,
}: {
	rule: AxcRule;
	path: AxcPath;
	fields: ConditionField[];
	locked: boolean;
	issues: AxcIssue[];
	onChange: (value: AxcRule) => void;
	remove?: () => void;
}) {
	const locale = useAxcLocale();
	const id = useId();
	const link = (key: string) => issueProps(issues, [...path, key], id);
	const field = fields.find((item) => item.name === rule.field);
	const operators = field ? operatorsFor(field) : [];
	const operator = operators.find((item) => item.name === rule.operator);
	return (
		<div className="axc-rule">
			<Select
				label={locale.ui.field}
				{...link('field')}
				value={rule.field}
				disabled={locked}
				searchable
				options={[
					...(field ? [] : [{ value: rule.field, label: locale.ui.unknownField(rule.field) }]),
					...fields.map((item) => ({
						value: item.name,
						label: item.label,
						disabled: item.disabled || !operatorsFor(item).length,
					})),
				]}
				onChange={(name) => onChange(ruleFor(fields.find((item) => item.name === name)!))}
			/>
			{field && (
				<Select
					label={locale.ui.operator}
					{...link('operator')}
					value={rule.operator}
					disabled={locked}
					options={[
						...(operator ? [] : [{ value: rule.operator, label: locale.ui.unknownOperator(rule.operator) }]),
						...operators.map((item) => ({ value: item.name, label: operatorLabel(field, item, locale) })),
					]}
					onChange={(name) => {
						const next = operators.find((item) => item.name === name)!;
						// Keep a field reference when the new operator still takes a value.
						onChange(
							rule.valueSource === 'field' && next.valueShape !== 'none'
								? { ...rule, operator: next.name }
								: ruleFor(field, next),
						);
					}}
				/>
			)}
			{field &&
				operator &&
				operator.valueShape !== 'none' &&
				field.valueSources?.includes('field') &&
				!fieldRefOnly(field, operator) && (
					<Select
						label={locale.ui.valueSource}
						{...link('valueSource')}
						disabled={locked}
						value={rule.valueSource ?? 'value'}
						options={[
							{ value: 'value', label: locale.ui.fixedValue },
							{ value: 'field', label: locale.ui.fieldReference },
						]}
						onChange={(source) =>
							onChange(
								source === 'field'
									? { field: rule.field, operator: rule.operator, value: '', valueSource: 'field' }
									: { field: rule.field, operator: rule.operator, value: initialValue(field, operator) },
							)
						}
					/>
				)}
			<div className="axc-rule-value">
				{field &&
					operator &&
					(rule.valueSource === 'field' ? (
						<Select
							label={locale.ui.referencedField}
							{...link('value')}
							disabled={locked}
							searchable
							value={String(rule.value)}
							onChange={(value) => onChange({ ...rule, value })}
							options={[
								{ value: '', label: locale.ui.choose },
								...fields
									.filter((item) => !item.disabled && sameType(item, field))
									.map((item) => ({ value: item.name, label: item.label })),
							]}
						/>
					) : (
						<RuleValue
							rule={rule}
							field={field}
							operator={operator}
							disabled={locked}
							link={link('value')}
							onChange={(value) => onChange({ ...rule, value })}
						/>
					))}
			</div>
			{remove && (
				<Button tone="danger" disabled={locked} onClick={remove}>
					{locale.ui.removeRule}
				</Button>
			)}
			<Issues issues={issues} id={id} />
		</div>
	);
}

function ConditionGroup({ catalog, value, onChange, locked, readOnly, depth, path, issues }: GroupProps) {
	const locale = useAxcLocale();
	const id = useId();
	const own = ownIssues(issues, path);
	const { keys, track, fresh } = useKeys(value.rules);
	const available = catalog.fields.filter((field) => !field.disabled && operatorsFor(field).length);
	const emit = (rules: AxcConditionValue['rules'], nextKeys: number[]) => {
		track(rules, nextKeys);
		onChange({ ...value, rules });
	};
	const patch = (index: number, node: AxcRule | AxcConditionValue) =>
		emit(
			value.rules.map((rule, i) => (i === index ? node : rule)),
			keys,
		);
	const remove = (index: number) =>
		emit(
			value.rules.filter((_, i) => i !== index),
			keys.filter((_, i) => i !== index),
		);
	const append = (node: AxcRule | AxcConditionValue) => emit([...value.rules, node], [...keys, fresh()]);
	return (
		<div className="axc-group">
			<div className="axc-toolbar">
				<Select
					label={locale.ui.combinator}
					{...issueProps(own, [...path, 'combinator'], id)}
					value={value.combinator}
					disabled={locked}
					options={[
						{ value: 'and', label: locale.ui.and },
						{ value: 'or', label: locale.ui.or },
					]}
					onChange={(combinator) => onChange({ ...value, combinator: combinator as 'and' | 'or' })}
				/>
				{catalog.allowNot !== false && (
					<Checkbox
						label={locale.ui.negate}
						{...issueProps(own, [...path, 'not'], id)}
						checked={value.not}
						disabled={locked}
						onChange={(not) => onChange({ ...value, not })}
					/>
				)}
				{!readOnly && (
					<>
						<Button disabled={locked || !available.length} onClick={() => append(ruleFor(available[0]))}>
							{locale.ui.addRule}
						</Button>
						<Button
							disabled={locked || depth >= (catalog.maxLevels ?? DEFAULT_MAX_LEVELS)}
							onClick={() => append(emptyCondition())}
						>
							{locale.ui.addGroup}
						</Button>
					</>
				)}
			</div>
			<Issues issues={own} id={id} />
			{value.rules.map((node, index) => {
				const at = [...path, 'rules', index];
				const nested = issues.filter((issue) => startsWith(issue.path, at));
				if ('rules' in node)
					return (
						<div className="axc-subgroup" key={keys[index]}>
							<ConditionGroup
								catalog={catalog}
								value={node}
								onChange={(next) => patch(index, next)}
								locked={locked}
								readOnly={readOnly}
								depth={depth + 1}
								path={at}
								issues={nested}
							/>
							{!readOnly && (
								<Button tone="danger" disabled={locked} onClick={() => remove(index)}>
									{locale.ui.removeGroup}
								</Button>
							)}
						</div>
					);
				return (
					<RuleRow
						key={keys[index]}
						rule={node}
						path={at}
						fields={catalog.fields}
						locked={locked}
						issues={nested}
						onChange={(next) => patch(index, next)}
						remove={readOnly ? undefined : () => remove(index)}
					/>
				);
			})}
		</div>
	);
}

/**
 * Plain condition editor. No model, network or storage access.
 * Throws `TypeError` during render when the catalog is invalid (see `ConditionField`).
 */
export function AxcCondition({ value, onChange, disabled, readOnly, allowEmpty, ...catalog }: AxcConditionProps) {
	const issues = validateCondition(value, catalog, { allowEmpty });
	return (
		<div className="axc-condition">
			<ConditionGroup
				catalog={catalog}
				value={value}
				onChange={(next) => onChange?.(next)}
				locked={Boolean(disabled || readOnly || !onChange)}
				readOnly={readOnly}
				depth={1}
				path={[]}
				issues={issues}
			/>
		</div>
	);
}
