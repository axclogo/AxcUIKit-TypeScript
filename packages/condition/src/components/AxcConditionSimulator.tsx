import { useState } from 'react';
import type { AxcPath } from '../core/issues.js';
import { formatPath } from '../core/issues.js';
import type {
	AxcConditionEvidence,
	AxcConditionSample,
	AxcConditionSimulation,
	AxcConditionSimulationExecutor,
	AxcConditionTrace,
} from '../core/simulation.js';
import type { AxcConditionCatalog, AxcConditionValue, AxcRule, ConditionField } from '../core/types.js';
import { operatorsFor } from '../core/operators.js';
import { operatorLabel } from '../internal/condition-editor.js';
import { Button, Select } from '../ui/controls.js';
import { useAxcLocale } from '../ui/provider.js';

/** Props for the sample-driven condition simulation panel. */
export interface AxcConditionSimulatorProps extends AxcConditionCatalog {
	value: AxcConditionValue;
	samples: readonly AxcConditionSample[];
	selectedSampleId: string | null;
	/** Without it the sample picker is read-only. */
	onSelectedSampleIdChange?: (id: string) => void;
	/** Pass `simulateCondition` from `@axclogo/eval` directly. */
	simulate: AxcConditionSimulationExecutor;
	allowEmpty?: boolean;
	disabled?: boolean;
	/** Receives the evaluator's opt-in evidence snapshot. Nothing is retained by UIKit. */
	onEvidence?: (evidence: AxcConditionEvidence) => void;
	/** Called after a successful run. */
	onResult?: (result: AxcConditionSimulation, sample: AxcConditionSample) => void;
	/** Receives the original value thrown by the evaluator. */
	onError?: (error: unknown, sample: AxcConditionSample) => void;
}

interface RunContext {
	value: AxcConditionValue;
	fields: ConditionField[];
	maxLevels: number | undefined;
	allowNot: boolean | undefined;
	allowEmpty: boolean;
	simulate: AxcConditionSimulationExecutor;
	sampleId: string;
	record: Record<string, unknown>;
}

type RunState =
	| (RunContext & { status: 'succeeded'; result: AxcConditionSimulation })
	| (RunContext & { status: 'failed'; error: unknown });

const pathKey = (path: AxcPath) => JSON.stringify(path);

function checkSamples(samples: readonly AxcConditionSample[]) {
	const ids = new Set<string>();
	for (const sample of samples) {
		if (!sample.id) throw new TypeError('Condition simulation sample ids must not be empty');
		if (ids.has(sample.id)) throw new TypeError(`Duplicate condition simulation sample id "${sample.id}"`);
		ids.add(sample.id);
	}
}

function collectNodes(
	value: AxcConditionValue,
	target = new Map<string, AxcConditionValue | AxcRule>(),
	path: AxcPath = [],
) {
	target.set(pathKey(path), value);
	value.rules.forEach((node, index) => {
		const childPath = [...path, 'rules', index];
		target.set(pathKey(childPath), node);
		if ('rules' in node) collectNodes(node, target, childPath);
	});
	return target;
}

function RuleDescription({ rule, fields }: { rule: AxcRule; fields: ConditionField[] }) {
	const locale = useAxcLocale();
	const field = fields.find((item) => item.name === rule.field)!;
	const operator = operatorsFor(field).find((item) => item.name === rule.operator)!;
	return (
		<>
			{field.label} · {operatorLabel(field, operator, locale)}
		</>
	);
}

function TraceNode({
	trace,
	nodes,
	fields,
}: {
	trace: AxcConditionTrace;
	nodes: Map<string, AxcConditionValue | AxcRule>;
	fields: ConditionField[];
}) {
	const locale = useAxcLocale();
	const node = nodes.get(pathKey(trace.path))!;
	if (trace.kind === 'skipped')
		return (
			<li className="axc-simulation-skipped">
				<code>{formatPath(trace.path)}</code> ·{' '}
				{'rules' in node ? locale.ui.simulationGroup : <RuleDescription rule={node} fields={fields} />} ·{' '}
				{trace.reason === 'andShortCircuit' ? locale.ui.simulationSkippedAnd : locale.ui.simulationSkippedOr}
			</li>
		);
	if (trace.kind === 'rule')
		return (
			<li className={trace.matched ? 'axc-simulation-pass' : 'axc-simulation-block'}>
				<code>{formatPath(trace.path)}</code> · <RuleDescription rule={node as AxcRule} fields={fields} /> ·{' '}
				{trace.matched ? locale.ui.simulationPassed : locale.ui.simulationBlocked}
			</li>
		);
	return (
		<li className={trace.matched ? 'axc-simulation-pass' : 'axc-simulation-block'}>
			<code>{formatPath(trace.path)}</code> · {trace.combinator === 'and' ? locale.ui.and : locale.ui.or} ·{' '}
			{trace.negated ? locale.ui.simulationNegated : locale.ui.simulationGroup} ·{' '}
			{trace.matched ? locale.ui.simulationPassed : locale.ui.simulationBlocked}
			{trace.shortCircuitAt === undefined ? null : ` · ${locale.ui.simulationShortCircuit(trace.shortCircuitAt + 1)}`}
			<ul>
				{trace.children.map((child) => (
					<TraceNode key={pathKey(child.path)} trace={child} nodes={nodes} fields={fields} />
				))}
			</ul>
		</li>
	);
}

