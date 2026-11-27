import { useState } from 'react';
import type { ConditionField } from '@axclogo/uikit/condition';
import type { PluginPlan, PluginOutput } from '../types.js';
import { words } from '../core/locales/index.js';
export function InputBindings({
	plan,
	fields,
	change,
	language,
}: {
	plan: PluginPlan;
	fields: ConditionField[];
	change: (inputs: Record<string, string>) => void;
	language?: 'en' | 'zh-CN';
}) {
	const l = words(language);
	const [key, setKey] = useState(''),
		[field, setField] = useState('');
	return (
		<fieldset>
			<legend>{l.inputs}</legend>
			{Object.entries(plan.inputs).map(([k, v]) => (
				<div className="axc-plugin-row" key={k}>
					<code>{k}</code> ← {v}
					<button
						type="button"
						aria-label={l.remove + ' ' + k}
						onClick={() => change(Object.fromEntries(Object.entries(plan.inputs).filter(([n]) => n !== k)))}
					>
						{l.remove}
					</button>
				</div>
			))}
			<div className="axc-plugin-row">
				<input aria-label={l.key} placeholder={l.key} value={key} onChange={(e) => setKey(e.target.value)} />
				<select aria-label={l.field} value={field} onChange={(e) => setField(e.target.value)}>
					<option value="" disabled>
						{l.field}
					</option>
					{fields.map((f) => (
						<option key={f.name} value={f.name} disabled={f.disabled}>
							{f.label}
						</option>
					))}
				</select>
				<button
					type="button"
					disabled={
						!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
						!fields.some((f) => f.name === field && !f.disabled) ||
						Object.hasOwn(plan.inputs, key)
					}
					onClick={() => {
						change({ ...plan.inputs, [key]: field });
						setKey('');
					}}
				>
					{l.add}
				</button>
			</div>
		</fieldset>
	);
}
export function OutputBindings({
	outputs,
	change,
	language,
}: {
	outputs: PluginOutput[];
	change: (v: PluginOutput[]) => void;
	language?: 'en' | 'zh-CN';
}) {
	const l = words(language);
	return (
		<fieldset>
			<legend>{l.outputs}</legend>
			{outputs.map((o, i) => {
				const edit = (p: Partial<PluginOutput>) => change(outputs.map((v, j) => (j === i ? { ...v, ...p } : v)));
				return (
					<div className="axc-plugin-row" key={i}>
						<input
							placeholder={l.key}
							aria-label={l.key}
							value={o.key}
							onChange={(e) => edit({ key: e.target.value })}
						/>
						<input
							placeholder={l.path}
							aria-label={l.path}
							value={o.path}
							onChange={(e) => edit({ path: e.target.value })}
						/>
						<select
							aria-label={l.type}
							value={o.type}
							onChange={(e) => edit({ type: e.target.value as PluginOutput['type'] })}
						>
							{['number', 'string', 'boolean'].map((t) => (
								<option key={t}>{t}</option>
							))}
						</select>
						<button type="button" onClick={() => change(outputs.filter((_, j) => i !== j))}>
							{l.remove}
						</button>
					</div>
				);
			})}
			<button type="button" onClick={() => change([...outputs, { key: '', type: 'string', path: '$' }])}>
				{l.add}
			</button>
		</fieldset>
	);
}
