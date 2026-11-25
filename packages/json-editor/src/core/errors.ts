import type { JsonIssue } from './types.js';

/** Contains the machine-readable issues found while parsing a JSON value. */
export class JsonValidationError extends Error {
	constructor(readonly issues: readonly JsonIssue[]) {
		super(issues[0]?.code);
		this.name = 'JsonValidationError';
	}
}

/** Reports invalid editor configuration with machine-readable issue paths. */
export class JsonConfigurationError extends TypeError {
	constructor(readonly issues: readonly JsonIssue[]) {
		super(issues.map((issue) => `${issue.code} at ${JSON.stringify(issue.path)}`).join('; '));
		this.name = 'JsonConfigurationError';
	}
}
