# Gym Tracker

App web progresiva (PWA) para registrar entrenamientos de gimnasio desde el celular: rutinas, series con los valores
de la sesión anterior precargados, temporizador de descanso, historial, gráficos de progreso y récords.
Funciona 100 % offline y guarda todo en el dispositivo (IndexedDB); no tiene backend ni login.

## Usarla en el celular

1. Abrí la URL publicada en **Chrome** (Android) o **Safari** (iPhone).
2. Android: menú **⋮ → Instalar app**. iPhone: **Compartir → Agregar a inicio**.
3. Abrila desde el ícono. Funciona sin conexión; cuando hay una versión nueva aparece un aviso para actualizar.

Los datos viven solo en ese dispositivo y navegador. Hacé respaldos desde **Ajustes → Exportar respaldo (JSON)**;
para pasarlos a otro celular, usá **Restaurar respaldo** ahí.

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev -- --host   # servidor de desarrollo, accesible desde el celular en la misma red Wi-Fi
npm test                # tests (Vitest)
npm run build           # chequeo de tipos + build de producción en dist/
npm run preview -- --host  # sirve el build (con service worker) para probarlo
npm run icons           # regenera los íconos PNG a partir de public/icon.svg
```

Por `http://<ip-de-la-PC>:5173` la app funciona, pero el navegador no habilita el modo offline, la instalación
ni el bloqueo de pantalla: necesitan `https` (o `localhost`).

## Estructura

- `src/db` – modelo de datos (`types.ts`), base Dexie (`db.ts`), carga inicial (`seed.ts`), operaciones de
  ejercicios, rutinas, sesiones e historial, respaldo/CSV.
- `src/lib` – lógica pura: parseo de números, búsqueda, 1RM (Epley), comparaciones, récords, estadísticas.
- `src/import` – lector de la planilla `GYM.xlsx` (SheetJS) y su importación.
- `src/features/session` – pantalla de entrenamiento, temporizador de descanso, wake lock.
- `src/features/progress` – gráficos (Recharts).
- `src/pages`, `src/components` – pantallas y componentes de UI.

Interfaz en español (Argentina); código y comentarios en inglés.
