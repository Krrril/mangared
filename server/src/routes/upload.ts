import { Router } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { isStorageConfigured, uploadFile } from '../services/storage.js'

export const uploadRouter = Router()

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Разрешены только JPG, PNG и WebP'))
      return
    }
    cb(null, true)
  },
})

// 30 загрузок за 10 минут с одного IP — щедро для реальной работы над
// главой (десятки страниц подряд), но не даёт залить хранилище скриптом.
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много загрузок, попробуйте позже' },
})

uploadRouter.use(requireAuth, uploadLimiter)

uploadRouter.post('/', (req, res) => {
  if (!isStorageConfigured()) {
    res.status(503).json({ error: 'Загрузка файлов не настроена на сервере' })
    return
  }

  upload.single('file')(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 'Файл больше 10MB' : err.message
      res.status(400).json({ error: message })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'Файл не передан' })
      return
    }

    const folder = req.body.folder === 'avatars' || req.body.folder === 'pages' ? req.body.folder : 'covers'

    try {
      const result = await uploadFile(req.file.buffer, req.file.mimetype, folder)
      res.status(201).json(result)
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Не удалось загрузить файл' })
    }
  })
})
