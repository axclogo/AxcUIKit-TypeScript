import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import pkg from '../package.json' with { type: 'json' };

const localBuild = process.argv.includes('--update');
const configObjectFullPath = resolve('api-extractor.json');
const configObject = ExtractorConfig.loadFile(configObjectFullPath);
const packageJsonFullPath = resolve('package.json');

// API Extractor requires a transient copy of the generated interface for comparison.
const reportTempFolder = await mkdtemp(join(tmpdir(), 'axc-uikit-api-'));
try {
	for (const [subpath, entry] of Object.entries(pkg.exports)) {
		if (typeof entry === 'string') continue;
		const [, component, reportFileName = 'index'] = subpath.split('/');
		const reportFolder = resolve('packages', component, 'api');
		if (localBuild) await mkdir(reportFolder, { recursive: true });
		const config = ExtractorConfig.prepare({
			configObject: {
				...configObject,
				mainEntryPointFilePath: resolve(entry.types),
				apiReport: { enabled: true, reportFolder, reportTempFolder, reportFileName },
			},
			configObjectFullPath,
			packageJsonFullPath,
		});
		const result = Extractor.invoke(config, { localBuild, printApiReportDiff: true });
		if (!result.succeeded) process.exitCode = 1;
	}
} finally {
	await rm(reportTempFolder, { recursive: true, force: true });
}
