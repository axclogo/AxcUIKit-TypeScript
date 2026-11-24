import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	AxcCondition,
	AxcDecision,
	AxcUIProvider,
	emptyDecision,
	type AxcConditionValue,
	type AxcModelSelectProps,
	type AxcDecisionValue,
	type AxcUIComponents,
	type ConditionField,
} from '../src/index.js';

process.env.TZ = 'UTC';
afterEach(cleanup);

const fields: ConditionField[] = [
	{ name: 'title', label: 'Title' },
	{ name: 'count', label: 'Count', dataType: 'number' },
	{ name: 'at', label: 'At', dataType: 'datetime' },
	{ name: 'meta', label: 'Meta', dataType: 'object' },
	{
		name: 'tags',
		label: 'Tags',
		dataType: 'array',
		values: [
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'B' },
		],
	},
	{ name: 'words', label: 'Words', dataType: 'array' },
];
const value: AxcConditionValue = {
	combinator: 'or',
	not: false,
	rules: [
		{ field: 'title', operator: 'contains', value: 'x' },
		{ field: 'count', operator: '=', value: 0 },
		{ field: 'at', operator: '=', value: '2026-11-18T10:00:00Z' },
		{ field: 'meta', operator: 'contains', value: 'm' },
		{ field: 'tags', operator: 'hasAny', value: ['a'] },
		{ combinator: 'and', not: false, rules: [{ field: 'title', operator: 'in', value: ['w'] }] },
	],
};

type Recorded = { kind: keyof AxcUIComponents; props: Record<string, unknown> };
/** Adapters that render no native elements and record every prop they receive. */
function recording() {
	const seen: Recorded[] = [];
	const make =
		(kind: keyof AxcUIComponents) =>
		(props: Record<string, unknown>): React.ReactElement => {
			seen.push({ kind, props });
			return (
				<span className={props.className as string} data-kind={kind} data-label={(props.label as string) ?? ''}>
					{props.children as React.ReactNode}
				</span>
			);
		};
	const kinds: Array<keyof AxcUIComponents> = [
		'Button',
		'Input',
		'TextArea',
		'Select',
		'MultiSelect',
		'Checkbox',
		'Tags',
		'DateInput',
	];
	const components = Object.fromEntries(kinds.map((kind) => [kind, make(kind)])) as unknown as AxcUIComponents;
	const latest = (kind: keyof AxcUIComponents, label?: string) =>
		[...seen].reverse().find((item) => item.kind === kind && (label === undefined || item.props.label === label))!
			.props;
	return { components, seen, latest };
}

function Host({ components, log }: { components: AxcUIComponents; log: AxcConditionValue[] }) {
	const [current, setCurrent] = useState(value);
	return (
		<AxcUIProvider components={components}>
			<AxcCondition fields={fields} value={current} onChange={(next) => (log.push(next), setCurrent(next))} />
		</AxcUIProvider>
	);
}

