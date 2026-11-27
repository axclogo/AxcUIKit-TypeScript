import assert from 'node:assert/strict';
import test from 'node:test';
import { relationGraphRendererNodeId } from '../src/core/selection.js';
import {
	RELATION_GRAPH_CARD_NODE_TYPE,
	relationGraphToG6Data,
	relationGraphToG6Layout,
	type RelationGraphTheme,
} from '../src/relation/g6-adapter.js';

const theme: RelationGraphTheme = {
	background: '#fff',
	border: '#ddd',
	primary: '#1677ff',
	primarySoft: '#e8f3ff',
	text: '#111',
	textMuted: '#666',
	tones: {
		blue: { fill: '#e8f3ff', stroke: '#1677ff' },
		cyan: { fill: '#c2eff0', stroke: '#038698' },
		green: { fill: '#e8f8f2', stroke: '#00a870' },
		orange: { fill: '#fff3e0', stroke: '#ff8800' },
		purple: { fill: '#efcaf0', stroke: '#871e9e' },
		red: { fill: '#fff0f0', stroke: '#f93920' },
		grey: { fill: '#eef0f2', stroke: '#6b7078' },
	},
};

test('keeps record IDs outside G6 global element ID namespace', () => {
	const data = relationGraphToG6Data(
		{
			nodes: [
				{ id: 'same', name: 'Node' },
				{ id: 'target', name: 'Target' },
			],
			relations: [{ key: 'same', source: 'same', target: 'target', type: 'link' }],
		},
		{ theme },
	);
	assert.equal(data.nodes?.[0]?.id, 'node:same');
	assert.equal(data.edges?.[0]?.id, 'edge:same');
	assert.equal(data.edges?.[0]?.source, relationGraphRendererNodeId('same'));
	assert.equal(new Set([...(data.nodes || []), ...(data.edges || [])].map((item) => item.id)).size, 3);
});

test('applies view resolvers without changing topology data', () => {
	const data = relationGraphToG6Data(
		{
			nodes: [
				{ id: 'first', name: 'A' },
				{ id: 'second', name: 'B' },
			],
			relations: [{ key: 'edge', source: 'first', target: 'second', type: 'link' }],
		},
		{
			theme,
			resolveNodeView: (node) => ({ shape: node.id === 'first' ? 'rect' : 'circle', tone: 'green' }),
			resolveRelationView: () => ({
				color: '#db2777',
				dashed: true,
				directed: false,
				label: 'Edge label',
				tone: 'orange',
			}),
		},
	);
	assert.equal(data.nodes?.[0]?.type, 'rect');
	assert.equal(data.nodes?.[0]?.style?.cursor, 'pointer');
	assert.equal(data.edges?.[0]?.style?.labelText, 'Edge label');
	assert.deepEqual(data.edges?.[0]?.style?.lineDash, [6, 5]);
	assert.equal(data.edges?.[0]?.style?.endArrow, false);
	assert.equal(data.edges?.[0]?.style?.stroke, '#db2777');
});

test('renders left-aligned card labels with a ribbon', () => {
	const data = relationGraphToG6Data(
		{
			nodes: [{ id: 'item', name: 'Title' }],
			relations: [],
		},
		{
			theme,
			resolveNodeView: () => ({
				shape: 'card',
				size: [280, 104],
				labelAlign: 'left',
				iconText: 'X',

				ribbon: { text: 'Group', background: '#E63946', foreground: '#FFFFFF' },
			}),
		},
	);
	const style = data.nodes?.[0]?.style;
	assert.equal(data.nodes?.[0]?.type, RELATION_GRAPH_CARD_NODE_TYPE);
	assert.equal(style?.labelTextAlign, 'left');
	assert.equal(style?.labelOffsetX, -122);
	assert.equal((style as Record<string, unknown>)?.ribbonText, 'Group');
	assert.equal((style as Record<string, unknown>)?.ribbonBackground, '#E63946');
	assert.equal((style as Record<string, unknown>)?.ribbonForeground, '#FFFFFF');
	assert.equal((style as Record<string, unknown>)?.cornerText, 'X');
	assert.equal((style as Record<string, unknown>)?.cornerPlacement, 'left-top');
});

test('keeps directed edges by default and applies extended theme tones', () => {
	const data = relationGraphToG6Data(
		{
			nodes: [
				{ id: 'source', name: 'Source' },
				{ id: 'target', name: 'Target' },
			],
			relations: [{ key: 'relation', source: 'source', target: 'target', type: 'link' }],
		},
		{
			theme,
			resolveNodeView: (node) => ({ tone: node.id === 'source' ? 'cyan' : 'purple' }),
		},
	);
	assert.equal(data.nodes?.[0]?.style?.stroke, '#038698');
	assert.equal(data.nodes?.[1]?.style?.stroke, '#871e9e');
	assert.equal(data.edges?.[0]?.style?.endArrow, true);
});

