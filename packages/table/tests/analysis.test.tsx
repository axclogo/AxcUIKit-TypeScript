import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DataAnalysisTable, type AnalysisConfig } from '../src/index.js';
afterEach(cleanup);
const config: AnalysisConfig = {
	keyword: '',
	condition: null,
	columns: { order: ['id'], visible: ['id'], widths: {}, fixed: {} },
	sorters: [],
	rowHeight: 'normal',
	colorRules: [{ id: 'r', name: 'Rule', field: 'hidden', operator: '=', value: 'ok', color: 'green' }],
};
test('filter-only fields remain eligible for conditions, sorting and color; search drafts commit once', () => {
	const changes: AnalysisConfig[] = [];
	const view = render(
		<DataAnalysisTable
			config={config}
			rows={[{ id: 1, hidden: 'ok' }]}
			rowKey="id"
			columns={[{ key: 'id' }]}
			fields={[{ name: 'hidden', label: 'Hidden field', conditionable: true, sortable: true, dataType: 'string' }]}
			onConfigChange={(v) => changes.push(v)}
			searchMode="submit"
		/>,
	);
	assert.equal(view.getByText('1').closest('tr')?.dataset.color, 'green');
	assert.ok(view.getByRole('option', { name: 'Hidden field' }));
	fireEvent.click(view.getByRole('button', { name: 'Filters' }));
	assert.ok(view.getByRole('dialog'));
	fireEvent.click(view.getByText('Cancel'));
	assert.equal(changes.length, 0);
	fireEvent.change(view.getByRole('textbox', { name: 'Search' }), { target: { value: 'coffee' } });
	assert.equal(changes.length, 0);
	fireEvent.click(view.getByRole('button', { name: 'Search' }));
	assert.equal(changes[0].keyword, 'coffee');
});

test('settings, sort, row height, colors, pagination and condition editing follow controlled inputs', () => {
	const updates: AnalysisConfig[] = [];
	const pages: number[] = [];
	const props = {
		rowKey: 'id' as const,
		rows: [{ id: 1, title: 'x', hidden: 'ok' }],
		columns: [{ key: 'id' }, { key: 'title' }],
		fields: [
			{ name: 'hidden', label: 'Hidden field', conditionable: true, sortable: true, dataType: 'string' as const },
		],
		onConfigChange: (v: AnalysisConfig) => updates.push(v),
		pagination: {
			page: 1,
			pageSize: 5,
			total: 20,
			onPageChange: (n: number) => pages.push(n),
			onPageSizeChange: () => {},
		},
	};
	const v = render(<DataAnalysisTable {...props} config={config} />);
	const btn = (name: string) => v.getByRole('button', { name });
	const select = (name: string, value: string) =>
		fireEvent.change(v.getByRole('combobox', { name }), { target: { value } });
	select('Sort field', '1');
	assert.deepEqual(updates.at(-1)?.sorters, [{ field: 'hidden', direction: 'desc' }]);
	v.rerender(<DataAnalysisTable {...props} config={updates.at(-1)!} />);
	select('Direction', '0');
	assert.deepEqual(updates.at(-1)?.sorters, [{ field: 'hidden', direction: 'asc' }]);
	select('Row height', '0');
	assert.equal(updates.at(-1)?.rowHeight, 'compact');
	fireEvent.click(btn('Next page'));
	assert.deepEqual(pages, [2]);
	fireEvent.click(btn('Columns'));
	fireEvent.click(btn('Show column title'));
	assert.deepEqual(updates.at(-1)?.columns.visible, ['id', 'title']);
	fireEvent.keyDown(btn('Move column title'), { key: 'ArrowUp' });
	assert.deepEqual(updates.at(-1)?.columns.order, ['title', 'id']);
	assert.deepEqual(updates.at(-1)?.colorRules, config.colorRules);
	fireEvent.click(btn('Confirm'));
	fireEvent.click(btn('Color rules'));
	fireEvent.click(btn('Remove Rule'));
	assert.deepEqual(updates.at(-1)?.colorRules, []);
	fireEvent.change(v.getByRole('textbox', { name: 'Value' }), { target: { value: 'abc' } });
	fireEvent.click(btn('Add'));
	assert.equal(updates.at(-1)?.colorRules.at(-1)?.value, 'abc');
	fireEvent.click(btn('Confirm'));
	fireEvent.click(btn('Filters'));
	fireEvent.click(btn('Confirm'));
	assert.equal(updates.at(-1)?.condition, null);
	fireEvent.click(btn('Filters'));
	fireEvent.click(btn('Add rule'));
	assert.ok(btn('Confirm').hasAttribute('disabled'));
	fireEvent.click(btn('Cancel'));
});
test('invalid field catalogs fail before an empty view renders', () => {
	const props = {
		columns: [],
		rows: [{ id: 1 }],
		rowKey: 'id' as const,
		config: { ...config, columns: { ...config.columns, order: [], visible: [] } },
		onConfigChange: () => {},
	};
	const f = { name: 'v', label: 'V', dataType: 'string' as const };
	assert.throws(() => render(<DataAnalysisTable {...props} fields={[f, f]} />), {
		name: 'TypeError',
		message: /field name/,
	});
	assert.throws(() => render(<DataAnalysisTable {...props} fields={[{ ...f, dataType: 'enum' }]} />), {
		name: 'TypeError',
		message: /options/,
	});
	// @ts-expect-error External field catalog uses an unsupported type.
	assert.throws(() => render(<DataAnalysisTable {...props} fields={[{ ...f, dataType: 'map' }]} />), {
		name: 'TypeError',
		message: /dataType/,
	});
});

