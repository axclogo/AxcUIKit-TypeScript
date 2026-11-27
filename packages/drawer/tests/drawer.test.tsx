import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Drawer } from '../src/index.js';
afterEach(cleanup);
test('close requests remain controlled, with optional footer and one completion per accepted exit', () => {
	let requests = 0,
		exits = 0;
	const props = {
		size: 'medium' as const,
		title: 'Report',
		onClose: () => {
			requests++;
		},
		afterClose: () => {
			exits++;
		},
	};
	const view = render(
		<Drawer {...props} open footer={<button type="button">Save</button>}>
			Details
		</Drawer>,
	);
	const dialog = view.getByRole('dialog', { name: 'Report' });
	Object.defineProperty(dialog, 'getAnimations', { value: () => [] });
	fireEvent.click(view.getByRole('button', { name: 'Close' }));
	assert.equal(requests, 1);
	assert.ok(dialog.hasAttribute('open'));
	const cancel = new Event('cancel', { cancelable: true });
	fireEvent(dialog, cancel);
	assert.ok(cancel.defaultPrevented);
	assert.equal(requests, 2);
	view.rerender(
		<Drawer {...props} open={false}>
			Details
		</Drawer>,
	);
	assert.equal(dialog.hasAttribute('open'), false);
	assert.equal(exits, 1);
	view.rerender(
		<Drawer {...props} open>
			Details
		</Drawer>,
	);
	assert.equal(view.queryByRole('button', { name: 'Save' }), null);
	assert.equal(exits, 1);
});
test('escape requests from a nested dialog reach only its owner', () => {
	let outer = 0,
		inner = 0;
	const v = render(
		<Drawer open size="large" title="Outer" onClose={() => outer++}>
			<Drawer open size="small" title="Inner" onClose={() => inner++}>
				Version
			</Drawer>
		</Drawer>,
	);
	fireEvent(v.getByRole('dialog', { name: 'Inner' }), new Event('cancel', { bubbles: true, cancelable: true }));
	assert.deepEqual([outer, inner], [0, 1]);
});

test('reopening during exit cancels completion and keeps the modal open', () => {
	const done: string[] = [];
	const drawer = (open: boolean) => (
		<Drawer
			open={open}
			size="small"
			title="Item"
			onClose={() => {}}
			afterClose={() => done.push('closed')}
			footer={false}
		>
			Content
		</Drawer>
	);
	const view = render(drawer(true));
	const dialog = view.getByRole('dialog');
	assert.equal(dialog.querySelector('footer'), null);
	const slide = Object.assign(new EventTarget(), { transitionProperty: 'transform' });
	Object.defineProperty(dialog, 'getAnimations', { value: () => [slide] });
	view.rerender(drawer(false));
	assert.ok(dialog.hasAttribute('open'));
	view.rerender(drawer(true));
	slide.dispatchEvent(new Event('cancel'));
	assert.ok(dialog.hasAttribute('open'));
	assert.deepEqual(done, []);
	view.rerender(drawer(false));
	slide.dispatchEvent(new Event('finish'));
	assert.deepEqual(done, ['closed']);
	assert.equal(dialog.hasAttribute('open'), false);
});
