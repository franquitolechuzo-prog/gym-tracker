# Gym Tracker

Offline-first PWA to log gym workouts (React + TypeScript + Vite + Dexie + Tailwind).

## Scripts

- `npm run dev` – dev server (`npm run dev -- --host` to open it from a phone on the same Wi-Fi)
- `npm test` – unit tests (Vitest)
- `npm run build` – typecheck + production build in `dist/`
- `npm run preview -- --host` – serve the production build (service worker included)

## Structure

- `src/db` – data model (`types.ts`), Dexie database (`db.ts`), first-run seed (`seed.ts`), settings
- `src/lib` – pure helpers (number parsing/formatting, search, 1RM/volume)
- `src/pages`, `src/components` – UI
