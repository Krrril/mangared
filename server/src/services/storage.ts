import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

/*
  Cloudflare R2 — S3-совместимое хранилище, выбрано вместо Supabase
  Storage из-за бесплатного исходящего трафика (у Supabase egress
  тарифицируется после лимита, а обложки/страницы глав читаются часто
  и много — именно на этом трафике R2 выигрывает). R2 говорит по тому
  же S3 API, поэтому используем официальный AWS SDK, просто с другим
  endpoint — отдельная библиотека не нужна.
*/

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'] as const

function getEnv(): Record<(typeof REQUIRED_ENV)[number], string> | null {
  const values = {} as Record<(typeof REQUIRED_ENV)[number], string>
  for (const key of REQUIRED_ENV) {
    const value = process.env[key]
    if (!value) return null
    values[key] = value
  }
  return values
}

let client: S3Client | null = null
let clientEnv: ReturnType<typeof getEnv> = null

function getClient(): { client: S3Client; env: NonNullable<ReturnType<typeof getEnv>> } | null {
  const env = getEnv()
  if (!env) return null
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    })
    clientEnv = env
  }
  return { client, env: clientEnv! }
}

/** true, если все R2-переменные окружения заданы — упавший /api/upload с понятной причиной лучше молчаливой 500-ки. */
export function isStorageConfigured(): boolean {
  return getEnv() !== null
}

export interface UploadResult {
  url: string
  key: string
}

// Обложки/аватары авторы грузят как есть с телефона или из фоторедактора —
// без ограничения это бывают файлы в несколько тысяч пикселей по стороне
// (видели живьём 3128×4429), а на сайте они нигде не показываются крупнее
// пары сотен px. Раздутый файл не просто лишний вес: decode() такой
// картинки в браузере ощутимо небыстрый (особенно на телефонах), и обложка
// на экране "зависает" на градиенте-заглушке на несколько секунд уже ПОСЛЕ
// того, как технически загрузилась, — то самое "не показывается обложка"
// (см. задачу). Сама главная задача (двойной IO-гейт + гонка с кэшем
// браузера в ImageWithRetry) была не единственной причиной. Ужимаем до
// 2x самого крупного места показа (см. TitlePage.module.css/Originals.module.css,
// см. также AuthorProfile.module.css — 128px аватар), с запасом под retina;
// pages (страницы самих глав) не трогаем — там нужно настоящее разрешение
// для чтения и зума.
const MAX_DIMENSIONS: Partial<Record<'covers' | 'pages' | 'avatars', number>> = {
  covers: 700,
  avatars: 320,
}

/**
 * Заливает файл в R2 под случайным ключом (не доверяем оригинальному
 * имени — коллизии, path traversal, спецсимволы) и возвращает публичный
 * URL. folder — логическая группировка (covers/pages/avatars), не влияет
 * на права доступа. Обложки и аватары попутно ужимаются (см. MAX_DIMENSIONS)
 * и перекодируются в WebP — меньше вес, быстрее decode на экране.
 */
export async function uploadFile(
  buffer: Buffer,
  contentType: string,
  folder: 'covers' | 'pages' | 'avatars',
): Promise<UploadResult> {
  const conn = getClient()
  if (!conn) {
    throw new Error('R2 не настроен (отсутствуют переменные окружения)')
  }

  const maxDimension = MAX_DIMENSIONS[folder]
  let finalBuffer = buffer
  let finalContentType = contentType
  if (maxDimension) {
    try {
      finalBuffer = await sharp(buffer)
        .rotate() // учитывает EXIF-ориентацию с телефона до resize, иначе после перекодирования фото может лечь на бок
        .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
      finalContentType = 'image/webp'
    } catch (err) {
      // Файл прошёл multer-фильтр как валидный JPG/PNG/WebP, но sharp всё
      // равно может споткнуться (битый/экзотический файл) — заливаем
      // оригинал как раньше, а не роняем всю загрузку из-за оптимизации.
      console.error('Не удалось ужать изображение, заливаю оригинал:', err)
      finalBuffer = buffer
      finalContentType = contentType
    }
  }

  const extension = finalContentType === 'image/png' ? 'png' : finalContentType === 'image/webp' ? 'webp' : 'jpg'
  const key = `${folder}/${randomUUID()}.${extension}`

  await conn.client.send(
    new PutObjectCommand({
      Bucket: conn.env.R2_BUCKET_NAME,
      Key: key,
      Body: finalBuffer,
      ContentType: finalContentType,
      // Ключ — случайный UUID (см. выше), контент по нему никогда не
      // меняется — файл либо существует с этим содержимым, либо удалён
      // (см. deleteFile). Можно кэшировать как immutable — раньше
      // Cache-Control вообще не выставлялся (см. задачу про CLS/LCP,
      // PageSpeed Insights: "экономия по кэшу" не менялась между прогонами).
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  const base = conn.env.R2_PUBLIC_URL.replace(/\/$/, '')
  return { url: `${base}/${key}`, key }
}

/**
 * Удаляет файл по его публичному URL (обратное преобразование к uploadFile
 * выше — вычленяем key, отрезая R2_PUBLIC_URL-префикс). Используется при
 * замене/удалении отдельной страницы главы (см. PATCH
 * /originals/mine/:id/chapters/:chapterId), чтобы старый файл не оставался
 * висеть в R2 без необходимости. Молча ничего не делает, если хранилище не
 * настроено или URL не похож на наш — точечная правка страниц не должна
 * ронять сам запрос из-за не критичной уборки мусора.
 */
export async function deleteFile(url: string): Promise<void> {
  const conn = getClient()
  if (!conn) return

  const base = conn.env.R2_PUBLIC_URL.replace(/\/$/, '')
  if (!url.startsWith(`${base}/`)) return
  const key = url.slice(base.length + 1)

  await conn.client
    .send(new DeleteObjectCommand({ Bucket: conn.env.R2_BUCKET_NAME, Key: key }))
    .catch((err) => console.error('Не удалось удалить файл из R2:', key, err))
}
