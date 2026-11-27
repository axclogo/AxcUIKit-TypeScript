// Keep self-references external even when TypeScript maps them to source on a clean checkout.
export const bundleOptions = {
	bundle: true,
	splitting: true,
	format: 'esm',
	platform: 'neutral',
	target: 'es2022',
	packages: 'external',
	external: ['@axclogo/uikit/*'],
};
