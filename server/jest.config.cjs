module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {},
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/index.js',
    '!src/config/**/*.js',
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/env.js'],
};
