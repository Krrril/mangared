const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const PW = fs.readFileSync('C:/Users/User/AppData/Local/Temp/claude/C--Users-User-Projects-mangared/82092036-7d39-498a-a75e-4e6c07789e0f/scratchpad/test-password.txt', 'utf8').trim()
const B = 'http://localhost:4000/api'
const p = new PrismaClient()
const DAY = 86400000
let fails = 0
const ok = (name, cond, extra = '') => {
  if (!cond) fails++
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''))
}
async function api(method, path, token, body) {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let j = null
  try { j = await r.json() } catch {}
  return { s: r.status, j }
}
const login = async (u) => (await api('POST', '/auth/login', null, { email: `${u}@example.test`, password: PW })).j.token
const dbUser = (u) => p.user.findFirst({ where: { email: `${u}@example.test` } })

;(async () => {
  const adm = await login('tstadm'), alice = await login('tstalice'), bob = await login('tstbob')
  const aliceId = (await dbUser('tstalice')).id, admId = (await dbUser('tstadm')).id

  console.log('--- A. admin without a grant ---')
  let r = await api('GET', '/premium/me', adm)
  ok('admin /premium/me isPremium + permanent', r.j.isPremium === true && r.j.premiumPermanent === true, JSON.stringify(r.j))
  r = await api('PATCH', '/premium/customize', adm, { avatarFrame: 'cosmos', accentColor: '#a78bfa' })
  ok('admin can save frame+colour', r.s === 200, JSON.stringify(r.j))
  const admRow = await dbUser('tstadm')
  ok('nothing written to DB for admin premiumUntil', admRow.premiumUntil === null)
  ok('admin has zero PremiumGrant rows', (await p.premiumGrant.count({ where: { userId: admId } })) === 0)
  r = await api('GET', '/auth/me', adm)
  ok('/auth/me isPremium for admin', r.j.isPremium === true && r.j.premiumPermanent === true && r.j.avatarFrame === 'cosmos')

  console.log('--- B. regular user ---')
  r = await api('GET', '/premium/me', alice)
  ok('alice not premium', r.j.isPremium === false)
  r = await api('PATCH', '/premium/customize', alice, { avatarFrame: 'sakura' })
  ok('alice cannot save (403)', r.s === 403)

  console.log('--- search ---')
  r = await api('GET', '/admin/premium/search?q=', adm); ok('empty query -> []', r.s === 200 && r.j.length === 0)
  r = await api('GET', '/admin/premium/search?q=t', adm); ok('1 char -> []', r.j.length === 0)
  r = await api('GET', '/admin/premium/search?q=tstalice', adm); ok('by name/username', r.j.some((u) => u.id === aliceId))
  r = await api('GET', '/admin/premium/search?q=tstalice@exam', adm); ok('by email', r.j.some((u) => u.id === aliceId))
  r = await api('GET', '/admin/premium/search?q=TEST TSTALICE', adm); ok('by display name (case-insens.)', r.j.some((u) => u.id === aliceId))
  r = await api('GET', '/admin/premium/search?q=tst', adm); ok('limit <= 15', r.j.length <= 15 && r.j.length >= 3, 'n=' + r.j.length)

  console.log('--- grant / extend / forever / custom ---')
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, { days: 7, note: 'first' })
  const u7 = new Date(r.j.premiumUntil).getTime()
  ok('grant 7d', r.s === 200 && Math.abs(u7 - (Date.now() + 7 * DAY)) < 60000 && r.j.extended === false)
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, { days: 30 })
  const u37 = new Date(r.j.premiumUntil).getTime()
  ok('extend +30 from current end (not from today)', Math.abs(u37 - (u7 + 30 * DAY)) < 1000 && r.j.extended === true, `delta days=${((u37 - u7) / DAY).toFixed(3)}`)
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, { forever: true })
  ok('forever -> 2099-12-31', r.j.forever === true && r.j.premiumUntil.startsWith('2099-12-31'))
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, { days: 7 })
  ok('+7d on forever stays forever (capped)', r.j.forever === true && r.j.premiumUntil.startsWith('2099-12-31'))
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, { until: new Date(Date.now() + 90 * DAY).toISOString() })
  ok('custom date (absolute)', r.s === 200 && r.j.forever === false && Math.abs(new Date(r.j.premiumUntil).getTime() - (Date.now() + 90 * DAY)) < 60000)
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, { until: '2020-01-01T00:00:00.000Z' }); ok('past date rejected', r.s === 400, r.j.error)
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, { days: 15 }); ok('invalid days rejected', r.s === 400)
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, { days: 7, forever: true }); ok('two terms rejected', r.s === 400)
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, {}); ok('no term rejected', r.s === 400)

  console.log('--- alice sees it; customize works ---')
  r = await api('PATCH', '/premium/customize', alice, { avatarFrame: 'sakura', accentColor: '#f472b6' })
  ok('alice (premium) can save', r.s === 200)
  r = await api('POST', '/comments', alice, { mangaId: 'tst-manga-1', text: 'TEST premium comment' })
  const cm = await api('GET', '/comments?mangaId=tst-manga-1', null)
  ok('comment author shows premium+frame', cm.j[0]?.author.isPremium === true && cm.j[0]?.author.avatarFrame === 'sakura')

  console.log('--- revoke ---')
  r = await api('POST', `/admin/users/${aliceId}/premium/revoke`, adm); ok('revoke ok', r.s === 200)
  r = await api('POST', `/admin/users/${aliceId}/premium/revoke`, adm); ok('revoke again -> 400', r.s === 400, r.j.error)
  r = await api('GET', '/premium/me', alice); ok('alice revoked, selection kept', r.j.isPremium === false && r.j.avatarFrame === 'sakura')
  const cm2 = await api('GET', '/comments?mangaId=tst-manga-1', null)
  ok('public comment: no premium/frame after revoke', cm2.j[0]?.author.isPremium === false && cm2.j[0]?.author.avatarFrame === null)
  r = await api('PATCH', '/premium/customize', alice, { avatarFrame: 'kitsune' }); ok('alice cannot save after revoke (403)', r.s === 403)

  console.log('--- admin protection ---')
  r = await api('POST', `/admin/users/${admId}/premium/revoke`, adm); ok('cannot revoke admin (400)', r.s === 400, r.j.error)
  r = await api('POST', `/admin/users/${admId}/premium/grant`, adm, { days: 7 }); ok('cannot grant to admin (400)', r.s === 400, r.j.error)

  console.log('--- non-admin gets 403 ---')
  for (const [m, pth, b] of [
    ['POST', `/admin/users/${aliceId}/premium/grant`, { days: 7 }],
    ['POST', `/admin/users/${aliceId}/premium/revoke`, undefined],
    ['GET', '/admin/premium/search?q=tstalice', undefined],
    ['GET', '/admin/premium/overview', undefined],
    ['GET', `/admin/users/${aliceId}/premium/grants`, undefined],
  ]) {
    const x = await api(m, pth, bob, b)
    ok(`bob ${m} ${pth.split('?')[0].replace(aliceId, ':id')} -> 403`, x.s === 403)
  }
  r = await api('GET', '/admin/premium/overview', null); ok('anon overview -> 401', r.s === 401)
  ok('bob still not premium in DB', (await dbUser('tstbob')).premiumUntil === null)

  console.log('--- expired: extension counts from today ---')
  await p.user.update({ where: { id: aliceId }, data: { premiumUntil: new Date(Date.now() - 2 * DAY) } })
  r = await api('GET', '/premium/me', alice); ok('expired -> isPremium false', r.j.isPremium === false)
  r = await api('POST', `/admin/users/${aliceId}/premium/grant`, adm, { days: 7 })
  ok('grant on expired starts from today', Math.abs(new Date(r.j.premiumUntil).getTime() - (Date.now() + 7 * DAY)) < 60000 && r.j.extended === false)

  console.log('--- overview ---')
  r = await api('GET', '/admin/premium/overview', adm)
  const h = r.j.holders
  ok('holders contain admin (permanent) and alice', h.some((x) => x.id === admId && x.premiumPermanent) && h.some((x) => x.id === aliceId && !x.premiumPermanent), 'n=' + h.length)
  ok('admin holder first', h[0].id === admId)
  ok('alice holder has grantedBy', h.find((x) => x.id === aliceId)?.grantedByName === 'Test tstadm')
  ok('recent has revoke entry + note', r.j.recent.some((g) => g.revoked) && r.j.recent.some((g) => g.note === 'first'))
  ok('recent has forever entry', r.j.recent.some((g) => g.forever))

  console.log('--- admin role revoked -> Premium disappears, selection stays ---')
  await p.user.update({ where: { id: admId }, data: { isAdmin: false } })
  r = await api('GET', '/premium/me', adm)
  ok('ex-admin not premium, frame+colour saved', r.j.isPremium === false && r.j.avatarFrame === 'cosmos' && r.j.accentColor === '#a78bfa', JSON.stringify(r.j))
  r = await api('PATCH', '/premium/customize', adm, { avatarFrame: 'kitsune' }); ok('ex-admin cannot save (403)', r.s === 403)
  await p.user.update({ where: { id: admId }, data: { isAdmin: true } })
  r = await api('GET', '/premium/me', adm); ok('admin restored -> premium again', r.j.isPremium === true && r.j.avatarFrame === 'cosmos')

  console.log('--- admin log ---')
  const logs = await p.adminActionLog.findMany({ where: { action: { startsWith: 'premium' } }, select: { action: true, details: true } })
  ok('log has grants + revokes', logs.filter((l) => l.action === 'premium.grant').length >= 6 && logs.filter((l) => l.action === 'premium.revoke').length >= 1, `grants=${logs.filter((l) => l.action === 'premium.grant').length}`)
  ok('log marks extension + forever', logs.some((l) => l.details.includes('(продление)')) && logs.some((l) => l.details.includes('навсегда')))

  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`)
  await p.$disconnect()
})().catch((e) => { console.error('ERR', e); process.exit(1) })
