import { useState } from 'react';
import { Drawer, zhCN as drawerLocale } from '../../drawer/src/index.js';
import '../../drawer/src/styles.css';
import { DataCrudTable, TableUIProvider, zhCN, type TableKey } from '../src/index.js';

const categories = ['设计', '开发', '质量'];
const initial = [
	{ id: 1, title: '界面设计指南', category: '设计' },
	{ id: 2, title: '组件命名约定', category: '开发' },
	{ id: 3, title: '可访问性检查清单', category: '质量' },
	{ id: 4, title: '颜色与对比度', category: '设计' },
	{ id: 5, title: '键盘交互规范', category: '开发' },
];
const columns = [
	{ key: 'title', title: '标题' },
	{ key: 'category', title: '分类', width: 90 },
];
const filters = [
	{
		type: 'select' as const,
		key: 'category',
		label: '分类',
		options: categories.map((value) => ({ value, label: value })),
	},
];
type Draft = { id?: number; title: string; category: string };

export function CrudExample() {
	const [rows, setRows] = useState(initial);
	const [draft, setDraft] = useState<Draft>();
	const [editorOpen, setEditorOpen] = useState(false);
	const edit = (value: Draft) => {
		setDraft(value);
		setEditorOpen(true);
	};
	const [keyword, setKeyword] = useState('');
	const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
	const [query, setQuery] = useState<{ keyword: string; category?: unknown }>({ keyword: '' });
	const [page, setPage] = useState(1);
	const [size, setSize] = useState(3);
	const [keys, setKeys] = useState<readonly TableKey[]>([]);
	const [notice, setNotice] = useState('');
	const [error, setError] = useState('');
	const filtered = rows.filter(
		(r) => r.title.includes(query.keyword) && (query.category === undefined || r.category === query.category),
	);
	const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / size)));
	const start = (current - 1) * size;
	const reset = () => {
		setQuery({ keyword: '' });
		setPage(1);
	};
	const remove = (ids: readonly TableKey[]) => {
		setRows(rows.filter((r) => !ids.includes(r.id)));
		setKeys(keys.filter((key) => !ids.includes(key)));
		setPage(current);
		setNotice('已删除 ' + ids.length + ' 条记录');
	};
	const save = (d: Draft) => {
		const title = d.title.trim();
		if (d.id === undefined) {
			const id = Math.max(0, ...rows.map((r) => r.id)) + 1;
			setRows([{ id, title, category: d.category }, ...rows]);
			setKeyword('');
			setFilterValues({});
			reset();
			setNotice('已新建「' + title + '」');
		} else {
			setRows(rows.map((r) => (r.id === d.id ? { ...r, title, category: d.category } : r)));
			setNotice('已保存「' + title + '」');
		}
		setEditorOpen(false);
	};
	return (
		<TableUIProvider locale={zhCN} onActionError={(e) => setError(e instanceof Error ? e.message : String(e))}>
			<DataCrudTable
				rowKey="id"
				columns={columns}
				rows={filtered.slice(start, start + size)}
				primaryActions={
					<button type="button" onClick={() => edit({ title: '', category: categories[0] })}>
						新建文档
					</button>
				}
				actions={[
					{ key: 'edit', label: '编辑', onClick: edit },
					{
						key: 'delete',
						label: '删除',
						type: 'danger',
						confirmTitle: '删除文档',
						confirm: (row) => '删除「' + row.title + '」？',
						onClick: (row) => remove([row.id]),
					},
				]}
				selection={{ selectedRowKeys: keys, onChange: setKeys }}
				batchActions={[
					{
						key: 'delete',
						label: '批量删除',
						type: 'danger',
						confirmTitle: '批量删除文档',
						confirm: ({ selectedCount }) => '删除选中的 ' + selectedCount + ' 条记录？',
						onClick: ({ selectedRowKeys }) => remove(selectedRowKeys),
					},
				]}
				keyword={keyword}
				onKeywordChange={setKeyword}
				searchPlaceholder="搜索标题"
				filters={filters}
				filterValues={filterValues}
				onFilterValuesChange={setFilterValues}
				onSearch={(text, values) => {
					setQuery({ keyword: text, category: values.category });
					setPage(1);
				}}
				onResetFilters={reset}
				pagination={{
					page: current,
					pageSize: size,
					pageSizeOptions: [3, 5],
					total: filtered.length,
					totalLabel: '共 ' + filtered.length + ' 条',
					onPageChange: setPage,
					onPageSizeChange: (n) => {
						setSize(n);
						setPage(1);
					},
				}}
				dragSort={
					query.keyword || query.category !== undefined
						? undefined
						: {
								onMove: ({ drag, nextIndex }) => {
									const next = rows.slice();
									next.splice(start + drag.rowIndex, 1);
									next.splice(start + nextIndex, 0, drag.row);
									setRows(next);
									setNotice('已调整「' + drag.row.title + '」的位置');
								},
							}
				}
			/>
			<div role="status">{notice}</div>
			{error && <p role="alert">{error}</p>}
			{draft && (
				<Drawer
					open={editorOpen}
					size="small"
					title={draft.id === undefined ? '新建文档' : '编辑文档'}
					closeLabel={drawerLocale.close}
					onClose={() => setEditorOpen(false)}
					afterClose={() => setDraft(undefined)}
					footer={
						<>
							<button type="button" onClick={() => setEditorOpen(false)}>
								取消
							</button>
							<button type="button" disabled={!draft.title.trim()} onClick={() => save(draft)}>
								保存
							</button>
						</>
					}
				>
					<div className="crud-example-fields">
						<label>
							文档标题
							<input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
						</label>
						<label>
							文档分类
							<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
								{categories.map((v) => (
									<option key={v}>{v}</option>
								))}
							</select>
						</label>
					</div>
				</Drawer>
			)}
		</TableUIProvider>
	);
}
