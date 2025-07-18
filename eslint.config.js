const js = require('@eslint/js');

module.exports = [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				// Browser globals
				window: 'readonly',
				document: 'readonly',
				console: 'readonly',
				navigator: 'readonly',
				location: 'readonly',
				localStorage: 'readonly',
				sessionStorage: 'readonly',
				fetch: 'readonly',

				// Node.js globals
				process: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				Buffer: 'readonly',
				global: 'readonly',
				module: 'readonly',
				exports: 'readonly',
				require: 'readonly',

				// Custom globals
				warning: 'readonly',
				userWarnings: 'readonly',
				setTimeout: 'readonly',
			},
		},
		rules: {
			// Spacing and formatting - relaxed but consistent
			'arrow-spacing': ['warn', { before: true, after: true }],
			'brace-style': ['warn', '1tbs', { allowSingleLine: true }],
			'comma-dangle': ['warn', 'always-multiline'],
			'comma-spacing': 'warn',
			'comma-style': 'warn',
			'dot-location': ['warn', 'property'],
			indent: ['error', 'tab'], // Keep your original tab preference
			'keyword-spacing': 'warn',
			'object-curly-spacing': ['warn', 'always'],
			'space-before-blocks': 'warn',
			'space-before-function-paren': ['warn', {
				anonymous: 'never',
				named: 'never',
				asyncArrow: 'always',
			}],
			'space-in-parens': 'warn',
			'space-infix-ops': 'warn',
			'spaced-comment': 'warn',

			'no-case-declarations': 'off',

			// Code quality - keep the important ones
			'no-var': 'error',
			'prefer-const': 'error',
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'no-console': 'off', // Allow console statements
			'no-empty-function': 'warn',
			'no-shadow': ['warn', { allow: ['err', 'resolve', 'reject', 'event', 'error'] }],
			'no-undef': 'error', // Re-enabled this important rule

			// Relaxed/removed problematic rules
			// Removed 'no-inline-comments' - inline comments can be useful
			// Removed 'no-lonely-if' - sometimes clearer than else-if
			// Removed 'no-multi-spaces' - sometimes needed for alignment
			'no-multiple-empty-lines': ['warn', { max: 3, maxEOF: 1, maxBOF: 0 }],
			'no-trailing-spaces': 'warn',

			// String and semicolon preferences
			quotes: ['warn', 'single', { allowTemplateLiterals: true }],
			semi: ['error', 'always'],

			// Complexity limits - more reasonable
			'max-nested-callbacks': ['warn', { max: 5 }],
			'max-statements-per-line': ['warn', { max: 3 }],
			'max-len': ['warn', { 
				code: 256, 
				ignoreUrls: true, 
				ignoreStrings: true,
				ignoreTemplateLiterals: true 
			}],

			// Logic improvements
			curly: ['warn', 'multi-line'],
			'no-floating-decimal': 'warn',
			'space-unary-ops': 'warn',
			yoda: 'warn',

			// Modern JavaScript best practices
			'prefer-arrow-callback': 'warn',
			'prefer-template': 'warn',
			'no-duplicate-imports': 'error',
		},
		ignores: [
			'node_modules/**',
			'dist/**',
			'build/**',
			'*.min.js',
		],
	},
];