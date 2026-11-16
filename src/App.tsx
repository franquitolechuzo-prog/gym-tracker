import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { ConfirmProvider } from './components/confirm';
import { TrainPage } from './pages/TrainPage';
import { RoutinesPage } from './pages/RoutinesPage';
import { RoutineEditPage } from './pages/RoutineEditPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { ExerciseFormPage } from './pages/ExerciseFormPage';
import { ProgressPage } from './pages/ProgressPage';
import { SessionDetailPage } from './pages/SessionDetailPage';

// Charts (Recharts) are heavy: load the exercise detail screen on demand. The service worker precaches it for offline use.
const ExerciseDetailPage = lazy(() => import('./pages/ExerciseDetailPage').then((m) => ({ default: m.ExerciseDetailPage })));
import { SettingsPage } from './pages/SettingsPage';
import { ImportSheetPage } from './pages/ImportSheetPage';

export default function App() {
  return (
    <ConfirmProvider>
      <Suspense fallback={null}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TrainPage />} />
          <Route path="rutinas" element={<RoutinesPage />} />
          <Route path="rutinas/:id" element={<RoutineEditPage />} />
          <Route path="ejercicios" element={<ExercisesPage />} />
          <Route path="ejercicios/nuevo" element={<ExerciseFormPage />} />
          <Route path="ejercicios/:id" element={<ExerciseDetailPage />} />
          <Route path="ejercicios/:id/editar" element={<ExerciseFormPage />} />
          <Route path="progreso" element={<ProgressPage />} />
          <Route path="progreso/sesion/:id" element={<SessionDetailPage />} />
          <Route path="progreso/ejercicio/:id" element={<ExerciseDetailPage />} />
          <Route path="ajustes" element={<SettingsPage />} />
          <Route path="ajustes/importar-planilla" element={<ImportSheetPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </Suspense>
    </ConfirmProvider>
  );
}
