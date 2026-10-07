import { Navigate, Route, Routes } from 'react-router'
import { DashboardPage } from '../pages/DashboardPage.tsx'
import { DictionaryPage } from '../pages/DictionaryPage.tsx'
import { EntryDetailPage } from '../pages/EntryDetailPage.tsx'
import { NotFoundPage } from '../pages/NotFoundPage.tsx'
import { PracticePage } from '../pages/PracticePage.tsx'
import { ProfilePage } from '../pages/ProfilePage.tsx'
import { ProgressPage } from '../pages/ProgressPage.tsx'
import { SettingsPage } from '../pages/SettingsPage.tsx'
import { SupportPage } from '../pages/SupportPage.tsx'
import { CreateCustomSetPage } from '../pages/study/CreateCustomSetPage.tsx'
import { CustomSetListPage } from '../pages/study/CustomSetListPage.tsx'
import { ImportCustomSetPage } from '../pages/study/ImportCustomSetPage.tsx'
import { MyStudiesPage } from '../pages/study/MyStudiesPage.tsx'
import { SetDetailPage } from '../pages/study/SetDetailPage.tsx'
import { SetListPage } from '../pages/study/SetListPage.tsx'
import { StudyLayout } from '../pages/study/StudyLayout.tsx'
import { AppLayout } from './layout/AppLayout.tsx'

/**
 * The app's route map. It is kept separate from <App> so tests can
 * exercise it with a MemoryRouter instead of the browser router.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="study" element={<StudyLayout />}>
          <Route index element={<MyStudiesPage />} />
          <Route path="hsk" element={<SetListPage type="hsk" />} />
          <Route path="topics" element={<SetListPage type="topic" />} />
          <Route path="custom" element={<CustomSetListPage />} />
        </Route>
        <Route path="study/custom/new" element={<CreateCustomSetPage />} />
        <Route path="study/custom/import" element={<ImportCustomSetPage />} />
        <Route path="study/sets/:setId" element={<SetDetailPage />} />
        <Route path="study/practice" element={<PracticePage />} />
        <Route path="dictionary" element={<DictionaryPage />} />
        <Route path="vocabulary/:id" element={<EntryDetailPage kind="word" />} />
        <Route path="characters/:id" element={<EntryDetailPage kind="character" />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="support" element={<SupportPage />} />
        {/* Old URLs: they still work */}
        <Route path="practice" element={<Navigate to="/study/practice" replace />} />
        <Route path="vocabulary" element={<Navigate to="/dictionary?kind=word" replace />} />
        <Route path="characters" element={<Navigate to="/dictionary?kind=character" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
