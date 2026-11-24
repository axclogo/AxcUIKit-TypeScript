// Change gate, run in CI against the base of a pull request or push:
// Component source or protocol changes require a changelog entry.
// Public API and issue-code changes also require a package version bump.
// Usage: node scripts/check-release.mjs <base-ref>
import { execFileSync } from 'node:child_process';

const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/check-release.mjs <base-ref>');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
const touched = (pattern) => changed.some((file) => pattern.test(file));
const failures = [];
if (touched(/^packages\/[^/]+\/(src|protocol)\//) && !changed.includes('CHANGELOG.md'))
	failures.push('component source or protocol changed without a CHANGELOG.md entry');
if (touched(/^packages\/[^/]+\/(api\/|protocol\/issue-codes\.json$)/)) {
	const version = (ref) =>
		JSON.parse(ref ? git('show', `${ref}:package.json`) : git('show', 'HEAD:package.json')).version;
	if (version(base) === version())
		failures.push('the public API or issue codes changed without a package.json version bump');
}
if (failures.length) {
	console.error(failures.join('\n'));
	process.exitCode = 1;
} else console.log(`Release gate OK (${changed.length} files changed since ${base}).`);
