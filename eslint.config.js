// Lint rules are hard constraints for maintainers (human or AI): there is no escape hatch.
// `noInlineConfig` makes `eslint-disable` comments ineffective, so a rule can only change here, in review.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
	{ ignores: ['**/dist/', '**/node_modules/', 'tests/react18/', '**/docs/'] },
	{ linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },
	...tseslint.configs.strict,
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: { parserOptions: { projectService: true } },
		plugins: { 'react-hooks': reactHooks },
		rules: {
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'error',
			'@typescript-eslint/no-floating-promises': [
				'error',
				{ allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['test', 'it', 'describe'] }] },
			],
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
			'@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description' }],
			// `!` is used where a value was just selected from the same list; keep it, but nothing looser.
			'@typescript-eslint/no-non-null-assertion': 'off',
		},
	},
	{
		files: ['packages/*/src/**'],
		rules: {
			'no-console': 'error',
			// Double casts silence the type checker; library code must not need them.
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TSAsExpression > TSAsExpression',
					message: 'No double casts (`as unknown as T`) in component source.',
				},
			],
		},
	},
);
