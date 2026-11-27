module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:security/recommended-legacy',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', 'coverage'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh', 'security'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react-refresh/only-export-components': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'security/detect-object-injection': 'off',
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.*'],
      rules: {
        'react/display-name': 'off',
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-non-literal-regexp': 'off',
        'no-unused-vars': 'off',
      },
    },
  ],
};
