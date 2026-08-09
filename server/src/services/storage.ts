import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'

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

/**
 * Заливает файл в R2 под случайным ключом (не доверяем оригинальному
 * имени — коллизии, path traversal, спецсимволы) и возвращает публичный
 * URL. folder — логическая группировка (covers/pages/avatars), не влияет
 * на права доступа.
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

  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  const key = `${folder}/${randomUUID()}.${extension}`

  await conn.client.send(
    new PutObjectCommand({
      Bucket: conn.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )

  const base = conn.env.R2_PUBLIC_URL.replace(/\/$/, '')
  return { url: `${base}/${key}`, key }
}
