module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ['eslint:recommended', 'standard'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'max-len': ['error', {code: 100}],
    'object-curly-spacing': ['error', 'never'],
    'eol-last': ['error', 'always'],
    'no-unused-vars': ['warn'],
    'no-console': ['off']
  }
}
