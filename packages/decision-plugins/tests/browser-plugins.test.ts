import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { httpRequest, javascript, validateHttp } from '../src/execute.js';
import type { PluginConfig } from '../src/types.js';

const config: PluginConfig = {
	url: 'https://example.test/evaluate?keep=1',
	method: 'POST',
	query: [{ key: 'count', source: 'input', value: 'count' }],
	headers: [{ key: 'x-enabled', source: 'input', value: 'enabled' }],
	body: '{"payload":{"$input":"payload"},"literal":"unchanged"}',
};

test('HTTP maps typed arguments into query, headers and nested JSON without changing inputs', async (t) => {
	const input = { count: 0, enabled: false, payload: { values: [1, 2] } };
	const signal = new AbortController().signal;
	t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
		assert.equal(url.toString(), 'https://example.test/evaluate?keep=1&count=0');
		assert.equal((init.headers as Headers).get('x-enabled'), 'false');
		assert.equal((init.headers as Headers).get('content-type'), 'application/json');
		assert.deepEqual(JSON.parse(init.body as string), { payload: input.payload, literal: 'unchanged' });
		assert.equal(init.signal, signal);
		return new Response('{"score":0,"active":false}');
	});
	validateHttp(config);
	assert.deepEqual(await httpRequest({ config, input, signal }), { score: 0, active: false });
	assert.deepEqual(input, { count: 0, enabled: false, payload: { values: [1, 2] } });
});

test('HTTP rejects invalid configurations and explicit mapping failures before requesting', async (t) => {
	let calls = 0;
	t.mock.method(globalThis, 'fetch', async () => {
		calls++;
		return new Response('{}');
	});
	const invalidConfigurations: PluginConfig[] = [
		{ url: 'file:///tmp/test' },
		{ method: 'INVALID' },
		{ method: 'GET' },
		{ query: [{ key: 'x', source: 'other', value: '' }] },
		{
			headers: [
				{ key: 'x', source: 'literal', value: '' },
				{ key: 'x', source: 'literal', value: '' },
			],
		},
		{
			headers: [
				{ key: 'X-Key', source: 'literal', value: '' },
				{ key: 'x-key', source: 'literal', value: '' },
			],
		},
		{ body: '{' },
		{ body: '{"score":1e999}' },
	];
	for (const change of invalidConfigurations)
		assert.throws(() => validateHttp({ ...config, ...change }), JSON.stringify(change));
	const signal = new AbortController().signal;
	const invalidInputs: PluginConfig[] = [{}, { count: {}, enabled: true }, { count: 1, enabled: true }];
	for (const input of invalidInputs) {
		await assert.rejects(httpRequest({ config, input, signal }), /Missing input|Expected scalar/);
	}
	assert.equal(calls, 0);
});

test('HTTP keeps network errors, status failures and malformed output visible', async (t) => {
	const signal = new AbortController().signal;
	const invocation = { config: { ...config, query: [], headers: [], body: '' }, input: {}, signal };
	const failure = new Error('offline');
	t.mock.method(globalThis, 'fetch', async () => {
		throw failure;
	});
	await assert.rejects(httpRequest(invocation), (e) => e === failure);
	t.mock.method(globalThis, 'fetch', async () => new Response('denied', { status: 403, statusText: 'Forbidden' }));
	await assert.rejects(httpRequest(invocation), /HTTP 403/);
	t.mock.method(globalThis, 'fetch', async () => new Response('invalid'));
	await assert.rejects(httpRequest(invocation), SyntaxError);
	t.mock.method(globalThis, 'fetch', async () => new Response('{"score":1e999}'));
	await assert.rejects(httpRequest(invocation), /finite JSON/);
	const controller = new AbortController();
	controller.abort(failure);
	await assert.rejects(httpRequest({ ...invocation, signal: controller.signal }), (e) => e === failure);
});

