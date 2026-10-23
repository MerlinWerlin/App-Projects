/** Two projects: pure-TS core in Node, UI with the jest-expo preset. */
module.exports = {
  projects: [
    {
      displayName: 'core',
      preset: 'jest-expo',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/core/**/*.test.ts', '<rootDir>/src/ui/**/*.test.ts', '<rootDir>/src/state/**/*.test.ts', '<rootDir>/src/theme/**/*.test.ts', '<rootDir>/src/i18n/**/*.test.ts', '<rootDir>/tests/**/*.test.ts'],
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/app/**/*.test.tsx', '<rootDir>/src/ui/**/*.test.tsx'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg)',
      ],
    },
  ],
};
