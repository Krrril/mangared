import { PrismaClient } from '@prisma/client'

// Один общий клиент Prisma на всё приложение — так рекомендует сама Prisma
// (создавать новый PrismaClient на каждый запрос — распространённая ошибка,
// которая быстро исчерпывает пул соединений к базе).
export const prisma = new PrismaClient()
