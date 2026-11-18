import { beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL must point to the dedicated tm_vitest database')
}

const database = new URL(databaseUrl)
if (
  !['localhost', '127.0.0.1', '::1'].includes(database.hostname) ||
  database.pathname !== '/tm_vitest'
) {
  throw new Error('Refusing to truncate tables outside the local tm_vitest database')
}

const prisma = new PrismaClient()

beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Transfer","Ticket","Event","User" CASCADE;'
  )
})

afterAll(async () => {
  await prisma.$disconnect()
})
