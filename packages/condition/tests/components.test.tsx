import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
	AxcCondition,
	AxcDecision,
	AxcUIProvider,
	emptyDecision,
	type AxcConditionValue,
	type AxcDecisionValue,
	type AxcInputProps,
	type ConditionField,
} from '../src/index.js';

process.env.TZ = 'Asia/Shanghai';
afterEach(cleanup);

const fields: ConditionField[] = [
	{ name: 'title', label: 'Title' },
	{ name: 'body', label: 'Body' },
	{ name: 'count', label: 'Count', dataType: 'number' },
	{ name: 'on', label: 'On', dataType: 'boolean' },
	{ name: 'at', label: 'At', dataType: 'datetime' },
	{ name: 'a', label: 'A', dataType: 'number', valueSources: ['field'] },
	{ name: 'b', label: 'B', dataType: 'number' },
];
const group = (...rules: AxcConditionValue['rules']): AxcConditionValue => ({ combinator: 'or', not: false, rules });

/** A host that stores whatever the editor emits; `clone` simulates hosts that copy values (e.g. via JSON). */
function Host({
	initial,
	log,
	clone = false,
}: {
	initial: AxcConditionValue;
	log?: AxcConditionValue[];
	clone?: boolean;
}) {
	const [value, setValue] = useState(initial);
	return (
		<AxcCondition
			fields={fields}
			value={value}
			onChange={(next) => {
				log?.push(next);
				setValue(clone ? structuredClone(next) : next);
			}}
		/>
	);
}
const rows = () => [...document.querySelectorAll<HTMLElement>('.axc-rule')];
const searchBox = (row: HTMLElement) =>
	within(row).getByRole('searchbox', { name: 'Search Field' }) as HTMLInputElement;

test('regression #3: deleting a middle row does not hand its local state to the next row', () => {
	render(
		<Host
			initial={group(
				{ field: 'title', operator: '=', value: 'one' },
				{ field: 'body', operator: '=', value: 'two' },
				{ field: 'title', operator: '=', value: 'three' },
			)}
		/>,
	);
	fireEvent.change(searchBox(rows()[1]), { target: { value: 'typed in row 2' } });
	fireEvent.change(searchBox(rows()[2]), { target: { value: 'typed in row 3' } });
	fireEvent.click(within(rows()[1]).getByRole('button', { name: 'Remove rule' }));
	assert.equal(rows().length, 2);
	assert.equal(searchBox(rows()[0]).value, '');
	assert.equal(searchBox(rows()[1]).value, 'typed in row 3', 'row 3 keeps its own state');
	assert.equal((within(rows()[1]).getByRole('textbox', { name: 'Title value' }) as HTMLInputElement).value, 'three');
});

test('stable keys: nested groups keep their state; hosts that clone values get a reset, never a leak', () => {
	render(
		<Host
			initial={group(
				group({ field: 'title', operator: '=', value: 'g1' }),
				group({ field: 'body', operator: '=', value: 'g2' }),
			)}
		/>,
	);
	fireEvent.change(searchBox(rows()[1]), { target: { value: 'kept' } });
	fireEvent.click(screen.getAllByRole('button', { name: 'Remove group' })[0]);
	assert.equal(searchBox(rows()[0]).value, 'kept');
	cleanup();
	render(
		<Host
			clone
			initial={group({ field: 'title', operator: '=', value: 'a' }, { field: 'body', operator: '=', value: 'b' })}
		/>,
	);
	fireEvent.change(searchBox(rows()[0]), { target: { value: 'deleted row' } });
	fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Remove rule' }));
	assert.equal(searchBox(rows()[0]).value, '');
	// Same length after an in-place edit keeps keys even when the host clones.
	fireEvent.change(searchBox(rows()[0]), { target: { value: 'still here' } });
	fireEvent.change(within(rows()[0]).getByRole('textbox', { name: 'Body value' }), { target: { value: 'edited' } });
	assert.equal(searchBox(rows()[0]).value, 'still here');
});

