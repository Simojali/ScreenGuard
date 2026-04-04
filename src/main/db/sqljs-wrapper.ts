/**
 * A synchronous-style wrapper around sql.js that mirrors the better-sqlite3 API.
 * sql.js is a WASM-based SQLite that requires no native compilation.
 */
import fs from 'fs'
import initSqlJs from 'sql.js'
import type { Database as SqlJsDatabase, SqlJsStatic, BindParams } from 'sql.js'

type Row = Record<string, unknown>

type RunResult = {
  lastInsertRowid: number
  changes: number
}

class PreparedStatement {
  constructor(
    private wrapper: DatabaseWrapper,
    private sql: string
  ) {}

  run(...params: unknown[]): RunResult {
    const p = flattenParams(params)
    this.wrapper._db.run(this.sql, p as BindParams)
    const ridRow = execOne(this.wrapper._db, 'SELECT last_insert_rowid() as r')
    const chgRow = execOne(this.wrapper._db, 'SELECT changes() as r')
    this.wrapper._dirty = true
    return {
      lastInsertRowid: (ridRow?.r as number) ?? 0,
      changes: (chgRow?.r as number) ?? 0
    }
  }

  all(...params: unknown[]): Row[] {
    return execAll(this.wrapper._db, this.sql, flattenParams(params) as BindParams)
  }

  get(...params: unknown[]): Row | undefined {
    return this.all(...params)[0]
  }
}

export class DatabaseWrapper {
  _db: SqlJsDatabase
  _dirty = false
  private filePath: string
  private saveTimer: NodeJS.Timeout | null = null

  constructor(db: SqlJsDatabase, filePath: string) {
    this._db = db
    this.filePath = filePath
    // Save to disk every 5 seconds when dirty
    this.saveTimer = setInterval(() => {
      if (this._dirty) this.save()
    }, 5000)
  }

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this, sql)
  }

  exec(sql: string): void {
    this._db.run(sql)
    this._dirty = true
    this.save()
  }

  pragma(stmt: string): void {
    this._db.run(`PRAGMA ${stmt}`)
  }

  save(): void {
    const data = this._db.export()
    fs.writeFileSync(this.filePath, Buffer.from(data))
    this._dirty = false
  }

  close(): void {
    if (this.saveTimer) clearInterval(this.saveTimer)
    this.save()
    this._db.close()
  }
}

function flattenParams(params: unknown[]): unknown[] {
  if (params.length === 1 && Array.isArray(params[0])) return params[0]
  return params
}

function execAll(db: SqlJsDatabase, sql: string, params: BindParams): Row[] {
  const stmt = db.prepare(sql, params)
  const rows: Row[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Row)
  }
  stmt.free()
  return rows
}

function execOne(db: SqlJsDatabase, sql: string): Row | undefined {
  return execAll(db, sql, [])[0]
}

// Module-level SQL.js instance (loaded once)
let SQL: SqlJsStatic | null = null

export async function loadSqlJs(wasmPath: string): Promise<void> {
  SQL = await initSqlJs({
    locateFile: () => wasmPath
  })
}

export function openDatabase(filePath: string): DatabaseWrapper {
  if (!SQL) throw new Error('sql.js not loaded. Call loadSqlJs() first.')
  let db: SqlJsDatabase
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath)
    db = new SQL.Database(data)
  } else {
    db = new SQL.Database()
  }
  return new DatabaseWrapper(db, filePath)
}