test('with all eight adapters injected, no native control remains and values keep their protocol types', () => {
	const { components, seen, latest } = recording();
	const log: AxcConditionValue[] = [];
	const { container } = render(<Host components={components} log={log} />);
	assert.equal(latest('Input', 'Count value').value, '0', 'Input receives string drafts');
	assert.equal(container.querySelectorAll('input, select, textarea, button').length, 0);
	assert.deepEqual(
		new Set(seen.map((item) => item.kind)),
		new Set(['Button', 'Input', 'TextArea', 'Select', 'MultiSelect', 'Checkbox', 'Tags', 'DateInput']),
	);
	for (const { kind, props } of seen) {
		assert.match(String(props.className), /^axc-[a-z-]+$/, `${kind} gets a stable layout class`);
		if (kind !== 'Button') assert.equal(typeof props.label, 'string', `${kind} has a label`);
	}
	act(() => (latest('Input', 'Count value').onChange as (v: string) => void)('abc'));
	assert.equal(latest('Input', 'Count value').invalid, true, 'adapters receive invalid');
	assert.equal(typeof latest('Input', 'Count value').describedBy, 'string');
	assert.equal(latest('Select', 'Field').invalid, undefined);
	const rule = (index: number) => log.at(-1)!.rules[index] as { value: unknown };
	act(() => (latest('Input', 'Count value').onChange as (v: string) => void)('12.5'));
	assert.equal(rule(1).value, 12.5);
	assert.equal(latest('DateInput').value, '2026-11-18T10:00:00', 'local wall-clock string');
	act(() => (latest('DateInput').onChange as (v: string) => void)('2026-11-19T08:30:00'));
	assert.equal(rule(2).value, '2026-11-19T08:30:00.000Z');
	act(() => (latest('MultiSelect').onChange as (v: string[]) => void)(['a', 'b']));
	assert.deepEqual(rule(4).value, ['a', 'b']);
	act(() => (latest('Checkbox').onChange as (v: boolean) => void)(true));
	assert.equal((log.at(-1)!.rules[5] as AxcConditionValue).not, true, 'last rendered checkbox is the nested group');
	act(() => (latest('TextArea').onChange as (v: string) => void)('{"k":1}'));
	assert.equal(rule(3).value, '{"k":1}');
	act(() => (latest('Tags').onChange as (v: string[]) => void)(['p', ' ', 'p', 'q r']));
	const nested = log.at(-1)!.rules[5] as AxcConditionValue;
	assert.deepEqual(
		(nested.rules[0] as { value: unknown }).value,
		['p', 'q r'],
		'Axc drops blanks and duplicates from any Tags adapter',
	);
});

test('readOnly and disabled reach adapters as disabled, including nested and decision editors', () => {
	for (const flag of ['readOnly', 'disabled'] as const) {
		const { components, seen } = recording();
		render(
			<AxcUIProvider components={components}>
				<AxcCondition fields={fields} value={value} onChange={() => {}} {...{ [flag]: true }} />
				<AxcDecision
					fields={fields}
					models={[]}
					value={{
						...emptyDecision(),
						precondition: value,
						outputs: [{ name: 'k', label: 'K', type: 'enum', options: [] }],
					}}
					onChange={() => {}}
					{...{ [flag]: true }}
				/>
			</AxcUIProvider>,
		);
		const controls = seen.filter((item) => item.kind !== 'Button');
		assert.ok(controls.length > 10);
		assert.ok(
			controls.every((item) => item.props.disabled === true),
			flag,
		);
		if (flag === 'readOnly') assert.equal(seen.filter((item) => item.kind === 'Button').length, 0);
		cleanup();
	}
});

test('providers override partially, nest by inheritance, and do not leak into siblings', () => {
	const Marked = (mark: string) => (props: { children: React.ReactNode; onClick: () => void }) => (
		<button type="button" data-mark={mark} onClick={props.onClick}>
			{props.children}
		</button>
	);
	const Outer = Marked('outer');
	const Inner = Marked('inner');
	const simple: AxcConditionValue = {
		combinator: 'and',
		not: false,
		rules: [{ field: 'title', operator: '=', value: 'x' }],
	};
	const { container } = render(
		<>
			<AxcUIProvider components={{ Button: Outer }}>
				<div id="outer">
					<AxcCondition fields={fields} value={simple} onChange={() => {}} />
				</div>
				<AxcUIProvider
					components={{ Input: (p) => <textarea aria-label={p.label} value={p.value} onChange={() => {}} /> }}
				>
					<div id="nested">
						<AxcCondition fields={fields} value={simple} onChange={() => {}} />
					</div>
				</AxcUIProvider>
				<AxcUIProvider components={{ Button: Inner }}>
					<div id="inner">
						<AxcCondition fields={fields} value={simple} onChange={() => {}} />
					</div>
				</AxcUIProvider>
			</AxcUIProvider>
			<div id="sibling">
				<AxcCondition fields={fields} value={simple} onChange={() => {}} />
			</div>
		</>,
	);
	const marks = (id: string) =>
		[...container.querySelectorAll(`#${id} button`)].map((b) => b.getAttribute('data-mark'));
	assert.ok(marks('outer').every((m) => m === 'outer'));
	assert.ok(
		marks('nested').every((m) => m === 'outer'),
		'inherits Button from the outer provider',
	);
	assert.equal(container.querySelector('#nested textarea')?.getAttribute('aria-label'), 'Title value');
	assert.ok(marks('inner').every((m) => m === 'inner'));
	assert.ok(
		marks('sibling').every((m) => m === null),
		'outside any provider: native controls',
	);
});

