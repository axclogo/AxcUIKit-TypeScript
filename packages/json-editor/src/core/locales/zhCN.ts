import type { JsonEditorLocale } from './en.js';

export const zhCN: JsonEditorLocale = {
	key: '键',
	type: '类型',
	value: '值',
	true: '是',
	false: '否',
	add: '添加',
	remove: '删除',
	expand: '展开',
	collapse: '收起',
	empty: '参数',
	extra: '额外参数',
	required: '必填',
	params: '参数',
	json: 'JSON',
	choose: '请选择',
	invalidNumber: '请输入有限的 JSON 数字',
	missingKey: '请输入键名',
	duplicateKey: '键名重复',
	types: { string: '字符串', number: '数字', boolean: '布尔值', null: '空值', object: '对象', array: '数组' },
	issues: {
		expected_object: '请输入 JSON 对象',
		invalid_json: '请输入有效的 JSON',
		invalid_value: '该值不是有效的 JSON 数据',
	},
};
