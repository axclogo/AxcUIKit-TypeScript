import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import { AxcConditionAssist, AxcDecisionAssist, emptyCondition, emptyDecision } from '../src/index.js';

test('all components render on the server', () => {
	const fields = [{ name: 't', label: 'T' }];
	const assist = { models: [], generate: async () => null };
	const html = renderToString(
		<>
			<AxcConditionAssist fields={fields} value={emptyCondition()} onChange={() => {}} assist={assist} />
			<AxcDecisionAssist fields={fields} models={[]} value={emptyDecision()} onChange={() => {}} assist={assist} />
		</>,
	);
	assert.match(html, /axc-condition-assist/);
	assert.match(html, /axc-decision-assist/);
});
