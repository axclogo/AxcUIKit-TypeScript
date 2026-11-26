import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	AxcConditionSimulator,
	AxcUIProvider,
	zhCN,
	type AxcConditionEvidence,
	type AxcConditionSample,
	type AxcConditionSimulation,
	type AxcConditionSimulationExecutor,
	type AxcConditionValue,
	type ConditionField,
} from '../src/index.js';

afterEach(cleanup);

const fields: ConditionField[] = [
	{ name: 'score', label: 'Score', dataType: 'number' },
	{ name: 'country', label: 'Country' },
	{ name: 'vip', label: 'VIP', dataType: 'boolean' },
	{ name: 'status', label: 'Status', dataType: 'enum', values: [{ value: 'active', label: 'Active' }] },
];
const condition: AxcConditionValue = {
	combinator: 'and',
	not: false,
	rules: [
		{ field: 'score', operator: '>=', value: 80 },
		{
			combinator: 'or',
			not: true,
			rules: [
				{ field: 'country', operator: '=', value: 'US' },
				{ field: 'vip', operator: '=', value: true },
			],
		},
		{ field: 'status', operator: '=', value: 'active' },
	],
};
const samples: AxcConditionSample[] = [
	{ id: 'one', label: 'Record one', record: { score: 90, country: 'US', vip: true, status: 'active' } },
	{ id: 'two', label: 'Record two', record: { score: 70, country: 'CN', vip: false, status: 'active' } },
];
const blocked: AxcConditionSimulation = {
	matched: false,
	trace: {
		kind: 'group',
		path: [],
		combinator: 'and',
		negated: false,
		rawMatched: false,
		matched: false,
		shortCircuitAt: 1,
		children: [
			{ kind: 'rule', path: ['rules', 0], field: 'score', operator: '>=', matched: true },
			{
				kind: 'group',
				path: ['rules', 1],
				combinator: 'or',
				negated: true,
				rawMatched: true,
				matched: false,
				shortCircuitAt: 0,
				children: [
					{ kind: 'rule', path: ['rules', 1, 'rules', 0], field: 'country', operator: '=', matched: true },
					{ kind: 'skipped', path: ['rules', 1, 'rules', 1], reason: 'orShortCircuit' },
				],
			},
			{ kind: 'skipped', path: ['rules', 2], reason: 'andShortCircuit' },
		],
	},
	decisiveRules: [{ path: ['rules', 1, 'rules', 0], matched: true }],
};

function Controlled({
	simulate,
	value = condition,
	onEvidence,
	onResult,
	onError,
}: {
	simulate: AxcConditionSimulationExecutor;
	value?: AxcConditionValue;
	onEvidence?: (evidence: AxcConditionEvidence) => void;
	onResult?: (result: AxcConditionSimulation, sample: AxcConditionSample) => void;
	onError?: (error: unknown, sample: AxcConditionSample) => void;
}) {
	const [selected, setSelected] = useState<string | null>('one');
	return (
		<AxcConditionSimulator
			fields={fields}
			value={value}
			samples={samples}
			selectedSampleId={selected}
			onSelectedSampleIdChange={setSelected}
			simulate={simulate}
			onEvidence={onEvidence}
			onResult={onResult}
			onError={onError}
		/>
	);
}

test('runs @axclogo/eval with the selected record and shows the decisive rule and exact short-circuit trace', () => {
	const calls: unknown[][] = [];
	const evidence: AxcConditionEvidence = {
		snapshotId: 'snapshot',
		kind: 'condition',
		input: { operation: 'simulate' },
		outcome: { status: 'succeeded', result: blocked },
	};
	const seenEvidence: AxcConditionEvidence[] = [];
	const results: Array<[AxcConditionSimulation, AxcConditionSample]> = [];
	const simulate: AxcConditionSimulationExecutor = (...args) => {
		calls.push(args);
		args[4]?.(evidence);
		return blocked;
	};
	render(
		<Controlled
			simulate={simulate}
			onEvidence={(item) => seenEvidence.push(item)}
			onResult={(result, sample) => results.push([result, sample])}
		/>,
	);
	fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
	assert.equal(calls.length, 1);
	assert.equal(calls[0][0], condition);
	assert.deepEqual(calls[0][1], { fields, maxLevels: undefined, allowNot: undefined });
	assert.equal(calls[0][2], samples[0].record);
	assert.equal(calls[0][3], false);
	assert.deepEqual(seenEvidence, [evidence]);
	assert.deepEqual(results, [[blocked, samples[0]]]);
	assert.equal(screen.getByRole('status').textContent, 'Not matched');
	const text = document.body.textContent ?? '';
	assert.match(text, /Decisive conditions/);
	assert.match(text, /Country · equals · passed/);
	assert.match(text, /negated group/);
	assert.match(text, /stopped at child 2/);
	assert.match(text, /skipped after an OR condition passed/);
	assert.match(text, /skipped after an AND condition blocked/);

	fireEvent.change(screen.getByRole('combobox', { name: 'Simulation sample' }), { target: { value: 'two' } });
	assert.equal(screen.queryByRole('status'), null, 'changing the selected record hides the stale result');
	fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
	assert.equal(calls[1][2], samples[1].record);
});

