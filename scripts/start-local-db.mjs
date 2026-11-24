// Starts a local PostgreSQL server for development using embedded-postgres.
// The database files live in .local-db/ (git-ignored) and survive restarts.
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const databaseDir = path.resolve('.local-db');
const port = Number(process.env.LOCAL_DB_PORT ?? 5433);
const user = 'postgres';
const password = 'postgres';
const database = 'exam_maker';

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user,
  password,
  persistent: true,
  autoRehydrateSymlinks: true,
  // Force UTF-8 so Bangla text can be stored regardless of the Windows locale.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: (message) => {
    if (/ready to accept connections|shutting down/i.test(message)) {
      process.stdout.write(message);
    }
  },
});

const alreadyInitialised = fs.existsSync(path.join(databaseDir, 'PG_VERSION'));

if (!alreadyInitialised) {
  console.log('Initialising local PostgreSQL cluster...');
  await pg.initialise();
}

console.log(`Starting local PostgreSQL on port ${port}...`);
await pg.start();

try {
  await pg.createDatabase(database);
  console.log(`Created database "${database}".`);
} catch (error) {
  if (!/already exists/i.test(String(error))) throw error;
  console.log(`Database "${database}" already exists.`);
}

console.log(`Local database ready: postgresql://${user}:${password}@localhost:${port}/${database}`);

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nStopping local PostgreSQL...');
  await pg.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Keep the process alive while the database is running.
setInterval(() => {}, 60_000);
