import { lazy, Suspense } from 'react';
import { AxcAssistAction, type AxcAssistResult, type AxcAssistTransport } from '@axclogo/uikit/condition';
import { words } from '../core/locales/index.js';
const Code = lazy(async () => ({ default: (await import('@axclogo/uikit/code-editor')).CodeEditor }));
const Json = lazy(async () => ({
	default: (await import('@axclogo/uikit/json-editor/codemirror')).CodeMirrorSourceEditor,
}));
export function JsonView({ value, label }: { value: unknown; label: string }) {
	return (
		<Suspense fallback={<pre>{JSON.stringify(value, null, 2)}</pre>}>
			<Json readOnly value={JSON.stringify(value, null, 2)} label={label} onChange={() => {}} height={140} />
		</Suspense>
	);
}
export function Source({ value, label, onChange }: { value: string; label: string; onChange: (s: string) => void }) {
	return (
		<Suspense fallback={null}>
			<Code label={label} value={value} onChange={onChange} />
		</Suspense>
	);
}
function textCandidate(input: unknown): AxcAssistResult<string> {
	if (
		!input ||
		typeof input !== 'object' ||
		!('explanation' in input) ||
		typeof input.explanation !== 'string' ||
		!('value' in input) ||
		typeof input.value !== 'string' ||
		Object.keys(input).length !== 2
	)
		throw new TypeError('Expected { explanation: string, value: string }');
	return { explanation: input.explanation, value: input.value };
}
/** Offer a reviewed text draft for a plugin-owned field. Only adoption calls onApply. */
export function PluginTextAssist({
	assist,
	context,
	value,
	onApply,
	target,
	language,
}: {
	assist: AxcAssistTransport;
	context: unknown;
	value: string;
	onApply: (text: string) => void;
	target: string;
	language?: 'en' | 'zh-CN';
}) {
	const current = { target, context, value };
	return (
		<AxcAssistAction
			transport={assist}
			current={current}
			label={words(language).assist}
			build={(model, requirement) => ({
				model,
				prompt: JSON.stringify({ target, context, current: value, requirement }),
				response_schema: {
					type: 'object',
					additionalProperties: false,
					required: ['explanation', 'value'],
					properties: { explanation: { type: 'string' }, value: { type: 'string' } },
				},
			})}
			parse={textCandidate}
			validate={() => []}
			preview={(text, change) => <textarea aria-label={target} value={text} onChange={(e) => change(e.target.value)} />}
			onApply={onApply}
		/>
	);
}
