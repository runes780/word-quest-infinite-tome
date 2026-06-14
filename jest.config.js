/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require('next/jest')

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'jest-environment-jsdom',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    // Live (real-LLM / browser) tests are opt-in only. The default suite ignores
    // any *.live.test.* file; set LIVE_TESTS=1 to include them. (jest appends
    // CLI --testPathIgnorePatterns rather than replacing it, so the env var is
    // the reliable switch — e.g.  LIVE_TESTS=1 jest questionPipeline.live)
    testPathIgnorePatterns: process.env.LIVE_TESTS === '1'
        ? ['/node_modules/']
        : ['/node_modules/', '\\.live\\.test\\.[jt]sx?$'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
