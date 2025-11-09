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
      tsconfig: {
        extends: './tsconfig.json',
        include: ['src/**/*', 'tests/**/*'],
        compilerOptions: {
          module: 'ESNext',
          moduleResolution: 'node',
          types: ['node', 'jest', '@types/supertest'],
        },
      },
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
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};

export default config;

