import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

/** Persisted in the kv table so the countdown survives reloads and app switches. */
interface RestTimerState {
  endsAt: number;
  duration: number;
  label?: string;
}

const KEY = 'restTimer';
let audioCtx: AudioContext | undefined;

/** Must be called from a user gesture so the audio context is allowed to play later. */
function primeAudio() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    // Audio not available; vibration only.
  }
}

function beep() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  for (const offset of [0, 0.25, 0.5]) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, t + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.2);
  }
}

function alertDone() {
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  beep();
}

export async function startRest(seconds: number, label?: string) {
  primeAudio();
  if (seconds <= 0) return stopRest();
  await db.kv.put({ key: KEY, value: { endsAt: Date.now() + seconds * 1000, duration: seconds, label } satisfies RestTimerState });
}

export async function adjustRest(deltaSeconds: number) {
  const row = await db.kv.get(KEY);
  const s = row?.value as RestTimerState | undefined;
  if (!s) return;
  const endsAt = Math.max(Date.now(), s.endsAt + deltaSeconds * 1000);
  await db.kv.put({ key: KEY, value: { ...s, endsAt, duration: Math.max(1, s.duration + deltaSeconds) } });
}

export async function stopRest() {
  await db.kv.delete(KEY);
}

/** Live countdown. `finished` stays true for a few seconds after reaching zero, then the timer clears itself. */
export function useRestTimer() {
  const state = useLiveQuery(async () => (await db.kv.get(KEY))?.value as RestTimerState | undefined, []);
  const [now, setNow] = useState(() => Date.now());
  const alerted = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    if (!state || now < state.endsAt) return;
    const overdue = now - state.endsAt;
    if (alerted.current !== state.endsAt) {
      alerted.current = state.endsAt;
      // Don't buzz for a timer that expired long ago (e.g. app reopened later).
      if (overdue < 10_000) alertDone();
    }
    if (overdue > 4_000) void stopRest();
  }, [now, state]);

  if (!state) return null;
  const remainingMs = Math.max(0, state.endsAt - now);
  return {
    remaining: Math.ceil(remainingMs / 1000),
    duration: state.duration,
    progress: 1 - remainingMs / (state.duration * 1000),
    finished: remainingMs === 0,
    label: state.label,
  };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
