import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveSession } from '../db/sessions';
import { StartScreen } from '../features/session/StartScreen';
import { SessionView } from '../features/session/SessionView';

/** Shows the in-progress session if there is one (so closing the app never loses it), else the start screen. */
export function TrainPage() {
  // `null` once loaded with no active session; `undefined` while loading.
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, []);
  const [banner, setBanner] = useState<string>();

  if (active === undefined) return null;
  if (active) return <SessionView session={active} onFinished={setBanner} />;
  return <StartScreen banner={banner} onDismissBanner={() => setBanner(undefined)} />;
}
