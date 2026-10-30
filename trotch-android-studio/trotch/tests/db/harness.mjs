/**
 * In-process Postgres (PGlite + PostGIS) with a minimal Supabase-compatible shell
 * (auth schema, auth.uid(), anon/authenticated roles and default grants), so the real
 * migrations and seed can be applied and Row Level Security can be exercised in Jest.
 */
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPABASE_SHELL = `
create schema if not exists extensions;
create schema if not exists auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @param {{ seed?: boolean }} [options] @returns {Promise<PGlite>} */
export async function createTestDatabase(options = {}) {
  const db = await PGlite.create({ extensions: { postgis } });
  await db.exec(SUPABASE_SHELL);
  const dir = join(root, 'supabase', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  // Mirror Supabase: API roles can use objects in the extensions schema (PostGIS functions/types).
  await db.exec(`grant usage on schema extensions to anon, authenticated;`);
  if (options.seed !== false) {
    await db.exec(readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8'));
  }
  return db;
}

/** @param {PGlite} db @param {string} id */
export async function createUser(db, id, displayName = 'Test User') {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${id.slice(0, 8)}@example.test`,
    JSON.stringify({ display_name: displayName }),
  ]);
}

/** Run `fn` as an API caller: `null` = anonymous, otherwise an authenticated user id. */
/**
 * @template T
 * @param {PGlite} db @param {string | null} userId @param {() => Promise<T>} fn @returns {Promise<T>}
 */
export async function as(db, userId, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`);
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