test('renders optional record colors and centered labels', () => {
	const data = relationGraphToG6Data(
		{
			nodes: [
				{ id: 'first', name: 'ABCDEFGHIJ', color: '#2563EB' },
				{ id: 'default', name: 'Default' },
			],
			relations: [],
		},
		{ theme, resolveNodeView: () => ({ labelPlacement: 'center' }) },
	);
	assert.equal(data.nodes?.[0]?.style?.fill, '#2563EB');
	assert.equal(data.nodes?.[0]?.style?.stroke, '#2563EB');
	assert.equal(data.nodes?.[0]?.style?.labelPlacement, 'center');
	assert.equal(data.nodes?.[0]?.style?.labelText, 'ABCDE\nFGHIJ');
	assert.equal(data.nodes?.[0]?.style?.labelMaxLines, 2);
	assert.equal(data.nodes?.[0]?.style?.labelWordWrap, true);
	assert.equal(data.nodes?.[1]?.style?.stroke, '#1677ff');
});

test('keeps the complete centered node label across all wrapped lines', () => {
	const name = 'A long label with emoji 🌳 across multiple lines';
	const data = relationGraphToG6Data(
		{
			nodes: [{ id: 'long-name', name }],
			relations: [],
		},
		{ theme, resolveNodeView: () => ({ labelPlacement: 'center' }) },
	);
	const label = String(data.nodes?.[0]?.style?.labelText);
	assert.equal(label.replaceAll('\n', ''), name);
	assert.equal(data.nodes?.[0]?.style?.labelMaxLines, label.split('\n').length);
	assert.ok(Number(data.nodes?.[0]?.style?.size) > 76);
});

test('limits relation labels to a single ellipsized line within the edge', () => {
	const data = relationGraphToG6Data(
		{
			nodes: [
				{ id: 'source', name: 'Source' },
				{ id: 'target', name: 'Target' },
			],
			relations: [
				{
					key: 'long-edge',
					source: 'source',
					target: 'target',
					type: 'A long relation label that exceeds the available edge width',
				},
			],
		},
		{ theme },
	);
	assert.equal(data.edges?.[0]?.type, 'line');
	assert.equal(data.edges?.[0]?.style?.labelWordWrap, true);
	assert.equal(data.edges?.[0]?.style?.labelMaxWidth, '60%');
	assert.equal(data.edges?.[0]?.style?.labelMaxLines, 1);
	assert.equal(data.edges?.[0]?.style?.labelTextOverflow, 'ellipsis');
});

test('uses repeated size-aware collisions for force layouts', () => {
	const layout = relationGraphToG6Layout({
		type: 'force',
		chargeStrength: -720,
		nodeSpacing: 108,
	});
	assert.deepEqual((layout as { manyBody?: unknown }).manyBody, { strength: -720 });
	assert.equal(layout.preventOverlap, true);
	assert.equal(layout.nodeSpacing, 108);
	assert.equal(layout.collideStrength, 1);
	assert.equal(layout.collideIterations, 4);
});

test('uses the width of tuple-sized nodes for centered labels', () => {
	const data = relationGraphToG6Data(
		{
			nodes: [{ id: 'first', name: 'A' }],
			relations: [],
		},
		{ theme, resolveNodeView: () => ({ labelPlacement: 'center', size: [120, 80] }) },
	);
	assert.equal(data.nodes?.[0]?.style?.labelMaxWidth, 102);
});

test('renders card nodes with configurable content lines and a corner badge', () => {
	const data = relationGraphToG6Data(
		{
			nodes: [{ id: 'item', name: 'Title' }],
			relations: [],
		},
		{
			theme,
			resolveNodeView: () => ({
				shape: 'card',
				subtitle: 'First line\nSecond line\nThird line',
				labelMaxLines: 4,
				iconText: 'X',
				tone: 'orange',
				highlight: true,
				size: [280, 104],
			}),
		},
	);
	const style = data.nodes?.[0]?.style;
	assert.equal(data.nodes?.[0]?.type, RELATION_GRAPH_CARD_NODE_TYPE);
	assert.deepEqual(style?.size, [280, 104]);
	assert.equal(style?.radius, 8);
	assert.equal(style?.fill, '#fff');
	assert.equal(style?.stroke, '#ff8800');
	assert.equal(style?.labelText, 'Title\nFirst line\nSecond line\nThird line');
	assert.equal(style?.labelMaxLines, 4);
	assert.equal(style?.labelMaxWidth, 256);
	assert.equal((style as Record<string, unknown>)?.cornerText, 'X');
	assert.equal((style as Record<string, unknown>)?.cornerPlacement, 'left-top');
	assert.equal(style?.halo, true);
});
