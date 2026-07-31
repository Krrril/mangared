import { Send, MessageCircle, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CONTACTS } from '../config/contacts'
import styles from './ContactsInline.module.css'

/**
 * Блок "Связь с нами" — Telegram/Discord/почта. TG и Discord показываются,
 * только когда заполнены в src/config/contacts.ts (Discord пока заглушка).
 * Lucide не содержит фирменных логотипов мессенджеров, поэтому иконки
 * условные (Send/MessageCircle), а не официальные брендовые значки.
 */
export default function ContactsInline() {
  const { t } = useTranslation()

  return (
    <div className={styles.wrap}>
      <p className={styles.heading}>{t('common.contactUs')}</p>
      <div className={styles.row}>
        {CONTACTS.telegram && (
          <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className={styles.link}>
            <Send size={15} />
            Telegram
          </a>
        )}
        {CONTACTS.discord && (
          <a href={CONTACTS.discord} target="_blank" rel="noopener noreferrer" className={styles.link}>
            <MessageCircle size={15} />
            Discord
          </a>
        )}
        <a href={`mailto:${CONTACTS.email}`} className={styles.link}>
          <Mail size={15} />
          {CONTACTS.email}
        </a>
      </div>
    </div>
  )
}
