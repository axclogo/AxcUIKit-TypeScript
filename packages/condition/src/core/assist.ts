import type { AxcAssistRequest, AxcAssistResult, AxcConditionCatalog, AxcConditionValue, AxcSchema } from './types.js';
import { closedObject, conditionSchema } from './condition-schema.js';
import { validateCondition } from './condition.js';
import { checkCatalog } from './catalog.js';
import { en, type AxcAssistPromptContext, type AxcLocale } from './locale.js';
import { checkObject, checkText, collect, ensureValid, prefixIssues, type AxcIssue } from './issues.js';

/** Wraps `target` in the `{ explanation, value }` envelope and renders the prompt. */
export function buildAssistRequest(
	model: string,
	requirement: string,
	current: unknown,
	catalog: AxcConditionCatalog,
	target: AxcSchema,
	prompt: (context: AxcAssistPromptContext) => string,
): AxcAssistRequest {
	const [issues, report] = collect();
	checkText(model, ['model'], report);
	checkText(requirement, ['requirement'], report);
	ensureValid(null, issues);
	// Keep $defs at the document root so local $refs still resolve after nesting under `value`.
	const { $defs, $schema, ...body } = target;
	return {
		model,
		response_schema: {
			...closedObject({ explanation: { type: 'string', pattern: '\\S' }, value: body }),
			$defs,
			$schema,
		},
		prompt: prompt({
			fields: JSON.stringify(catalog.fields.filter((field) => !field.disabled)),
			maxLevels: checkCatalog(catalog),
			allowNot: catalog.allowNot !== false,
			current: JSON.stringify(current),
			requirement,
		}),
	};
}

/**
 * Request for generating a plain condition. The prompt comes from `locale.prompts.conditionAssist`.
 * Throws `AxcValidationError` (`required` at `model` / `requirement`) when either is blank.
 */
export function conditionAssistRequest(
	model: string,
	requirement: string,
	current: AxcConditionValue,
	catalog: AxcConditionCatalog,
	locale: AxcLocale = en,
): AxcAssistRequest {
	return buildAssistRequest(
		model,
		requirement,
		current,
		catalog,
		conditionSchema(catalog),
		locale.prompts.conditionAssist,
	);
}

/** Validates the `{ explanation, value }` envelope; issues inside `value` are prefixed with `value`. */
export function validateAssistResult(input: unknown, validate: (value: unknown) => AxcIssue[]): AxcIssue[] {
	const [issues, report] = collect();
	if (checkObject(input, ['explanation', 'value'], [], report)) {
		checkText(input.explanation, ['explanation'], report);
		issues.push(...prefixIssues(['value'], validate(input.value)));
	}
	return issues;
}

/**
 * Reads a model's condition candidate. Nothing is repaired: Markdown fences, stringified JSON,
 * extra keys or wrong types all throw `AxcValidationError`. The candidate must be non-empty.
 */
export function parseConditionResult(input: unknown, catalog: AxcConditionCatalog): AxcAssistResult<AxcConditionValue> {
	return ensureValid(
		input,
		validateAssistResult(input, (value) => validateCondition(value, catalog)),
	);
}