test('stable keys for decision outputs: deleting an output keeps the next output’s tag draft', () => {
	function DecisionHost() {
		const [value, setValue] = useState<AxcDecisionValue>({
			...emptyDecision(),
			outputs: [
				{ name: 'first', label: 'First', type: 'enum', options: ['x'] },
				{ name: 'second', label: 'Second', type: 'enum', options: ['y'] },
			],
		});
		return <AxcDecision fields={fields} models={[]} value={value} onChange={setValue} />;
	}
	render(<DecisionHost />);
	fireEvent.change(screen.getByRole('textbox', { name: 'Add to Output 2 options' }), { target: { value: 'draft' } });
	fireEvent.click(screen.getAllByRole('button', { name: 'Remove output' })[0]);
	assert.equal((screen.getByRole('textbox', { name: 'Output 1 name' }) as HTMLInputElement).value, 'second');
	assert.equal((screen.getByRole('textbox', { name: 'Add to Output 1 options' }) as HTMLInputElement).value, 'draft');
});

test('regression #5: changing an operator to contains never merges rows', () => {
	const log: AxcConditionValue[] = [];
	render(
		<Host
			log={log}
			initial={group(
				{ field: 'title', operator: 'contains', value: 'a' },
				{ field: 'title', operator: '=', value: 'b' },
			)}
		/>,
	);
	assert.equal(rows().length, 2);
	fireEvent.change(within(rows()[1]).getByRole('combobox', { name: 'Operator' }), { target: { value: 'contains' } });
	assert.equal(rows().length, 2);
	assert.deepEqual(log.at(-1)!.rules, [
		{ field: 'title', operator: 'contains', value: 'a' },
		{ field: 'title', operator: 'contains', value: '' },
	]);
	assert.equal(screen.queryByRole('button', { name: /edit/i }), null, 'no hidden mode switch');
});

test('issues are shown next to the row they belong to', () => {
	render(
		<Host
			initial={group(
				{ field: 'title', operator: '=', value: 'ok' },
				{ field: 'count', operator: 'between', value: [3, 1] },
				group(),
			)}
		/>,
	);
	assert.equal(within(rows()[0]).queryByRole('alert'), null);
	assert.equal(within(rows()[1]).getByRole('alert').textContent, 'The lower bound is greater than the upper bound.');
	const nested = document.querySelector('.axc-subgroup .axc-group') as HTMLElement;
	assert.equal(within(nested).getByRole('alert').textContent, 'Add at least one item.');
	cleanup();
	render(<Host initial={group()} />);
	assert.equal(screen.getByRole('alert').textContent, 'Add at least one item.');
	cleanup();
	render(<AxcCondition fields={fields} allowEmpty value={group()} onChange={() => {}} />);
	assert.equal(screen.queryByRole('alert'), null);
});

/** Text input adapter so tests can send strings a native number input would sanitize. */
const TextInput = ({ label, value, onChange }: AxcInputProps) => (
	<input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
);

test('regression #8: number drafts are parsed strictly', () => {
	const log: AxcConditionValue[] = [];
	render(
		<AxcUIProvider components={{ Input: TextInput }}>
			<Host log={log} initial={group({ field: 'count', operator: '=', value: '' })} />
		</AxcUIProvider>,
	);
	const box = screen.getByRole('textbox', { name: 'Count value' });
	const emitted = (text: string) => (
		fireEvent.change(box, { target: { value: text } }),
		(log.at(-1)!.rules[0] as { value: unknown }).value
	);
	assert.equal(emitted(' '), ' ');
	assert.equal(screen.getByRole('alert').textContent, 'Must be a number.');
	assert.equal(emitted('0x10'), '0x10');
	assert.equal(emitted('Infinity'), 'Infinity');
	assert.equal(emitted('1e3'), 1000);
	assert.equal(emitted('-0.5'), -0.5);
	assert.equal(emitted('0'), 0);
	assert.equal(screen.queryByRole('alert'), null);
	assert.equal(emitted(''), '');
	assert.equal(screen.getByRole('alert').textContent, 'Must be a number.');
});

