#!/usr/bin/env node
// A Docker-free stand-in for `supabase start`, for containers that cannot pull Supabase's
// images. It runs the real pieces that matter for Questline:
//
//   Postgres 15+ (local binaries)  - the migrations, RLS and sync functions, for real
//   Supabase Auth (GoTrue binary)  - sign-up, sign-in, JWTs
//   PostgREST binary               - /rest/v1, the same RPC layer supabase-js talks to
//   Deno                           - the edge functions (functions-host.ts)
//   a small gateway                - Supabase's URL layout on one port (like Kong)
//
// Not included: Realtime (the client falls back to polling), Storage, Studio, email.
// Prefer `npx supabase start` where Docker images can be pulled.
//
// Usage: node supabase/tests/local-stack/start.mjs [--reset]
// Env:   STACK_DIR, PG_BIN_DIR, GOTRUE_BIN, POSTGREST_BIN, DENO_BIN, *_PORT (see below).
import { spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const env = process.env;

const STACK_DIR = env.STACK_DIR ?? '/var/tmp/questline-stack';
const PG_BIN = env.PG_BIN_DIR ?? '/usr/lib/postgresql/16/bin';
const GOTRUE_BIN = env.GOTRUE_BIN ?? 'gotrue';
const POSTGREST_BIN = env.POSTGREST_BIN ?? 'postgrest';
const DENO_BIN = env.DENO_BIN ?? 'deno';
const PORTS = {
  gateway: Number(env.GATEWAY_PORT ?? 54321),
  pg: Number(env.PG_PORT ?? 54322),
  auth: Number(env.AUTH_PORT ?? 54329),
  rest: Number(env.REST_PORT ?? 54330),
  functions: Number(env.FUNCTIONS_PORT ?? 54331),
};
// Same well-known development secret the Supabase CLI uses locally. Never use in production.
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
const API_URL = `http://localhost:${PORTS.gateway}`;
const SITE_URL = env.SITE_URL ?? 'http://localhost:4184';

function jwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${head}.${createHmac('sha256', JWT_SECRET).update(head).digest('base64url')}`;
}
const ANON_KEY = jwt({ iss: 'supabase-demo', role: 'anon', exp: 1983812996 });
const SERVICE_KEY = jwt({ iss: 'supabase-demo', role: 'service_role', exp: 1983812996 });

const isRoot = process.getuid?.() === 0;
function asPostgres(cmd, args) {
  return isRoot ? ['runuser', ['-u', 'postgres', '--', cmd, ...args]] : [cmd, args];
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
}
const pgUrl = `postgres://postgres@localhost:${PORTS.pg}/postgres`;
function psql(fileOrSql, { file = true } = {}) {
  run(join(PG_BIN, 'psql'), [
    pgUrl,
    '-v',
    'ON_ERROR_STOP=1',
    '-q',
    ...(file ? ['-f', fileOrSql] : ['-c', fileOrSql]),
  ]);
}
function psqlValue(sql) {
  const r = spawnSync(join(PG_BIN, 'psql'), [pgUrl, '-At', '-c', sql], { encoding: 'utf8' });
  return r.stdout.trim();
}

const children = [];
function start(name, cmd, args, extraEnv) {
  const child = spawn(cmd, args, {
    env: { ...env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = (d) =>
    String(d)
      .split('\n')
      .filter(Boolean)
      .forEach((l) => console.log(`[${name}] ${l}`));
  child.stdout.on('data', log);
  child.stderr.on('data', log);
  child.on('exit', (code) => console.log(`[${name}] exited (${code})`));
  children.push(child);
  return child;
}

async function waitFor(url, name) {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`${name} did not start (${url})`);
}

/* ---------------------------------------------------------------- Postgres */

const dataDir = join(STACK_DIR, 'pg');
if (process.argv.includes('--reset')) rmSync(STACK_DIR, { recursive: true, force: true });
mkdirSync(STACK_DIR, { recursive: true });
if (isRoot) run('chown', ['postgres', STACK_DIR]);
if (!existsSync(join(dataDir, 'PG_VERSION'))) {
  const [c, a] = asPostgres(join(PG_BIN, 'initdb'), [
    '-D',
    dataDir,
    '-U',
    'postgres',
    '--auth=trust',
    '-E',
    'UTF8',
  ]);
  run(c, a, { stdio: 'ignore' });
}
{
  const [c, a] = asPostgres(join(PG_BIN, 'pg_ctl'), [
    '-D',
    dataDir,
    '-l',
    join(STACK_DIR, 'pg.log'),
    '-o',
    `-p ${PORTS.pg} -k ${STACK_DIR} -c wal_level=logical -c timezone=UTC`,
    '-w',
    'start',
  ]);
  run(c, a);
}
psql(join(HERE, 'bootstrap.sql'));

/* ------------------------------------------------------------ Auth (GoTrue) */

const authEnv = {
  GOTRUE_DB_DRIVER: 'postgres',
  DATABASE_URL: `${pgUrl}?search_path=auth`,
  GOTRUE_DB_NAMESPACE: 'auth',
  GOTRUE_API_HOST: '127.0.0.1',
  PORT: String(PORTS.auth),
  API_EXTERNAL_URL: `${API_URL}/auth/v1`,
  GOTRUE_SITE_URL: SITE_URL,
  GOTRUE_URI_ALLOW_LIST: `${SITE_URL}/**,http://localhost:*/**`,
  GOTRUE_JWT_SECRET: JWT_SECRET,
  GOTRUE_JWT_EXP: '3600',
  GOTRUE_JWT_AUD: 'authenticated',
  GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
  GOTRUE_JWT_ADMIN_ROLES: 'service_role',
  GOTRUE_DISABLE_SIGNUP: 'false',
  GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
  // No mail server here: new accounts are confirmed at once.
  GOTRUE_MAILER_AUTOCONFIRM: 'true',
  GOTRUE_RATE_LIMIT_EMAIL_SENT: '1000',
  GOTRUE_LOG_LEVEL: 'warn',
};
run(GOTRUE_BIN, ['migrate'], { env: { ...env, ...authEnv }, stdio: 'ignore' });
psql(join(HERE, 'post-auth.sql'));

/* -------------------------------------------------------------- Migrations */

const migrationsDir = join(ROOT, 'supabase/migrations');
for (const name of readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  if (psqlValue(`select 1 from public.local_stack_migrations where name = '${name}'`) === '1')
    continue;
  console.log(`[migrate] ${name}`);
  psql(join(migrationsDir, name));
  psql(`insert into public.local_stack_migrations (name) values ('${name}')`, { file: false });
}
// PostgREST caches the schema; ask it to reload after migrations.
psql(`notify pgrst, 'reload schema'`, { file: false });

/* ------------------------------------------------------------------ Servers */

start('auth', GOTRUE_BIN, ['serve'], authEnv);
start('rest', POSTGREST_BIN, [], {
  PGRST_DB_URI: `postgres://authenticator:local-authenticator@localhost:${PORTS.pg}/postgres`,
  PGRST_DB_SCHEMAS: 'public',
  PGRST_DB_ANON_ROLE: 'anon',
  PGRST_JWT_SECRET: JWT_SECRET,
  PGRST_SERVER_PORT: String(PORTS.rest),
  PGRST_LOG_LEVEL: 'warn',
});
start(
  'functions',
  DENO_BIN,
  ['run', '--allow-net', '--allow-env', '--allow-read', join(HERE, 'functions-host.ts')],
  {
    PORT: String(PORTS.functions),
    SUPABASE_URL: API_URL,
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS ?? 'http://localhost:*',
    CRON_SECRET: env.CRON_SECRET ?? 'local-cron-secret',
  },
);

/* ------------------------------------------------------------------ Gateway */

const ROUTES = [
  ['/auth/v1', PORTS.auth],
  ['/rest/v1', PORTS.rest],
  ['/functions/v1', PORTS.functions],
];
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type, prefer, accept-profile, content-profile, range, x-supabase-api-version',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, x-supabase-api-version',
};
const gateway = http.createServer((req, res) => {
  const route = ROUTES.find(([p]) => req.url?.startsWith(p));
  // Functions answer CORS themselves (that is part of what is tested).
  if (req.method === 'OPTIONS' && route?.[0] !== '/functions/v1') {
    res.writeHead(204, CORS).end();
    return;
  }
  if (!route) {
    res.writeHead(404, CORS).end(JSON.stringify({ message: 'not available in the local stack' }));
    return;
  }
  const [prefix, port] = route;
  const path = prefix === '/functions/v1' ? req.url : req.url.slice(prefix.length) || '/';
  const upstream = http.request(
    { host: '127.0.0.1', port, path, method: req.method, headers: req.headers },
    (up) => {
      const headers = { ...up.headers };
      if (prefix !== '/functions/v1') Object.assign(headers, CORS);
      res.writeHead(up.statusCode ?? 502, headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (e) => {
    res.writeHead(502, CORS).end(JSON.stringify({ message: String(e) }));
  });
  req.pipe(upstream);
});
// Realtime websockets are not part of this stack; refuse them quietly.
gateway.on('upgrade', (_req, socket) => socket.destroy());
gateway.listen(PORTS.gateway);

await waitFor(`http://127.0.0.1:${PORTS.auth}/health`, 'auth');
await waitFor(`http://127.0.0.1:${PORTS.rest}/`, 'rest');
await waitFor(`http://127.0.0.1:${PORTS.functions}/`, 'functions');

const envFile = join(HERE, '.env.local');
writeFileSync(
  envFile,
  [
    `VITE_SUPABASE_URL=${API_URL}`,
    `VITE_SUPABASE_ANON_KEY=${ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}`,
    `DATABASE_URL=${pgUrl}`,
    `JWT_SECRET=${JWT_SECRET}`,
    '',
  ].join('\n'),
);
console.log(`\nLocal stack ready at ${API_URL} (database ${pgUrl}).`);
console.log(`Keys written to ${envFile}. Ctrl+C stops everything.\n`);
if (env.STACK_READY_FILE) writeFileSync(env.STACK_READY_FILE, readFileSync(envFile));

function shutdown() {
  for (const c of children) c.kill('SIGTERM');
  gateway.close();
  const [c, a] = asPostgres(join(PG_BIN, 'pg_ctl'), ['-D', dataDir, '-m', 'fast', 'stop']);
  spawnSync(c, a, { stdio: 'ignore' });
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
