import { beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Transfer","Ticket","Event","User" CASCADE;'
  )
})

afterAll(async () => {
  await prisma.$disconnect()
})