test('an empty saved column selection tracks the catalog; resetting restores default order and preserves pins', () => {
	const changes: AnalysisConfig[] = [];
	const base = {
		...config,
		columns: {
			visible: [],
			order: [],
			widths: { id: 80, title: 95 },
			fixed: { id: 'left' as const, title: 'right' as const },
		},
	};
	const v = render(
		<DataAnalysisTable
			rows={[{ id: 1, title: 'Example' }]}
			rowKey="id"
			config={base}
			columns={[{ key: 'id', width: 90 }, { key: 'title' }]}
			fields={[]}
			defaultColumnKeys={[]}
			onConfigChange={(c) => changes.push(c)}
		/>,
	);
	assert.ok(v.getByRole('cell', { name: 'Example' }));
	fireEvent.click(v.getByRole('button', { name: 'Columns' }));
	fireEvent.click(v.getByRole('button', { name: 'Hide column id' }));
	assert.deepEqual(changes.at(-1)?.columns.visible, ['title']);
	fireEvent.click(v.getByRole('button', { name: 'Show all columns' }));
	assert.deepEqual(changes.at(-1)?.columns.visible, ['id', 'title']);
	fireEvent.click(v.getByRole('button', { name: 'Reset' }));
	assert.deepEqual(changes.at(-1)?.columns, {
		visible: ['id', 'title'],
		order: ['id', 'title'],
		widths: { title: 95 },
		fixed: { id: 'left', title: 'right' },
	});
});
test('applying a negated empty condition preserves its meaning', () => {
	const changes: AnalysisConfig[] = [];
	const query = { combinator: 'and' as const, not: true, rules: [] };
	const v = render(
		<DataAnalysisTable
			rows={[{ id: 1 }]}
			rowKey="id"
			columns={[{ key: 'id' }]}
			fields={[{ name: 'id', label: 'ID', dataType: 'number', conditionable: true }]}
			config={{ ...config, condition: { query } }}
			onConfigChange={(c) => changes.push(c)}
		/>,
	);
	fireEvent.click(v.getByRole('button', { name: 'Filters' }));
	fireEvent.click(v.getByRole('button', { name: 'Confirm' }));
	assert.deepEqual(changes.at(-1)?.condition, { query });
});

