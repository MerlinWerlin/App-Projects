/** Pure-TS calculator and state tests run in Node (no React Native imports under src/calc or src/plus). */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
