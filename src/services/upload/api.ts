import { API_BASE } from '../../config/api'

export type UploadFolder = 'covers' | 'pages' | 'avatars'

export interface UploadResult {
  url: string
  key: string
}

/*
  Отдельный от authorizedFetch путь — тот всегда ставит
  Content-Type: application/json, что ломает multipart/form-data.
  XMLHttpRequest, а не fetch — только у него есть событие прогресса
  загрузки (upload.onprogress), нужное для превью с прогресс-баром.
*/
export function uploadFile(
  token: string,
  file: File,
  folder: UploadFolder,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/upload`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      let body: unknown
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        resolve(body as UploadResult)
      } else {
        const message = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `Загрузка не удалась (${xhr.status})`
        reject(new Error(message))
      }
    }
    xhr.onerror = () => reject(new Error('Сетевая ошибка при загрузке файла'))

    xhr.send(formData)
  })
}
