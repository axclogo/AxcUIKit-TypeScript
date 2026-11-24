import type { AxcAssistRequest, AxcAssistResult, AxcConditionCatalog } from './types.js';
import { buildAssistRequest, validateAssistResult } from './assist.js';
import { decisionSchema, validateDecisionPlan, type AxcDecisionPlan } from './decision.js';
import { en, type AxcLocale } from './locale.js';
import { ensureValid } from './issues.js';

/**
 * Request for generating a whole decision plan. The model decides whether the precondition and
 * postcondition are on; it never picks the runtime model. Prompt: `locale.prompts.decisionAssist`.
 */
export function decisionAssistRequest(
	model: string,
	requirement: string,
	current: AxcDecisionPlan,
	catalog: AxcConditionCatalog,
	locale: AxcLocale = en,
): AxcAssistRequest {
	return buildAssistRequest(
		model,
		requirement,
		current,
		catalog,
		decisionSchema(catalog),
		locale.prompts.decisionAssist,
	);
}

/** Reads a model's plan candidate. The whole plan is validated before it can be applied as one unit. */
export function parseDecisionResult(input: unknown, catalog: AxcConditionCatalog): AxcAssistResult<AxcDecisionPlan> {
	return ensureValid(
		input,
		validateAssistResult(input, (value) => validateDecisionPlan(value, catalog)),
	);
}
