import { afterEach } from 'vitest';
import { GymDB } from '../db/db';

let counter = 0;
const open: GymDB[] = [];

/** Creates an isolated in-memory database that is deleted after each test. */
export function createTestDb(): GymDB {
  const d = new GymDB(`test-${Date.now()}-${counter++}`);
  open.push(d);
  return d;
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((d) => d.delete()));
});
