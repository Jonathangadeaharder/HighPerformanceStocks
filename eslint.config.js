import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default tseslint.config(
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'dist/**',
			'coverage/**',
			'data/**',
			'node_modules/**',
			'holding-companies-wt/**',
			'eslint.config.js',
			'prettier.config.js',
			'svelte.config.js',
			'vite.config.js',
			'src/app.d.ts',
			'**/*.cjs',
			'lib/**/*.js'
		]
	},
	js.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	...svelte.configs.recommended,
	{
		files: ['**/*.{ts,svelte}'],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte']
			}
		},
		plugins: {
			unicorn
		},
		rules: {
			...unicorn.configs.recommended.rules,
			complexity: ['error', 20],
			'max-depth': ['error', 4],
			'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{ prefer: 'type-imports', fixStyle: 'inline-type-imports' }
			],
			'@typescript-eslint/explicit-function-return-type': [
				'error',
				{
					allowExpressions: true,
					allowHigherOrderFunctions: true,
					allowTypedFunctionExpressions: true
				}
			],
			'@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'@typescript-eslint/no-unsafe-assignment': 'warn',
			'@typescript-eslint/no-unnecessary-condition': 'error',
			'@typescript-eslint/prefer-regexp-exec': 'off',
			'@typescript-eslint/restrict-template-expressions': ['warn', { allowNumber: true }],
			'@typescript-eslint/return-await': ['error', 'in-try-catch'],
			'@typescript-eslint/switch-exhaustiveness-check': 'error',
			'unicorn/filename-case': [
				'error',
				{
					case: 'kebabCase',
					ignore: ['^\\+page(?:\\.server)?$', '^app\\.d$']
				}
			],
			'unicorn/no-array-for-each': 'error',
			'unicorn/no-array-sort': 'off',
			'unicorn/no-null': 'off',
			'unicorn/no-array-reduce': 'off',
			'unicorn/import-style': 'off',
			'unicorn/numeric-separators-style': 'off',
			'unicorn/prefer-top-level-await': 'off',
			'unicorn/prefer-string-replace-all': 'off',
			'unicorn/prefer-switch': 'off',
			'unicorn/text-encoding-identifier-case': 'off',
			'unicorn/prevent-abbreviations': 'off'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: tseslint.parser,
				svelteConfig
			}
		},
		rules: {
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-member-accessibility': 'off'
		}
	},
	{
		files: ['scripts/**/*.ts'],
		languageOptions: {
			globals: {
				...globals.node
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			}
		},
		plugins: {
			unicorn
		},
		rules: {
			'no-console': 'off',
			...unicorn.configs.recommended.rules,
			complexity: 'off',
			'max-depth': 'off',
			'max-lines-per-function': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unnecessary-condition': 'off',
			'@typescript-eslint/restrict-plus-operands': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': 'off',
			'unicorn/filename-case': 'off',
			'unicorn/no-array-for-each': 'off',
			'unicorn/no-array-reduce': 'off',
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/import-style': 'off',
			'unicorn/prefer-top-level-await': 'off',
			'unicorn/no-null': 'off',
			'unicorn/no-zero-fractions': 'off',
			'unicorn/no-process-exit': 'off',
			'unicorn/prefer-number-properties': 'off',
			'unicorn/text-encoding-identifier-case': 'off'
		}
	},
	prettierConfig
);
