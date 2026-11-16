import { PageHeader } from '../components/Layout';

export function TrainPage() {
  return (
    <>
      <PageHeader title="Entrenar" />
      <div className="p-4">
        <button
          type="button"
          disabled
          className="min-h-20 w-full rounded-2xl bg-accent text-xl font-bold text-neutral-950 disabled:opacity-50"
        >
          Empezar entrenamiento
        </button>
        <p className="mt-3 text-center text-sm text-neutral-500">El registro de sesiones llega en la etapa 3.</p>
      </div>
    </>
  );
}
