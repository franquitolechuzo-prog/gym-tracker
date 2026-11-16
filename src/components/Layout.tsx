import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { BackIcon, BookIcon, ChartIcon, DumbbellIcon, GearIcon, ListIcon } from './icons';

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

/** Page header with title, optional back button and a shortcut to Settings. */
export function PageHeader({
  title,
  action,
  back = false,
  showSettings = !back,
}: {
  title: string;
  action?: ReactNode;
  back?: boolean;
  showSettings?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <header
      className={`sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-neutral-900 bg-neutral-950/95 pt-[env(safe-area-inset-top)] backdrop-blur ${back ? 'pr-4 pl-1' : 'px-4'}`}
    >
      <div className="flex min-w-0 items-center">
        {back && (
          <button
            type="button"
            aria-label="Volver"
            onClick={() => navigate(-1)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-neutral-300 active:bg-neutral-800"
          >
            <BackIcon />
          </button>
        )}
        <h1 className={`truncate py-4 font-bold ${back ? 'text-xl' : 'text-2xl'}`}>{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {action}
        {showSettings && <Link
          to="/ajustes"
          aria-label="Ajustes"
          className="flex h-12 w-12 items-center justify-center rounded-full text-neutral-400 active:bg-neutral-800"
        >
          <GearIcon />
        </Link>}
      </div>
    </header>
  );
}
