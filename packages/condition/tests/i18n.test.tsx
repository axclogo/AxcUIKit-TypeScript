import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen } from '@testing-library/react';
import {
	AxcCondition,
	AxcDecision,
	AxcUIProvider,
	emptyDecision,
	en,
	formatIssue,
	operatorsFor,
	zhCN,
	type AxcIssue,
	type AxcIssueCode,
	type AxcLocale,
	type ConditionField,
} from '../src/index.js';

afterEach(cleanup);

const fields: ConditionField[] = [{ name: 'title', label: 'Title' }];
const value = { combinator: 'and' as const, not: false, rules: [{ field: 'title', operator: 'contains', value: '' }] };

/** One sample issue per code, with params, so every message function runs. */
const samples: { [C in AxcIssueCode]: AxcIssue & { code: C } } = {
	type: { code: 'type', path: [], params: { expected: 'number' } },
	unknownKey: { code: 'unknownKey', path: ['id'], params: { key: 'id' } },
	required: { code: 'required', path: [] },
	empty: { code: 'empty', path: [] },
	duplicate: { code: 'duplicate', path: [], params: { value: 'v' } },
	combinator: { code: 'combinator', path: [] },
	tooDeep: { code: 'tooDeep', path: [], params: { max: 3 } },
	negationDisabled: { code: 'negationDisabled', path: [] },
	unknownField: { code: 'unknownField', path: [], params: { field: 'f' } },
	unknownOperator: { code: 'unknownOperator', path: [], params: { operator: 'o' } },
	fieldRefInvalid: { code: 'fieldRefInvalid', path: [] },
	fieldRefRequired: { code: 'fieldRefRequired', path: [] },
	rangeLength: { code: 'rangeLength', path: [] },
	rangeOrder: { code: 'rangeOrder', path: [] },
	option: { code: 'option', path: [], params: { value: 'v' } },
	date: { code: 'date', path: [] },
	datetime: { code: 'datetime', path: [] },
	regex: { code: 'regex', path: [] },
	outputName: { code: 'outputName', path: [], params: { name: 'n' } },
	enumOptions: { code: 'enumOptions', path: [] },
};

test('every issue code renders in both locales, with params, and differently per language', () => {
	for (const issue of Object.values(samples)) {
		const english = formatIssue(issue, en);
		const chinese = formatIssue(issue, zhCN);
		assert.ok(english && chinese, issue.code);
		assert.notEqual(english, chinese, issue.code);
		if (issue.code !== 'type')
			for (const param of Object.values(issue.params ?? {})) {
				assert.ok(english.includes(String(param)), `${issue.code} en shows ${param}`);
				assert.ok(chinese.includes(String(param)), `${issue.code} zh shows ${param}`);
			}
	}
	assert.equal(formatIssue(samples.type, en), 'Must be a number.');
	assert.equal(formatIssue(samples.type, zhCN), '必须是数字');
	assert.equal(formatIssue(samples.tooDeep, zhCN), '条件组最多嵌套 3 层');
});

test('locales have the same keys, and every built-in operator has a label', () => {
	const shape = (locale: AxcLocale) => ({
		top: Object.keys(locale).sort(),
		operators: Object.keys(locale.operators).sort(),
		types: Object.keys(locale.types).sort(),
		issues: Object.keys(locale.issues).sort(),
		ui: Object.keys(locale.ui).sort(),
		prompts: Object.keys(locale.prompts).sort(),
	});
	assert.deepEqual(shape(zhCN), shape(en));
	const dataTypes = ['string', 'number', 'boolean', 'date', 'datetime', 'enum', 'array', 'object'] as const;
	for (const dataType of dataTypes)
		for (const op of operatorsFor({ name: 'f', label: 'F', dataType } as ConditionField)) {
			assert.equal(op.label, undefined, 'built-ins carry no hard-coded label');
			assert.ok(en.operators[op.name] && zhCN.operators[op.name], `${dataType} ${op.name}`);
		}
});

test('English is the default; zh-CN switches UI text, operator labels and issue messages', () => {
	render(<AxcCondition fields={fields} value={value} onChange={() => {}} />);
	assert.ok(screen.getByRole('button', { name: 'Add rule' }));
	assert.ok(screen.getByRole('option', { name: 'contains' }));
	assert.equal(screen.getByRole('alert').textContent, 'Required.');
	cleanup();
	render(
		<AxcUIProvider locale={zhCN}>
			<AxcCondition fields={fields} value={value} onChange={() => {}} />
		</AxcUIProvider>,
	);
	assert.ok(screen.getByRole('button', { name: '添加条件' }));
	assert.ok(screen.getByRole('option', { name: '包含' }));
	assert.equal(screen.getByRole('alert').textContent, '必填');
});

test('hosts override single strings, nested providers inherit the locale, custom operator labels win', () => {
	const custom: AxcLocale = {
		...en,
		ui: { ...en.ui, addRule: 'Add filter' },
		issues: { ...en.issues, required: () => 'Fill this in' },
	};
	render(
		<AxcUIProvider locale={custom}>
			<AxcUIProvider components={{}}>
				<AxcCondition
					fields={[
						{ name: 'title', label: 'Title', operators: [{ name: 'contains', valueShape: 'scalar', label: 'has' }] },
					]}
					value={value}
					onChange={() => {}}
				/>
			</AxcUIProvider>
		</AxcUIProvider>,
	);
	assert.ok(screen.getByRole('button', { name: 'Add filter' }));
	assert.ok(screen.getByRole('option', { name: 'has' }));
	assert.equal(screen.getByRole('alert').textContent, 'Fill this in');
});

test('the decision editor and ai.* field labels follow the locale', () => {
	render(
		<AxcUIProvider locale={zhCN}>
			<AxcDecision
				fields={fields}
				models={[]}
				value={{
					...emptyDecision(),
					postcondition: {
						combinator: 'and',
						not: false,
						rules: [{ field: 'ai.matched', operator: '=', value: true }],
					},
				}}
				onChange={() => {}}
			/>
		</AxcUIProvider>,
	);
	assert.ok(screen.getByRole('checkbox', { name: '前置条件' }));
	assert.ok(screen.getByRole('option', { name: 'AI · 是否符合' }));
	assert.ok(screen.getAllByText('至少添加一项').length > 0, 'input_fields issue is localized');
});
