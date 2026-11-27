import { bundleOptions } from './build-options.mjs';
import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });

for (const component of ['condition', 'json-editor', 'table', 'graph', 'drawer', 'code-editor', 'decision-plugins']) {
	const source = `packages/${component}/src`;
	const entryPoints = {
		index: `${source}/index.ts`,
		...(['condition', 'json-editor', 'table', 'graph'].includes(component) && { core: `${source}/core/index.ts` }),
		...(component !== 'code-editor' && { styles: `${source}/styles.css` }),
	};
	if (component === 'json-editor') entryPoints.codemirror = `${source}/codemirror.tsx`;

	await build({
		entryPoints,
		outdir: `dist/${component}`,
		chunkNames: 'chunks/[name]-[hash]',
		...bundleOptions,
		logLevel: 'info',
	});
}
