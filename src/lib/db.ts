import { drizzle } from "drizzle-orm/netlify-db";

import * as schema from "../../db/schema";

// Netlify sets NETLIFY_DB_URL: `netlify dev` points it at a local Postgres,
// and deployed functions point it at the project's cloud database.
// Created on first use so `next build` works without a database.
let instance: ReturnType<typeof createDb> | undefined;

function createDb() {
  return drizzle({ schema });
}

export function getDb() {
  instance ??= createDb();
  return instance;
}

export { schema };