test('field and operator changes produce typed drafts; datetimes round-trip through local time', () => {
	const log: AxcConditionValue[] = [];
	render(<Host log={log} initial={group({ field: 'title', operator: '=', value: 'x' })} />);
	const last = () => log.at(-1)!.rules[0];
	fireEvent.change(screen.getByRole('combobox', { name: 'Field' }), { target: { value: 'on' } });
	assert.deepEqual(last(), { field: 'on', operator: '=', value: false });
	fireEvent.change(screen.getByRole('combobox', { name: 'Field' }), { target: { value: 'count' } });
	fireEvent.change(screen.getByRole('combobox', { name: 'Operator' }), { target: { value: 'between' } });
	assert.deepEqual(last(), { field: 'count', operator: 'between', value: ['', ''] });
	fireEvent.change(screen.getByRole('combobox', { name: 'Operator' }), { target: { value: 'null' } });
	assert.deepEqual(last(), { field: 'count', operator: 'null', value: null });
	fireEvent.change(screen.getByRole('combobox', { name: 'Field' }), { target: { value: 'at' } });
	const input = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
	fireEvent.change(input, { target: { value: '2026-11-18T10:00:00' } });
	assert.deepEqual(last(), { field: 'at', operator: '=', value: '2026-11-18T02:00:00.000Z' });
	// The DOM may normalize away ":00" seconds; the protocol value above is what matters.
	assert.match((document.querySelector('input[type="datetime-local"]') as HTMLInputElement).value, /^2026-11-18T10:00/);
});

test('reference-only fields keep the reference across operator changes', () => {
	const log: AxcConditionValue[] = [];
	render(<Host log={log} initial={group({ field: 'a', operator: '=', value: 'b', valueSource: 'field' })} />);
	assert.equal(screen.queryByRole('combobox', { name: 'Value source' }), null);
	fireEvent.change(screen.getByRole('combobox', { name: 'Operator' }), { target: { value: '>' } });
	assert.deepEqual(log.at(-1)!.rules[0], { field: 'a', operator: '>', value: 'b', valueSource: 'field' });
	fireEvent.change(screen.getByRole('combobox', { name: 'Operator' }), { target: { value: 'null' } });
	fireEvent.change(screen.getByRole('combobox', { name: 'Operator' }), { target: { value: '=' } });
	assert.deepEqual(log.at(-1)!.rules[0], { field: 'a', operator: '=', value: '', valueSource: 'field' });
});

test('readOnly, disabled and missing onChange lock every control', () => {
	const value = group(
		{ field: 'title', operator: '=', value: 'x' },
		group({ field: 'body', operator: '=', value: 'y' }),
	);
	const controls = () => [...document.querySelectorAll<HTMLInputElement>('input, select, textarea, button')];
	render(<AxcCondition fields={fields} value={value} readOnly onChange={() => assert.fail('no writes')} />);
	assert.equal(screen.queryByRole('button'), null, 'readOnly hides add/remove');
	assert.ok(controls().every((node) => node.disabled));
	cleanup();
	render(<AxcCondition fields={fields} value={value} disabled onChange={() => assert.fail('no writes')} />);
	assert.ok(screen.getAllByRole('button').length > 0, 'disabled keeps the layout');
	assert.ok(controls().every((node) => node.disabled));
	cleanup();
	render(<AxcCondition fields={fields} value={value} />);
	assert.ok(controls().every((node) => node.disabled));
});

test('allowNot: false hides negation in every group but keeps AND/OR', () => {
	render(
		<AxcCondition
			fields={fields}
			allowNot={false}
			value={group(group({ field: 'title', operator: '=', value: 'x' }))}
			onChange={() => {}}
		/>,
	);
	assert.equal(screen.queryByRole('checkbox', { name: 'NOT' }), null);
	assert.equal(screen.getAllByRole('combobox', { name: 'Group operator' }).length, 2);
});

