import type { JsonObject, JsonValue, JsonValueType } from '../core/index.js';

type DraftValue =
	| { type: 'array' | 'object'; children: Node[] }
	| { type: 'string' | 'number'; text: string }
	| { type: 'boolean'; value: boolean }
	| { type: 'null' };

interface Origin {
	key: string;
	value: JsonValue;
}

export interface Node {
	id: number;
	key: string | undefined;
	draft: DraftValue;
	expanded: boolean;
	origin?: Origin;
	fieldName?: string;
}

let lastId = 0;

export function equal(left: JsonValue, right: JsonValue): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left)) {
		return (
			Array.isArray(right) && left.length === right.length && left.every((value, index) => equal(value, right[index]))
		);
	}
	if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(right))
		return false;
	const keys = Object.keys(left);
	return (
		keys.length === Object.keys(right).length &&
		keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]))
	);
}

const initialValues = { string: '', number: 0, boolean: false, null: null, array: [], object: {} };

export function initialValue(type: JsonValueType = 'string'): JsonValue {
	return initialValues[type];
}

export function toDraft(value: JsonValue): DraftValue {
	if (value === null) return { type: 'null' };
	if (Array.isArray(value))
		return { type: 'array', children: value.map((item, index) => fromValue(String(index), item)) };
	if (typeof value === 'object')
		return { type: 'object', children: Object.entries(value).map(([key, item]) => fromValue(key, item)) };
	if (typeof value === 'string') return { type: 'string', text: value };
	if (typeof value === 'number') return { type: 'number', text: Object.is(value, -0) ? '-0' : String(value) };
	return { type: 'boolean', value };
}

export function newNode(key: string | undefined, value: JsonValue = ''): Node {
	return { id: ++lastId, key, draft: toDraft(value), expanded: true };
}

function fromValue(key: string, value: JsonValue): Node {
	return { ...newNode(key, value), origin: { key, value } };
}

function reconcileNode(old: Node | undefined, key: string, value: JsonValue): Node {
	if (!old) return fromValue(key, value);
	const origin = { key, value };
	if (old.origin && equal(old.origin.value, value)) return { ...old, origin };
	const draft = old.draft;
	if (draft.type === 'array' && Array.isArray(value)) {
		return { ...old, key, origin, draft: { ...draft, children: reconcileArray(draft.children, value) } };
	}
	if (draft.type === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return { ...old, key, origin, draft: { ...draft, children: reconcileObject(draft.children, value) } };
	}
	return { ...old, key, origin, draft: toDraft(value) };
}

function reconcileArray(previous: Node[], value: JsonValue[]) {
	const byIndex = new Map(previous.map((node) => [node.origin?.key, node]));
	const matched = new Set<number>();
	const matches = value.map((item, index) => {
		const node = byIndex.get(String(index));
		if (node?.origin && equal(node.origin.value, item)) {
			matched.add(node.id);
			return node;
		}
		return undefined;
	});
	// First preserve entries that shifted after an external insert or removal, then reuse changed positions.
	for (const [index, item] of value.entries()) {
		if (matches[index]) continue;
		const node = previous.find(
			(candidate) => candidate.origin && !matched.has(candidate.id) && equal(candidate.origin.value, item),
		);
		if (node) {
			matches[index] = node;
			matched.add(node.id);
		}
	}
	return value.map((item, index) => {
		const key = String(index);
		const byPosition = byIndex.get(key);
		const old = matches[index] ?? (byPosition && !matched.has(byPosition.id) ? byPosition : undefined);
		return reconcileNode(old, key, item);
	});
}

export function reconcileObject(previous: Node[], value: JsonObject): Node[] {
	const byKey = new Map(previous.map((node) => [node.origin?.key, node]));
	return [
		...Object.entries(value).map(([key, item]) => reconcileNode(byKey.get(key), key, item)),
		...previous.filter(
			(node) => !node.origin && (node.fieldName === undefined || !Object.hasOwn(value, node.fieldName)),
		),
	];
}

const numericPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export function isValidNumber(text: string) {
	return numericPattern.test(text) && Number.isFinite(Number(text));
}

function readNode(node: Node): JsonValue {
	const { draft } = node;
	switch (draft.type) {
		case 'object':
			return readObject(draft.children);
		case 'array':
			return draft.children.map(readNode);
		case 'number':
			return Number(draft.text);
		case 'string':
			return draft.text;
		case 'null':
			return null;
		case 'boolean':
			return draft.value;
	}
}

function readObject(nodes: Node[]): JsonObject {
	return Object.fromEntries(nodes.flatMap((node) => (node.key === undefined ? [] : [[node.key, readNode(node)]])));
}

export function duplicates(nodes: Node[]) {
	const seen = new Set<string>();
	const repeated = new Set<string>();
	for (const { key } of nodes) {
		if (key === undefined) continue;
		if (seen.has(key)) repeated.add(key);
		seen.add(key);
	}
	return repeated;
}

function validNode(node: Node): boolean {
	const { draft } = node;
	if (draft.type === 'object') return validObject(draft.children);
	if (draft.type === 'array') return draft.children.every(validNode);
	return draft.type !== 'number' || isValidNumber(draft.text);
}

export function validObject(nodes: Node[]) {
	return !duplicates(nodes).size && nodes.every((node) => (node.key === undefined ? !node.origin : validNode(node)));
}

function markOrigin(node: Node, key: string, value: JsonValue): Node {
	const origin = { key, value };
	if (node.draft.type === 'array' && Array.isArray(value)) {
		const children = node.draft.children.map((child, index) => markOrigin(child, String(index), value[index]));
		return { ...node, origin, draft: { ...node.draft, children } };
	}
	if (node.draft.type === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return { ...node, origin, draft: { ...node.draft, children: markObject(node.draft.children, value) } };
	}
	return { ...node, origin };
}

function markObject(nodes: Node[], value: JsonObject) {
	return nodes.map((node) => (node.key === undefined ? node : markOrigin(node, node.key, value[node.key])));
}

export function commit(nodes: Node[]) {
	if (!validObject(nodes)) return undefined;
	const value = readObject(nodes);
	return { value, nodes: markObject(nodes, value) };
}
