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
      // Auth bypass prevention — client-supplied user identity must never substitute for req.user.id
      // Pattern: req.body/query.<anyUserId> used as actor instead of req.user.id
      // Fix: use req.user?.id (authenticated session). If this is a TARGET identifier (not the actor),
      //      add // safe: target-identifier or // safe: admin-only to suppress.
      'no-restricted-syntax': [
        'error',
        // ── req.body identity fields ──────────────────────────────────────────
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='userId']",
          message: "req.body.userId — use req.user?.id. If target identifier, add // safe: target-identifier",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='user_id']",
          message: "req.body.user_id — use req.user?.id. If target identifier or admin-only, add // safe: comment",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='ownerId']",
          message: "req.body.ownerId — use req.user?.id. If target identifier, add // safe: target-identifier",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='seller_id']",
          message: "req.body.seller_id — use req.user?.id. If admin-only, add // safe: admin-only",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='fromUserId']",
          message: "req.body.fromUserId — use req.user?.id. Actor must come from authenticated session.",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='toUserId']",
          message: "req.body.toUserId — verify: if this is the target recipient (not actor), add // safe: target-identifier",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='reviewer_id']",
          message: "req.body.reviewer_id — audit actor must be req.user?.id. Use req.user?.id for audit log integrity.",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='body'][property.name='creatorId']",
          message: "req.body.creatorId — use req.user?.id. If target identifier, add // safe: target-identifier",
        },
        // ── req.query identity fields ─────────────────────────────────────────
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='query'][property.name='userId']",
          message: "req.query.userId — ensure req.user?.id takes priority. Use req.user?.id || req.query.userId for public endpoints.",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='query'][property.name='user_id']",
          message: "req.query.user_id — use req.user?.id. If admin lookup, add // safe: admin-only",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='query'][property.name='ownerId']",
          message: "req.query.ownerId — ensure req.user?.id takes priority. If public filter, add // safe: public-filter",
        },
        {
          selector: "MemberExpression[object.object.name='req'][object.property.name='query'][property.name='creatorId']",
          message: "req.query.creatorId — ensure req.user?.id takes priority. If public analytics, add // safe: public-filter",
        },
      ],
    },
  },
  {
    ignores: ['node_modules/', '*.min.js', 'dist/', 'build/'],
  },
];