test('JavaScript worker is terminated and its URL released on cancellation, success and construction errors', async (t) => {
	const blobs: Blob[] = [];
	const revoked: string[] = [];
	t.mock.method(URL, 'createObjectURL', (blob: Blob) => {
		blobs.push(blob);
		return 'blob:source';
	});
	t.mock.method(URL, 'revokeObjectURL', (url: string) => revoked.push(url));
	class TestWorker {
		static instances: TestWorker[] = [];
		onmessage?: (event: { data: { json: string } }) => void;
		onerror?: (event: { preventDefault: () => void; message: string }) => void;
		onmessageerror?: () => void;
		terminated = false;
		input: unknown;
		constructor() {
			TestWorker.instances.push(this);
		}
		postMessage(value: unknown) {
			this.input = value;
		}
		terminate() {
			this.terminated = true;
		}
	}
	const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
	Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: TestWorker });
	t.after(() => {
		if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
		else Reflect.deleteProperty(globalThis, 'Worker');
	});
	const controller = new AbortController();
	const pending = javascript({ config: { code: 'return input;' }, input: { value: false }, signal: controller.signal });
	const worker = TestWorker.instances[0];
	assert.deepEqual(worker.input, { value: false });
	assert.match(await blobs[0].text(), /const run = async/);
	const failure = new Error('cancelled');
	controller.abort(failure);
	await assert.rejects(pending, (e) => e === failure);
	assert.ok(worker.terminated);
	const success = javascript({ config: { code: 'return input;' }, input: {}, signal: new AbortController().signal });
	TestWorker.instances[1].onmessage!({ data: { json: '{"score":0}' } });
	assert.deepEqual(await success, { score: 0 });
	assert.ok(TestWorker.instances[1].terminated);
	const syntax = javascript({ config: { code: '!' }, input: {}, signal: new AbortController().signal });
	TestWorker.instances[2].onerror!({ preventDefault() {}, message: 'SyntaxError' });
	await assert.rejects(syntax, /SyntaxError/);
	assert.ok(TestWorker.instances[2].terminated);
	assert.equal(revoked.length, 3);
	t.mock.timers.enable({ apis: ['setTimeout'] });
	const timeout = javascript({ config: { code: 'while (true) {}' }, input: {}, signal: new AbortController().signal });
	t.mock.timers.tick(5000);
	await assert.rejects(timeout, /timed out/);
	assert.ok(TestWorker.instances[3].terminated);
	const unreadable = javascript({ config: { code: 'return input;' }, input: {}, signal: new AbortController().signal });
	TestWorker.instances[4].onmessageerror!();
	await assert.rejects(unreadable, /deserialized/);
	assert.ok(TestWorker.instances[4].terminated);
	const aborted = new AbortController();
	aborted.abort(failure);
	assert.throws(
		() => javascript({ config: { code: 'return input;' }, input: {}, signal: aborted.signal }),
		(e) => e === failure,
	);
	assert.equal(TestWorker.instances.length, 5);

	Object.defineProperty(globalThis, 'Worker', {
		value: class {
			postMessage() {}
			constructor() {
				throw failure;
			}
		},
	});
	assert.throws(
		() => javascript({ config: { code: 'return 1;' }, input: {}, signal: new AbortController().signal }),
		(e) => e === failure,
	);
	assert.equal(revoked.length, 6);
});

test('generated worker source preserves JSON values and rejects lossy JavaScript results', async (t) => {
	let source: Blob;
	t.mock.method(URL, 'createObjectURL', (blob: Blob) => {
		source = blob;
		return 'blob:source';
	});
	t.mock.method(URL, 'revokeObjectURL', () => {});
	class TestWorker {
		static instances: TestWorker[] = [];
		onmessage?: (event: { data: { json: string } | { error: string } }) => void;
		constructor() {
			TestWorker.instances.push(this);
		}
		postMessage() {}
		terminate() {}
	}
	const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
	Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: TestWorker });
	t.after(() => {
		if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
		else Reflect.deleteProperty(globalThis, 'Worker');
	});
	const execute = async (code: string) => {
		const result = javascript({ config: { code }, input: {}, signal: new AbortController().signal });
		const self = {
			onmessage: async () => {},
			postMessage: (data: { json: string } | { error: string }) => TestWorker.instances.at(-1)!.onmessage!({ data }),
		};
		runInNewContext(await source.text(), { self });
		await (self.onmessage as (event: { data: unknown }) => Promise<void>)({ data: {} });
		return result;
	};
	assert.deepEqual(await execute('return { score: 0, enabled: false, empty: null, rows: [1, "x"] };'), {
		score: 0,
		enabled: false,
		empty: null,
		rows: [1, 'x'],
	});
	assert.deepEqual(await execute('const item = {score: 1}; return {a: item, b: item};'), {
		a: { score: 1 },
		b: { score: 1 },
	});
	assert.equal(await execute('return await Promise.resolve("ok");'), 'ok');
	for (const code of [
		'return undefined;',
		'return {value: undefined};',
		'return [NaN];',
		'return Infinity;',
		'return 1n;',
		'return new Date();',
		'const item = {}; item.self = item; return item;',
		'return () => 1;',
	])
		await assert.rejects(execute(code), /JSON result/);
	await assert.rejects(execute('throw new Error("script failed");'), /script failed/);
});
