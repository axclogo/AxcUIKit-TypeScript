import { AxcUIProvider } from '../src/index.js';
import { hostControls } from './host-controls.js';
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
	AxcCondition,
	AxcConditionAssist,
	AxcDecision,
	AxcDecisionAssist,
	emptyDecision,
	en,
	zhCN,
	type AxcAssistRequest,
	type AxcAssistTransport,
	type AxcDecisionValue,
	type AxcConditionValue,
	type ConditionField,
} from '../src/index.js';
import '../src/styles.css';
import './style.css';

const fields: ConditionField[] = [
	{ name: 'title', label: 'Title', dataType: 'string' },
	{ name: 'content', label: 'Content', dataType: 'string' },
	{ name: 'detail', label: 'Detail', dataType: 'string' },
	{ name: 'count', label: 'Count', dataType: 'number' },
	{ name: 'enabled', label: 'Enabled', dataType: 'boolean' },
	{ name: 'published', label: 'Published at', dataType: 'datetime' },
];
// A mix of types, a nested group and one unfinished rule, so the demo shows inline errors too.
const initial: AxcConditionValue = {
	combinator: 'and',
	not: false,
	rules: [
		{ field: 'title', operator: 'contains', value: 'alpha' },
		{ field: 'count', operator: 'between', value: [1, 10] },
		{
			combinator: 'or',
			not: false,
			rules: [
				{ field: 'enabled', operator: '=', value: true },
				{ field: 'published', operator: '>', value: '2026-01-01T00:00:00Z' },
			],
		},
		{ field: 'content', operator: 'contains', value: '' },
	],
};
const models = [{ id: 'host-model-a', provider: 'Demo', label: 'Manual round trip' }];

function App() {
	const [mode, setMode] = useState('condition');
	const [dark, setDark] = useState(false);
	const [hostUI, setHostUI] = useState(false);
	const [chinese, setChinese] = useState(false);
	const [condition, setCondition] = useState(initial);
	const [decision, setDecision] = useState<AxcDecisionValue>({
		...emptyDecision(),
		model: 'host-model-a',
		input_fields: ['title'],
		instruction: 'Does the text match the description?',
	});
	const [request, setRequest] = useState<AxcAssistRequest | null>(null);
	const [response, setResponse] = useState('');
	const [error, setError] = useState('');
	const waiting = useRef<((value: unknown) => void) | null>(null);
	// The demo only exchanges the protocol: the user pastes a response; nothing pretends a real model answered.
	const assist: AxcAssistTransport = {
		models,
		generate: (next, signal) =>
			new Promise((resolve, reject) => {
				setRequest(next);
				setResponse('');
				setError('');
				waiting.current = resolve;
				signal.addEventListener(
					'abort',
					() => {
						waiting.current = null;
						setRequest(null);
						reject(new Error('Cancelled'));
					},
					{ once: true },
				);
			}),
	};
	const sample = () =>
		JSON.stringify(
			{
				explanation: 'A hand-written protocol sample, not real model output.',
				value:
					mode === 'decision-assist'
						? {
								precondition: null,
								input_fields: ['title'],
								instruction: 'Does the text match the description? Explain why.',
								outputs: [],
								postcondition: null,
							}
						: {
								combinator: 'or',
								not: false,
								rules: [
									{ field: 'title', operator: 'contains', value: 'alpha' },
									{ field: 'title', operator: 'contains', value: 'beta' },
								],
							},
			},
			null,
			2,
		);
	return (
		<main data-axc-theme={dark ? 'dark' : 'light'}>
			<header>
				<h1>AxcCondition</h1>
				<p>Standalone condition components · React is the only dependency · no backend</p>
				<label>
					<input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />
					Dark theme
				</label>
				<label>
					<input type="checkbox" checked={hostUI} onChange={(event) => setHostUI(event.target.checked)} />
					Host button adapter example
				</label>
				<label>
					<input type="checkbox" checked={chinese} onChange={(event) => setChinese(event.target.checked)} />
					中文 (zh-CN)
				</label>
			</header>
			<nav aria-label="Component">
				{[
					['condition', 'AxcCondition'],
					['condition-assist', 'AxcConditionAssist'],
					['decision', 'AxcDecision'],
					['decision-assist', 'AxcDecisionAssist'],
				].map(([key, label]) => (
					<button type="button" key={key} aria-pressed={mode === key} onClick={() => setMode(key)}>
						{label}
					</button>
				))}
			</nav>
			<section className="example" key={mode}>
				<AxcUIProvider components={hostUI ? hostControls : undefined} locale={chinese ? zhCN : en}>
					{mode === 'condition' && <AxcCondition fields={fields} value={condition} onChange={setCondition} />}
					{mode === 'condition-assist' && (
						<AxcConditionAssist fields={fields} value={condition} onChange={setCondition} assist={assist} />
					)}
					{mode === 'decision' && (
						<AxcDecision fields={fields} value={decision} onChange={setDecision} models={models} />
					)}
					{mode === 'decision-assist' && (
						<AxcDecisionAssist
							fields={fields}
							value={decision}
							onChange={setDecision}
							models={models}
							assist={assist}
						/>
					)}
				</AxcUIProvider>
			</section>
			{request && (
				<section className="protocol">
					<h2>Host protocol round trip (no model is called)</h2>
					<p>Send the request to your model, then paste the parsed JSON below, or fill in the sample.</p>
					<details open>
						<summary>Request</summary>
						<pre>{JSON.stringify(request, null, 2)}</pre>
					</details>
					<textarea
						aria-label="Model response JSON"
						rows={10}
						value={response}
						onChange={(e) => setResponse(e.target.value)}
					/>
					<button type="button" onClick={() => setResponse(sample())}>
						Fill in sample
					</button>
					<button
						type="button"
						onClick={() => {
							try {
								const value: unknown = JSON.parse(response);
								waiting.current?.(value);
								waiting.current = null;
								setRequest(null);
							} catch (reason) {
								setError(String(reason));
							}
						}}
					>
						Submit response
					</button>
					{error && <p role="alert">{error}</p>}
				</section>
			)}
			<details className="protocol">
				<summary>Current value (in memory only)</summary>
				<pre>{JSON.stringify(mode.startsWith('condition') ? condition : decision, null, 2)}</pre>
			</details>
		</main>
	);
}

createRoot(document.getElementById('root')!).render(<App />);
