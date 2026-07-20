module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/domain/**/*.test.ts', '<rootDir>/src/infrastructure/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/'
  ]
};
