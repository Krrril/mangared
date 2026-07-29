import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './i18n'
import './styles/global.css'
import App from './app/App'
import { AuthProvider } from './services/auth/AuthContext'
import { ThemeProvider } from './services/theme/ThemeContext'
import { GOOGLE_CLIENT_ID } from './config/google'

/** Оборачивает в GoogleOAuthProvider, только если Client ID вообще настроен (см. src/config/google.ts) */
function MaybeGoogleProvider({ children }: { children: ReactNode }) {
  return GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>
  ) : (
    children
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MaybeGoogleProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MaybeGoogleProvider>
    </ThemeProvider>
  </StrictMode>,
)
