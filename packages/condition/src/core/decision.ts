import type { AxcConditionCatalog, AxcConditionValue, AxcModelOption, AxcSchema, ConditionField } from './types.js';
import { closedObject, conditionSchema, groupDefs } from './condition-schema.js';
import { validateCondition } from './condition.js';
import { checkCatalog } from './catalog.js';
import { en, type AxcLocale } from './locale.js';
import {
	checkObject,
	checkText,
	collect,
	ensureValid,
	prefixIssues,
	type AxcIssue,
	type AxcPath,
	type Report,
} from './issues.js';

/** An extra AI output. `matched` and `reason` are reserved. `options` is non-empty for `enum` and empty otherwise. */
export interface AxcDecisionField {
	name: string;
	label: string;
	type: 'string' | 'number' | 'boolean' | 'enum';
	options: string[];
}

/** A decision plan. `null` turns the precondition or postcondition off; when on it must be non-empty. */
export interface AxcDecisionPlan {
	precondition: AxcConditionValue | null;
	input_fields: string[];
	instruction: string;
	outputs: AxcDecisionField[];
	postcondition: AxcConditionValue | null;
}

/** What `AxcDecision` edits: a plan plus the runtime model. Assist candidates never contain `model`. */
export interface AxcDecisionValue extends AxcDecisionPlan {
	model: string | null;
}

/** An unfinished draft. It does not pick a model or input fields for the user. */
export const emptyDecision = (): AxcDecisionValue => ({
	model: null,
	precondition: null,
	input_fields: [],
	instruction: '',
	outputs: [],
	postcondition: null,
});

const PLAN_KEYS = ['precondition', 'input_fields', 'instruction', 'outputs', 'postcondition'];
const OUTPUT_TYPES = ['string', 'number', 'boolean', 'enum'];
const OUTPUT_NAME = /^[a-z][a-z0-9_]*$/;

/**
 * Fields the postcondition can read: `ai.matched`, `ai.reason` and `ai.<name>` per output.
 * They live in the `ai.` namespace so they cannot collide with host fields. Labels come from `locale`.
 */
export function decisionFields(outputs: AxcDecisionField[], locale: AxcLocale = en): ConditionField[] {
	return [
		{ name: 'ai.matched', label: locale.ui.aiMatched, dataType: 'boolean' },
		{ name: 'ai.reason', label: locale.ui.aiReason, dataType: 'string' },
		...outputs.map((output): ConditionField =>
			output.type === 'enum'
				? {
						name: `ai.${output.name}`,
						label: locale.ui.aiOutput(output.label),
						dataType: 'enum',
						values: output.options.map((value) => ({ value, label: value })),
					}
				: { name: `ai.${output.name}`, label: locale.ui.aiOutput(output.label), dataType: output.type },
		),
	];
}

function checkDecisionCatalog(catalog: AxcConditionCatalog) {
	const field = catalog.fields.find((item) => item.name.startsWith('ai.'));
	if (field) throw new TypeError(`Field "${field.name}": the ai. prefix is reserved for decision outputs`);
}

function checkOutputs(value: unknown, report: Report): AxcDecisionField[] | null {
	if (!Array.isArray(value)) return (report({ code: 'type', path: ['outputs'], params: { expected: 'array' } }), null);
	const names = new Set(['matched', 'reason']);
	let valid = true;
	value.forEach((output, index) => {
		const path: AxcPath = ['outputs', index];
		const count = (issue: AxcIssue) => ((valid = false), report(issue));
		if (!checkObject(output, ['name', 'label', 'type', 'options'], path, count)) return;
		if (checkText(output.name, [...path, 'name'], count)) {
			if (!OUTPUT_NAME.test(output.name) || names.has(output.name))
				count({ code: 'outputName', path: [...path, 'name'], params: { name: output.name } });
			names.add(output.name);
		}
		checkText(output.label, [...path, 'label'], count);
		if (!OUTPUT_TYPES.includes(output.type as string))
			count({ code: 'option', path: [...path, 'type'], params: { value: String(output.type) } });
		const options = output.options;
		if (!Array.isArray(options))
			return count({ code: 'type', path: [...path, 'options'], params: { expected: 'array' } });
		options.forEach((option, i) => {
			if (checkText(option, [...path, 'options', i], count) && options.indexOf(option) !== i)
				count({ code: 'duplicate', path: [...path, 'options', i], params: { value: option } });
		});
		if (output.type === 'enum' ? !options.length : options.length)
			count({ code: 'enumOptions', path: [...path, 'options'] });
	});
	return valid ? (value as AxcDecisionField[]) : null;
}

