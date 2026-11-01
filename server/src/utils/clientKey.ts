import type { Request } from 'express'

/*
  Идентификатор клиента для ограничителей частоты. Прод стоит за двумя
  прокси (Cloudflare → Render), а app.set('trust proxy', true) берёт в
  req.ip ЛЕВЫЙ элемент X-Forwarded-For — его клиент может подставить сам и
  обходить лимиты, меняя заголовок. Cloudflare же всегда перезаписывает
  CF-Connecting-IP реальным адресом клиента, поэтому он в приоритете;
  True-Client-IP — тот же смысл у некоторых конфигураций; req.ip — запасной
  вариант (локальная разработка, прямой доступ).
*/
export function clientKey(req: Request): string {
  const cf = req.headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf.trim()) return cf.trim()
  const tci = req.headers['true-client-ip']
  if (typeof tci === 'string' && tci.trim()) return tci.trim()
  return req.ip ?? 'unknown'
}
