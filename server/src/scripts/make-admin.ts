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

// findFirst, не findUnique/update напрямую по email — email больше не
// уникален глобально (см. schema.prisma, User.email): Яндекс-аккаунт
// может делить email с обычным/Google-аккаунтом. Админом имеет смысл
// делать именно "обычный" аккаунт — им и матчим явно.
const found = await prisma.user.findFirst({
  where: { email, OR: [{ passwordHash: { not: null } }, { googleId: { not: null } }] },
})

if (!found) {
  console.error(`Пользователь с email "${email}" не найден — сначала зарегистрируйтесь на сайте, потом повторите.`)
  process.exit(1)
}

const user = await prisma.user.update({ where: { id: found.id }, data: { isAdmin: true } })

console.log(`✓ ${user.email} (${user.name}) теперь администратор.`)
await prisma.$disconnect()
