/*
  Места, откуда в аналитике замечены подозрительные всплески визитов
  (скорее всего, дата-центры/облачные краулеры, а не люди). Это только
  фильтр ОТОБРАЖЕНИЯ в /admin (переключатель "Скрыть подозрительные
  дата-центры", по умолчанию выключен) — посетителей никто не блокирует,
  записи в БД не меняются.

  Страна без города скрывает ВСЕ визиты из страны, включая настоящих
  людей, — поэтому переключатель выключен по умолчанию, а в админке рядом
  показывается, сколько визитов он скрыл. Список правится здесь.
  Запись с городом (Сен-Гислен, Бельгия — площадка Google) сейчас
  перекрыта записью по стране BE; оставлена, чтобы при удалении BE из
  списка фильтр по городу продолжил работать.
*/
export interface DatacenterRule {
  /** ISO-код страны (как отдаёт geoip-lite). */
  country: string
  /** Если задан — правило только для этого города. */
  city?: string
  /** Подпись для админки. */
  label: string
}

export const DATACENTER_RULES: DatacenterRule[] = [
  { country: 'BE', city: 'Saint-Ghislain', label: 'Saint-Ghislain (BE)' },
  { country: 'BE', label: 'BE' },
  { country: 'SE', label: 'SE' },
  { country: 'SG', label: 'SG' },
]

function normalizeCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

export function isDatacenterLocation(country: string | null, city: string | null): boolean {
  if (!country) return false
  const cityKey = city ? normalizeCity(city) : null
  return DATACENTER_RULES.some((rule) => {
    if (rule.country !== country) return false
    if (!rule.city) return true
    return cityKey !== null && cityKey === normalizeCity(rule.city)
  })
}