/**
 * Returns every problem in a decision plan. Paths are relative to the plan, so precondition
 * issues start with `precondition` and postcondition issues with `postcondition`.
 * Postcondition rules are checked against host fields plus `decisionFields(outputs)`; while outputs
 * are invalid the postcondition is not checked. Throws `TypeError` if a host field uses the `ai.` prefix.
 */
export function validateDecisionPlan(value: unknown, catalog: AxcConditionCatalog): AxcIssue[] {
	checkCatalog(catalog);
	checkDecisionCatalog(catalog);
	const [issues, report] = collect();
	if (!checkObject(value, PLAN_KEYS, [], report)) return issues;
	if (value.precondition !== null)
		issues.push(...prefixIssues(['precondition'], validateCondition(value.precondition, catalog)));
	const inputs = value.input_fields;
	if (!Array.isArray(inputs)) report({ code: 'type', path: ['input_fields'], params: { expected: 'array' } });
	else if (!inputs.length) report({ code: 'empty', path: ['input_fields'] });
	else
		inputs.forEach((name, index) => {
			const path = ['input_fields', index];
			if (!catalog.fields.some((field) => !field.disabled && field.name === name))
				report({ code: 'unknownField', path, params: { field: String(name) } });
			else if (inputs.indexOf(name) !== index) report({ code: 'duplicate', path, params: { value: String(name) } });
		});
	checkText(value.instruction, ['instruction'], report);
	const outputs = checkOutputs(value.outputs, report);
	if (value.postcondition !== null && outputs)
		issues.push(
			...prefixIssues(
				['postcondition'],
				validateCondition(value.postcondition, { ...catalog, fields: [...catalog.fields, ...decisionFields(outputs)] }),
			),
		);
	return issues;
}

/**
 * Validates what `AxcDecision` edits: the plan plus the runtime model, which must be one of `models`
 * (`required` / `option` at `model`). Use it to decide whether a decision can be saved.
 */
export function validateDecision(value: unknown, catalog: AxcConditionCatalog, models: AxcModelOption[]): AxcIssue[] {
	const [issues, report] = collect();
	if (!checkObject(value, [...PLAN_KEYS, 'model'], [], report)) return issues;
	const { model } = value;
	const plan = Object.fromEntries(PLAN_KEYS.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]));
	issues.push(...validateDecisionPlan(plan, catalog));
	if (typeof model !== 'string' || !model) report({ code: 'required', path: ['model'] });
	else if (!models.some((item) => item.id === model))
		report({ code: 'option', path: ['model'], params: { value: model } });
	return issues;
}

/** Reads an external decision value (plan + runtime model). Throws `AxcValidationError` with every issue. */
export function parseDecision(
	value: unknown,
	catalog: AxcConditionCatalog,
	models: AxcModelOption[],
): AxcDecisionValue {
	return ensureValid(value, validateDecision(value, catalog, models));
}

/** Reads an external decision plan. Throws `AxcValidationError` with every issue. */
export function parseDecisionPlan(value: unknown, catalog: AxcConditionCatalog): AxcDecisionPlan {
	return ensureValid(value, validateDecisionPlan(value, catalog));
}

/** Drops the runtime model. Assist requests and candidates only ever deal with plans. */
export function decisionPlan(value: AxcDecisionValue): AxcDecisionPlan {
	const { model, ...plan } = value;
	return plan;
}

/**
 * JSON Schema for a whole plan, for constraining model output. The postcondition schema is loose
 * (fields depend on the generated outputs), so results must still go through `parseDecisionPlan`.
 */
