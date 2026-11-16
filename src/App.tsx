import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { ConfirmProvider } from './components/confirm';
import { TrainPage } from './pages/TrainPage';
import { RoutinesPage } from './pages/RoutinesPage';
import { RoutineEditPage } from './pages/RoutineEditPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { ExerciseFormPage } from './pages/ExerciseFormPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <ConfirmProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TrainPage />} />
          <Route path="rutinas" element={<RoutinesPage />} />
          <Route path="rutinas/:id" element={<RoutineEditPage />} />
          <Route path="ejercicios" element={<ExercisesPage />} />
          <Route path="ejercicios/nuevo" element={<ExerciseFormPage />} />
          <Route path="ejercicios/:id" element={<ExerciseFormPage />} />
          <Route path="progreso" element={<ProgressPage />} />
          <Route path="ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ConfirmProvider>
  );
}
