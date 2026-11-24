import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });

for (const component of ['condition', 'json-editor']) {
	const source = `packages/${component}/src`;
	const entryPoints = {
		index: `${source}/index.ts`,
		core: `${source}/core/index.ts`,
		styles: `${source}/styles.css`,
	};
	if (component === 'json-editor') entryPoints.codemirror = `${source}/codemirror.tsx`;

	await build({
		entryPoints,
		outdir: `dist/${component}`,
		chunkNames: 'chunks/[name]-[hash]',
		bundle: true,
		splitting: true,
		format: 'esm',
		platform: 'neutral',
		target: 'es2022',
		packages: 'external',
		logLevel: 'info',
	});
}
