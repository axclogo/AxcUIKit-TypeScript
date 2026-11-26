import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const expectedName = '@axc/uikit';
const expectedRepository = 'git+https://github.com/axclogo/AxcUIKit-TypeScript.git';
const registryUrl = 'https://registry.npmjs.org';
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function isRecord(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value, label) {
	if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
	return value;
}

export function validateReleaseMetadata(manifestValue, lockfileValue) {
	const manifest = requireRecord(manifestValue, 'package.json');
	const lockfile = requireRecord(lockfileValue, 'package-lock.json');
	const repository = requireRecord(manifest.repository, 'package.json repository');
	const publishConfig = requireRecord(manifest.publishConfig, 'package.json publishConfig');
	const lockPackages = requireRecord(lockfile.packages, 'package-lock.json packages');
	const lockRoot = requireRecord(lockPackages[''], 'package-lock.json root package');

	if (manifest.name !== expectedName)
		throw new Error(`package.json name must be ${expectedName}, got ${String(manifest.name)}`);
	if (typeof manifest.version !== 'string' || !stableVersion.test(manifest.version))
		throw new Error('package.json version must be a stable SemVer value such as 1.2.3');
	if (manifest.private === true) throw new Error('The release package must not be private');
	if (repository.url !== expectedRepository)
		throw new Error(`package.json repository.url must be ${expectedRepository} for npm provenance`);
	if (publishConfig.registry !== registryUrl)
		throw new Error(`package.json publishConfig.registry must be ${registryUrl}`);
	if (publishConfig.access !== 'public') throw new Error('package.json publishConfig.access must be public');
	if (lockfile.name !== manifest.name || lockRoot.name !== manifest.name)
		throw new Error('package-lock.json package names must match package.json');
	if (lockfile.version !== manifest.version || lockRoot.version !== manifest.version)
		throw new Error('package-lock.json versions must match package.json');

	return manifest;
}

export async function getPublishStatus(
	manifest,
	fetchRegistry = fetch,
	createTimeoutSignal = () => AbortSignal.timeout(15_000),
) {
	const response = await fetchRegistry(`${registryUrl}/${encodeURIComponent(manifest.name)}`, {
		signal: createTimeoutSignal(),
	});
	if (response.status === 404) return 'bootstrap';
	if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);

	const metadata = await response.json();
	const versions = requireRecord(requireRecord(metadata, 'npm registry response').versions, 'npm registry versions');
	return Object.hasOwn(versions, manifest.version) ? 'published' : 'unpublished';
}

function readJson(url) {
	return JSON.parse(readFileSync(url, 'utf8'));
}

function writeActionOutput(manifest, status) {
	if (!process.env.GITHUB_OUTPUT) return;
	const publish = status === 'unpublished';
	appendFileSync(
		process.env.GITHUB_OUTPUT,
		`name=${manifest.name}\nversion=${manifest.version}\nstatus=${status}\npublish=${String(publish)}\n`,
	);
}

function writeActionSummary(manifest, status) {
	if (!process.env.GITHUB_STEP_SUMMARY) return;
	const outcome = {
		bootstrap: 'Blocked: the package must be created once before Trusted Publisher can be configured.',
		published: 'No-op: this immutable version already exists on npm.',
		unpublished: 'Ready: this version is absent and will pass the release gate before publication.',
	}[status];
	appendFileSync(
		process.env.GITHUB_STEP_SUMMARY,
		`## npm release gate\n\n| Package | Registry state | Decision |\n| --- | --- | --- |\n| \`${manifest.name}@${manifest.version}\` | \`${status}\` | ${outcome} |\n`,
	);
}

export async function main() {
	const manifest = validateReleaseMetadata(
		readJson(new URL('../package.json', import.meta.url)),
		readJson(new URL('../package-lock.json', import.meta.url)),
	);
	const status = await getPublishStatus(manifest);
	writeActionOutput(manifest, status);
	writeActionSummary(manifest, status);
	console.log(`Publish gate checked ${manifest.name}@${manifest.version}: ${status}.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
