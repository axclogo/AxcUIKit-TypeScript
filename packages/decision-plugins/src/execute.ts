import type { PluginConfig, PluginInvocation, PluginJson } from './types.js';

/** Read a required configuration string. Invalid configuration throws TypeError. */
export function requiredText(config: PluginConfig, key: string): string {
	const value = config[key];
	if (typeof value !== 'string' || !value.trim()) throw new TypeError('Expected nonempty ' + key);
	return value;
}
type Param = { key: string; source: 'literal' | 'input'; value: string };
function params(value: PluginJson): Param[] {
	if (!Array.isArray(value)) throw new TypeError('Expected a parameter list');
	const names = new Set<string>();
	return value.map((row) => {
		if (
			!row ||
			typeof row !== 'object' ||
			Array.isArray(row) ||
			typeof row.key !== 'string' ||
			!row.key.trim() ||
			names.has(row.key) ||
			typeof row.value !== 'string' ||
			(row.source !== 'literal' && row.source !== 'input')
		)
			throw new TypeError('Invalid or duplicate request parameter');
		names.add(row.key);
		return { key: row.key, value: row.value, source: row.source };
	});
}
/** Validate request configuration before testing or saving. Invalid fields throw TypeError. */
export function validateHttp(config: PluginConfig) {
	const url = new URL(requiredText(config, 'url'));
	if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TypeError('Expected HTTP or HTTPS URL');
	if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(requiredText(config, 'method')))
		throw new TypeError('Unsupported HTTP method');
	params(config.query);
	const headers = new Headers();
	for (const parameter of params(config.headers)) {
		if (headers.has(parameter.key)) throw new TypeError('Duplicate HTTP header');
		headers.set(parameter.key, parameter.source === 'literal' ? parameter.value : '');
	}
	if (typeof config.body !== 'string') throw new TypeError('Expected JSON body text');
	if (config.body) {
		if (config.method === 'GET') throw new TypeError('GET cannot include a body');
		assertJson(JSON.parse(config.body));
	}
}
function argument(input: PluginConfig, key: string): PluginJson {
	if (!Object.hasOwn(input, key)) throw new TypeError('Missing input: ' + key);
	return input[key];
}
function bodyValue(value: PluginJson, input: PluginConfig): PluginJson {
	if (Array.isArray(value)) return value.map((v) => bodyValue(v, input));
	if (value !== null && typeof value === 'object') {
		if (Object.keys(value).length === 1 && typeof value.$input === 'string') return argument(input, value.$input);
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bodyValue(v, input)]));
	}
	return value;
}
/** Execute a validated HTTP configuration. Network, status and JSON errors reject the call. */
export async function httpRequest({ config, input, signal }: PluginInvocation): Promise<PluginJson> {
	signal.throwIfAborted();
	const url = new URL(config.url as string),
		headers = new Headers();
	const resolve = (p: Param) => {
		const v = p.source === 'literal' ? p.value : argument(input, p.value);
		if (v === null || typeof v === 'object') throw new TypeError('Expected scalar HTTP parameter: ' + p.key);
		return String(v);
	};
	for (const p of params(config.query)) url.searchParams.set(p.key, resolve(p));
	for (const p of params(config.headers)) headers.set(p.key, resolve(p));
	const body = config.body ? JSON.stringify(bodyValue(JSON.parse(config.body as string), input)) : undefined;
	if (body && !headers.has('content-type')) headers.set('content-type', 'application/json');
	const r = await fetch(url, { method: config.method as string, headers, body, signal });
	if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);
	const result: unknown = await r.json();
	assertJson(result);
	return result;
}
/** Validate finite JSON without converting Dates, undefined properties or custom objects. */
function assertJson(value: unknown): asserts value is PluginJson {
	const ancestors = new Set<object>();
	const pending: ({ value: unknown; exit: false } | { value: object; exit: true })[] = [{ value, exit: false }];
	while (pending.length) {
		const next = pending.pop()!;
		if (next.exit) {
			ancestors.delete(next.value);
			continue;
		}
		const item = next.value;
		if (item === null || typeof item === 'string' || typeof item === 'boolean') continue;
		if (typeof item === 'number' && Number.isFinite(item)) continue;
		if (typeof item !== 'object' || ancestors.has(item)) throw new TypeError('Expected finite JSON result');
		if (
			!Array.isArray(item) &&
			Object.getPrototypeOf(item) !== Object.prototype &&
			Object.getPrototypeOf(item) !== null
		)
			throw new TypeError('Expected plain JSON result');
		ancestors.add(item);
		pending.push({ value: item, exit: true });
		for (const child of Array.isArray(item) ? item : Object.values(item)) pending.push({ value: child, exit: false });
	}
}

/** Execute trusted JavaScript in a dedicated worker. Reject on syntax/runtime errors, non-JSON output,
 * cancellation or the five-second deadline; every completed call terminates its worker. */
export function javascript({ config, input, signal }: PluginInvocation): Promise<PluginJson> {
	signal.throwIfAborted();
	const code = requiredText(config, 'code');
	// The worker keeps synchronous scripts off the UI thread. It is not a security sandbox.
	const source = `
const run = async (input) => {
${code}
};
const assertJson = ${assertJson.toString()};
self.onmessage = async ({ data }) => {
	try {
		const value = await run(data);
		assertJson(value);
		self.postMessage({ json: JSON.stringify(value) });
	} catch (error) {
		self.postMessage({ error: String(error) });
	}
};
`;
	const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
	let worker: Worker;
	try {
		worker = new Worker(url);
	} finally {
		URL.revokeObjectURL(url);
	}
	return new Promise<PluginJson>((resolve, reject) => {
		const cleanup = () => {
			clearTimeout(timer);
			signal.removeEventListener('abort', abort);
			worker.terminate();
		};
		const abort = () => {
			cleanup();
			reject(signal.reason);
		};
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error('JavaScript execution timed out'));
		}, 5000);
		signal.addEventListener('abort', abort, { once: true });
		worker.onerror = (event) => {
			event.preventDefault();
			cleanup();
			reject(new Error(event.message));
		};
		worker.onmessageerror = () => {
			cleanup();
			reject(new Error('JavaScript result could not be deserialized'));
		};
		worker.onmessage = ({ data }: { data: { json: string } | { error: string } }) => {
			cleanup();
			if ('error' in data) reject(new Error(data.error));
			else resolve(JSON.parse(data.json));
		};
		try {
			worker.postMessage(input);
		} catch (error) {
			cleanup();
			reject(error);
		}
	});
}
