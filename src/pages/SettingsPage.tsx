import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../components/Layout';
import { Button, NumberStepper, Segmented } from '../components/ui';
import { ChevronIcon } from '../components/icons';
import { useConfirm } from '../components/confirm';
import { updateSettings, useSettings } from '../db/settings';
import type { WeightUnit } from '../db/types';
import {
  BackupError,
  downloadText,
  exportBackup,
  exportHistoryCsv,
  parseBackup,
  resetDatabase,
  restoreBackup,
  summarizeBackup,
} from '../db/backup';
import { stopRest } from '../features/session/restTimer';
import { formatLongDate, toLocalDateString } from '../lib/format';
import { formatBytes, getStorageInfo, requestPersistentStorage } from '../lib/storage';

export function SettingsPage() {
  const settings = useSettings();
  const confirm = useConfirm();
  const backupInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [storage, setStorage] = useState<{ persisted: boolean | null; usageBytes?: number }>();

  const refreshStorage = () => void getStorageInfo().then(setStorage);
  useEffect(refreshStorage, []);

  const today = toLocalDateString();

  const onExportJson = async () => {
    const backup = await exportBackup();
    downloadText(`gym-tracker-respaldo-${today}.json`, JSON.stringify(backup, null, 1), 'application/json');
    setMessage({ kind: 'ok', text: 'Respaldo descargado. Guardalo en un lugar seguro (Drive, mail, etc.).' });
  };

  const onExportCsv = async () => {
    downloadText(`gym-tracker-historial-${today}.csv`, await exportHistoryCsv(), 'text/csv;charset=utf-8');
    setMessage({ kind: 'ok', text: 'Historial exportado en CSV.' });
  };

  const onImportJson = async (file: File | undefined) => {
    if (backupInput.current) backupInput.current.value = '';
    if (!file) return;
    setMessage(undefined);
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      const s = summarizeBackup(backup);
      const ok = await confirm({
        title: '¿Restaurar este respaldo?',
        message: (
          <>
            <p>
              Contiene {s.exercises} ejercicios, {s.routines} rutinas y {s.sessions} entrenamientos
              {s.firstDate && s.lastDate ? ` (del ${formatLongDate(s.firstDate)} al ${formatLongDate(s.lastDate)})` : ''}.
            </p>
            <p className="mt-2 font-semibold text-amber-300">Reemplaza todos los datos actuales de la app.</p>
          </>
        ),
        confirmLabel: 'Restaurar',
        danger: true,
      });
      if (!ok) return;
      await restoreBackup(backup);
      setMessage({ kind: 'ok', text: 'Respaldo restaurado.' });
    } catch (err) {
      console.error(err);
      setMessage({ kind: 'error', text: err instanceof BackupError ? err.message : 'No se pudo leer el archivo de respaldo.' });
    }
  };

  const onDeleteAll = async () => {
    const first = await confirm({
      title: '¿Borrar todos los datos?',
      message: 'Se eliminan tu historial, ejercicios y rutinas. La app vuelve a quedar como recién instalada.',
      confirmLabel: 'Continuar',
      danger: true,
    });
    if (!first) return;
    const second = await confirm({
      title: '¿Seguro? No se puede deshacer',
      message: 'Si no tenés un respaldo, vas a perder todo el historial. Te recomendamos exportar un respaldo antes.',
      confirmLabel: 'Borrar todo',
      cancelLabel: 'No, volver',
      danger: true,
    });
    if (!second) return;
    await stopRest();
    await resetDatabase();
    setMessage({ kind: 'ok', text: 'Se borraron todos los datos.' });
  };

  const onPersist = async () => {
    const granted = await requestPersistentStorage();
    refreshStorage();
    setMessage(
      granted
        ? { kind: 'ok', text: 'Listo: el navegador no va a borrar tus datos por falta de espacio.' }
        : { kind: 'error', text: 'El navegador no lo permitió todavía. Instalá la app en la pantalla de inicio y volvé a intentar.' },
    );
  };

  return (
    <>
      <PageHeader title="Ajustes" back />
      <input ref={backupInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImportJson(e.target.files?.[0])} />

      <div className="flex flex-col gap-6 p-4">
        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-xl p-3 ${message.kind === 'ok' ? 'bg-lime-950/70 text-lime-100' : 'bg-red-950/60 text-red-200'}`}
          >
            {message.text}
          </p>
        )}

        <Section title="Entrenamiento">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-400">Unidad para ejercicios nuevos</span>
            <Segmented<WeightUnit>
              label="Unidad"
              value={settings.unit}
              onChange={(unit) => updateSettings({ unit })}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
            <p className="text-sm text-neutral-500">Cada ejercicio guarda su propia unidad; podés cambiarla al editarlo.</p>
          </div>
          <NumberStepper
            label={`Incremento de peso (${settings.unit})`}
            decimal
            step={0.5}
            min={0.25}
            max={50}
            value={settings.weightIncrement}
            onChange={(v) => v !== undefined && updateSettings({ weightIncrement: v })}
          />
          <NumberStepper
            label="Descanso por defecto (segundos)"
            step={15}
            min={0}
            max={900}
            value={settings.defaultRestSeconds}
            onChange={(v) => v !== undefined && updateSettings({ defaultRestSeconds: v })}
          />
          <p className="-mt-2 text-sm text-neutral-500">Se usa cuando la rutina no define un descanso para el ejercicio.</p>
        </Section>

        <Section title="Respaldo e importación">
          <Button onClick={onExportJson}>Exportar respaldo (JSON)</Button>
          <Button onClick={() => backupInput.current?.click()}>Restaurar respaldo…</Button>
          <Button onClick={onExportCsv}>Exportar historial (CSV)</Button>
          <Link
            to="/ajustes/importar-planilla"
            className="flex min-h-12 items-center justify-between rounded-xl bg-neutral-800 px-4 font-semibold active:bg-neutral-700"
          >
            Importar planilla de Excel
            <ChevronIcon />
          </Link>
          <p className="text-sm text-neutral-500">
            Los datos viven solo en este dispositivo. Exportá un respaldo de vez en cuando por si cambiás o perdés el celular.
          </p>
        </Section>

        <Section title="Almacenamiento">
          <p className="text-neutral-300">
            {storage?.persisted
              ? '✓ Datos protegidos: el navegador no los borra por falta de espacio.'
              : storage?.persisted === false
                ? 'Los datos no están protegidos: el navegador podría borrarlos si se queda sin espacio.'
                : 'Este navegador no informa si los datos están protegidos.'}
            {storage?.usageBytes !== undefined && ` Espacio usado: ${formatBytes(storage.usageBytes)}.`}
          </p>
          {storage?.persisted === false && <Button onClick={onPersist}>Proteger mis datos</Button>}
        </Section>

        <Section title="Zona de peligro">
          <Button variant="danger" onClick={onDeleteAll}>
            Borrar todos los datos
          </Button>
        </Section>

        <p className="text-center text-xs text-neutral-600">Gym Tracker · versión {__APP_VERSION__}</p>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">{title}</h2>
      {children}
    </section>
  );
}
