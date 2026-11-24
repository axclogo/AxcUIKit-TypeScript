import { build, context } from 'esbuild';
// Local demo only. `--build` writes the demo bundle once so demo/index.html also opens from disk (file://);
// without it, esbuild serves the demo and rebuilds on changes.
// IIFE + relative paths because browsers block module scripts and absolute paths under file://.
const demo = 'packages/condition/demo';
const options = {
	entryPoints: [`${demo}/main.tsx`],
	outfile: `${demo}/dist/app.js`,
	bundle: true,
	format: 'iife',
	platform: 'browser',
	target: 'es2022',
	jsx: 'automatic',
	define: { 'process.env.NODE_ENV': '"production"' },
	minify: true,
	logLevel: 'info',
};
if (process.argv.includes('--build')) await build(options);
else {
	const ctx = await context(options);
	await ctx.watch();
	const server = await ctx.serve({ servedir: demo, host: '127.0.0.1', port: 5178 });
	console.log(`Demo: http://127.0.0.1:${server.port}`);
	const close = async () => {
		await ctx.dispose();
		process.exit(0);
	};
	process.on('SIGINT', close);
	process.on('SIGTERM', close);
}
