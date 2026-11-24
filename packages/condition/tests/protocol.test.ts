import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import {
	conditionSchema,
	en,
	validateCondition,
	validateDecisionPlan,
	zhCN,
	type AxcConditionCatalog,
	type AxcConditionOptions,
	type AxcIssue,
} from '../src/core/index.js';

interface Fixture {
	catalog: AxcConditionCatalog;
	cases: Array<{
		name: string;
		catalog?: Partial<AxcConditionCatalog>;
		options?: AxcConditionOptions;
		value: unknown;
		issues: AxcIssue[];
	}>;
}
const read = <T>(name: string): T =>
	JSON.parse(readFileSync(new URL(`../protocol/${name}`, import.meta.url), 'utf8')) as T;
const conditions = read<Fixture>('condition.fixtures.json');
const decisions = read<Fixture>('decision.fixtures.json');
const codes = read<string[]>('issue-codes.json');
const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, validateFormats: false });

test('issue codes are frozen: same set and order in protocol/issue-codes.json and both locales', () => {
	assert.deepEqual(Object.keys(en.issues), codes);
	assert.deepEqual(Object.keys(zhCN.issues), codes);
});

test('every issue code is pinned by at least one fixture', () => {
	const seen = new Set<string>(
		[...conditions.cases, ...decisions.cases].flatMap((c) => c.issues.map((issue) => issue.code)),
	);
	assert.deepEqual(
		codes.filter((code) => !seen.has(code)),
		[],
	);
});

for (const fixture of conditions.cases)
	test(`condition fixture: ${fixture.name}`, () => {
		const catalog = { ...conditions.catalog, ...fixture.catalog };
		assert.deepEqual(validateCondition(fixture.value, catalog, fixture.options), fixture.issues);
		if (!fixture.issues.length && !fixture.options?.allowEmpty)
			assert.equal(ajv.validate(conditionSchema(catalog), fixture.value), true, 'valid cases also pass the schema');
	});

for (const fixture of decisions.cases)
	test(`decision fixture: ${fixture.name}`, () => {
		assert.deepEqual(validateDecisionPlan(fixture.value, { ...decisions.catalog, ...fixture.catalog }), fixture.issues);
	});
