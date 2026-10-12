/*
  Эвристика "это бот/краулер/монитор" по User-Agent. Визит с такой меткой
  НЕ выбрасывается (см. VisitLog.isBot), только помечается — в /admin его
  можно показать отдельным счётчиком и сравнить с "живыми".

  Это именно эвристика: бот, представившийся обычным браузером, сюда не
  попадёт, а редкий нормальный клиент с "bot" в UA — попадёт. Поэтому в UI
  это называется "подозрительные", а не "боты".

  Сам User-Agent нигде не сохраняется — пишется только булев результат.
*/

// "bot" ловим только как конец слова/токена (Googlebot/2.1, AhrefsBot,
// bot.html, "bot;"), чтобы не цеплять случайные подстроки; "cubot" —
// бренд телефонов, исключаем явно.
const BOT_PATTERNS: RegExp[] = [
  /(?<!cu)bot(?![a-z])/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /headless/i,
  /lighthouse/i,
  /pagespeed|page speed|chrome-lighthouse|gtmetrix|pingdom/i,
  /uptime|monitor|statuscake|datadog|newrelic|site24x7|zabbix|nagios|healthcheck|health-check/i,
  /\bcurl\//i,
  /\bwget\//i,
  /python-requests|python-urllib|aiohttp|httpx|go-http-client|java\/[\d.]+|libwww|node-fetch|axios\/|undici/i,
  /phantomjs|puppeteer|playwright|selenium|webdriver/i,
  /facebookexternalhit|embedly|whatsapp\/|telegrambot|discordbot|slackbot|twitterbot|linkedinbot/i,
  /semrush|ahrefs|mj12|dotbot|petalbot|bytespider|yandex(?:bot|images|metrika)|baiduspider|duckduckbot|applebot/i,
]

export function isBotUserAgent(userAgent: string | undefined | null): boolean {
  const ua = (userAgent ?? '').trim()
  // Пустой UA у настоящего браузера не бывает.
  if (!ua) return true
  return BOT_PATTERNS.some((re) => re.test(ua))
}
