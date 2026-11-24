/** Framework-free protocol entry: types, validation, JSON Schemas, prompts and locales. No React, DOM or network. */
export type {
	AxcSchema,
	ConditionDataType,
	ConditionValueShape,
	ConditionOption,
	ConditionOperator,
	ConditionField,
	ConditionFieldBase,
	AxcRule,
	AxcConditionValue,
	AxcConditionCatalog,
	AxcModelOption,
	AxcAssistRequest,
	AxcAssistTransport,
	AxcAssistResult,
} from './types.js';
export type { AxcPath, AxcIssue, AxcIssueCode, AxcIssueParams, AxcExpectedType } from './issues.js';
export { AxcValidationError, formatPath } from './issues.js';
export type { AxcLocale, AxcAssistPromptContext, AxcDecisionPromptContext } from './locale.js';
export { en, formatIssue } from './locale.js';
export { zhCN } from './locales/zh-CN.js';
export type { AxcConditionOptions } from './condition.js';
export { emptyCondition, validateCondition, parseCondition } from './condition.js';
export { conditionSchema } from './condition-schema.js';
export { operatorsFor } from './operators.js';
export { conditionAssistRequest, parseConditionResult } from './assist.js';
export { decisionAssistRequest, parseDecisionResult } from './decision-assist.js';
export type { AxcDecisionField, AxcDecisionPlan, AxcDecisionValue } from './decision.js';
export {
	emptyDecision,
	decisionFields,
	decisionPlan,
	validateDecision,
	parseDecision,
	validateDecisionPlan,
	parseDecisionPlan,
	decisionSchema,
	decisionResultSchema,
	decisionRequest,
	parseDecisionOutput,
} from './decision.js';