test('add rule, add group (up to maxLevels) and negate', () => {
	const log: AxcConditionValue[] = [];
	function Limited() {
		const [value, setValue] = useState(group({ field: 'title', operator: '=', value: 'x' }));
		return (
			<AxcCondition fields={fields} maxLevels={2} value={value} onChange={(next) => (log.push(next), setValue(next))} />
		);
	}
	render(<Limited />);
	fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
	assert.deepEqual(log.at(-1)!.rules[1], { field: 'title', operator: '=', value: '' });
	fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
	const [, nested] = screen.getAllByRole('button', { name: 'Add group' }) as HTMLButtonElement[];
	assert.equal(nested.disabled, true, 'depth 2 of 2');
	fireEvent.click(screen.getAllByRole('checkbox', { name: 'NOT' })[0]);
	assert.equal(log.at(-1)!.not, true);
});

test('Tags: Enter commits, IME composition does not, paste splits lines only, blanks and duplicates drop', () => {
	const log: AxcConditionValue[] = [];
	render(<Host log={log} initial={group({ field: 'title', operator: 'in', value: ['a'] })} />);
	const input = screen.getByRole('textbox', { name: 'Add to Title value' });
	fireEvent.change(input, { target: { value: 'b, c' } });
	fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
	assert.equal(log.length, 0);
	fireEvent.keyDown(input, { key: 'Enter' });
	assert.deepEqual(log.at(-1)!.rules[0], { field: 'title', operator: 'in', value: ['a', 'b, c'] });
	fireEvent.paste(input, { clipboardData: { getData: () => 'd e\n\na\r\nf' } });
	assert.deepEqual((log.at(-1)!.rules[0] as { value: unknown }).value, ['a', 'b, c', 'd e', 'f']);
	fireEvent.click(screen.getByRole('button', { name: 'Remove a' }));
	assert.deepEqual((log.at(-1)!.rules[0] as { value: unknown }).value, ['b, c', 'd e', 'f']);
});

test('a broken catalog fails loudly instead of rendering something half-working', () => {
	const bad = [
		{ name: 'n', label: 'N', dataType: 'number', values: [{ value: '1', label: '1' }] },
	] as unknown as ConditionField[];
	const original = console.error;
	console.error = () => {};
	try {
		assert.throws(() => render(<AxcCondition fields={bad} value={group()} />), TypeError);
	} finally {
		console.error = original;
	}
});

test('invalid controls are marked and point at their issue text', () => {
	render(
		<Host
			initial={group({ field: 'count', operator: '=', value: 'x' }, { field: 'title', operator: '=', value: 'ok' })}
		/>,
	);
	const bad = within(rows()[0]).getByRole('spinbutton', { name: 'Count value' });
	assert.equal(bad.getAttribute('aria-invalid'), 'true');
	const described = document.getElementById(bad.getAttribute('aria-describedby')!);
	assert.equal(described?.textContent, 'Must be a number.');
	assert.equal(within(rows()[0]).getByRole('combobox', { name: 'Field' }).getAttribute('aria-invalid'), null);
	assert.equal(within(rows()[1]).getByRole('textbox', { name: 'Title value' }).getAttribute('aria-invalid'), null);
	cleanup();
	render(
		<AxcDecision
			fields={fields}
			models={[{ id: 'm', label: 'M' }]}
			value={{ ...emptyDecision(), model: 'gone' }}
			onChange={() => {}}
		/>,
	);
	const model = screen.getByRole('combobox', { name: 'Decision model' });
	assert.equal(model.getAttribute('aria-invalid'), 'true');
	assert.equal(
		document.getElementById(model.getAttribute('aria-describedby')!)?.textContent,
		'"gone" is not an available option.',
	);
});
