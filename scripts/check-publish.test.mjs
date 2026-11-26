import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getPublishStatus, validateReleaseMetadata } from './check-publish.mjs';

const manifest = {
	name: '@axc/uikit',
	version: '0.6.0',
	repository: { url: 'git+https://github.com/axclogo/AxcUIKit-TypeScript.git' },
	publishConfig: { access: 'public', registry: 'https://registry.npmjs.org' },
};
const lockfile = {
	name: '@axc/uikit',
	version: '0.6.0',
	packages: { '': { name: '@axc/uikit', version: '0.6.0' } },
};

function response(status, body) {
	return {
		status,
		ok: status >= 200 && status < 300,
		json: async () => body,
	};
}

test('accepts the exact public release metadata', () => {
	assert.equal(validateReleaseMetadata(manifest, lockfile), manifest);
});

for (const [name, changedManifest, changedLockfile, message] of [
	['package name', { ...manifest, name: '@example/wrong' }, lockfile, /name must be @axc\/uikit/],
	['empty version', { ...manifest, version: '' }, lockfile, /version must be a stable SemVer/],
	['prerelease version', { ...manifest, version: '0.6.1-beta.1' }, lockfile, /version must be a stable SemVer/],
	['output injection in version', { ...manifest, version: '0.6.1\npublish=true' }, lockfile, /stable SemVer/],
	['private package', { ...manifest, private: true }, lockfile, /must not be private/],
	[
		'repository',
		{ ...manifest, repository: { url: 'https://example.com/repository.git' } },
		lockfile,
		/repository\.url must be/,
	],
	[
		'registry',
		{ ...manifest, publishConfig: { ...manifest.publishConfig, registry: 'https://example.com' } },
		lockfile,
		/publishConfig\.registry must be/,
	],
	[
		'access',
		{ ...manifest, publishConfig: { ...manifest.publishConfig, access: 'restricted' } },
		lockfile,
		/publishConfig\.access must be public/,
	],
	[
		'lockfile name',
		manifest,
		{ ...lockfile, packages: { '': { name: '@example/wrong', version: '0.6.0' } } },
		/package names must match/,
	],
	['lockfile version', manifest, { ...lockfile, version: '0.5.0' }, /versions must match/],
]) {
	test(`rejects invalid ${name}`, () => {
		assert.throws(() => validateReleaseMetadata(changedManifest, changedLockfile), message);
	});
}

test('reports bootstrap only for an explicit Registry 404', async () => {
	assert.equal(await getPublishStatus(manifest, async () => response(404)), 'bootstrap');
});

test('reports an existing immutable version as published', async () => {
	assert.equal(await getPublishStatus(manifest, async () => response(200, { versions: { '0.6.0': {} } })), 'published');
});

test('reports a missing version of an existing package as unpublished', async () => {
	assert.equal(
		await getPublishStatus(manifest, async () => response(200, { versions: { '0.5.0': {} } })),
		'unpublished',
	);
});

test('queries only the public npm package endpoint with the configured timeout signal', async () => {
	let request;
	const timeoutSignal = new AbortController().signal;
	await getPublishStatus(
		manifest,
		async (url, options) => {
			request = { url, options };
			return response(404);
		},
		() => timeoutSignal,
	);
	assert.equal(request.url, 'https://registry.npmjs.org/%40axc%2Fuikit');
	assert.equal(request.options.signal, timeoutSignal);
});

test('does not reinterpret Registry or response errors as a missing version', async () => {
	await assert.rejects(() => getPublishStatus(manifest, async () => response(503)), /HTTP 503/);
	await assert.rejects(
		() => getPublishStatus(manifest, async () => response(200, { versions: [] })),
		/npm registry versions must be an object/,
	);
});

test('keeps the privileged workflow constrained to a tested main commit and OIDC', async () => {
	const workflow = await readFile(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8');
	assert.match(workflow, /workflow_run:/);
	assert.match(workflow, /workflow_run\.event == 'push'/);
	assert.match(workflow, /workflow_run\.conclusion == 'success'/);
	assert.match(workflow, /workflow_run\.head_branch == 'main'/);
	assert.match(workflow, /workflow_run\.head_repository\.full_name == github\.repository/);
	assert.match(workflow, /workflow_run\.head_sha/);
	assert.match(workflow, /persist-credentials: false/);
	assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
	assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
	assert.doesNotMatch(workflow, /uses: actions\/(?:checkout|setup-node)@v\d/);
	assert.match(workflow, /id-token: write/);
	assert.match(workflow, /package-manager-cache: false/);
	assert.match(workflow, /npm run verify/);
	assert.match(workflow, /npm publish/);
	assert.match(workflow, /status == 'bootstrap'[\s\S]*exit 1/);
	assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\./);
});
