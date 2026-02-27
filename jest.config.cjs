/** Jest config for TypeScript project using ts-jest */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  }
  ,
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts']
  ,
  setupFiles: ['<rootDir>/src/setupNodeEnv.ts']
  ,
  forceExit: true
};
