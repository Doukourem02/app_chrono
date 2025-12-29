/**
 * Configuration Jest pour les tests TypeScript
 * Support des modules ES (ESM) et TypeScript
 */
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: './tsconfig.test.json',
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.js',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/config/**',
    '!src/utils/logger.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};

export default config;

