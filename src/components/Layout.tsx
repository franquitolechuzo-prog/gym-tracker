import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { BookIcon, ChartIcon, DumbbellIcon, GearIcon, ListIcon } from './icons';

const TABS = [
  { to: '/', label: 'Entrenar', Icon: DumbbellIcon, end: true },
  { to: '/rutinas', label: 'Rutinas', Icon: ListIcon, end: false },
  { to: '/ejercicios', label: 'Ejercicios', Icon: BookIcon, end: false },
  { to: '/progreso', label: 'Progreso', Icon: ChartIcon, end: false },
];

export function Layout() {
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                    isActive ? 'text-accent' : 'text-neutral-400'
                  }`
                }
              >
                <Icon />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Page header with title and a shortcut to Settings. */
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-neutral-900 bg-neutral-950/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <h1 className="py-4 text-2xl font-bold">{title}</h1>
      <div className="flex items-center gap-1">
        {action}
        <Link
          to="/ajustes"
          aria-label="Ajustes"
          className="flex h-12 w-12 items-center justify-center rounded-full text-neutral-400 active:bg-neutral-800"
        >
          <GearIcon />
        </Link>
      </div>
    </header>
  );
}