export function decisionSchema(catalog: AxcConditionCatalog): AxcSchema {
	// Move the precondition's $refs under #/$defs/pre without touching field names or enum values.
	const pre = JSON.parse(
		JSON.stringify(conditionSchema(catalog), (key, value: unknown) =>
			key === '$ref' && typeof value === 'string' ? value.replace('#/$defs/', '#/$defs/pre/$defs/') : value,
		),
	);
	// Postcondition fields depend on the generated outputs, so its rules are only loosely typed here.
	const post = groupDefs(
		'post',
		catalog,
		closedObject(
			{
				valueSource: { const: 'field' },
				field: { type: 'string', minLength: 1 },
				operator: { type: 'string', minLength: 1 },
				value: {
					type: ['string', 'number', 'boolean', 'null', 'array'],
					items: { type: ['string', 'number', 'boolean'] },
				},
			},
			['field', 'operator', 'value'],
		),
	);
	const enabled = catalog.fields.filter((field) => !field.disabled).map((field) => field.name);
	return {
		...closedObject({
			precondition: { anyOf: [{ type: 'null' }, { $ref: '#/$defs/pre' }] },
			input_fields: {
				type: 'array',
				minItems: 1,
				uniqueItems: true,
				items: enabled.length ? { enum: enabled } : false,
			},
			instruction: { type: 'string', pattern: '\\S' },
			outputs: {
				type: 'array',
				items: closedObject({
					name: { type: 'string', pattern: OUTPUT_NAME.source },
					label: { type: 'string', pattern: '\\S' },
					type: { enum: OUTPUT_TYPES },
					options: { type: 'array', uniqueItems: true, items: { type: 'string', pattern: '\\S' } },
				}),
			},
			postcondition: { anyOf: [{ type: 'null' }, { $ref: '#/$defs/post1' }] },
		}),
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		$defs: { pre, ...post },
	};
}

/** Schema the runtime model must answer with: `matched`, `reason` and every declared output. */
export function decisionResultSchema(outputs: AxcDecisionField[]): AxcSchema {
	return closedObject({
		matched: { type: 'boolean' },
		reason: { type: 'string' },
		...Object.fromEntries(
			outputs.map((f) => [f.name, f.type === 'enum' ? { type: 'string', enum: f.options } : { type: f.type }]),
		),
	});
}

/**
 * Builds the runtime model request for one input record. Call it only after the precondition matched.
 * Sends only `input_fields`, keyed by field name. Throws `AxcValidationError` when the plan is invalid,
 * `model` is blank (`required` at `model`) or a selected field is missing or undefined (`required` at
 * `input.<field>`). The prompt comes from `locale.prompts.decisionRun`.
 */
export function decisionRequest(
	value: AxcDecisionValue,
	input: Record<string, unknown>,
	catalog: AxcConditionCatalog,
	locale: AxcLocale = en,
) {
	const plan = decisionPlan(value);
	const [issues, report] = collect(validateDecisionPlan(plan, catalog));
	if (typeof value.model !== 'string' || !value.model.trim()) report({ code: 'required', path: ['model'] });
	const selected: Record<string, unknown> = {};
	if (Array.isArray(plan.input_fields))
		for (const field of plan.input_fields) {
			if (!Object.hasOwn(input, field) || input[field] === undefined)
				report({ code: 'required', path: ['input', field] });
			selected[field] = input[field];
		}
	ensureValid(null, issues);
	return {
		model: value.model as string,
		response_schema: decisionResultSchema(plan.outputs),
		prompt: locale.prompts.decisionRun({ instruction: plan.instruction, input: JSON.stringify(selected) }),
	};
}

/**
 * Reads the runtime model's parsed JSON. Rejects missing, extra or mistyped keys, and enum values
 * outside `options`; nothing is coerced. A failed parse is a failed call, not a "not matched" result.
 */
export function parseDecisionOutput(
	input: unknown,
	outputs: AxcDecisionField[],
): Record<string, unknown> & { matched: boolean; reason: string } {
	const [issues, report] = collect();
	if (checkObject(input, ['matched', 'reason', ...outputs.map((f) => f.name)], [], report)) {
		const expect = (key: string, type: 'string' | 'number' | 'boolean') => {
			const value = input[key];
			if (!Object.hasOwn(input, key)) report({ code: 'required', path: [key] });
			else if (typeof value !== type || (typeof value === 'number' && !Number.isFinite(value)))
				report({ code: 'type', path: [key], params: { expected: type } });
		};
		expect('matched', 'boolean');
		expect('reason', 'string');
		for (const field of outputs) {
			expect(field.name, field.type === 'enum' ? 'string' : field.type);
			const value = input[field.name];
			if (field.type === 'enum' && typeof value === 'string' && !field.options.includes(value))
				report({ code: 'option', path: [field.name], params: { value } });
		}
	}
	return ensureValid(input, issues);
}
