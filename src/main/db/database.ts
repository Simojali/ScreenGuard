import path from 'path'
import { app } from 'electron'
import { loadSqlJs, openDatabase, DatabaseWrapper } from './sqljs-wrapper'
import { migrations } from './migrations'

let db: DatabaseWrapper | null = null

export async function initDatabase(): Promise<DatabaseWrapper> {
  // Locate the sql-wasm.wasm file bundled in node_modules
  const wasmPath = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm')
  await loadSqlJs(wasmPath)

  const dbPath = path.join(app.getPath('userData'), 'screentime.db')
  db = openDatabase(dbPath)

  runMigrations(db)
  return db
}

function runMigrations(database: DatabaseWrapper): void {
  // Ensure migration tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `)

  const applied = database
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all() as { version: number }[]

  const appliedVersions = new Set(applied.map((r) => r.version))

  for (let i = 0; i < migrations.length; i++) {
    const version = i + 1
    if (!appliedVersions.has(version)) {
      database.exec(migrations[i])
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(version, Date.now())
    }
  }
}

export function getDb(): DatabaseWrapper {
  if (!db) throw new Error('Database not initialized')
  return db
}
