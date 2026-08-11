import 'dotenv/config'
import { prisma } from '../db.js'

/*
  Разовый скрипт, а не самообслуживание через UI — специально, чтобы не
  было пути "зарегистрировался и сам себя назначил админом" (см.
  docs/ARCHITECTURE.md, "Админ-панель"). Подключается через DATABASE_URL
  из .env, как и сам сервер — чтобы назначить админа на проде, а не
  локально, запусти с DATABASE_URL от Render (см. Environment на
  Render-сервисе), например:

    DATABASE_URL="<прод-строка-подключения>" npm run make-admin -- you@example.com
*/

const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error('Использование: npm run make-admin -- <email>')
  process.exit(1)
}

const user = await prisma.user
  .update({ where: { email }, data: { isAdmin: true } })
  .catch(() => null)

if (!user) {
  console.error(`Пользователь с email "${email}" не найден — сначала зарегистрируйтесь на сайте, потом повторите.`)
  process.exit(1)
}

console.log(`✓ ${user.email} (${user.name}) теперь администратор.`)
await prisma.$disconnect()
