import { useState } from 'react';
import { json } from '@codemirror/lang-json';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { CodeEditor } from '../src/index.js';
import { useTheme } from '../../../demo/theme.js';
const languages = {
	SQL: sql({ dialect: PostgreSQL, schema: { documents: ['id', 'title', 'status'], revisions: ['id', 'document_id'] } }),
	JSON: json(),
	Markdown: markdown(),
	Text: undefined,
};
type Language = keyof typeof languages;
export function CodeExample() {
	const theme = useTheme();
	const [active, setActive] = useState<Language>('SQL'),
		[locked, setLocked] = useState(false),
		[result, setResult] = useState('');
	const [texts, setTexts] = useState({
		SQL: 'SELECT title, status\nFROM documents\nORDER BY title;',
		JSON: '{\n  "title": "阅读清单"\n}',
		Markdown: '# 阅读清单\n\n- 设计指南',
		Text: '记录草稿',
	});
	return (
		<>
			<div className="sample-switch">
				{(Object.keys(languages) as Language[]).map((key) => (
					<button
						type="button"
						key={key}
						aria-pressed={active === key}
						onClick={() => {
							setActive(key);
							setResult('');
						}}
					>
						{key}
					</button>
				))}
				<label>
					<input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
					只读
				</label>
			</div>
			<CodeEditor
				key={active}
				label={active + ' 源码'}
				language={languages[active]}
				value={texts[active]}
				onChange={(value) => setTexts((prior) => ({ ...prior, [active]: value }))}
				theme={theme}
				wordWrap
				readOnly={locked}
				onRun={active === 'SQL' ? () => setResult('已收到运行请求（本地示例）') : undefined}
				onSave={() => setResult('已收到保存请求（本地示例）')}
			/>
			<p>⌘ / Ctrl + S 触发保存回调。SQL 支持 ⌘ / Ctrl + Enter 触发运行回调。</p>
			<output>{result}</output>
		</>
	);
}
