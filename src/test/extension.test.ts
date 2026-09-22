import * as assert from 'assert';

import * as vscode from 'vscode';
import { getWebviewContent } from '../tools/fonts/font-preview-page';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('font preview HTML applies preview font and allows inline styles', () => {
		const mockPanel = {
			webview: {
				cspSource: 'https://example.test',
				asWebviewUri: (uri: vscode.Uri) => uri,
			},
		};
		const html = getWebviewContent(
			mockPanel as any,
			vscode.Uri.file('C:/workspace/extension'),
			vscode.Uri.file('C:/workspace/files/Example-Regular.ttf'),
			'Example-Regular.ttf',
		);

		assert.ok(html.includes("font-family: preview"));
		assert.ok(html.includes('font-family: preview, sans-serif'));
		assert.ok(html.includes("style-src https://example.test 'unsafe-inline'"));
	});
});
