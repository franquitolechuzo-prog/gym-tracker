import { useLiveQuery } from 'dexie-react-hooks';
import { db, type GymDB } from './db';
import { DEFAULT_SETTINGS, type Settings } from './types';

export async function getSettings(database: GymDB = db): Promise<Settings> {
  const row = await database.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>, database: GymDB = db): Promise<void> {
  const current = await getSettings(database);
  await database.kv.put({ key: 'settings', value: { ...current, ...patch } });
}

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS);
}
