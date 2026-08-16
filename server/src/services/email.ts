import nodemailer from 'nodemailer'

/*
  Отправка писем через Gmail SMTP — простой и бесплатный вариант для
  разового транзакционного письма (сброс пароля), не требует отдельного
  сервиса вроде SendGrid. Нужен обычный Gmail-аккаунт и пароль приложения
  (App Password, не обычный пароль от аккаунта — см. ARCHITECTURE.md,
  "Восстановление пароля"), заданные через GMAIL_USER/GMAIL_APP_PASSWORD.
  Без этих переменных отправка молча пропускается (см. isEmailConfigured) —
  так же, как R2 и Google-вход, чтобы не ронять остальной сайт из-за
  одной неподключённой интеграции.
*/

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

export function isEmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

function getTransporter() {
  if (!isEmailConfigured()) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  }
  return transporter
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const t = getTransporter()
  if (!t) {
    // GMAIL_USER/GMAIL_APP_PASSWORD не заданы — не роняем запрос (см.
    // /forgot-password), но и молчать смысла нет: без этого лога локальную
    // разработку/тест сброса пароля было бы невозможно проверить руками.
    console.error(`sendPasswordResetEmail: письмо не отправлено (нет GMAIL_USER/GMAIL_APP_PASSWORD). Ссылка для ${to}: ${resetUrl}`)
    return
  }

  await t.sendMail({
    from: `MangaGreen <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Восстановление пароля — MangaGreen',
    text: `Восстановление пароля\n\nПерейдите по ссылке, чтобы задать новый пароль (ссылка действительна 1 час):\n${resetUrl}\n\nЕсли вы не запрашивали восстановление пароля — просто проигнорируйте это письмо.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Восстановление пароля</h2>
        <p>Перейдите по ссылке, чтобы задать новый пароль (ссылка действительна 1 час):</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#3f8a5c;color:#fff;border-radius:999px;text-decoration:none;">Сбросить пароль</a></p>
        <p style="color:#888;font-size:13px;">Если вы не запрашивали восстановление пароля — просто проигнорируйте это письмо.</p>
      </div>
    `,
  })
}
