import 'dotenv/config'
import { prisma } from '../db.js'

const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error('Использование: npm run delete-account -- <email>')
  process.exit(1)
}

const result = await prisma.user.deleteMany({ where: { email } })

if (result.count === 0) {
  console.error(`Пользователь с email "${email}" не найден.`)
  process.exit(1)
}

console.log(`✓ Удалён аккаунт ${email}.`)
await prisma.$disconnect()
