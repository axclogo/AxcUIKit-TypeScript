import { useState } from 'react';
import { JsonEditorProvider, JsonObjectEditor, zhCN, type JsonContent, type JsonField } from '../src/index.js';
import { CodeMirrorSourceEditor } from '../src/codemirror.js';
import '../src/styles.css';

const fields: JsonField[] = [
	{ name: 'title', label: '标题', type: 'string' },
	{ name: 'enabled', label: '启用', type: 'boolean' },
	{ name: 'tags', label: '标签', type: 'array', items: { type: 'string' } },
];
export function JsonExample() {
	const [content, setContent] = useState<JsonContent>({
		kind: 'value',
		value: { title: '阅读清单', enabled: true, tags: ['设计', '开发'] },
	});
	return (
		<JsonEditorProvider locale={zhCN} slots={{ SourceEditor: CodeMirrorSourceEditor }}>
			<JsonObjectEditor fields={fields} content={content} onChange={setContent} />
		</JsonEditorProvider>
	);
}
