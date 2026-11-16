import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { TrainPage } from './pages/TrainPage';
import { RoutinesPage } from './pages/RoutinesPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TrainPage />} />
        <Route path="rutinas" element={<RoutinesPage />} />
        <Route path="ejercicios" element={<ExercisesPage />} />
        <Route path="progreso" element={<ProgressPage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
