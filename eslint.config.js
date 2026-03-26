import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import { fileURLToPath } from 'node:url';

export default tseslint.config(
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'dist/**',
			'coverage/**',
			'data/**',
			'node_modules/**',
			'prettier.config.js',
			'svelte.config.js',
			'vite.config.js',
			'**/*.cjs',
			'**/*.js',
			'scripts/sandbox/**'
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs.recommended,
	{
		files: ['**/*.{ts,tsx,svelte}'],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2017
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
				extraFileExtensions: ['.svelte']
			}
		},
		plugins: {
			unicorn,
			sonarjs
		},
		rules: {
			...unicorn.configs.recommended.rules,
			...sonarjs.configs.recommended.rules,

			// Complexity & Quality
			complexity: ['warn', 50],
			'sonarjs/cognitive-complexity': ['warn', 50],
			'sonarjs/no-duplicate-string': 'warn',
			'max-depth': ['error', 4],
			'max-lines-per-function': ['warn', 100],

			// TypeScript Strictness
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{ prefer: 'type-imports', fixStyle: 'inline-type-imports' }
			],
			'@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{ allowNumber: true, allowBoolean: true, allowAny: true, allowNullish: true }
			],

			// Unicorn overrides
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/no-null': 'off',
			'unicorn/filename-case': [
				'error',
				{ case: 'kebabCase', ignore: ['^\\+page', '^\\+layout', '^app\\.d$'] }
			],
			'unicorn/import-style': 'off',
			'unicorn/no-process-exit': 'off',
			'unicorn/prefer-top-level-await': 'off',
			'unicorn/no-array-sort': 'off',
			'unicorn/no-array-reduce': 'off',
			'unicorn/text-encoding-identifier-case': 'off',
			'unicorn/prefer-number-properties': 'off',

			// SonarJS overrides
			'sonarjs/no-nested-conditional': 'off',
			'sonarjs/no-nested-template-literals': 'off',
			'sonarjs/no-dead-store': 'off',
			'sonarjs/no-unused-vars': 'off',

			// General
			'no-console': 'off' // Allowed for this project (CLI heavy)
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser
			}
		},
		rules: {
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off'
		}
	},
	{
		files: ['scripts/**/*.{ts,js,cjs}'],
		rules: {
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'sonarjs/cognitive-complexity': 'off',
			'sonarjs/pseudo-random': 'off',
			complexity: 'off',
			'max-lines-per-function': 'off',
			'unicorn/consistent-function-scoping': 'off',
			'unicorn/text-encoding-identifier-case': 'off',
			'unicorn/prefer-number-properties': 'off',
			'unicorn/no-process-exit': 'off',
			'no-empty': 'off'
		}
	},
	prettierConfig
);
