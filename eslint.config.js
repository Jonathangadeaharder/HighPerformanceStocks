import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'dist/**',
			'coverage/**',
			'data/**',
			'node_modules/**',
			'eslint.config.js',
			'prettier.config.js',
			'svelte.config.js',
			'vite.config.js'
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
				...globals.node,
				...globals.es2017
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
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
			'complexity': ['error', 20],
			'sonarjs/cognitive-complexity': ['error', 20],
			'sonarjs/no-duplicate-string': 'warn',
			'max-depth': ['error', 4],
			'max-lines-per-function': ['warn', 100],
			
			// TypeScript Strictness
			'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			
			// Unicorn overrides
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/no-null': 'off',
			'unicorn/filename-case': ['error', { case: 'kebabCase', ignore: ['^\\+page', '^\\+layout', '^app\\.d$'] }],
			
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
		}
	},
	prettierConfig
);
