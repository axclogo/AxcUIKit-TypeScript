import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { DataAnalysisTable, type AnalysisConfig, type DataAnalysisField } from '../src/index.js';

afterEach(cleanup);
const rows = [
	{ id: 1, meta: { title: 'First' }, count: 0, enabled: false, code: 2, date: '2026-01-02', at: '2026-01-02T10:15' },
	{ id: 2, meta: { title: 'Second' }, count: 1, enabled: true, code: 3, date: '2026-02-02', at: '2026-02-02T10:15' },
];
const fields: DataAnalysisField[] = [
	{ name: 'title', label: 'Title', dataType: 'string', options: [], colorable: true },
	{ name: 'count', label: 'Count', dataType: 'number', options: [], colorable: true },
	{ name: 'enabled', label: 'Enabled', dataType: 'boolean', colorable: true },
	{ name: 'code', label: 'Code', dataType: 'enum', options: [{ value: 2, label: 'Open' }], colorable: true },
	{ name: 'date', label: 'Date', dataType: 'date', options: [], colorable: true },
	{ name: 'at', label: 'Time', dataType: 'datetime', colorable: true },
];
const initial: AnalysisConfig = {
	keyword: '',
	condition: null,
	sorters: [],
	columns: { order: [], visible: ['id'], widths: {}, fixed: {} },
	rowHeight: 'normal',
	colorRules: [],
};
function setup() {
	const updates: AnalysisConfig[] = [];
	function Table() {
		const [config, setConfig] = useState(initial);
		return (
			<DataAnalysisTable
				rows={rows}
				rowKey="id"
				columns={[{ key: 'id' }, { key: 'title', dataIndex: ['meta', 'title'] }]}
				fields={fields}
				config={config}
				onConfigChange={(c) => {
					updates.push(c);
					setConfig(c);
				}}
			/>
		);
	}
	const view = render(<Table />);
	const click = (name: string | RegExp) => fireEvent.click(view.getByRole('button', { name }));
	const marked = () =>
		Array.from(view.container.querySelectorAll('tr[data-color]'), (tr) => [
			tr.textContent,
			tr.getAttribute('data-color'),
		]);
	click('Color rules');
	return { view, click, marked, updates };
}
test('select, apply, recolor and remove a rule on a hidden nested field', () => {
	const { view, click, marked, updates } = setup();
	assert.equal(view.getAllByRole('radio').length, 5);
	fireEvent.change(view.getByRole('textbox', { name: 'Value' }), { target: { value: 'First' } });
	fireEvent.click(view.getByRole('radio', { name: 'Green' }));
	click('Confirm');
	assert.deepEqual(marked(), [['1', 'green']]);
	const id = updates[0].colorRules[0].id;
	click('Color rules');
	assert.ok(view.getByRole('img', { name: 'Green' }));
	click(/^Edit Title/);
	assert.ok(view.getByRole('radio', { name: 'Green', checked: true }));
	fireEvent.click(view.getByRole('radio', { name: 'Blue' }));
	click('Save');
	assert.deepEqual(marked(), [['1', 'blue']]);
	assert.equal(updates[1].colorRules[0].id, id);
	click('Confirm');
	assert.equal(updates.length, 2);
	click('Color rules');
	click(/^Remove Title/);
	assert.deepEqual(marked(), []);
});
test('field inputs retain zero, false, enum IDs and date values and preserve first-match priority', () => {
	const { view, click, marked, updates } = setup();
	for (const [i, value, expected] of [
		[1, '0', 0],
		[2, '1', false],
		[3, '0', 2],
		[4, '2026-01-02', '2026-01-02'],
		[5, '2026-01-02T10:15', '2026-01-02T10:15'],
	] as const) {
		fireEvent.change(view.getByRole('combobox', { name: 'Field' }), { target: { value: String(i) } });
		fireEvent.change(view.getByLabelText('Value'), { target: { value } });
		fireEvent.click(view.getByRole('radio', { name: i === 1 ? 'Orange' : 'Blue' }));
		click('Add');
		assert.equal(updates.at(-1)?.colorRules.at(-1)?.value, expected);
		assert.deepEqual(marked(), [['1', 'orange']]);
	}
	click(/^Remove Count/);
	assert.deepEqual(marked(), [['1', 'blue']]);
	click('Confirm');
	assert.equal(updates.length, 6);
});
