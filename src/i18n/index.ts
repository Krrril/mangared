import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import en from './locales/en.json'
import kk from './locales/kk.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import tr from './locales/tr.json'
import ko from './locales/ko.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'

const STORAGE_KEY = 'mangared:lang'

/*
  Мультиязычность заложена с самого начала (см. docs/DECISIONS.md).
  ru и en переведены полностью, остальные 8 языков с макета выбора
  языка — рабочие заготовки (структура ключей та же, часть текста пока
  на английском, см. docs/DESIGN_SYSTEM.md про добавление языков).
*/
const savedLanguage = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    kk: { translation: kk },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    tr: { translation: tr },
    ko: { translation: ko },
    zh: { translation: zh },
    ja: { translation: ja },
  },
  lng: savedLanguage ?? 'ru',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
