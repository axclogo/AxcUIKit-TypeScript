# Code Editor

A controlled text editor backed by CodeMirror 6. Plain text requires just the component. Import the official extension for each language your application uses. For SQL, install `@codemirror/lang-sql`; for Markdown, install `@codemirror/lang-markdown`. Keep extensions stable across renders.

```tsx
import { useState } from 'react';
import { CodeEditor } from '@axclogo/uikit/code-editor';
import { sql, PostgreSQL } from '@codemirror/lang-sql';

const language = sql({ dialect: PostgreSQL, schema: { documents: ['id', 'title'] } });

export function Query() {
	const [value, setValue] = useState('SELECT title FROM documents');
	return <CodeEditor label="Query" value={value} onChange={setValue} language={language} wordWrap />;
}
```

The SQL extension provides dialect support and schema-aware completion. Markdown and JSON use `markdown()` and `json()` from their official language packages. Extra CodeMirror extensions can supply completion sources and diagnostics. The editor accepts a CSS height or a pixel number, supports light/dark themes, and allows the Tab key to move focus. Read-only content remains selectable. Disabled editors leave the tab sequence. Mod-Enter invokes the supplied run callback and Mod-S invokes the save callback. The application owns execution, persistence and error reporting.

The shared text-control contract is exported as `SourceTextProps`.

For structured JSON, use `JsonObjectEditor`; its optional `json-editor/codemirror` slot binds this editor to the JSON extension. JSON parsing, invalid text and parameter-mode switching belong to the JSON editor. Its native entry stays independent of CodeMirror.

[Public interface](api/index.api.md)
