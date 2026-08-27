import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from '../pages/Home/Home'
import TitlePage from '../pages/TitlePage/TitlePage'
import Reader from '../pages/Reader/Reader'
import Search from '../pages/Search/Search'
import Categories from '../pages/Categories/Categories'
import Top from '../pages/Top/Top'
import Library from '../pages/Library/Library'
import Favorites from '../pages/Favorites/Favorites'
import History from '../pages/History/History'
import Updates from '../pages/Updates/Updates'
import Auth from '../pages/Auth/Auth'
import ForgotPassword from '../pages/ForgotPassword/ForgotPassword'
import ResetPassword from '../pages/ResetPassword/ResetPassword'
import Admin from '../pages/Admin/Admin'
import CreatorHome from '../pages/Creator/CreatorHome'
import NewManga from '../pages/Creator/NewManga'
import MangaDetail from '../pages/Creator/MangaDetail'
import AuthorProfile from '../pages/Author/AuthorProfile'
import OriginalsCatalog from '../pages/Originals/OriginalsCatalog'
import OriginalDetail from '../pages/Originals/OriginalDetail'
import PrivacyPolicy from '../pages/PrivacyPolicy/PrivacyPolicy'
import PublishingRules from '../pages/PublishingRules/PublishingRules'
import Terms from '../pages/Terms/Terms'
import ComingSoon from '../pages/ComingSoon/ComingSoon'
import CookieConsent from '../components/CookieConsent'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/title/:titleId" element={<TitlePage />} />
        <Route path="/title/:titleId/read/:chapterId" element={<Reader />} />
        <Route path="/search" element={<Search />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/top" element={<Top />} />
        <Route path="/library" element={<Library />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/history" element={<History />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/admin" element={<Admin />} />
        <Route
          path="/downloads"
          element={
            <ComingSoon
              label="Загрузки"
              description="Офлайн-чтение — в планах на v3: нужно скачивать и хранить страницы на устройстве, это отдельная большая задача (см. docs/ROADMAP.md)."
            />
          }
        />
        <Route path="/creator" element={<CreatorHome />} />
        <Route path="/creator/new" element={<NewManga />} />
        <Route path="/creator/:mangaId" element={<MangaDetail />} />
        <Route path="/author/:username" element={<AuthorProfile />} />
        <Route path="/originals" element={<OriginalsCatalog />} />
        <Route path="/originals/:mangaId" element={<OriginalDetail />} />
        {/* Тот же компонент читалки, что и для MangaDex (/title/.../read/...) —
            параметр называется titleId, а не mangaId, чтобы совпадать с
            useParams в Reader.tsx (см. src/pages/Reader/Reader.tsx). */}
        <Route path="/originals/:titleId/read/:chapterId" element={<Reader />} />
        <Route path="/publishing-rules" element={<PublishingRules />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<ComingSoon label="Страница не найдена" />} />
      </Routes>
      <CookieConsent />
    </BrowserRouter>
  )
}
