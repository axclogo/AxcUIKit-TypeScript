import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, cleanup } from '@testing-library/react';
import { RelationGraph } from '../src/index.js';
import { relationGraphToG6Layout } from '../src/relation/g6-adapter.js';
afterEach(cleanup);
test('invalid input is visible in the canvas and an empty dataset uses host empty content', () => {
	const v = render(<RelationGraph data="{}" selected={null} />);
	assert.match(v.getByRole('alert').textContent ?? '', /JSON array/);
	v.rerender(<RelationGraph data={[]} selected={null} empty="Nothing here" />);
	assert.ok(v.getByText('Nothing here'));
	assert.throws(() => v.rerender(<RelationGraph data={[]} selected={null} zoomRange={[2, 1]} />), /zoomRange/);
});
test('layout maps both axes and preserves force parameters', () => {
	assert.equal(relationGraphToG6Layout({ type: 'dagre', direction: 'TB' }).type, 'antv-dagre');
	assert.equal(relationGraphToG6Layout({ type: 'force', iterations: 12 }).type, 'd3-force');
});
