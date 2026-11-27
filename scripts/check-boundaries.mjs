// Check core and adapter boundaries in each component's TypeScript source.
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const walk = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
	);
const NATIVE = ['input', 'select', 'textarea', 'button', 'option', 'form'];
const TEXT_ATTRIBUTES = ['label', 'placeholder', 'title', 'aria-label', 'alt'];
const UI_ENTRIES = ['src/ui/controls.tsx', 'src/ui/types.ts', 'src/ui/provider.tsx'];
const CJK = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
const CODEMIRROR = ['@codemirror/lang-json', '@uiw/react-codemirror'];
const GRAPH_PEERS = ['@antv/g6', '@xyflow/react', '@dagrejs/dagre'];
const failures = [];

for (const component of ['condition', 'json-editor', 'table', 'graph', 'drawer', 'code-editor', 'decision-plugins']) {
	const root = 'packages/' + component;

	for (const sourcePath of walk(root + '/src').filter((name) => /\.[jt]sx?$/.test(name))) {
		const file = path.relative(root, sourcePath);
		const text = readFileSync(sourcePath, 'utf8');
		const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
		const core = file.startsWith('src/core/');
		const ui = file.startsWith('src/ui/');
		const fail = (node, message) => {
			const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
			failures.push(`${sourcePath}:${line + 1}: ${message}`);
		};
		if (!file.startsWith('src/core/locales/') && CJK.test(text))
			failures.push(`${sourcePath}: CJK text belongs in src/core/locales/`);
		const visit = (node) => {
			if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
				const tag = node.tagName.getText(source);
				if (NATIVE.includes(tag) && !ui)
					fail(node, `<${tag}> must be rendered through the UI adapter (src/ui/controls)`);
				if (tag === 'button') {
					const type = node.attributes.properties.find(
						(attr) => ts.isJsxAttribute(attr) && attr.name.getText(source) === 'type',
					);
					if (!type || !type.initializer || !ts.isStringLiteral(type.initializer) || type.initializer.text !== 'button')
						fail(node, '<button> needs a literal type="button" so it never submits a host form');
				}
			}
			if (ts.isJsxText(node) && /\p{L}/u.test(node.text))
				fail(node, `hard-coded text "${node.text.trim()}"; use the locale`);
			if (
				ts.isJsxAttribute(node) &&
				TEXT_ATTRIBUTES.includes(node.name.getText(source)) &&
				node.initializer &&
				ts.isStringLiteral(node.initializer)
			)
				fail(node, `hard-coded ${node.name.getText(source)}="${node.initializer.text}"; use the locale`);
			let specifier;
			if (
				(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			)
				specifier = node.moduleSpecifier.text;
			if (
				ts.isCallExpression(node) &&
				node.expression.kind === ts.SyntaxKind.ImportKeyword &&
				ts.isStringLiteral(node.arguments[0])
			)
				specifier = node.arguments[0].text;
			if (specifier) {
				if (!specifier.startsWith('.')) {
					const allowed = ['react', 'react/jsx-runtime'];
					if (component === 'json-editor' && file === 'src/codemirror.tsx')
						allowed.push('@codemirror/lang-json', '@axclogo/uikit/code-editor');
					if (
						component === 'json-editor' &&
						file === 'src/ui/types.ts' &&
						ts.isImportDeclaration(node) &&
						node.importClause?.isTypeOnly
					)
						allowed.push('@axclogo/uikit/code-editor');
					if (component === 'decision-plugins')
						allowed.push(
							'@axclogo/uikit/condition',
							'@axclogo/uikit/code-editor',
							'@axclogo/uikit/json-editor/codemirror',
						);
					if (component === 'code-editor') allowed.push('@uiw/react-codemirror');
					if (component === 'table') allowed.push('@axclogo/uikit/condition', '@tanstack/virtual-core');
					if (component === 'graph') allowed.push('@axclogo/uikit/condition', ...GRAPH_PEERS);
					if (core || !allowed.includes(specifier)) fail(node, `dependency not allowed: ${specifier}`);
				} else {
					const target = path.normalize(path.join(path.dirname(file), specifier)).replace(/\.[jt]sx?$/, '');
					if (!target.startsWith('src/')) fail(node, `import escapes src/: ${specifier}`);
					if (target === 'src/codemirror') fail(node, 'import the CodeMirror adapter through its package subpath');
					if (core && !target.startsWith('src/core/')) fail(node, `src/core must not import ${specifier}`);
					if (
						!ui &&
						target.startsWith('src/ui/') &&
						!UI_ENTRIES.some((entry) => entry.replace(/\.tsx?$/, '') === target)
					)
						fail(node, `import controls through src/ui/controls, types or provider, not ${specifier}`);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (Object.keys(pkg.dependencies ?? {}).some((name) => ![...CODEMIRROR, '@tanstack/virtual-core'].includes(name)))
	failures.push('package.json: unexpected runtime dependency');
if (Object.keys(pkg.peerDependencies ?? {}).some((name) => !['react', 'react-dom', ...GRAPH_PEERS].includes(name)))
	failures.push('package.json: unexpected peer dependency');

if (failures.length) {
	console.error(failures.join('\n'));
	process.exitCode = 1;
} else console.log('Boundaries OK for all components.');
