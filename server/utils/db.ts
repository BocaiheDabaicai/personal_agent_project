import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as schema from '../db/schema'

type Db = BetterSQLite3Database<typeof schema>

function createDb(): Db {
  const dbPath = resolve(process.cwd(), 'data/app.db')
  mkdirSync(dirname(dbPath), { recursive: true })

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  return drizzle(sqlite, { schema })
}

const globalForDb = globalThis as typeof globalThis & {
  __personalAgentDb?: Db
}

export const db: Db = (globalForDb.__personalAgentDb ??= createDb())
