// Flat config (eslint 9). Deliberately pragmatic: recommended rules without
// type-aware linting (the typecheck script already owns type truth), plus the
// react-hooks rules the client halves must never violate.
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['lib/**', 'node_modules/**', 'coverage/**', '_wt-*/**'] },
  ...tseslint.configs.recommended,
  reactHooks.configs['recommended-latest'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // The codebase intentionally uses `as` structural casts against hand-written
      // host interfaces (the only way to soft-read optional host services without
      // value-importing official packages). Ban `as any`, not the pattern itself.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.mjs', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
)
