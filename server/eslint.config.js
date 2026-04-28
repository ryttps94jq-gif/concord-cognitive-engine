import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Disallow empty catch blocks - use logger.debug() for silent failures
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],
      curly: ['warn', 'multi-line'],
      'no-throw-literal': 'error',
      'no-return-await': 'warn',
      'require-await': 'warn',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-proto': 'error',
      'no-extend-native': 'error',
      'no-iterator': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'warn',
      'no-multi-str': 'warn',
      'no-new-wrappers': 'error',
      'no-octal-escape': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-useless-call': 'warn',
      'no-useless-concat': 'warn',
      'no-useless-return': 'warn',
      'prefer-regex-literals': 'warn',
      radix: 'warn',
      yoda: 'warn',
      // Auth bypass prevention — client-supplied userId must never substitute for req.user.id
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='userId']",
          message: "req.body.userId is an auth bypass risk. Use req.user?.id from the authenticated session. If this is a target identifier (not the actor), add // safe: target-identifier",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='user_id']",
          message: "req.body.user_id is an auth bypass risk. Use req.user?.id from the authenticated session. If this is a target identifier (not the actor), add // safe: target-identifier",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='query'][property.name='userId']",
          message: "req.query.userId used as actor identity is an auth bypass risk. Use req.user?.id from the authenticated session.",
        },
      ],
    },
  },
  {
    ignores: ['node_modules/', '*.min.js', 'dist/', 'build/'],
  },
];
