// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const nodeGlobals = require('globals').node;

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
]);
