import type { RelationGraphModel, RelationGraphRelation, RelationGraphSelection } from './index.js';

export type RelationGraphElementStates = Record<string, string[]>;

export const RELATION_GRAPH_IDLE_STATE = 'idle';
const CLICK_MOVEMENT_THRESHOLD_SQUARED = 25;

export function relationGraphPointerMoved(start: { x: number; y: number }, current: { x: number; y: number }) {
	const deltaX = current.x - start.x;
	const deltaY = current.y - start.y;
	return deltaX * deltaX + deltaY * deltaY >= CLICK_MOVEMENT_THRESHOLD_SQUARED;
}

export function relationGraphElementStates(
	model: RelationGraphModel,
	selection: RelationGraphSelection | null,
): RelationGraphElementStates {
	const states: RelationGraphElementStates = {};
	if (!selection) {
		model.nodes.forEach((node) => {
			states[relationGraphRendererNodeId(node.id)] = [RELATION_GRAPH_IDLE_STATE];
		});
		model.relations.forEach((relation) => {
			states[relationGraphRendererRelationId(relation.key)] = [RELATION_GRAPH_IDLE_STATE];
		});
		return states;
	}

	const activeNodeIds = new Set<string>();
	const activeRelationKeys = new Set<string>();
	if (selection.type === 'node') {
		activeNodeIds.add(selection.id);
		model.relations.forEach((relation) => {
			if (relation.source !== selection.id && relation.target !== selection.id) return;
			activeNodeIds.add(relation.source);
			activeNodeIds.add(relation.target);
			activeRelationKeys.add(relation.key);
		});
	} else {
		const relation = model.relations.find((item) => item.key === selection.key);
		if (relation) {
			activeNodeIds.add(relation.source);
			activeNodeIds.add(relation.target);
			activeRelationKeys.add(relation.key);
		}
	}

	model.nodes.forEach((node) => {
		states[relationGraphRendererNodeId(node.id)] =
			selection.type === 'node' && node.id === selection.id
				? ['selected']
				: activeNodeIds.has(node.id)
					? ['active']
					: ['inactive'];
	});
	model.relations.forEach((relation) => {
		states[relationGraphRendererRelationId(relation.key)] =
			selection.type === 'relation' && relation.key === selection.key
				? ['selected']
				: activeRelationKeys.has(relation.key)
					? ['active']
					: ['inactive'];
	});
	return states;
}

export function relationGraphSelectionForRelation(
	relation: RelationGraphRelation,
	selectionMode: 'node' | 'node-and-relation',
): RelationGraphSelection | null {
	if (selectionMode === 'node') return null;
	return {
		key: relation.key,
		source: relation.source,
		target: relation.target,
		relationType: relation.type,
		type: 'relation',
	};
}

export const relationGraphRendererNodeId = (id: string) => 'node:' + id;
export const relationGraphRendererRelationId = (key: string) => 'edge:' + key;
