export type RelationGraphId = string | number;
export type RelationGraphRecord = {
	id: RelationGraphId;
	name: string;
	color?: string | null;
} & ({ related_id: RelationGraphId; relation_type: string } | { related_id: null; relation_type: null });
export type RelationGraphInput =
	readonly RelationGraphRecord[] | string | { columns: readonly string[]; rows: readonly (readonly unknown[])[] };
export interface RelationGraphNode {
	id: string;
	name: string;
	color?: string;
}
export interface RelationGraphRelation {
	key: string;
	source: string;
	target: string;
	type: string;
}
export interface RelationGraphModel {
	nodes: RelationGraphNode[];
	relations: RelationGraphRelation[];
}

/** Encode the ordered endpoints and relation type without delimiter collisions. Accepts all strings. */
export function relationGraphRelationKey(source: string, target: string, type: string): string {
	return `relation:${source.length}:${source}${target.length}:${target}${type.length}:${type}`;
}
export { en, zhCN, type Locale } from './locales/index.js';
export type RelationGraphSelection =
	| { id: string; type: 'node' }
	| {
			key: string;
			source: string;
			target: string;
			relationType: string;
			type: 'relation';
	  };

export { normalizeRelationGraph, RelationGraphDataError } from './normalize.js';
