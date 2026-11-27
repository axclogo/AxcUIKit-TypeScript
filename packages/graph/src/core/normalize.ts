import {
	relationGraphRelationKey,
	type RelationGraphModel,
	type RelationGraphNode,
	type RelationGraphRelation,
} from './index.js';

const required = ['id', 'related_id', 'name', 'relation_type'];
/** A malformed relation record or table, with the path of the first invalid value. */
export class RelationGraphDataError extends Error {
	constructor(
		readonly path: string,
		readonly reason: string,
	) {
		super(path + ': ' + reason);
		this.name = 'RelationGraphDataError';
	}
}
function invalid(path: string, message: string): never {
	throw new RelationGraphDataError(path, message);
}
function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, path: string): string {
	return typeof value === 'string' && value.trim() ? value.trim() : invalid(path, 'expected a non-empty string');
}
function key(value: unknown, path: string) {
	return typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value, path);
}
function columns(names: readonly unknown[], path: string) {
	if (
		!required.every((n) => names.includes(n)) ||
		names.some((n) => typeof n !== 'string' || (n !== 'color' && !required.includes(n))) ||
		new Set(names).size !== names.length
	)
		invalid(path, 'expected id, related_id, name, relation_type and optional color');
}
function records(input: unknown): readonly unknown[] {
	if (typeof input === 'string') {
		let data: unknown;
		try {
			data = JSON.parse(input);
		} catch (e) {
			if (e instanceof SyntaxError) return invalid('$', e.message);
			throw e;
		}
		return Array.isArray(data) ? data : invalid('$', 'expected a JSON array');
	}
	if (Array.isArray(input)) return input;
	if (!object(input) || Object.keys(input).length !== 2 || !Array.isArray(input.columns) || !Array.isArray(input.rows))
		return invalid('$', 'expected a record array or a columns/rows table');
	const names: unknown[] = input.columns;
	columns(names, 'columns');
	return input.rows.map((r: unknown, i: number) => {
		if (!Array.isArray(r) || r.length !== names.length) return invalid('rows[' + i + ']', 'incorrect row width');
		return Object.fromEntries(names.map((n, j) => [String(n), r[j]]));
	});
}
/** Parse records, JSON text or a rectangular table. Throws RelationGraphDataError for malformed data or unresolved edges. */
export function normalizeRelationGraph(input: unknown): RelationGraphModel {
	const nodes = new Map<string, RelationGraphNode>(),
		edges = new Map<string, RelationGraphRelation>();
	for (const [i, record] of records(input).entries()) {
		const path = 'rows[' + i + ']';
		if (!object(record)) return invalid(path, 'expected a record');
		columns(Object.keys(record), path);
		const id = key(record.id, path + '.id'),
			name = text(record.name, path + '.name'),
			previous = nodes.get(id);
		const color = record.color == null ? undefined : text(record.color, path + '.color');
		if (color && !/^#[0-9a-f]{6}$/i.test(color)) return invalid(path + '.color', 'expected #RRGGBB');
		if (previous && (previous.name !== name || (previous.color && color && previous.color !== color)))
			return invalid(path, 'conflicting node declaration: ' + id);
		const chosen = color ?? previous?.color;
		nodes.set(id, chosen ? { id, name, color: chosen } : { id, name });
		if (record.related_id === null) {
			if (record.relation_type !== null)
				return invalid(path + '.relation_type', 'expected null for a node-only declaration');
			continue;
		}
		const target = key(record.related_id, path + '.related_id'),
			type = text(record.relation_type, path + '.relation_type');
		const edgeKey = relationGraphRelationKey(id, target, type);
		if (edges.has(edgeKey)) return invalid(path, 'duplicate relation: ' + edgeKey);
		edges.set(edgeKey, { key: edgeKey, source: id, target, type });
	}
	for (const e of edges.values()) if (!nodes.has(e.target)) return invalid(e.key, 'undeclared target: ' + e.target);
	return {
		nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
		relations: [...edges.values()].sort(
			(a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.type.localeCompare(b.type),
		),
	};
}
