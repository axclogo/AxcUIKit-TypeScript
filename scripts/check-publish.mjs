// Validate immutable publish metadata and tell GitHub Actions whether this version needs publishing.
import { appendFileSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const repository = 'git+https://github.com/axclogo/AxcUIKit-TypeScript.git';

if (manifest.name !== '@axc/uikit') throw new Error(`Package name must be @axc/uikit, got ${manifest.name}`);
if (manifest.private === true) throw new Error('The release package must not be private');
if (manifest.repository?.url !== repository)
	throw new Error(`package.json repository.url must be ${repository} for npm provenance`);
if (manifest.publishConfig?.registry !== 'https://registry.npmjs.org')
	throw new Error('publishConfig.registry must be https://registry.npmjs.org');
if (manifest.publishConfig?.access !== 'public') throw new Error('publishConfig.access must be public');

const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(manifest.name)}`);
let status;
if (response.status === 404) status = 'bootstrap';
else if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
else {
	const registry = await response.json();
	status = Object.hasOwn(registry.versions, manifest.version) ? 'published' : 'unpublished';
}

const publish = status === 'unpublished';
if (process.env.GITHUB_OUTPUT)
	appendFileSync(process.env.GITHUB_OUTPUT, `status=${status}\npublish=${String(publish)}\n`);
console.log(`Publish gate OK (${manifest.name}@${manifest.version}: ${status}).`);