test('multi-value color rules match individual values even when their column is hidden', () => {
	const props = {
		rows: [
			{ id: 1, tags: ['catalog', 'new'] },
			{ id: 2, tags: ['cat'] },
			{ id: 3, tags: [] },
		],
		rowKey: 'id' as const,
		columns: [{ key: 'id' }],
		fields: [{ name: 'tags', label: 'Tags', dataType: 'array' as const, colorable: true }],
		onConfigChange: () => {},
	};
	const table = (operator: '=' | '!=' | 'contains') => (
		<DataAnalysisTable
			{...props}
			config={{ ...config, colorRules: [{ ...config.colorRules[0], field: 'tags', operator, value: 'cat' }] }}
		/>
	);
	const view = render(table('='));
	const colored = () => Array.from(view.container.querySelectorAll('tr[data-color="green"]'), (row) => row.textContent);
	assert.deepEqual(colored(), ['2']);
	view.rerender(table('!='));
	assert.deepEqual(colored(), ['1', '3']);
	view.rerender(table('contains'));
	assert.deepEqual(colored(), ['1', '2']);
});

test('the column list reorders hidden columns on drop and keeps their position when shown', () => {
	const updates: AnalysisConfig[] = [];
	const props = {
		columns: ['a', 'b', 'c', 'd'].map((key) => ({ key })),
		fields: [],
		rows: [{ id: 1 }],
		rowKey: 'id' as const,
		onConfigChange: (next: AnalysisConfig) => updates.push(next),
	};
	const initial = { ...config, columns: { ...config.columns, order: ['a', 'b', 'c', 'd'], visible: ['a', 'd'] } };
	const v = render(<DataAnalysisTable {...props} config={initial} />);
	fireEvent.click(v.getByRole('button', { name: 'Columns' }));
	const grip = (key: string) => v.getByRole('button', { name: 'Move column ' + key });
	const refresh = () => v.rerender(<DataAnalysisTable {...props} config={updates.at(-1)!} />);
	const transfer = new DataTransfer();
	// Drag image rendering requires a browser.
	transfer.setDragImage = () => {};
	function drag(key: string, target: string, y: number) {
		const row = grip(target).closest('li')!;
		row.getBoundingClientRect = () => new DOMRect(0, 0, 100, 40);
		fireEvent.dragStart(grip(key), { dataTransfer: transfer });
		// The DOM test runtime uses Event for DragEvent and discards pointer coordinates.
		for (const type of ['dragover', 'drop']) {
			const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
			Object.defineProperty(event, 'dataTransfer', { value: transfer });
			fireEvent(row, event);
		}
		fireEvent.dragEnd(grip(key));
	}
	fireEvent.dragStart(grip('a'), { dataTransfer: transfer });
	fireEvent.dragEnd(grip('a'));
	drag('a', 'a', 30);
	assert.equal(updates.length, 0);
	drag('b', 'd', 30);
	assert.equal(updates.length, 1);
	assert.deepEqual(updates[0].columns, { ...initial.columns, order: ['a', 'c', 'd', 'b'] });
	refresh();
	drag('b', 'a', 5);
	assert.deepEqual(updates[1].columns.order, ['b', 'a', 'c', 'd']);
	refresh();
	fireEvent.click(v.getByRole('button', { name: 'Hide column d' }));
	refresh();
	assert.ok(v.getByRole('button', { name: 'Hide column a' }).hasAttribute('disabled'));
	fireEvent.click(v.getByRole('button', { name: 'Show all columns' }));
	refresh();
	assert.deepEqual(
		v.getAllByRole('columnheader').map((el) => el.textContent),
		['b', 'a', 'c', 'd'],
	);
	fireEvent.keyDown(grip('b'), { key: 'ArrowUp' });
	assert.equal(updates.length, 4);
});
