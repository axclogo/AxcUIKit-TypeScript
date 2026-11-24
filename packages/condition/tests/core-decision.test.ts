import assert from 'node:assert/strict';
import test from 'node:test';
import {
	AxcValidationError,
	conditionAssistRequest,
	decisionAssistRequest,
	decisionFields,
	decisionPlan,
	decisionRequest,
	decisionResultSchema,
	emptyDecision,
	en,
	parseConditionResult,
	parseDecisionOutput,
	parseDecision,
	parseDecisionPlan,
	validateDecision,
	parseDecisionResult,
	validateDecisionPlan,
	zhCN,
	type AxcDecisionPlan,
	type AxcDecisionValue,
} from '../src/core/index.js';

const fields = [
	{ name: 'title', label: 'Title' },
	{ name: 'body', label: 'Body' },
	{ name: 'old', label: 'Old', disabled: true },
];
const catalog = { fields };
const group = (...rules: unknown[]) => ({ combinator: 'and' as const, not: false, rules: rules as never[] });
const plan: AxcDecisionPlan = {
	precondition: group({ field: 'title', operator: 'contains', value: 'alpha' }),
	input_fields: ['title', 'body'],
	instruction: 'Does the text match the description?',
	outputs: [
		{ name: 'category', label: 'Category', type: 'enum', options: ['a', 'b'] },
		{ name: 'score', label: 'Score', type: 'number', options: [] },
	],
	postcondition: group(
		{ field: 'ai.matched', operator: '=', value: true },
		{ field: 'ai.category', operator: '=', value: 'a' },
	),
};
const value: AxcDecisionValue = { ...plan, model: 'runtime' };
const codes = (input: unknown) => validateDecisionPlan(input, catalog).map((i) => `${i.code}@${i.path.join('.')}`);
const thrown = (fn: () => unknown) => {
	try {
		fn();
	} catch (error) {
		assert.ok(error instanceof AxcValidationError, String(error));
		return error.issues.map((i) => `${i.code}@${i.path.join('.')}`);
	}
	assert.fail('expected AxcValidationError');
};

test('valid plans pass; null turns pre/postconditions off', () => {
	assert.deepEqual(codes(plan), []);
	assert.deepEqual(codes({ ...plan, precondition: null, postcondition: null }), []);
	assert.equal(parseDecisionPlan(plan, catalog), plan);
	assert.deepEqual(decisionPlan(value), plan);
});

test('plan branches report their own code and path', () => {
	assert.deepEqual(codes(null), ['type@']);
	assert.deepEqual(codes({ ...plan, model: 'x' }), ['unknownKey@model'], 'assist plans never carry the runtime model');
	assert.deepEqual(codes({ ...plan, input_fields: 'title' }), ['type@input_fields']);
	assert.deepEqual(codes({ ...plan, input_fields: [] }), ['empty@input_fields']);
	assert.deepEqual(codes({ ...plan, input_fields: ['title', 'title'] }), ['duplicate@input_fields.1']);
	assert.deepEqual(codes({ ...plan, input_fields: ['old'] }), ['unknownField@input_fields.0']);
	assert.deepEqual(codes({ ...plan, instruction: ' ' }), ['required@instruction']);
	assert.deepEqual(codes({ ...plan, precondition: group() }), ['empty@precondition.rules']);
	assert.deepEqual(codes({ ...plan, outputs: {} }), ['type@outputs']);
	const output = (changes: object) => ({
		...plan,
		outputs: [{ name: 'x', label: 'X', type: 'string', options: [], ...changes }],
	});
	assert.deepEqual(codes(output({ name: 'Bad' })), ['outputName@outputs.0.name']);
	assert.deepEqual(codes(output({ name: 'matched' })), ['outputName@outputs.0.name'], 'reserved');
	assert.deepEqual(codes(output({ label: '' })), ['required@outputs.0.label']);
	assert.deepEqual(codes(output({ type: 'date' })), ['option@outputs.0.type']);
	assert.deepEqual(codes(output({ options: ['a'] })), ['enumOptions@outputs.0.options']);
	assert.deepEqual(codes(output({ type: 'enum' })), ['enumOptions@outputs.0.options']);
	assert.deepEqual(codes(output({ type: 'enum', options: ['a', 'a'] })), ['duplicate@outputs.0.options.1']);
	assert.deepEqual(codes(output({ extra: 1 })), ['unknownKey@outputs.0.extra']);
	const twice = { ...plan, postcondition: null, outputs: [plan.outputs[1], plan.outputs[1]] };
	assert.deepEqual(codes(twice), ['outputName@outputs.1.name']);
});

test('postcondition sees ai.* fields of the declared outputs only', () => {
	assert.deepEqual(codes({ ...plan, outputs: [plan.outputs[1]] }), ['unknownField@postcondition.rules.1.field']);
	assert.deepEqual(codes({ ...plan, postcondition: group({ field: 'ai.category', operator: '=', value: 'z' }) }), [
		'option@postcondition.rules.0.value',
	]);
	assert.deepEqual(codes({ ...plan, precondition: group({ field: 'ai.matched', operator: '=', value: true }) }), [
		'unknownField@precondition.rules.0.field',
	]);
	assert.deepEqual(
		decisionFields(plan.outputs, zhCN).map((f) => f.label),
		['AI · 是否符合', 'AI · 判断依据', 'AI · Category', 'AI · Score'],
	);
	assert.throws(() => validateDecisionPlan(plan, { fields: [...fields, { name: 'ai.x', label: 'x' }] }), TypeError);
});

