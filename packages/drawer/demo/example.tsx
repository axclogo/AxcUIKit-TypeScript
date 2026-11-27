import { useState } from 'react';
import { Drawer, zhCN, type DrawerSize } from '../src/index.js';
import '../src/styles.css';

export function DrawerExample() {
	const [open, setOpen] = useState(false),
		[history, setHistory] = useState(false),
		[toolbar, setToolbar] = useState(true),
		[size, setSize] = useState<DrawerSize>('medium');
	const [saved, setSaved] = useState('界面设计指南'),
		[draft, setDraft] = useState(saved);
	return (
		<div className="drawer-example">
			<div className="sample-switch">
				<label>
					宽度{' '}
					<select value={size} onChange={(e) => setSize(e.target.value as DrawerSize)}>
						{(['small', 'medium', 'large', 'full'] as const).map((s) => (
							<option key={s}>{s}</option>
						))}
					</select>
				</label>
				<label>
					<input type="checkbox" checked={toolbar} onChange={(e) => setToolbar(e.target.checked)} />
					底部工具栏
				</label>
			</div>
			<h2>{saved}</h2>
			<button
				type="button"
				onClick={() => {
					setDraft(saved);
					setOpen(true);
				}}
			>
				打开详情
			</button>
			<Drawer
				open={open}
				size={size}
				title={saved}
				closeLabel={zhCN.close}
				onClose={() => setOpen(false)}
				headerActions={
					<button type="button" onClick={() => setHistory(true)}>
						查看历史版本
					</button>
				}
				footer={
					toolbar ? (
						<>
							<button type="button" onClick={() => setOpen(false)}>
								取消
							</button>
							<button
								type="button"
								onClick={() => {
									setSaved(draft);
									setOpen(false);
								}}
							>
								保存
							</button>
						</>
					) : undefined
				}
			>
				<label>
					文档标题 <input value={draft} onChange={(e) => setDraft(e.target.value)} />
				</label>
				<h3>修订记录</h3>
				<ol>
					{Array.from({ length: 36 }, (_, i) => (
						<li key={i}>
							第 {36 - i} 版 · {['更新排版示例', '修订对比度说明', '补充键盘操作'][i % 3]}
						</li>
					))}
				</ol>
				<Drawer open={history} size="small" title="历史版本" closeLabel={zhCN.close} onClose={() => setHistory(false)}>
					<p>上一版：{saved}</p>
				</Drawer>
			</Drawer>
		</div>
	);
}