test('shows successful empty and skipped-group traces without inventing decisive rules', () => {
	const value: AxcConditionValue = {
		combinator: 'or',
		not: false,
		rules: [condition.rules[0], condition.rules[1]],
	};
	const result: AxcConditionSimulation = {
		matched: true,
		trace: {
			kind: 'group',
			path: [],
			combinator: 'or',
			negated: false,
			rawMatched: true,
			matched: true,
			children: [
				{ kind: 'rule', path: ['rules', 0], field: 'score', operator: '>=', matched: true },
				{ kind: 'skipped', path: ['rules', 1], reason: 'orShortCircuit' },
			],
		},
		decisiveRules: [],
	};
	render(<Controlled value={value} simulate={() => result} />);
	fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
	assert.equal(screen.getByRole('status').textContent, 'Matched');
	assert.match(document.body.textContent ?? '', /No rule was needed to determine the result/);
	assert.match(document.body.textContent ?? '', /group · skipped after an OR condition passed/);
});

test('surfaces evaluator failures and forwards the original thrown value', () => {
	const failures: Array<[unknown, AxcConditionSample]> = [];
	const structured = { kind: 'recordType', field: 'score', expected: 'number' };
	const { rerender } = render(
		<Controlled
			simulate={() => {
				throw structured;
			}}
			onError={(error, sample) => failures.push([error, sample])}
		/>,
	);
	fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
	assert.match(screen.getByRole('alert').textContent ?? '', /"kind":"recordType"/);
	assert.deepEqual(failures, [[structured, samples[0]]]);

	rerender(
		<Controlled
			simulate={() => {
				throw new Error('WASM unavailable');
			}}
		/>,
	);
	fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
	assert.equal(screen.getByRole('alert').textContent, 'Simulation failed: WASM unavailable');

	rerender(
		<Controlled
			simulate={() => {
				throw undefined;
			}}
		/>,
	);
	fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
	assert.equal(screen.getByRole('alert').textContent, 'Simulation failed: undefined');
});

test('keeps selection controlled, represents missing samples explicitly, and rejects ambiguous ids', () => {
	const simulate = () => blocked;
	const { rerender } = render(
		<AxcConditionSimulator
			fields={fields}
			value={condition}
			samples={[]}
			selectedSampleId={null}
			simulate={simulate}
		/>,
	);
	assert.equal(screen.getByRole('combobox').hasAttribute('disabled'), true);
	assert.equal(screen.getByRole('button').hasAttribute('disabled'), true);
	assert.ok(screen.getByRole('option', { name: 'Select a sample' }));

	rerender(
		<AxcConditionSimulator
			fields={fields}
			value={condition}
			samples={samples}
			selectedSampleId="missing"
			onSelectedSampleIdChange={() => {}}
			simulate={simulate}
			disabled
		/>,
	);
	assert.ok(screen.getByRole('option', { name: 'Unknown sample: missing' }));
	assert.equal(screen.getByRole('button').hasAttribute('disabled'), true);

	assert.throws(
		() =>
			render(
				<AxcConditionSimulator
					fields={fields}
					value={condition}
					samples={[samples[0], { ...samples[1], id: 'one' }]}
					selectedSampleId="one"
					simulate={simulate}
				/>,
			),
		/Duplicate condition simulation sample id "one"/,
	);
	assert.throws(
		() =>
			render(
				<AxcConditionSimulator
					fields={fields}
					value={condition}
					samples={[{ ...samples[0], id: '' }]}
					selectedSampleId={null}
					simulate={simulate}
				/>,
			),
		/ids must not be empty/,
	);
});

test('uses the active locale for simulator controls and results', () => {
	render(
		<AxcUIProvider locale={zhCN}>
			<Controlled simulate={() => blocked} />
		</AxcUIProvider>,
	);
	fireEvent.click(screen.getByRole('button', { name: '模拟执行' }));
	assert.equal(screen.getByRole('status').textContent, '条件未通过');
	assert.ok(screen.getByRole('combobox', { name: '模拟数据' }));
});
