import type { AxcIssue, AxcPath } from '../core/issues.js';
import { formatIssue } from '../core/locale.js';
import { useAxcLocale } from '../ui/provider.js';

export const startsWith = (path: AxcPath, prefix: AxcPath) =>
	path.length >= prefix.length && prefix.every((key, index) => path[index] === key);

/** Issues at `path` or one level below it (e.g. a group's own `rules`), excluding deeper nodes. */
export const ownIssues = (issues: AxcIssue[], path: AxcPath) =>
	issues.filter((issue) => startsWith(issue.path, path) && issue.path.length <= path.length + 1);

/** Control props linking a control to the issue text rendered with `id`, when any issue starts with `prefix`. */
export const issueProps = (issues: AxcIssue[], prefix: AxcPath, id: string) =>
	issues.some((issue) => startsWith(issue.path, prefix)) ? { invalid: true, describedBy: id } : {};

/** Renders issues next to the control they belong to. `id` is what controls reference via `describedBy`. */
export function Issues({ issues, id }: { issues: AxcIssue[]; id?: string }) {
	const locale = useAxcLocale();
	if (!issues.length) return null;
	return (
		<div className="axc-error" role="alert" id={id}>
			{issues.map((issue, index) => (
				<div key={index}>{formatIssue(issue, locale)}</div>
			))}
		</div>
	);
}
