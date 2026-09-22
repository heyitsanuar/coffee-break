import tseslint from 'typescript-eslint';

export default [{
  files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
  languageOptions: { parser: tseslint.parser },
  rules: { 'no-debugger': 'error' },
}];