test('native controls honour the contract: non-submit buttons, label as name, className on root, disabled is inert', () => {
	let submitted = 0;
	const log: AxcDecisionValue[] = [];
	function DecisionHost() {
		const [current, setCurrent] = useState<AxcDecisionValue>({ ...emptyDecision(), precondition: value });
		return (
			<AxcDecision
				fields={fields}
				models={[]}
				value={current}
				onChange={(next) => (log.push(next), setCurrent(next))}
			/>
		);
	}
	const { container } = render(
		<form onSubmit={(event) => (event.preventDefault(), submitted++)}>
			<DecisionHost />
		</form>,
	);
	const buttons = [...container.querySelectorAll('button')];
	assert.ok(buttons.length > 5);
	assert.ok(buttons.every((button) => button.type === 'button'));
	fireEvent.click(screen.getAllByRole('button', { name: 'Add rule' })[0]);
	fireEvent.click(screen.getByRole('button', { name: 'Add output' }));
	assert.equal(submitted, 0);
	assert.equal(log.length, 2);
	// Accessible names come from `label`.
	assert.ok(screen.getByRole('checkbox', { name: 'Precondition' }));
	assert.ok(screen.getByRole('listbox', { name: 'Input fields' }));
	assert.ok(screen.getByRole('group', { name: 'Title value' }));
	// className lands on the root element of each control.
	for (const className of [
		'axc-select',
		'axc-checkbox',
		'axc-tags',
		'axc-date-input',
		'axc-textarea',
		'axc-input',
		'axc-button',
	])
		assert.ok(container.querySelector(`.${className}`), className);
	assert.ok(container.querySelector('.axc-native-select.axc-select'), 'searchable select: class on the wrapper');
	assert.ok(container.querySelector('label.axc-checkbox > input[type="checkbox"]'));
	cleanup();
	render(
		<AxcCondition fields={fields} value={value} disabled onChange={() => assert.fail('disabled control fired')} />,
	);
	for (const button of screen.getAllByRole('button')) fireEvent.click(button);
});

test('model adapter receives original metadata and decision values without label parsing', () => {
	const models = [{ id: 'opaque/id', label: 'model / label', provider: 'provider / label' }];
	let received: AxcModelSelectProps | undefined;
	const ModelSelect = (props: AxcModelSelectProps) => {
		received = props;
		return <span data-testid="host-model" className={props.className} />;
	};
	const changes: AxcDecisionValue[] = [];
	const current = { ...emptyDecision(), model: 'opaque/id' };
	const { rerender } = render(
		<AxcUIProvider components={{ ModelSelect }}>
			<AxcDecision fields={fields} value={current} models={models} onChange={(next) => changes.push(next)} />
		</AxcUIProvider>,
	);
	assert.deepEqual(received?.models, models);
	assert.equal(received?.value, 'opaque/id');
	assert.match(received?.className ?? '', /axc-select/);
	act(() => received?.onChange(null));
	assert.equal(changes[0].model, null);
	rerender(
		<AxcUIProvider components={{ ModelSelect }}>
			<AxcDecision fields={fields} value={emptyDecision()} models={models} onChange={() => {}} disabled />
		</AxcUIProvider>,
	);
	assert.equal(received?.disabled, true);
	assert.equal(received?.invalid, true);
	assert.ok(received?.describedBy);
});
