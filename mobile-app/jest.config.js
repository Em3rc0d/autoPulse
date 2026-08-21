module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/__tests__/**/*.test.tsx'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo-crypto|expo-sqlite|expo-modules-core|@expo)/)'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/'
  ],
  moduleNameMapper: {
    '^expo-crypto$': '<rootDir>/src/__mocks__/expo-crypto.js'
  }
};
