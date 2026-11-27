// Exercise external package resolution from built ESM, then run the peer APIs.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { registerHooks, createRequire } from 'node:module';
import { access, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { bundleOptions } from './build-options.mjs';
const require = createRequire(import.meta.url);
const isolated = registerHooks({
	resolve(specifier, context, next) {
		assert.doesNotMatch(specifier, /^(@antv\/|@xyflow\/|@dagrejs\/)/);
		return next(specifier, context);
	},
});
try {
	for (const entry of ['condition', 'json-editor', 'table', 'table/core', 'graph/core']) {
		const path = '@axclogo/uikit/' + entry;
		assert.equal(require(path), await import(path));
	}
} finally {
	isolated.deregister();
}
const graph = await import('@axclogo/uikit/graph');
assert.equal(require('@axclogo/uikit/graph'), graph);
assert.equal(graph.normalizeRelationGraph, (await import('@axclogo/uikit/graph/core')).normalizeRelationGraph);
for (const name of ['RelationGraph', 'GraphWorkbench', 'GraphWorkspace', 'GraphNodeShell'])
	assert.equal(typeof graph[name], 'function');
const table = await import('@axclogo/uikit/table');
for (const name of ['BaseTable', 'DataTable', 'DataTreeTable', 'DataAnalysisTable', 'DataCrudTable', 'TableUIProvider'])
	assert.equal(typeof table[name], 'function');
for (const name of ['table', 'graph']) {
	await access(new URL(import.meta.resolve('@axclogo/uikit/' + name + '/styles.css')));
}
const folder = await mkdtemp(join(process.cwd(), '.axc-probe-'));
try {
	for (const name of ['table', 'graph']) {
		const { outputFiles, metafile } = await build({
			...bundleOptions,
			entryPoints: [`packages/${name}/tests/build-probe.ts`],
			outdir: folder,
			write: false,
			metafile: true,
		});
		assert.equal(Object.keys(metafile.inputs).length, 1);
		const file = join(folder, name + '.mjs');
		await writeFile(file, outputFiles[0].contents);
		const api = await import(pathToFileURL(file).href);
		assert.equal(api.AxcCondition, (await import('@axclogo/uikit/condition')).AxcCondition);
		if (name === 'table') assert.equal(typeof api.Virtualizer, 'function');
		else {
			const [output] = Object.values(metafile.outputs);
			assert.ok(
				output.imports.some((entry) => entry.path === '@antv/g6' && entry.kind === 'dynamic-import' && entry.external),
			);
			const runtime = await api.loadG6();
			assert.equal(runtime.version, '5.1.1');
			assert.equal(typeof runtime.Graph, 'function');
			const graph = new api.Graph().setGraph({ rankdir: 'LR' }).setDefaultEdgeLabel(() => ({}));
			graph.setNode('a', { width: 80, height: 40 }).setNode('b', { width: 80, height: 40 }).setEdge('a', 'b');
			api.layout(graph);
			assert.ok(graph.node('a').x < graph.node('b').x);
		}
	}
} finally {
	await rm(folder, { recursive: true, force: true });
}
console.log('Table and graph build probes passed.');
