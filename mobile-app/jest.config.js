module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: [
    '<rootDir>/node_modules/react-native/jest/setup.js',
    '<rootDir>/jest.setup.js'
  ],
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/__tests__/**/*.test.tsx'
  ],
  // Match Metro's Android/native resolution before generic extensions.
  moduleFileExtensions: [
    'android.ts', 'native.ts', 'ts',
    'android.tsx', 'native.tsx', 'tsx',
    'android.js', 'native.js', 'js',
    'android.jsx', 'native.jsx', 'jsx',
    'json', 'node'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json'
    }],
    '^.+\\.jsx?$': '<rootDir>/scripts/jest-react-native-transformer.js'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo(?:-|$)|@expo)/)'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/'
  ],
  moduleNameMapper: {
    '^expo-crypto$': '<rootDir>/src/__mocks__/expo-crypto.js',
    '^expo-keep-awake$': '<rootDir>/src/__mocks__/expo-keep-awake.js'
  }
};
