import MainLayout from '../../layouts/MainLayout'
import styles from './PrivacyPolicy.module.css'

/*
  Базовая заглушка политики конфиденциальности — нужна как минимальная
  честная страница для баннера согласия на cookies (см. CookieConsent).
  Не юридический документ, составленный юристом — это описание того, что
  сайт реально делает технически (см. ARCHITECTURE.md), в понятной форме.
  Заменить на полноценную версию, когда до этого дойдёт очередь (см. ROADMAP.md).
*/
export default function PrivacyPolicy() {
  return (
    <MainLayout>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: July 2026</p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What this page covers</h2>
          <p className={styles.text}>
            This is a short, plain-language summary of how MangaGreen handles data — not a
            full legal document yet. If you have questions, reach out through the contacts
            in the footer.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Account data</h2>
          <p className={styles.text}>
            If you create an account, we store your name, email, and a hashed password (or a
            Google account identifier if you sign in with Google — we never see your Google
            password). This is used only to let you log in and sync your favorites and reading
            progress across devices.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Reading data</h2>
          <p className={styles.text}>
            If you're logged in, your favorites and reading progress (title, chapter, page
            number) are stored on our server. If you're not logged in, the same data is kept
            only in your browser's local storage and never leaves your device.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Cookies and local storage</h2>
          <p className={styles.text}>
            We use local storage (not tracking cookies) to remember your login session,
            language, theme, and — for guests — favorites and reading progress. We don't use
            this data for advertising or share it with ad networks.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Third-party services</h2>
          <p className={styles.text}>
            Manga metadata, covers, and pages are loaded live from{' '}
            <a href="https://mangadex.org" target="_blank" rel="noopener noreferrer">
              MangaDex
            </a>
            . If you use Google Sign-In, Google processes your login on their side — see
            Google's own privacy policy for that part.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Your choices</h2>
          <p className={styles.text}>
            You can use MangaGreen without an account. If you have an account and want your
            data deleted, contact us through the footer links.
          </p>
        </section>
      </div>
    </MainLayout>
  )
}
