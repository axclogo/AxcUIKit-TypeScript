import type { ReactNode } from 'react';
import type {
	AxcAssistTransport,
	AxcConditionCatalog,
	AxcConditionSimulation,
	AxcConditionValue,
} from '@axclogo/uikit/condition';
export type PluginJson = string | number | boolean | null | PluginJson[] | { [key: string]: PluginJson };
export type PluginConfig = { [key: string]: PluginJson };
export type PluginOutput = { key: string; path: string; type: 'string' | 'number' | 'boolean' };
export interface PluginPlan {
	version: 1;
	plugin: string;
	config: PluginConfig;
	inputs: Record<string, string>;
	outputs: PluginOutput[];
	precondition: AxcConditionValue | null;
	postcondition: AxcConditionValue;
}
export interface PluginEditorProps {
	config: PluginConfig;
	onChange: (config: PluginConfig) => void;
	inputs: Readonly<Record<string, string>>;
	outputs: readonly PluginOutput[];
	assist?: AxcAssistTransport;
	language?: 'en' | 'zh-CN';
}
export type PluginInvocation = { config: PluginConfig; input: PluginConfig; signal: AbortSignal };
export interface DecisionPlugin {
	id: string;
	label: string;
	initialConfig: () => PluginConfig;
	/** Render configuration controls; return stable component elements to preserve editor state. */
	renderEditor: (props: PluginEditorProps) => ReactNode;
	validate: (config: PluginConfig) => void;
	execute: (call: PluginInvocation) => Promise<PluginJson>;
	unavailable?: string;
	requireTest?: boolean;
}
export interface PluginResource {
	id: string;
	version: string;
	label: string;
}
export interface ResourceService {
	resources?: readonly PluginResource[];
	actions?: ReactNode;
	invoke?: (resource: { id: string; version: string }, call: PluginInvocation) => Promise<PluginJson>;
}
export type PluginReply =
	{ status: 'ok'; requestId: string; result: PluginJson } | { status: 'failed'; requestId: string; error: PluginJson };
export type PluginEvaluation =
	| { status: 'skipped'; pre: AxcConditionSimulation }
	| { status: 'needPlugin'; requestId: string; input: PluginConfig; pre: AxcConditionSimulation | null }
	| {
			status: 'decided';
			requestId: string;
			pre: AxcConditionSimulation | null;
			matched: boolean;
			outputs: PluginConfig;
			post: AxcConditionSimulation;
	  };
export interface PluginEvidence {
	kind: 'plugin';
	snapshotId: string;
	input: PluginConfig;
	outcome: PluginConfig;
}
/** Evidence tagged by the orchestrator so sample outputs cannot be mistaken for live plugin results. */
export interface PluginRunEvidence extends PluginEvidence {
	resultSource: 'plugin' | 'sample';
}
export interface PluginEvaluator {
	pluginInput: (bindings: Record<string, string>, catalog: AxcConditionCatalog, record: PluginConfig) => PluginConfig;
	validatePlugin: (plan: PluginPlan, catalog: AxcConditionCatalog) => void;
	projectPluginOutputs: (plugin: string, outputs: PluginOutput[], raw: PluginJson) => PluginConfig;
	evaluatePlugin: (
		plan: PluginPlan,
		catalog: AxcConditionCatalog,
		record: PluginConfig,
		reply?: PluginReply,
		evidence?: (snapshot: PluginEvidence) => void,
	) => PluginEvaluation;
}
