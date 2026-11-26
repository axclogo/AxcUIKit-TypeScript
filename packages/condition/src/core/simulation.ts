import type { AxcPath } from './issues.js';
import type { AxcConditionCatalog, AxcConditionValue } from './types.js';

/** One record offered to the condition simulator. `id` must be non-empty and unique within the list. */
export interface AxcConditionSample {
	id: string;
	label: string;
	record: Record<string, unknown>;
}

/** An evaluated condition group in an `@axclogo/eval` simulation trace. */
export interface AxcConditionGroupTrace {
	kind: 'group';
	path: AxcPath;
	combinator: 'and' | 'or';
	negated: boolean;
	rawMatched: boolean;
	matched: boolean;
	shortCircuitAt?: number;
	children: AxcConditionTrace[];
}

/** An evaluated leaf rule in an `@axclogo/eval` simulation trace. */
export interface AxcConditionRuleTrace {
	kind: 'rule';
	path: AxcPath;
	field: string;
	operator: string;
	matched: boolean;
}

/** A node that normal short-circuit execution did not evaluate. */
export interface AxcConditionSkippedTrace {
	kind: 'skipped';
	path: AxcPath;
	reason: 'andShortCircuit' | 'orShortCircuit';
}

/** One node in the exact execution trace returned by `@axclogo/eval`. */
export type AxcConditionTrace = AxcConditionGroupTrace | AxcConditionRuleTrace | AxcConditionSkippedTrace;

/** An evaluated rule whose result contributed to the root result. */
export interface AxcDecisiveRule {
	path: AxcPath;
	matched: boolean;
}

/** Result returned by `@axclogo/eval`'s `simulateCondition`. */
export interface AxcConditionSimulation {
	matched: boolean;
	trace: AxcConditionTrace;
	decisiveRules: AxcDecisiveRule[];
}

/** Optional evidence snapshot emitted by `@axclogo/eval` for one simulation. */
export interface AxcConditionEvidence {
	snapshotId: string;
	kind: 'condition';
	input: Record<string, unknown>;
	outcome: { status: 'succeeded'; result: AxcConditionSimulation } | { status: 'failed'; error: unknown };
}

/**
 * Structural type of `@axclogo/eval`'s `simulateCondition` export. It validates and evaluates one record,
 * returning the real execution trace. It throws the evaluator's structured error for invalid inputs.
 */
export type AxcConditionSimulationExecutor = (
	condition: AxcConditionValue,
	catalog: AxcConditionCatalog,
	record: Record<string, unknown>,
	allowEmpty: boolean,
	evidenceCallback?: (evidence: AxcConditionEvidence) => void,
) => AxcConditionSimulation;
