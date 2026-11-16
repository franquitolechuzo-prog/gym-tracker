import type { GymDB } from './db';
import { DEFAULT_SETTINGS, type Exercise, type MuscleGroup, type Routine, type RoutineExercise } from './types';
import { newId } from '../lib/id';

interface SeedExercise {
  name: string;
  muscleGroup: MuscleGroup;
  equipment?: string;
  isBodyweight?: boolean;
}

export const SEED_EXERCISES: SeedExercise[] = [
  // Piernas
  { name: 'Squat machine', muscleGroup: 'Piernas', equipment: 'Máquina' },
  { name: 'Sentadilla', muscleGroup: 'Piernas', equipment: 'Barra' },
  { name: 'Peso muerto', muscleGroup: 'Piernas', equipment: 'Barra' },
  { name: 'Zancadas', muscleGroup: 'Piernas', equipment: 'Mancuernas' },
  { name: 'Extensiones de cuádriceps', muscleGroup: 'Piernas', equipment: 'Máquina' },
  { name: 'Curl femoral', muscleGroup: 'Piernas', equipment: 'Máquina' },
  { name: 'Prensa', muscleGroup: 'Piernas', equipment: 'Máquina' },
  { name: 'Stand calf raise', muscleGroup: 'Piernas', equipment: 'Máquina' },
  { name: 'Sit calf raise', muscleGroup: 'Piernas', equipment: 'Máquina' },
  { name: 'Calf raise unilateral', muscleGroup: 'Piernas', equipment: 'Mancuerna' },
  // Espalda
  { name: 'Dominadas', muscleGroup: 'Espalda', equipment: 'Barra fija', isBodyweight: true },
  { name: 'Remo en máquina', muscleGroup: 'Espalda', equipment: 'Máquina' },
  { name: 'Face pull', muscleGroup: 'Espalda', equipment: 'Polea' },
  { name: 'Extensiones de espalda', muscleGroup: 'Espalda', equipment: 'Banco' },
  { name: 'Jalón al pecho', muscleGroup: 'Espalda', equipment: 'Polea' },
  { name: 'Remo con barra', muscleGroup: 'Espalda', equipment: 'Barra' },
  // Pecho
  { name: 'Press plano', muscleGroup: 'Pecho', equipment: 'Barra' },
  { name: 'Press inclinado', muscleGroup: 'Pecho', equipment: 'Barra' },
  { name: 'Aperturas', muscleGroup: 'Pecho', equipment: 'Mancuernas' },
  { name: 'Fondos', muscleGroup: 'Pecho', equipment: 'Paralelas', isBodyweight: true },
  // Hombros
  { name: 'Elevaciones laterales en polea', muscleGroup: 'Hombros', equipment: 'Polea' },
  { name: 'Elevaciones laterales con mancuernas', muscleGroup: 'Hombros', equipment: 'Mancuernas' },
  { name: 'Press militar', muscleGroup: 'Hombros', equipment: 'Barra' },
  // Brazos
  { name: 'Curl inclinado', muscleGroup: 'Brazos', equipment: 'Mancuernas' },
  { name: 'Curl con barra', muscleGroup: 'Brazos', equipment: 'Barra' },
  { name: 'Skull crushers', muscleGroup: 'Brazos', equipment: 'Barra Z' },
  { name: 'Extensión de tríceps en polea', muscleGroup: 'Brazos', equipment: 'Polea' },
];

/** Compound lifts get a lower rep range and longer rest than isolation work. */
const COMPOUND = new Set([
  'Squat machine',
  'Sentadilla',
  'Peso muerto',
  'Zancadas',
  'Prensa',
  'Dominadas',
  'Remo en máquina',
  'Remo con barra',
  'Press plano',
  'Press inclinado',
  'Press militar',
  'Fondos',
]);

export const SEED_ROUTINES: { name: string; exercises: string[] }[] = [
  {
    name: 'Piernas A',
    exercises: ['Squat machine', 'Peso muerto', 'Extensiones de cuádriceps', 'Curl femoral', 'Stand calf raise'],
  },
  {
    name: 'Piernas B',
    exercises: ['Zancadas', 'Peso muerto', 'Extensiones de cuádriceps', 'Curl femoral', 'Stand calf raise'],
  },
  {
    name: 'Tirón',
    exercises: ['Dominadas', 'Remo en máquina', 'Face pull', 'Curl inclinado', 'Extensiones de espalda', 'Stand calf raise'],
  },
  {
    name: 'Empuje A',
    exercises: ['Press inclinado', 'Aperturas', 'Elevaciones laterales en polea', 'Fondos', 'Sit calf raise', 'Extensiones de espalda'],
  },
  {
    name: 'Empuje B',
    exercises: [
      'Press plano',
      'Aperturas',
      'Elevaciones laterales con mancuernas',
      'Skull crushers',
      'Calf raise unilateral',
      'Extensiones de espalda',
    ],
  },
];

const SEEDED_FLAG = 'seeded';

/**
 * Loads the default exercises, routines and settings the first time the app runs.
 * Idempotent: guarded by a flag so user deletions are never "re-seeded".
 */
export async function ensureSeeded(database: GymDB): Promise<boolean> {
  return database.transaction(
    'rw',
    [database.kv, database.exercises, database.routines, database.routineExercises],
    async () => {
      if (await database.kv.get(SEEDED_FLAG)) return false;

      const now = Date.now();
      const exercises: Exercise[] = SEED_EXERCISES.map((e, i) => ({
        id: newId(),
        name: e.name,
        muscleGroup: e.muscleGroup,
        equipment: e.equipment,
        unit: DEFAULT_SETTINGS.unit,
        isBodyweight: e.isBodyweight ?? false,
        archived: false,
        createdAt: now + i,
      }));
      const byName = new Map(exercises.map((e) => [e.name, e]));

      const routines: Routine[] = [];
      const routineExercises: RoutineExercise[] = [];
      SEED_ROUTINES.forEach((r, ri) => {
        const routine: Routine = { id: newId(), name: r.name, order: ri, createdAt: now + ri };
        routines.push(routine);
        r.exercises.forEach((name, order) => {
          const ex = byName.get(name);
          if (!ex) throw new Error(`Seed routine "${r.name}" references unknown exercise "${name}"`);
          const compound = COMPOUND.has(name);
          routineExercises.push({
            id: newId(),
            routineId: routine.id,
            exerciseId: ex.id,
            order,
            targetSets: 3,
            targetRepsMin: compound ? 6 : 10,
            targetRepsMax: compound ? 10 : 15,
            restSeconds: compound ? 150 : 90,
          });
        });
      });

      await database.exercises.bulkAdd(exercises);
      await database.routines.bulkAdd(routines);
      await database.routineExercises.bulkAdd(routineExercises);
      await database.kv.bulkPut([
        { key: 'settings', value: DEFAULT_SETTINGS },
        { key: SEEDED_FLAG, value: now },
      ]);
      return true;
    },
  );
}
