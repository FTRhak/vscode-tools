import * as assert from 'assert';
import * as path from 'path';

import { planReactComponentGeneration, toPascalCase, toRelativeImport } from '../react/component-generation';

suite('React component generation', () => {
	test('toPascalCase normalizes kebab, snake, and camel names', () => {
		assert.strictEqual(toPascalCase('my-button'), 'MyButton');
		assert.strictEqual(toPascalCase('my_button'), 'MyButton');
		assert.strictEqual(toPascalCase('myButton'), 'MyButton');
		assert.strictEqual(toPascalCase('MyButton'), 'MyButton');
	});

	test('toRelativeImport uses a posix specifier without an extension', () => {
		const fromFile = path.join('src', 'components', 'Button', 'Button.tsx');
		const toFile = path.join('src', 'components', 'props', 'Button.props');
		assert.strictEqual(toRelativeImport(fromFile, toFile), '../props/Button.props');
	});

	test('plans tsx, css, test, and index in a folder', () => {
		const plan = planReactComponentGeneration({
			workspaceRoot: path.sep === '\\' ? 'C:\\proj' : '/proj',
			relativePath: 'src/components',
			name: 'my-button',
			inFolder: true,
			externalProps: false,
			propsPath: '',
			exportDefault: false,
			skipTests: false,
			skipStyle: false,
			style: 'css',
		});

		assert.strictEqual(plan.error, undefined);
		assert.strictEqual(plan.name, 'MyButton');
		assert.strictEqual(plan.files.length, 4);
		assert.ok(plan.files.some((file) => file.fsPath.endsWith(path.join('MyButton', 'MyButton.tsx'))));
		assert.ok(plan.files.some((file) => file.fsPath.endsWith(path.join('MyButton', 'MyButton.css'))));
		assert.ok(plan.files.some((file) => file.fsPath.endsWith(path.join('MyButton', 'MyButton.test.tsx'))));
		assert.ok(plan.files.some((file) => file.fsPath.endsWith(path.join('MyButton', 'index.ts'))));
		assert.ok(plan.files.some((file) => file.content.includes('export function MyButton')));
		assert.ok(plan.files.some((file) => file.content.includes('type MyButtonProps = {}')));
		assert.ok(plan.files.some((file) => file.content.includes('import "./MyButton.css"')));
	});

	test('skips tests and the barrel when those options are off', () => {
		const plan = planReactComponentGeneration({
			workspaceRoot: path.sep === '\\' ? 'C:\\proj' : '/proj',
			relativePath: 'src',
			name: 'Icon',
			inFolder: false,
			externalProps: false,
			propsPath: '',
			exportDefault: true,
			skipTests: true,
			skipStyle: false,
			style: 'css',
		});

		assert.strictEqual(plan.files.length, 2);
		assert.ok(plan.files.every((file) => !file.fsPath.endsWith('.test.tsx')));
		assert.ok(plan.files.every((file) => path.basename(file.fsPath) !== 'index.ts'));
		assert.ok(plan.files.some((file) => file.content.includes('export default function Icon')));
	});

	test('writes an external props file and imports it', () => {
		const root = path.sep === '\\' ? 'C:\\proj' : '/proj';
		const plan = planReactComponentGeneration({
			workspaceRoot: root,
			relativePath: 'src/components',
			name: 'Card',
			inFolder: true,
			externalProps: true,
			propsPath: 'src/components/props',
			exportDefault: false,
			skipTests: true,
			skipStyle: false,
			style: 'css',
		});

		const propsFile = plan.files.find((file) => file.fsPath.endsWith(path.join('props', 'Card.props.ts')));
		const tsxFile = plan.files.find((file) => file.fsPath.endsWith('Card.tsx'));
		assert.ok(propsFile);
		assert.ok(tsxFile);
		assert.ok(propsFile?.content.includes('export type CardProps = {}'));
		assert.ok(tsxFile?.content.includes('import type { CardProps } from "../props/Card.props"'));
	});

	test('rejects an empty name and a missing props path', () => {
		const empty = planReactComponentGeneration({
			workspaceRoot: '/proj',
			relativePath: 'src',
			name: '',
			inFolder: true,
			externalProps: false,
			propsPath: '',
			exportDefault: false,
			skipTests: false,
			skipStyle: false,
			style: 'css',
		});
		assert.ok(empty.error);

		const missingProps = planReactComponentGeneration({
			workspaceRoot: '/proj',
			relativePath: 'src',
			name: 'Tile',
			inFolder: true,
			externalProps: true,
			propsPath: '   ',
			exportDefault: false,
			skipTests: false,
			skipStyle: false,
			style: 'css',
		});
		assert.ok(missingProps.error);
	});

	test('writes scss when style is scss', () => {
		const plan = planReactComponentGeneration({
			workspaceRoot: path.sep === '\\' ? 'C:\\proj' : '/proj',
			relativePath: 'src',
			name: 'Panel',
			inFolder: false,
			externalProps: false,
			propsPath: '',
			exportDefault: false,
			skipTests: true,
			skipStyle: false,
			style: 'scss',
		});

		assert.ok(plan.files.some((file) => file.fsPath.endsWith('Panel.scss')));
		assert.ok(plan.files.every((file) => !file.fsPath.endsWith('.css')));
		assert.ok(plan.files.some((file) => file.content.includes('import "./Panel.scss"')));
	});

	test('skips the style file when skip style is on or style is none', () => {
		const skipped = planReactComponentGeneration({
			workspaceRoot: path.sep === '\\' ? 'C:\\proj' : '/proj',
			relativePath: 'src',
			name: 'Bare',
			inFolder: false,
			externalProps: false,
			propsPath: '',
			exportDefault: false,
			skipTests: true,
			skipStyle: true,
			style: 'css',
		});
		assert.strictEqual(skipped.files.length, 1);
		assert.ok(skipped.files.every((file) => !file.fsPath.match(/\.(css|scss|sass|less)$/)));
		assert.ok(!skipped.files[0].content.includes('import "./Bare.css"'));

		const none = planReactComponentGeneration({
			workspaceRoot: path.sep === '\\' ? 'C:\\proj' : '/proj',
			relativePath: 'src',
			name: 'Bare',
			inFolder: false,
			externalProps: false,
			propsPath: '',
			exportDefault: false,
			skipTests: true,
			skipStyle: false,
			style: 'none',
		});
		assert.strictEqual(none.files.length, 1);
		assert.ok(none.files.every((file) => !file.fsPath.match(/\.(css|scss|sass|less)$/)));
	});
});
