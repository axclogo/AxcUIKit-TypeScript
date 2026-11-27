// Keep separately importable component bundles small (gzip bytes).
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const budgets = {
	'decision-plugins': { js: 16000, css: 1500 },
	drawer: { js: 4000, css: 1500 },
	'code-editor': { js: 2500, css: 0 },
	table: { js: 32000, css: 4500 },
	graph: { js: 30000, css: 4000 },
	condition: { js: 22_000, css: 1_500 },
	'json-editor': { js: 18_000, css: 1_500 },
};
const size = (file) => gzipSync(readFileSync(file)).length;

for (const [component, budget] of Object.entries(budgets)) {
	const output = `dist/${component}`;
	const bundles = readdirSync(output, { recursive: true }).filter((file) => file.endsWith('.js'));
	const js = bundles.reduce((total, file) => total + size(`${output}/${file}`), 0);
	const css = budget.css ? size(`${output}/styles.css`) : 0;
	const summary = `${component} size: JS ${js} B / ${budget.js} B, CSS ${css} B / ${budget.css} B (gzip)`;
	if (js > budget.js || css > budget.css) {
		console.error(summary + ' exceeds budget');
		process.exitCode = 1;
	} else console.log(summary);
}
