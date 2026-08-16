import MainLayout from '../../layouts/MainLayout'
import styles from './PublishingRules.module.css'

/*
  Правила публикации авторского контента ("Originals") — ссылка на эту
  страницу стоит в чекбоксе согласия на /creator/new (см. NewManga.tsx,
  agreeLink). Раньше здесь была ComingSoon-заглушка.
*/
export default function PublishingRules() {
  return (
    <MainLayout>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Правила публикации</h1>
        <p className={styles.updated}>Обновлено: август 2026</p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Авторский контент</h2>
          <ul className={styles.list}>
            <li>Публиковать можно только оригинальный контент, созданный самим автором.</li>
            <li>Запрещено публиковать чужие работы без явного разрешения правообладателя.</li>
            <li>Запрещено выдавать чужой контент за свой (плагиат).</li>
            <li>При обнаружении нарушения тайтл удаляется, автор может быть заблокирован.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Возрастные ограничения</h2>
          <ul className={styles.list}>
            <li>18+ контент (эротика, порнография, графическое насилие) полностью запрещён на платформе.</li>
            <li>Контент должен быть уместен для широкой аудитории читателей.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Запрещённый контент</h2>
          <ul className={styles.list}>
            <li>Разжигание ненависти, дискриминация по любому признаку.</li>
            <li>Пропаганда насилия, экстремизма.</li>
            <li>Контент, нарушающий законодательство.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Права и ответственность автора</h2>
          <ul className={styles.list}>
            <li>Публикуя работу, автор подтверждает наличие прав на неё.</li>
            <li>Автор несёт ответственность за содержание своей публикации.</li>
            <li>Администрация оставляет за собой право удалить контент, нарушающий правила, без предварительного уведомления.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Модерация</h2>
          <ul className={styles.list}>
            <li>Все новые публикации могут проверяться администрацией перед появлением в каталоге.</li>
            <li>Жалобы от читателей рассматриваются в разумный срок.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <p className={styles.text}>
            Вопросы по этим правилам — через контакты в подвале сайта.
          </p>
        </section>
      </div>
    </MainLayout>
  )
}
