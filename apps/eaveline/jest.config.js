/** Pure-TS core tests run in Node (no React Native imports under src/core or src/data). */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