const errorText = (error: unknown) =>
	error instanceof Error ? error.message : (JSON.stringify(error) ?? String(error));

/**
 * Runs the selected sample through `@axclogo/eval` and renders its decisive rules and exact short-circuit trace.
 * UIKit does not evaluate, repair or retain conditions, records, results or evidence itself.
 * Empty or duplicate sample ids throw `TypeError` during render. Evaluator failures are displayed and passed
 * unchanged to `onError`; exceptions from host callbacks are not intercepted.
 */
export function AxcConditionSimulator({
	value,
	fields,
	maxLevels,
	allowNot,
	samples,
	selectedSampleId,
	onSelectedSampleIdChange,
	simulate,
	allowEmpty = false,
	disabled,
	onEvidence,
	onResult,
	onError,
}: AxcConditionSimulatorProps) {
	checkSamples(samples);
	const locale = useAxcLocale();
	const [run, setRun] = useState<RunState | null>(null);
	const sample = samples.find((item) => item.id === selectedSampleId);
	const current =
		run &&
		run.value === value &&
		run.fields === fields &&
		run.maxLevels === maxLevels &&
		run.allowNot === allowNot &&
		run.allowEmpty === allowEmpty &&
		run.simulate === simulate &&
		run.sampleId === selectedSampleId &&
		run.record === sample?.record
			? run
			: null;
	const options = [
		...(selectedSampleId !== null && !sample
			? [{ value: selectedSampleId, label: locale.ui.unknownSample(selectedSampleId), disabled: true }]
			: []),
		...(selectedSampleId === null ? [{ value: '', label: locale.ui.chooseSample, disabled: true }] : []),
		...samples.map((item) => ({ value: item.id, label: item.label })),
	];
	const execute = () => {
		const selected = sample!;
		const context = {
			value,
			fields,
			maxLevels,
			allowNot,
			allowEmpty,
			simulate,
			sampleId: selected.id,
			record: selected.record,
		};
		let result: AxcConditionSimulation;
		try {
			result = simulate(value, { fields, maxLevels, allowNot }, selected.record, allowEmpty, onEvidence);
		} catch (error) {
			setRun({ ...context, status: 'failed', error });
			onError?.(error, selected);
			return;
		}
		setRun({ ...context, status: 'succeeded', result });
		onResult?.(result, selected);
	};
	const nodes = current?.status === 'succeeded' ? collectNodes(value) : null;
	return (
		<div className="axc-condition-simulator">
			<div className="axc-toolbar">
				<Select
					label={locale.ui.simulationSample}
					value={selectedSampleId ?? ''}
					options={options}
					disabled={Boolean(disabled || !onSelectedSampleIdChange || !samples.length)}
					onChange={(id) => onSelectedSampleIdChange?.(id)}
				/>
				<Button disabled={Boolean(disabled || !sample)} onClick={execute}>
					{locale.ui.runSimulation}
				</Button>
			</div>
			{current?.status === 'failed' && (
				<div className="axc-error" role="alert">
					{locale.ui.simulationFailed(errorText(current.error))}
				</div>
			)}
			{current?.status === 'succeeded' && nodes && (
				<div className="axc-simulation-result">
					<p className={current.result.matched ? 'axc-simulation-pass' : 'axc-simulation-block'} role="status">
						{current.result.matched ? locale.ui.simulationMatched : locale.ui.simulationNotMatched}
					</p>
					<strong>{locale.ui.simulationDecisiveRules}</strong>
					{current.result.decisiveRules.length ? (
						<ul>
							{current.result.decisiveRules.map((decisive) => (
								<li
									key={pathKey(decisive.path)}
									className={decisive.matched ? 'axc-simulation-pass' : 'axc-simulation-block'}
								>
									<code>{formatPath(decisive.path)}</code> ·{' '}
									<RuleDescription rule={nodes.get(pathKey(decisive.path)) as AxcRule} fields={fields} /> ·{' '}
									{decisive.matched ? locale.ui.simulationPassed : locale.ui.simulationBlocked}
								</li>
							))}
						</ul>
					) : (
						<p>{locale.ui.simulationNoDecisiveRules}</p>
					)}
					<strong>{locale.ui.simulationTrace}</strong>
					<ul className="axc-simulation-trace">
						<TraceNode trace={current.result.trace} nodes={nodes} fields={fields} />
					</ul>
				</div>
			)}
		</div>
	);
}
