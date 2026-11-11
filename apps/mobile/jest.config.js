const preset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^react-native-mmkv$': '<rootDir>/test/mocks/react-native-mmkv.ts',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // ESM-only packages that must go through Babel as well.
  transformIgnorePatterns: preset.transformIgnorePatterns.map((pattern) =>
    pattern.replace('(?!(', '(?!(nitro-core|@maplibre|@supabase|'),
  ),
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
};
