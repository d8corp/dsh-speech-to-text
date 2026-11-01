// jest.config.js
export default {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/.deploy/', '<rootDir>/client/', '<rootDir>/lib/'],
  modulePathIgnorePatterns: ['<rootDir>/release/', '<rootDir>/lib/'],
  coverageDirectory: 'docs/coverage',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: { ignoreCodes: [1343] } }],
  },
}
