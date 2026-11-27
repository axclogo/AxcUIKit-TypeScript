import type { DecisionPlugin, PluginConfig, PluginEditorProps, ResourceService } from '../types.js';
import { httpRequest, javascript, requiredText, validateHttp } from '../execute.js';
import { PluginTextAssist, Source } from './editors.js';
import { words } from '../core/locales/index.js';
function TextField({
	p,
	name,
	label,
	source = false,
}: {
	p: PluginEditorProps;
	name: string;
	label: string;
	source?: boolean;
}) {
	const value = p.config[name] as string,
		change = (v: string) => p.onChange({ ...p.config, [name]: v });
	return (
		<>
			<label>
				{label}
				{source ? (
					<Source value={value} label={label} onChange={change} />
				) : (
					<textarea value={value} onChange={(e) => change(e.target.value)} />
				)}
			</label>
			{p.assist && (
				<PluginTextAssist
					assist={p.assist}
					language={p.language}
					value={value}
					onApply={change}
					target={label}
					context={{ inputs: p.inputs, outputs: p.outputs }}
				/>
			)}
		</>
	);
}
function Params({ p, name }: { p: PluginEditorProps; name: 'query' | 'headers' }) {
	const l = words(p.language),
		rows = p.config[name] as PluginConfig[];
	const update = (next: PluginConfig[]) => p.onChange({ ...p.config, [name]: next });
	return (
		<fieldset>
			<legend>{l[name]}</legend>
			{rows.map((row, i) => {
				const patch = (change: PluginConfig) => update(rows.map((v, j) => (i === j ? { ...v, ...change } : v)));
				return (
					<div key={i} className="axc-plugin-row">
						<input aria-label={l.key} value={row.key as string} onChange={(e) => patch({ key: e.target.value })} />
						<select
							aria-label={l.source}
							value={row.source as string}
							onChange={(e) => patch({ source: e.target.value, value: '' })}
						>
							<option value="literal">{l.literal}</option>
							<option value="input">{l.input}</option>
						</select>
						{row.source === 'input' ? (
							<select
								aria-label={l.value}
								value={row.value as string}
								onChange={(e) => patch({ value: e.target.value })}
							>
								<option value="" disabled>
									{l.input}
								</option>
								{Object.keys(p.inputs).map((k) => (
									<option key={k}>{k}</option>
								))}
							</select>
						) : (
							<input
								aria-label={l.value}
								value={row.value as string}
								onChange={(e) => patch({ value: e.target.value })}
							/>
						)}
						<button type="button" onClick={() => update(rows.filter((_, j) => j !== i))}>
							{l.remove}
						</button>
					</div>
				);
			})}
			<button type="button" onClick={() => update([...rows, { key: '', source: 'literal', value: '' }])}>
				{l.add}
			</button>
		</fieldset>
	);
}
function HttpEditor(p: PluginEditorProps) {
	const l = words(p.language);
	return (
		<>
			<label>
				{l.method}
				<select value={p.config.method as string} onChange={(e) => p.onChange({ ...p.config, method: e.target.value })}>
					{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
						<option key={m}>{m}</option>
					))}
				</select>
			</label>
			<label>
				{l.url}
				<input
					type="url"
					value={p.config.url as string}
					onChange={(e) => p.onChange({ ...p.config, url: e.target.value })}
				/>
			</label>
			<Params p={p} name="query" />
			<Params p={p} name="headers" />
			<label>
				{l.body}
				<textarea
					value={p.config.body as string}
					placeholder={l.bodyHint}
					onChange={(e) => p.onChange({ ...p.config, body: e.target.value })}
				/>
			</label>
		</>
	);
}
function JsEditor(p: PluginEditorProps) {
	return <TextField p={p} name="code" label={words(p.language).code} source />;
}
function ResourceEditor({
	id,
	service,
	...p
}: PluginEditorProps & { id: 'ai' | 'model' | 'script'; service?: ResourceService }) {
	const l = words(p.language);
	const resources = service?.resources;
	const selected = resources?.findIndex((r) => r.id === p.config.id && r.version === p.config.version) ?? -1;
	return (
		<>
			<label>
				{l.resource}
				<select
					disabled={!resources?.length}
					value={selected}
					onChange={(e) => {
						const resource = resources![Number(e.target.value)];
						p.onChange({ ...p.config, id: resource.id, version: resource.version });
					}}
				>
					<option value={-1} disabled>
						{p.config.id
							? `${p.config.id} · ${p.config.version}`
							: resources?.length
								? l.required
								: resources
									? l.empty
									: l.catalog}
					</option>
					{resources?.map((resource, index) => (
						<option value={index} key={JSON.stringify([resource.id, resource.version])}>
							{resource.label} · {resource.version}
						</option>
					))}
				</select>
			</label>
			{service?.actions}
			{id === 'ai' && <TextField p={p} name="prompt" label={l.prompt} />}
		</>
	);
}
/**
 * Create five independent browser presets. Resource catalogs and invokers are host-owned.
 * Missing integrations and invalid configurations throw TypeError; host invocation failures propagate.
 */
export function builtinDecisionPlugins(
	options: { language?: 'en' | 'zh-CN'; ai?: ResourceService; model?: ResourceService; script?: ResourceService } = {},
): DecisionPlugin[] {
	const l = words(options.language);
	const resource = (id: 'ai' | 'model' | 'script'): DecisionPlugin => {
		const service = options[id];
		const resources = service?.resources;
		const unavailable = !resources ? l.catalog : !service?.invoke ? l.executor : undefined;
		return {
			id,
			label: l[id],
			initialConfig: () =>
				id === 'ai' ? ({ id: '', version: '', prompt: '' } as PluginConfig) : { id: '', version: '' },
			unavailable,
			validate(config) {
				if (!resources) throw new TypeError(l.catalog);
				if (!resources.some((r) => r.id === config.id && r.version === config.version)) throw new TypeError(l.required);
				if (id === 'ai') requiredText(config, 'prompt');
			},
			async execute(call) {
				if (unavailable) throw new TypeError(unavailable);
				const result = await service!.invoke!(
					{ id: call.config.id as string, version: call.config.version as string },
					call,
				);
				if (id === 'ai' && typeof result !== 'string') throw new TypeError('Expected raw AI text');
				return result;
			},
			renderEditor: (p) => <ResourceEditor {...p} id={id} service={service} />,
		};
	};
	return [
		resource('ai'),
		resource('model'),
		{
			id: 'javascript',
			label: l.js,
			initialConfig: () => ({ code: 'return input;' }),
			renderEditor: (p) => <JsEditor {...p} />,
			validate(c) {
				requiredText(c, 'code');
			},
			execute: javascript,
		},
		{
			id: 'http',
			label: l.http,
			initialConfig: () => ({ method: 'GET', url: '', headers: [], query: [], body: '' }),
			renderEditor: (p) => <HttpEditor {...p} />,
			validate: validateHttp,
			execute: httpRequest,
			requireTest: true,
		},
		resource('script'),
	];
}