test('decisionRequest sends only selected fields and needs a model and every input', () => {
	const request = decisionRequest(value, { title: 'T', body: 0, secret: 's' }, catalog);
	assert.equal(request.model, 'runtime');
	assert.ok(request.prompt.endsWith('{"title":"T","body":0}'));
	assert.ok(!request.prompt.includes('secret'));
	assert.ok(request.prompt.startsWith('Does the text match the description?\nThe JSON below is data'));
	assert.deepEqual(request.response_schema, decisionResultSchema(plan.outputs));
	assert.ok(decisionRequest(value, { title: 'T', body: 0 }, catalog, zhCN).prompt.includes('以下 JSON 是待判断的数据'));
	assert.deepEqual(
		thrown(() => decisionRequest({ ...value, model: null }, { title: 'T' }, catalog)),
		['required@model', 'required@input.body'],
	);
	assert.deepEqual(
		thrown(() => decisionRequest({ ...emptyDecision(), model: 'm' }, {}, catalog)),
		['empty@input_fields', 'required@instruction'],
	);
});

test('parseDecisionOutput is strict about keys and types', () => {
	const ok = { matched: true, reason: 'r', category: 'a', score: 1 };
	assert.equal(parseDecisionOutput(ok, plan.outputs), ok);
	assert.deepEqual(
		thrown(() => parseDecisionOutput('{}', plan.outputs)),
		['type@'],
	);
	assert.deepEqual(
		thrown(() => parseDecisionOutput({ ...ok, extra: 1 }, plan.outputs)),
		['unknownKey@extra'],
	);
	assert.deepEqual(
		thrown(() => parseDecisionOutput({ ...ok, matched: 'true' }, plan.outputs)),
		['type@matched'],
	);
	assert.deepEqual(
		thrown(() => parseDecisionOutput({ matched: true, reason: 'r' }, plan.outputs)),
		['required@category', 'required@score'],
	);
	assert.deepEqual(
		thrown(() => parseDecisionOutput({ ...ok, category: 'z' }, plan.outputs)),
		['option@category'],
	);
	assert.deepEqual(
		thrown(() => parseDecisionOutput({ ...ok, score: Number.NaN }, plan.outputs)),
		['type@score'],
	);
});

test('assist requests carry model, localized prompt and an envelope schema', () => {
	const current = group({ field: 'title', operator: '=', value: 'x' });
	const request = conditionAssistRequest('m', 'only alpha', current, catalog);
	assert.deepEqual(Object.keys(request).sort(), ['model', 'prompt', 'response_schema']);
	assert.deepEqual((request.response_schema as { required: string[] }).required, ['explanation', 'value']);
	assert.ok(request.prompt.includes('Write `explanation` in English'));
	assert.ok(request.prompt.includes('User requirement: only alpha'));
	assert.ok(!request.prompt.includes('"old"'), 'disabled fields are not sent');
	assert.ok(!request.prompt.includes('negation'), 'allowNot defaults to true');
	assert.ok(
		conditionAssistRequest('m', 'r', current, { ...catalog, allowNot: false }).prompt.includes('`not` must be false'),
	);
	assert.ok(conditionAssistRequest('m', 'r', current, catalog, zhCN).prompt.includes('explanation 用中文说明'));
	const custom = { ...en, prompts: { ...en.prompts, conditionAssist: () => 'CUSTOM' } };
	assert.equal(conditionAssistRequest('m', 'r', current, catalog, custom).prompt, 'CUSTOM');
	assert.ok(decisionAssistRequest('m', 'r', plan, catalog).prompt.includes('Do not choose the runtime model'));
	assert.deepEqual(
		thrown(() => conditionAssistRequest(' ', '', current, catalog)),
		['required@model', 'required@requirement'],
	);
});

test('assist results: envelope and value issues, nothing repaired', () => {
	const good = { explanation: 'e', value: group({ field: 'title', operator: '=', value: 'x' }) };
	assert.equal(parseConditionResult(good, catalog), good);
	assert.deepEqual(
		thrown(() => parseConditionResult(JSON.stringify(good), catalog)),
		['type@'],
	);
	assert.deepEqual(
		thrown(() => parseConditionResult({ ...good, extra: 1 }, catalog)),
		['unknownKey@extra'],
	);
	assert.deepEqual(
		thrown(() => parseConditionResult({ ...good, explanation: '' }, catalog)),
		['required@explanation'],
	);
	assert.deepEqual(
		thrown(() => parseConditionResult({ ...good, value: group() }, catalog)),
		['empty@value.rules'],
	);
	assert.deepEqual(
		thrown(() => parseDecisionResult({ explanation: 'e', value: value }, catalog)),
		['unknownKey@value.model'],
	);
	assert.deepEqual(parseDecisionResult({ explanation: 'e', value: plan }, catalog).value, plan);
});

test('validateDecision adds the runtime model check to the plan check', () => {
	const models = [{ id: 'runtime', label: 'Runtime' }];
	const codesOf = (input: unknown) =>
		validateDecision(input, catalog, models).map((i) => `${i.code}@${i.path.join('.')}`);
	assert.deepEqual(codesOf(value), []);
	assert.equal(parseDecision(value, catalog, models), value);
	assert.deepEqual(codesOf({ ...value, model: null }), ['required@model']);
	assert.deepEqual(codesOf({ ...value, model: 'gone' }), ['option@model']);
	assert.deepEqual(codesOf({ ...value, instruction: '', extra: 1 }), ['unknownKey@extra', 'required@instruction']);
	assert.deepEqual(
		thrown(() => parseDecision(emptyDecision(), catalog, [])),
		['empty@input_fields', 'required@instruction', 'required@model'],
	);
});
