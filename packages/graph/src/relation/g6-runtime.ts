import type * as G6 from '@antv/g6';
import type { LabelStyleProps, RectStyleProps, Rect } from '@antv/g6';
import { RELATION_GRAPH_CARD_NODE_TYPE } from './g6-adapter.js';
type G6Runtime = typeof G6;
type Group = Parameters<Rect['drawBadgeShapes']>[1];
type RelationCardStyle = Required<RectStyleProps> & {
	cornerColor?: string;
	cornerPlacement?: 'left-top' | 'right-top';
	cornerText?: string;
	ribbonBackground?: string;
	ribbonForeground?: string;
	ribbonText?: string;
};

function registerRelationGraphCard(runtime: G6Runtime) {
	if (runtime.getExtension(runtime.ExtensionCategory.NODE, RELATION_GRAPH_CARD_NODE_TYPE)) return;
	class RelationGraphCard extends runtime.Rect {
		protected drawBadgeShapes(attributes: Required<RectStyleProps>, container: Group) {
			const card = attributes as RelationCardStyle;
			const key = this.getShape('key');
			const width = Number(key.attributes.width);
			const height = Number(key.attributes.height);
			const ribbonStyle: LabelStyleProps | false = card.ribbonText
				? {
						x: -width / 2 + 25,
						y: -height / 2 + 12,
						text: card.ribbonText,
						fill: card.ribbonForeground,
						fontSize: 10,
						fontWeight: 600,
						textAlign: 'center',
						textBaseline: 'middle',
						background: true,
						backgroundFill: card.ribbonBackground,
						backgroundRadius: 2,
						padding: [2, 12],
					}
				: false;
			const ribbon = this.upsert('ribbon', runtime.Label, ribbonStyle, container);
			if (ribbon) {
				ribbon.setAttribute('transformOrigin', 'center');
				ribbon.setAttribute('transform', 'rotate(-45deg)');
			}

			const cornerStyle: LabelStyleProps | false = card.cornerText
				? {
						x: card.cornerPlacement === 'right-top' ? width / 2 - 10 : -width / 2 + 10,
						y: -height / 2 + 10,
						text: card.cornerText,
						fill: card.cornerColor,
						fontSize: 11,
						fontWeight: 600,
						textAlign: 'center',
						textBaseline: 'middle',
					}
				: false;
			this.upsert('corner', runtime.Label, cornerStyle, container);
		}
	}
	runtime.register(runtime.ExtensionCategory.NODE, RELATION_GRAPH_CARD_NODE_TYPE, RelationGraphCard);
}

export async function loadRuntime() {
	const runtime = await import('@antv/g6');
	if (runtime.version !== '5.1.1') throw new Error('Expected G6 5.1.1, received ' + runtime.version);
	registerRelationGraphCard(runtime);
	return runtime;
}
