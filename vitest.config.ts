import { defineConfig } from 'vitest/config'

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/tm_vitest'
const testDatabase = new URL(testDatabaseUrl)

if (
  !['localhost', '127.0.0.1', '::1'].includes(testDatabase.hostname) ||
  testDatabase.pathname !== '/tm_vitest'
) {
  throw new Error('Vitest requires a loopback PostgreSQL URL for the tm_vitest database')
}

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: testDatabaseUrl
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    include: ['tests/**/*.spec.ts'],
    fileParallelism: false,
    sequence: {
      concurrent: false
    }
  }
})