import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'evidence/**'] },
  ...tseslint.configs.recommended,
  { files: ['**/*.ts'], rules: { 'no-debugger': 'error' } },
];
