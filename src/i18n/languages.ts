export interface AppLanguage {
  code: string
  /** Название языка на нём самом — так его проще узнать в списке выбора */
  nativeName: string
}

/*
  Порядок и набор языков — по экрану "Язык приложения" из мобильного
  макета. ru и en переведены полностью, остальные — рабочие заготовки
  (см. docs/DESIGN_SYSTEM.md, раздел про добавление языков).
*/
export const APP_LANGUAGES: AppLanguage[] = [
  { code: 'ru', nativeName: 'Русский' },
  { code: 'en', nativeName: 'English' },
  { code: 'kk', nativeName: 'Қазақша' },
  { code: 'es', nativeName: 'Español' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'tr', nativeName: 'Türkçe' },
  { code: 'ko', nativeName: '한국어' },
  { code: 'zh', nativeName: '中文(简体)' },
  { code: 'ja', nativeName: '日本語' },
]
