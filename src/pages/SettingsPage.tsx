import { PageHeader } from '../components/Layout';
import { useSettings } from '../db/settings';
import { formatWeight } from '../lib/format';

export function SettingsPage() {
  const settings = useSettings();
  return (
    <>
      <PageHeader title="Ajustes" />
      <dl className="divide-y divide-neutral-900">
        <Row label="Unidad" value={settings.unit} />
        <Row label="Incremento de peso" value={`${formatWeight(settings.weightIncrement)} ${settings.unit}`} />
        <Row label="Descanso por defecto" value={`${settings.defaultRestSeconds} s`} />
      </dl>
      <p className="p-4 text-sm text-neutral-500">La edición de ajustes y el respaldo de datos llegan en la etapa 5.</p>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between px-4">
      <dt className="text-neutral-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
