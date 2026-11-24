import assert from 'node:assert/strict';
import test from 'node:test';
import { version } from 'react';
import { version as domVersion } from 'react-dom';

test('runs against the intended React major', () => {
	const expected = process.env.AXC_EXPECT_REACT ?? '19';
	assert.equal(version.split('.')[0], expected);
	assert.equal(domVersion.split('.')[0], expected);
});
